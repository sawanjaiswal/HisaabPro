import { HisaabDatabase, LocalParty, db as defaultDb } from '../db/schema';
import { OutboxEngine } from '../sync/OutboxEngine';
import { liveQueryBus } from '../domain/live-query-bus';
import { SyncManager } from '../sync/SyncManager';
import type { PartyListResponse, PartySummary, PartyDetail, PartyFormData, PartyFilters } from '../features/parties/party.types';
import { resolveCurrentBusinessId } from './repository.utils';

function mapLocalPartyToDetail(p: LocalParty): PartyDetail {
  return {
    id: p.id, name: p.name, phone: p.phone || undefined, type: p.type as any,
    companyName: p.companyName || undefined, gstin: p.gstin || undefined, pan: p.pan || undefined,
    tags: [], creditLimit: 0, creditLimitMode: 'WARN', totalBusiness: 0,
    outstandingBalance: p.outstandingBalance, isActive: p.isActive,
    addresses: [], customFieldValues: [], pricing: [], createdAt: p.createdAt, updatedAt: p.updatedAt,
  };
}

export class PartyRepository {
  constructor(
    private db: HisaabDatabase = defaultDb,
    private businessId: string = resolveCurrentBusinessId()
  ) {}

  /** 0ms Local-First Read: Returns filtered & paginated party list instantly from Dexie. */
  async list(filters: Partial<PartyFilters> = {}): Promise<PartyListResponse> {
    const page = filters.page || 1, limit = filters.limit || 20;
    const search = (filters.search || '').trim().toLowerCase();
    const type = filters.type;

    let allParties = (await this.db.parties.toArray())
      .filter((p) => !p.isDeleted && (this.businessId === 'default' || p.businessId === 'default' || p.businessId === this.businessId));

    if (type && type !== 'ALL') allParties = allParties.filter((p) => p.type === type);
    if (search) {
      allParties = allParties.filter((p) =>
        (p.name || '').toLowerCase().includes(search) || (p.phone || '').includes(search) ||
        (p.companyName || '').toLowerCase().includes(search) || (p.gstin || '').toLowerCase().includes(search)
      );
    }

    allParties.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    let totalReceivable = 0, totalPayable = 0, customersCount = 0, suppliersCount = 0, bothCount = 0;
    for (const p of allParties) {
      if (p.outstandingBalance > 0) totalReceivable += p.outstandingBalance;
      else if (p.outstandingBalance < 0) totalPayable += Math.abs(p.outstandingBalance);
      if (p.type === 'CUSTOMER') customersCount++;
      else if (p.type === 'SUPPLIER') suppliersCount++;
      else if (p.type === 'BOTH') bothCount++;
    }

    const total = allParties.length, totalPages = Math.ceil(total / limit) || 1;
    const pagedParties = allParties.slice((page - 1) * limit, page * limit);
    const summaries: PartySummary[] = pagedParties.map((p) => ({
      id: p.id, name: p.name, phone: p.phone || undefined, type: p.type as any,
      companyName: p.companyName || undefined, gstin: p.gstin || undefined, pan: p.pan || undefined,
      tags: [], creditLimit: 0, outstandingBalance: p.outstandingBalance, isActive: p.isActive,
    }));

    return {
      parties: summaries,
      pagination: { page, limit, total, totalPages },
      summary: { totalReceivable, totalPayable, netOutstanding: totalReceivable - totalPayable, totalParties: total, customersCount, suppliersCount, bothCount },
    };
  }

  /** 0ms Local-First Read: Get a single party by ID */
  async getById(id: string): Promise<PartyDetail | null> {
    const p = await this.db.parties.get(id);
    if (!p || p.isDeleted) return null;
    if (this.businessId !== 'default' && p.businessId !== 'default' && p.businessId !== this.businessId) return null;
    return mapLocalPartyToDetail(p);
  }

  /** <1ms Optimistic Write: Creates party locally and enqueues to outbox */
  async create(data: PartyFormData): Promise<PartyDetail> {
    const nowIso = new Date().toISOString();
    const tempId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `temp_party_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const openingAmount = data.openingBalance?.amount
      ? (data.openingBalance.type === 'RECEIVABLE' ? data.openingBalance.amount : -data.openingBalance.amount)
      : 0;

    const newLocalParty: LocalParty = {
      id: tempId, businessId: this.businessId, name: data.name, phone: data.phone || null,
      type: data.type || 'CUSTOMER', companyName: data.companyName || null, gstin: data.gstin || null,
      pan: data.pan || null, outstandingBalance: openingAmount, isActive: true, isDeleted: false,
      version: 1, createdAt: nowIso, updatedAt: nowIso,
    };

    await this.db.transaction('rw', [this.db.parties, this.db.syncQueue], async () => {
      await this.db.parties.put(newLocalParty);
      await OutboxEngine.enqueueInTx(this.db, {
        businessId: this.businessId, entityType: 'PARTY', entityId: tempId, operation: 'CREATE',
        payload: { ...data, id: tempId }, baseVersion: 0,
      });
    });

    liveQueryBus.invalidate(['parties']);
    SyncManager.triggerSync();
    return mapLocalPartyToDetail(newLocalParty);
  }

  /** <1ms Optimistic Update: Updates party locally and enqueues to outbox */
  async update(id: string, data: Partial<PartyFormData>): Promise<PartyDetail | null> {
    const existing = await this.db.parties.get(id);
    if (!existing || (this.businessId !== 'default' && existing.businessId !== 'default' && existing.businessId !== this.businessId)) return null;

    const nowIso = new Date().toISOString();
    const updated: LocalParty = {
      ...existing, name: data.name ?? existing.name, phone: data.phone !== undefined ? data.phone : existing.phone,
      type: data.type ?? existing.type, companyName: data.companyName !== undefined ? data.companyName : existing.companyName,
      gstin: data.gstin !== undefined ? data.gstin : existing.gstin, pan: data.pan !== undefined ? data.pan : existing.pan,
      version: existing.version + 1, updatedAt: nowIso,
    };

    await this.db.transaction('rw', [this.db.parties, this.db.syncQueue], async () => {
      await this.db.parties.put(updated);
      await OutboxEngine.enqueueInTx(this.db, {
        businessId: this.businessId, entityType: 'PARTY', entityId: id, operation: 'UPDATE',
        payload: data, baseVersion: existing.version,
      });
    });

    liveQueryBus.invalidate(['parties']);
    liveQueryBus.invalidate(['parties', id]);
    SyncManager.triggerSync();
    return mapLocalPartyToDetail(updated);
  }

  /** <1ms Optimistic Delete: Soft-deletes party locally and enqueues to outbox */
  async delete(id: string): Promise<void> {
    const existing = await this.db.parties.get(id);
    if (!existing || (this.businessId !== 'default' && existing.businessId !== 'default' && existing.businessId !== this.businessId)) return;

    const nowIso = new Date().toISOString();
    const updated: LocalParty = { ...existing, isDeleted: true, version: existing.version + 1, updatedAt: nowIso };

    await this.db.transaction('rw', [this.db.parties, this.db.syncQueue], async () => {
      await this.db.parties.put(updated);
      await OutboxEngine.enqueueInTx(this.db, {
        businessId: this.businessId, entityType: 'PARTY', entityId: id, operation: 'DELETE',
        payload: { id }, baseVersion: existing.version,
      });
    });

    liveQueryBus.invalidate(['parties']);
    liveQueryBus.invalidate(['parties', id]);
    SyncManager.triggerSync();
  }

  /** Level 6 SSOT: Reconciles local temp party with authoritative server record */
  async reconcileServerCreated(tempId: string, party: PartyDetail): Promise<void> {
    await this.db.transaction('rw', [this.db.parties, this.db.syncQueue], async () => {
      if (tempId !== party.id) await this.db.parties.delete(tempId);
      await this.db.parties.put({
        id: party.id, businessId: this.businessId, name: party.name, phone: party.phone || null,
        type: party.type, companyName: party.companyName || null, gstin: party.gstin || null, pan: party.pan || null,
        outstandingBalance: party.outstandingBalance, isActive: party.isActive, isDeleted: false,
        version: party.version || 1, createdAt: party.createdAt || new Date().toISOString(), updatedAt: party.updatedAt || new Date().toISOString(),
      });
      await this.db.syncQueue.where('entityId').equals(tempId).delete();
    });
    liveQueryBus.invalidate(['parties']);
    liveQueryBus.invalidate(['parties', party.id]);
  }

  async reconcileServerUpdated(id: string, party: PartyDetail): Promise<void> {
    await this.db.transaction('rw', [this.db.parties, this.db.syncQueue], async () => {
      const existing = await this.db.parties.get(id);
      if (existing) {
        await this.db.parties.put({
          ...existing, name: party.name, phone: party.phone || null, type: party.type,
          companyName: party.companyName || null, gstin: party.gstin || null, pan: party.pan || null,
          outstandingBalance: party.outstandingBalance, version: party.version || existing.version + 1,
          updatedAt: party.updatedAt || new Date().toISOString(),
        });
      }
      await this.db.syncQueue.where('entityId').equals(id).delete();
    });
    liveQueryBus.invalidate(['parties']);
    liveQueryBus.invalidate(['parties', id]);
  }

  async reconcileServerDeleted(id: string): Promise<void> {
    await this.db.syncQueue.where('entityId').equals(id).delete();
  }
}
