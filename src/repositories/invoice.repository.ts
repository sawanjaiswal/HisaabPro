import { HisaabDatabase, LocalDocument, db as defaultDb } from '../db/schema';
import { OutboxEngine } from '../sync/OutboxEngine';
import { liveQueryBus } from '../domain/live-query-bus';
import { SyncManager } from '../sync/SyncManager';
import type { DocumentListResponse, DocumentFilters } from '../features/invoices/invoice.types';
import type { DocumentSummary } from '../features/invoices/invoice-document.types';

export class InvoiceRepository {
  constructor(
    private db: HisaabDatabase = defaultDb,
    private businessId: string = 'default'
  ) {}

  /**
   * 0ms Local-First Read: List documents / invoices instantly from Dexie
   */
  async list(filters: Partial<DocumentFilters> = {}): Promise<DocumentListResponse> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const search = (filters.search || '').trim().toLowerCase();
    const type = filters.type;

    let items = await this.db.documents
      .where('businessId')
      .equals(this.businessId)
      .toArray();

    items = items.filter((d) => !d.isDeleted);

    if (type) {
      items = items.filter((d) => d.type === type);
    }

    if (search) {
      items = items.filter(
        (d) =>
          (d.documentNumber || '').toLowerCase().includes(search) ||
          (d.partyName || '').toLowerCase().includes(search)
      );
    }

    items.sort((a, b) => (b.documentDate || b.updatedAt || '').localeCompare(a.documentDate || a.updatedAt || ''));

    let totalAmount = 0;
    let totalPaid = 0;
    let totalDue = 0;

    for (const d of items) {
      totalAmount += d.grandTotal || 0;
      totalPaid += d.paidAmount || 0;
      totalDue += d.balanceAmount || 0;
    }

    const total = items.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const pagedItems = items.slice(startIndex, startIndex + limit);

    const summaries: DocumentSummary[] = pagedItems.map((d) => ({
      id: d.id,
      documentNumber: d.documentNumber,
      type: (d.type || 'SALE_INVOICE') as any,
      status: (d.status || 'SAVED') as any,
      documentDate: d.documentDate,
      dueDate: d.dueDate || null,
      party: {
        id: d.partyId,
        name: d.partyName || 'Party',
        phone: '',
      },
      subtotal: d.grandTotal,
      totalDiscount: 0,
      totalAdditionalCharges: 0,
      roundOff: 0,
      grandTotal: d.grandTotal,
      totalProfit: 0,
      paidAmount: d.paidAmount,
      balanceDue: d.balanceAmount,
      lineItemCount: Array.isArray(d.lineItems) ? d.lineItems.length : 0,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));

    return {
      documents: summaries,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      summary: {
        totalAmount,
        totalPaid,
        totalDue,
      },
    };
  }

  /**
   * 0ms Local-First Read: Get a single document by ID
   */
  async getById(id: string): Promise<LocalDocument | null> {
    const doc = await this.db.documents.get(id);
    if (!doc || doc.businessId !== this.businessId || doc.isDeleted) return null;
    return doc;
  }

  /**
   * <1ms Optimistic Write: Create document locally + enqueue outbox
   */
  async create(data: {
    partyId: string;
    partyName?: string;
    type?: string;
    documentNumber?: string;
    documentDate?: string;
    dueDate?: string;
    grandTotal: number;
    paidAmount?: number;
    lineItems?: any[];
    notes?: string;
  }): Promise<LocalDocument> {
    const nowIso = new Date().toISOString();
    const tempId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `temp_doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const paid = data.paidAmount || 0;
    const balance = Math.max(0, data.grandTotal - paid);
    const count = await this.db.documents.where('businessId').equals(this.businessId).count();
    const docNumber = data.documentNumber || `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const newDoc: LocalDocument = {
      id: tempId,
      businessId: this.businessId,
      documentNumber: docNumber,
      type: data.type || 'SALE_INVOICE',
      status: balance === 0 ? 'PAID' : (paid > 0 ? 'PARTIALLY_PAID' : 'SAVED'),
      partyId: data.partyId,
      partyName: data.partyName,
      documentDate: data.documentDate || nowIso,
      dueDate: data.dueDate || null,
      grandTotal: data.grandTotal,
      paidAmount: paid,
      balanceAmount: balance,
      lineItems: data.lineItems || [],
      notes: data.notes || null,
      isDeleted: false,
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await this.db.transaction('rw', [this.db.documents, this.db.syncQueue], async () => {
      await this.db.documents.put(newDoc);
      await OutboxEngine.enqueueInTx(this.db, {
        businessId: this.businessId,
        entityType: 'DOCUMENT',
        entityId: tempId,
        operation: 'CREATE',
        payload: {
          ...data,
          id: tempId,
        },
        baseVersion: 0,
      });
    });

    liveQueryBus.invalidate(['invoices']);
    liveQueryBus.invalidate(['parties']);
    SyncManager.triggerSync();

    return newDoc;
  }

  /**
   * <1ms Optimistic Delete: Soft-delete document locally + enqueue outbox
   */
  async delete(id: string): Promise<void> {
    const existing = await this.db.documents.get(id);
    if (!existing || existing.businessId !== this.businessId) return;

    const nowIso = new Date().toISOString();
    const updated: LocalDocument = {
      ...existing,
      isDeleted: true,
      version: existing.version + 1,
      updatedAt: nowIso,
    };

    await this.db.transaction('rw', [this.db.documents, this.db.syncQueue], async () => {
      await this.db.documents.put(updated);
      await OutboxEngine.enqueueInTx(this.db, {
        businessId: this.businessId,
        entityType: 'DOCUMENT',
        entityId: id,
        operation: 'DELETE',
        payload: { id },
        baseVersion: existing.version,
      });
    });

    liveQueryBus.invalidate(['invoices']);
    liveQueryBus.invalidate(['parties']);
    SyncManager.triggerSync();
  }
}
