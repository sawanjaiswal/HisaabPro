import { db, SyncQueueItem } from '../db/schema';
import { NetworkDetector } from './NetworkDetector';
import { CrossTabSyncBus } from './CrossTabSyncBus';
import { api } from '../lib/api';

export type SyncStatus = 'IDLE' | 'SYNCING' | 'ERROR' | 'OFFLINE';

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}

type SyncStateListener = (state: SyncState) => void;

class SyncManagerImpl {
  private status: SyncStatus = 'IDLE';
  private pendingCount = 0;
  private lastSyncedAt: string | null = null;
  private lastError: string | null = null;
  private listeners: Set<SyncStateListener> = new Set();
  private isProcessing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Auto-trigger on network reconnect
      NetworkDetector.subscribe((isOnline) => {
        if (isOnline) {
          this.triggerSync();
        } else {
          this.setStatus('OFFLINE');
        }
      });

      // Update pending count whenever new mutations arrive
      CrossTabSyncBus.subscribe((event) => {
        if (event.type === 'MUTATION_ENQUEUED') {
          this.refreshPendingCount();
          this.triggerSync();
        }
      });

      // Periodic sync attempt every 30 seconds
      setInterval(() => {
        if (NetworkDetector.getStatus()) {
          this.triggerSync();
        }
      }, 30000);

      this.refreshPendingCount();
    }
  }

  public getState(): SyncState {
    return {
      status: this.status,
      pendingCount: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
    };
  }

  public subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async refreshPendingCount(): Promise<number> {
    try {
      const count = await db.syncQueue.where('status').equals('PENDING').count();
      this.pendingCount = count;
      this.notify();
      return count;
    } catch {
      return 0;
    }
  }

  public async triggerSync(): Promise<void> {
    if (this.isProcessing) return;
    if (!NetworkDetector.getStatus()) {
      this.setStatus('OFFLINE');
      return;
    }

    this.isProcessing = true;
    this.setStatus('SYNCING');

    try {
      // 1. Push Phase: Send pending mutations in batch
      const pendingItems: SyncQueueItem[] = await db.syncQueue
        .where('status')
        .equals('PENDING')
        .limit(50)
        .toArray();

      if (pendingItems.length > 0) {
        const payload = {
          deviceId: 'device_browser',
          mutations: pendingItems.map((item) => ({
            id: item.id,
            idempotencyKey: item.idempotencyKey,
            entityType: item.entityType,
            entityId: item.entityId,
            operation: item.operation,
            baseVersion: item.baseVersion,
            payload: item.payload,
          })),
        };

        const pushRes: any = await api('/sync/push', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        const acceptedIds = new Set((pushRes.accepted || []).map((a: any) => a.id));
        if (acceptedIds.size > 0) {
          // Remove accepted items from queue
          await db.syncQueue.bulkDelete(Array.from(acceptedIds) as string[]);
        }
      }

      // 2. Pull Phase: Fetch latest server updates
      const meta = await db.syncMeta.toCollection().first();
      const sinceParam = meta?.lastSyncTimestamp ? `?since=${encodeURIComponent(meta.lastSyncTimestamp)}` : '';

      const pullRes: any = await api(`/sync/pull${sinceParam}`, {
        method: 'GET',
      });

      if (pullRes?.changes) {
        // Hydrate local database
        const { parties, products } = pullRes.changes;

        if (Array.isArray(parties) && parties.length > 0) {
          await db.parties.bulkPut(
            parties.map((p: any) => ({
              id: p.id,
              businessId: p.businessId,
              name: p.name,
              phone: p.phone,
              type: p.type,
              companyName: p.companyName,
              gstin: p.gstin,
              pan: p.pan,
              outstandingBalance: p.outstandingBalance || 0,
              isActive: p.isActive ?? true,
              isDeleted: false,
              version: p.version || 1,
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
            }))
          );
        }

        if (Array.isArray(products) && products.length > 0) {
          await db.products.bulkPut(
            products.map((p: any) => ({
              id: p.id,
              businessId: p.businessId,
              name: p.name,
              sku: p.sku,
              unitId: p.unitId,
              currentStock: p.currentStock || 0,
              salePrice: p.salePrice || 0,
              purchasePrice: p.purchasePrice || 0,
              minStockLevel: p.minStockLevel || 0,
              isActive: p.isActive ?? true,
              isDeleted: p.isDeleted ?? false,
              version: p.version || 1,
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
            }))
          );
        }
      }

      // Update sync metadata
      const nowIso = new Date().toISOString();
      this.lastSyncedAt = nowIso;
      this.lastError = null;

      await db.syncMeta.put({
        id: 'meta_singleton',
        businessId: meta?.businessId || 'default',
        lastSyncTimestamp: pullRes?.serverTimestamp || nowIso,
        lastSyncStatus: 'SUCCESS',
        deviceId: 'device_browser',
        schemaVersion: 1,
        updatedAt: nowIso,
      });

      await this.refreshPendingCount();
      this.setStatus('IDLE');

      CrossTabSyncBus.publish({
        type: 'SYNC_COMPLETED',
        businessId: meta?.businessId || 'default',
      });
    } catch (err: any) {
      console.warn('[SyncManager] Sync failed:', err.message);
      this.lastError = err.message || 'Sync failed';
      this.setStatus('ERROR');
    } finally {
      this.isProcessing = false;
    }
  }

  private setStatus(status: SyncStatus) {
    this.status = status;
    this.notify();
  }

  private notify() {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('[SyncManager] Listener error', err);
      }
    }
  }
}

export const SyncManager = new SyncManagerImpl();
