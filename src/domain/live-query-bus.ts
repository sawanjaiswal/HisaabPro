/**
 * HisaabPro Declarative Live Query Bus (SSOT)
 * Provides centralized hierarchical cache invalidation and reactive live query subscriptions.
 * Ported directly from VaahanPro.
 */

export type QueryKeySegment = string | number | boolean | null | undefined;
export type QueryKey = readonly QueryKeySegment[];

type InvalidationListener = (invalidatedKey: QueryKey) => void;

class LiveQueryBus {
  private listeners = new Set<{
    keyPattern: QueryKey;
    listener: InvalidationListener;
  }>();

  /**
   * Check if a subscription pattern matches the invalidated key.
   * e.g. pattern ['parties'] matches invalidatedKey ['parties'] and ['parties', 'p123']
   * e.g. pattern ['parties', 'p123'] matches invalidatedKey ['parties'] and ['parties', 'p123']
   */
  private matches(pattern: QueryKey, target: QueryKey): boolean {
    if (target.length === 0) return true; // Global invalidation matches everything
    const minLength = Math.min(pattern.length, target.length);
    for (let i = 0; i < minLength; i++) {
      if (pattern[i] !== target[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Subscribe a component or hook to changes matching a specific query key prefix.
   */
  subscribe(keyPattern: QueryKey, listener: InvalidationListener): () => void {
    const entry = { keyPattern, listener };
    this.listeners.add(entry);
    return () => {
      this.listeners.delete(entry);
    };
  }

  /**
   * Invalidate all queries matching the specified key pattern.
   */
  invalidate(key: QueryKey = []): void {
    this.listeners.forEach(({ keyPattern, listener }) => {
      if (this.matches(keyPattern, key)) {
        try {
          listener(key);
        } catch (err) {
          console.error('[LiveQueryBus] Error in invalidation listener:', err);
        }
      }
    });
  }

  /**
   * Invalidate everything (e.g. on business switch or sync completion)
   */
  invalidateAll(): void {
    this.invalidate([]);
  }
}

export const liveQueryBus = new LiveQueryBus();

// Global Window Event Bridge for backward-compatible background sync
if (typeof window !== 'undefined') {
  window.addEventListener('hisaabpro_data_changed', () => {
    liveQueryBus.invalidateAll();
  });
  window.addEventListener('online', () => {
    liveQueryBus.invalidateAll();
  });
}
