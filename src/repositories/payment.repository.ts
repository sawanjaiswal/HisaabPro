import { HisaabDatabase, LocalPayment, db as defaultDb } from '../db/schema';
import { OutboxEngine } from '../sync/OutboxEngine';
import { liveQueryBus } from '../domain/live-query-bus';
import { SyncManager } from '../sync/SyncManager';
import type { PaymentListResponse, PaymentFilters, PaymentFormData } from '../features/payments/payment.types';
import type { PaymentSummary } from '../features/payments/payment-models.types';

import { resolveCurrentBusinessId } from './repository.utils';

export class PaymentRepository {
  constructor(
    private db: HisaabDatabase = defaultDb,
    private businessId: string = resolveCurrentBusinessId()
  ) {}

  /**
   * 0ms Local-First Read: List payments instantly from Dexie
   */
  async list(filters: Partial<PaymentFilters> = {}): Promise<PaymentListResponse> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const search = (filters.search || '').trim().toLowerCase();
    const type = filters.type;

    let items = await this.db.payments
      .where('businessId')
      .equals(this.businessId)
      .toArray();

    items = items.filter((p) => !p.isDeleted);

    if (type) {
      items = items.filter((p) => p.type === type);
    }

    if (search) {
      items = items.filter(
        (p) =>
          (p.partyName || '').toLowerCase().includes(search) ||
          (p.referenceNumber || '').toLowerCase().includes(search)
      );
    }

    items.sort((a, b) => (b.date || b.updatedAt || '').localeCompare(a.date || a.updatedAt || ''));

    let totalIn = 0;
    let totalOut = 0;

    for (const p of items) {
      if (p.type === 'PAYMENT_IN' || p.type === 'IN') {
        totalIn += p.amount || 0;
      } else {
        totalOut += p.amount || 0;
      }
    }

    const total = items.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const pagedItems = items.slice(startIndex, startIndex + limit);

    const summaries: PaymentSummary[] = pagedItems.map((p) => ({
      id: p.id,
      type: (p.type === 'IN' || p.type === 'PAYMENT_IN' ? 'PAYMENT_IN' : 'PAYMENT_OUT') as any,
      partyId: p.partyId,
      partyName: p.partyName || 'Party',
      amount: p.amount,
      date: p.date,
      mode: (p.mode || 'CASH') as any,
      referenceNumber: p.referenceNumber || null,
      notes: p.notes || null,
      allocationsCount: 0,
      hasDiscount: false,
      discountAmount: 0,
      unallocatedAmount: 0,
      createdAt: p.createdAt,
    }));

    return {
      payments: summaries,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      summary: {
        totalIn,
        totalOut,
        net: totalIn - totalOut,
      },
    };
  }

  /**
   * 0ms Local-First Read: Get a single payment by ID
   */
  async getById(id: string): Promise<LocalPayment | null> {
    const p = await this.db.payments.get(id);
    if (!p || p.businessId !== this.businessId || p.isDeleted) return null;
    return p;
  }

  /**
   * <1ms Optimistic Write: Create payment locally + enqueue outbox
   */
  async create(data: PaymentFormData): Promise<LocalPayment> {
    const nowIso = new Date().toISOString();
    const tempId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `temp_pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let partyName = (data as any).partyName;
    if (!partyName && data.partyId) {
      const p = await this.db.parties.get(data.partyId);
      if (p) partyName = p.name;
    }

    const newPayment: LocalPayment = {
      id: tempId,
      businessId: this.businessId,
      type: data.type || 'PAYMENT_IN',
      partyId: data.partyId,
      partyName,
      amount: data.amount,
      mode: data.mode || 'CASH',
      date: data.date || nowIso.split('T')[0],
      referenceNumber: data.referenceNumber || null,
      notes: data.notes || null,
      isDeleted: false,
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await this.db.transaction('rw', [this.db.payments, this.db.parties, this.db.syncQueue], async () => {
      await this.db.payments.put(newPayment);
      if (data.partyId) {
        const party = await this.db.parties.get(data.partyId);
        if (party) {
          const isOut = data.type === 'PAYMENT_OUT' || data.type === 'PAYROLL_OUT';
          const delta = isOut ? data.amount : -data.amount;
          party.outstandingBalance = (party.outstandingBalance || 0) + delta;
          party.version = (party.version || 1) + 1;
          party.updatedAt = nowIso;
          await this.db.parties.put(party);
        }
      }
      await OutboxEngine.enqueueInTx(this.db, {
        businessId: this.businessId,
        entityType: 'PAYMENT',
        entityId: tempId,
        operation: 'CREATE',
        payload: {
          ...data,
          id: tempId,
        },
        baseVersion: 0,
      });
    });

    liveQueryBus.invalidate(['payments']);
    liveQueryBus.invalidate(['parties']);
    liveQueryBus.invalidate(['invoices']);
    SyncManager.triggerSync();

    return newPayment;
  }

  /**
   * <1ms Optimistic Delete: Soft-delete payment locally + enqueue outbox
   */
  async delete(id: string): Promise<void> {
    const existing = await this.db.payments.get(id);
    if (!existing || existing.businessId !== this.businessId) return;

    const nowIso = new Date().toISOString();
    const updated: LocalPayment = {
      ...existing,
      isDeleted: true,
      version: existing.version + 1,
      updatedAt: nowIso,
    };

    await this.db.transaction('rw', [this.db.payments, this.db.parties, this.db.syncQueue], async () => {
      await this.db.payments.put(updated);
      if (existing.partyId && existing.amount) {
        const party = await this.db.parties.get(existing.partyId);
        if (party) {
          const isOut = existing.type === 'PAYMENT_OUT' || existing.type === 'PAYROLL_OUT';
          const delta = isOut ? -existing.amount : existing.amount;
          party.outstandingBalance = (party.outstandingBalance || 0) + delta;
          party.version = (party.version || 1) + 1;
          party.updatedAt = nowIso;
          await this.db.parties.put(party);
        }
      }
      await OutboxEngine.enqueueInTx(this.db, {
        businessId: this.businessId,
        entityType: 'PAYMENT',
        entityId: id,
        operation: 'DELETE',
        payload: { id },
        baseVersion: existing.version,
      });
    });

    liveQueryBus.invalidate(['payments']);
    liveQueryBus.invalidate(['parties']);
    liveQueryBus.invalidate(['invoices']);
    SyncManager.triggerSync();
  }
}
