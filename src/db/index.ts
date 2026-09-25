import { db } from './schema';

export * from './schema';

/** Clears all cached tables upon logout */
export async function clearReadCache(): Promise<void> {
  try {
    await Promise.all([
      db.parties.clear(),
      db.products.clear(),
      db.documents.clear(),
      db.payments.clear(),
      db.syncQueue.clear(),
      db.syncMeta.clear(),
    ]);
  } catch (err) {
    console.warn('[db] Failed to clear local cache on logout', err);
  }
}
