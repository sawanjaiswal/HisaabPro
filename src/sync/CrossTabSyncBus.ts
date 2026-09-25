/**
 * Cross-Tab Sync Event Bus (BroadcastChannel + Fallback)
 * Keeps all open browser tabs in perfect reactive sync.
 */

export interface CrossTabEvent {
  type: 'MUTATION_ENQUEUED' | 'SYNC_COMPLETED' | 'TENANT_CHANGED';
  businessId: string;
  entityType?: string;
  entityId?: string;
  timestamp: string;
}

type SyncEventListener = (event: CrossTabEvent) => void;

class CrossTabSyncBusImpl {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<SyncEventListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('hisaabpro_sync_bus');
      this.channel.onmessage = (msg: MessageEvent<CrossTabEvent>) => {
        this.emitLocal(msg.data);
      };
    }
  }

  public publish(event: Omit<CrossTabEvent, 'timestamp'>) {
    const fullEvent: CrossTabEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    if (this.channel) {
      try {
        this.channel.postMessage(fullEvent);
      } catch (err) {
        console.warn('[CrossTabSyncBus] Broadcast failed', err);
      }
    }

    this.emitLocal(fullEvent);
  }

  public subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitLocal(event: CrossTabEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[CrossTabSyncBus] Listener error', err);
      }
    }
  }
}

export const CrossTabSyncBus = new CrossTabSyncBusImpl();
