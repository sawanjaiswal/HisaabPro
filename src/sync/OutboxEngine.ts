import { HisaabDatabase, SyncQueueItem } from '../db/schema';

export type CanonicalEntityType = 'PARTY' | 'PRODUCT' | 'DOCUMENT' | 'PAYMENT';
export type CanonicalOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export interface EnqueueOptions {
  businessId: string;
  entityType: CanonicalEntityType;
  entityId: string;
  operation: CanonicalOperation;
  payload?: any;
  baseVersion?: number;
  deviceId?: string;
}

interface HlcTimestamp {
  millis: number;
  counter: number;
  deviceId: string;
}

let lastHlc: HlcTimestamp = {
  millis: 0,
  counter: 0,
  deviceId: 'device_client',
};

function getNextHlc(deviceId = 'device_client'): string {
  const now = Date.now();
  if (now > lastHlc.millis) {
    lastHlc = { millis: now, counter: 0, deviceId };
  } else {
    lastHlc = { millis: lastHlc.millis, counter: lastHlc.counter + 1, deviceId };
  }
  return `${new Date(lastHlc.millis).toISOString()}_c${lastHlc.counter.toString().padStart(4, '0')}_${lastHlc.deviceId}`;
}

export class OutboxEngine {
  /**
   * Generates a deterministic, collision-resistant idempotency key
   */
  public static generateIdempotencyKey(
    businessId: string,
    entityType: string,
    entityId: string,
    operation: string,
    baseVersion: number = 0
  ): string {
    const cleanType = (entityType || '').toLowerCase().trim();
    const cleanOp = (operation || '').toLowerCase().trim();
    return `idemp_${(businessId || '').slice(0, 8)}_${cleanType}_${(entityId || '').slice(0, 12)}_${cleanOp}_v${baseVersion}`;
  }

  /**
   * Enqueues an offline mutation atomically into Dexie syncQueue
   */
  public static async enqueue(database: HisaabDatabase, options: EnqueueOptions): Promise<SyncQueueItem> {
    const hlcString = getNextHlc(options.deviceId || 'device_client');
    const nowIso = new Date().toISOString();
    const cleanType = (options.entityType || '').toUpperCase() as CanonicalEntityType;
    const cleanOp = (options.operation || '').toUpperCase() as CanonicalOperation;
    const baseVer = options.baseVersion ?? 0;

    const idempotencyKey = this.generateIdempotencyKey(
      options.businessId,
      options.entityType,
      options.entityId,
      options.operation,
      baseVer
    );

    const safePayload = options.payload ? JSON.parse(JSON.stringify(options.payload)) : {};

    const queueItem: SyncQueueItem = {
      id: crypto.randomUUID(),
      businessId: options.businessId,
      idempotencyKey,
      entityType: cleanType,
      entityId: options.entityId,
      operation: cleanOp,
      baseVersion: baseVer,
      payload: safePayload,
      hlcTimestamp: hlcString,
      status: 'PENDING',
      attempts: 0,
      lastError: null,
      createdAt: nowIso,
    };

    await database.syncQueue.put(queueItem);
    return queueItem;
  }
}
