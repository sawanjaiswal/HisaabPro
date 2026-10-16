import { HisaabDatabase, LocalDocument, db as defaultDb } from '../db/schema';
import { OutboxEngine } from '../sync/OutboxEngine';
import { liveQueryBus } from '../domain/live-query-bus';
import { SyncManager } from '../sync/SyncManager';
import type { DocumentListResponse, DocumentFilters } from '../features/invoices/invoice.types';
import { mapLocalDocToSummary } from './invoice.mapper';
import { getDocumentOutstandingDelta, getDocumentStockDelta } from './invoice.rules';
import { resolveCurrentBusinessId } from './repository.utils';

export class InvoiceRepository {
  constructor(
    private db: HisaabDatabase = defaultDb,
    private businessId: string = resolveCurrentBusinessId()
  ) {}

  /**
   * 0ms Local-First Read: List documents / invoices instantly from Dexie
   */
  async list(filters: Partial<DocumentFilters> = {}): Promise<DocumentListResponse> {
    const page = filters.page || 1, limit = filters.limit || 20;
    const search = (filters.search || '').trim().toLowerCase();
    const all = await this.db.documents.where('businessId').equals(this.businessId).toArray();
    let items = all.filter((d) => !d.isDeleted && (!filters.type || d.type === filters.type));
    if (search) {
      items = items.filter((d) => (d.documentNumber || '').toLowerCase().includes(search) || (d.partyName || '').toLowerCase().includes(search));
    }
    items.sort((a, b) => (b.documentDate || b.updatedAt || '').localeCompare(a.documentDate || a.updatedAt || ''));

    let totalAmount = 0, totalPaid = 0, totalDue = 0;
    for (const d of items) {
      totalAmount += d.grandTotal || 0;
      totalPaid += d.paidAmount || 0;
      totalDue += d.balanceAmount || 0;
    }
    const total = items.length;
    const paged = items.slice((page - 1) * limit, page * limit);
    return {
      documents: paged.map(mapLocalDocToSummary),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      summary: { totalAmount, totalPaid, totalDue },
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
    status?: string;
    documentNumber?: string;
    documentDate?: string;
    dueDate?: string;
    grandTotal: number;
    paidAmount?: number;
    balanceAmount?: number;
    lineItems?: any[];
    notes?: string;
    payment?: any;
  }): Promise<LocalDocument> {
    const nowIso = new Date().toISOString();
    const tempId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `temp_doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const paid = Number(data.paidAmount) || 0;
    const balance = data.balanceAmount !== undefined ? Number(data.balanceAmount) : Math.max(0, data.grandTotal - paid);
    const count = await this.db.documents.where('businessId').equals(this.businessId).count();
    const docNumber = data.documentNumber || `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    let partyName = data.partyName;
    if (!partyName && data.partyId) {
      const p = await this.db.parties.get(data.partyId);
      if (p) partyName = p.name;
    }

    const docStatus = data.status === 'DRAFT' ? 'DRAFT' : 'SAVED';

    const newDoc: LocalDocument = {
      id: tempId,
      businessId: this.businessId,
      documentNumber: docNumber,
      type: data.type || 'SALE_INVOICE',
      status: docStatus,
      partyId: data.partyId,
      partyName,
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

    await this.db.transaction('rw', [this.db.documents, this.db.parties, this.db.products, this.db.payments, this.db.syncQueue], async () => {
      await this.db.documents.put(newDoc);
      if (paid > 0 && newDoc.type === 'SALE_INVOICE') {
        const payTempId = `temp_pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await this.db.payments.put({
          id: payTempId,
          businessId: this.businessId,
          type: 'PAYMENT_IN',
          partyId: data.partyId,
          partyName,
          amount: paid,
          mode: data.payment?.mode || 'CASH',
          date: (data.documentDate || nowIso).split('T')[0],
          referenceNumber: data.payment?.referenceNumber || null,
          notes: `Payment for ${docNumber}`,
          isDeleted: false,
          version: 1,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
      if (data.partyId) {
        const delta = getDocumentOutstandingDelta(newDoc.type, balance);
        if (delta !== 0) {
          const party = await this.db.parties.get(data.partyId);
          if (party) {
            party.outstandingBalance = (party.outstandingBalance || 0) + delta;
            party.version = (party.version || 1) + 1;
            party.updatedAt = nowIso;
            await this.db.parties.put(party);
          }
        }
      }
      if (Array.isArray(data.lineItems) && data.lineItems.length > 0) {
        for (const item of data.lineItems) {
          if (item.productId && item.quantity) {
            const stockDelta = getDocumentStockDelta(newDoc.type, item.quantity);
            if (stockDelta !== 0) {
              const product = await this.db.products.get(item.productId);
              if (product) {
                product.currentStock = (product.currentStock || 0) + stockDelta;
                product.version = (product.version || 1) + 1;
                product.updatedAt = nowIso;
                await this.db.products.put(product);
              }
            }
          }
        }
      }
      await OutboxEngine.enqueueInTx(this.db, {
        businessId: this.businessId,
        entityType: 'DOCUMENT',
        entityId: tempId,
        operation: 'CREATE',
        payload: {
          ...data,
          id: tempId,
          documentNumber: docNumber,
          status: docStatus,
          grandTotal: data.grandTotal,
          paidAmount: paid,
          balanceDue: balance,
        },
        baseVersion: 0,
      });
    });

    ['invoices', 'parties', 'products', 'payments', 'dashboard'].forEach((k) => liveQueryBus.invalidate([k]));
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

    await this.db.transaction('rw', [this.db.documents, this.db.parties, this.db.products, this.db.syncQueue], async () => {
      await this.db.documents.put(updated);
      if (existing.partyId && existing.balanceAmount) {
        const delta = getDocumentOutstandingDelta(existing.type, existing.balanceAmount);
        if (delta !== 0) {
          const party = await this.db.parties.get(existing.partyId);
          if (party) {
            party.outstandingBalance = (party.outstandingBalance || 0) - delta;
            party.version = (party.version || 1) + 1;
            party.updatedAt = nowIso;
            await this.db.parties.put(party);
          }
        }
      }
      if (Array.isArray(existing.lineItems) && existing.lineItems.length > 0) {
        for (const item of existing.lineItems) {
          if (item.productId && item.quantity) {
            const stockDelta = getDocumentStockDelta(existing.type, item.quantity);
            if (stockDelta !== 0) {
              const product = await this.db.products.get(item.productId);
              if (product) {
                product.currentStock = (product.currentStock || 0) - stockDelta;
                product.version = (product.version || 1) + 1;
                product.updatedAt = nowIso;
                await this.db.products.put(product);
              }
            }
          }
        }
      }
      await OutboxEngine.enqueueInTx(this.db, {
        businessId: this.businessId,
        entityType: 'DOCUMENT',
        entityId: id,
        operation: 'DELETE',
        payload: { id },
        baseVersion: existing.version,
      });
    });

    ['invoices', 'parties', 'products', 'dashboard'].forEach((k) => liveQueryBus.invalidate([k]));
    SyncManager.triggerSync();
  }
}
