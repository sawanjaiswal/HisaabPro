/**
 * Storage Sentinel — Requests persistent storage from browser
 * to prevent automatic eviction of IndexedDB on low-disk conditions.
 */

export async function initStorageSentinel(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        const granted = await navigator.storage.persist();
        console.log(`[StorageSentinel] Persistent storage granted: ${granted}`);
        return granted;
      }
      return isPersisted;
    } catch (err) {
      console.warn('[StorageSentinel] Failed to request persistent storage', err);
      return false;
    }
  }
  return false;
}
