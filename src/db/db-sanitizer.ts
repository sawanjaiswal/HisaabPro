/**
 * HisaabPro IndexedDB Startup Sanitizer & Cleaner (Ported from VaahanPro)
 * Runs automatically on startup to ensure all existing records in the browser IndexedDB
 * have guaranteed non-null array properties and valid numeric fields.
 */

import { HisaabDatabase } from './schema';

/**
 * Automatically sweeps and deletes legacy orphaned IndexedDB databases from prior iterations.
 */
export async function sweepLegacyIndexedDatabases(): Promise<void> {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') {
    return;
  }
  try {
    const dbs = await indexedDB.databases();
    for (const dbInfo of dbs) {
      const name = dbInfo.name;
      if (!name) continue;
      const isLegacy =
        name === 'hisaabpro-api-cache' ||
        name === 'hisaabpro-offline' ||
        name === 'hisaabpro_cache_v1';
      if (isLegacy) {
        try {
          indexedDB.deleteDatabase(name);
          console.info(`[HisaabPro DB Sanitizer] Cleaned legacy database: ${name}`);
        } catch (err) {
          console.warn(`[HisaabPro DB Sanitizer] Could not delete legacy database ${name}:`, err);
        }
      }
    }
  } catch (err) {
    console.warn('[HisaabPro DB Sanitizer] indexedDB.databases sweep note:', err);
  }
}

export async function sanitizeAndMigrateLocalDB(db: HisaabDatabase): Promise<void> {
  try {
    await sweepLegacyIndexedDatabases();

    // Sanitize Parties
    if (db.parties) {
      await db.parties.toCollection().modify((p: any) => {
        if (typeof p.outstandingBalance !== 'number') {
          p.outstandingBalance = 0;
        }
        if (p.isDeleted === undefined) {
          p.isDeleted = false;
        }
        if (p.isActive === undefined) {
          p.isActive = true;
        }
      });
    }

    // Sanitize Products
    if (db.products) {
      await db.products.toCollection().modify((prod: any) => {
        if (typeof prod.currentStock !== 'number') {
          prod.currentStock = 0;
        }
        if (typeof prod.salePrice !== 'number') {
          prod.salePrice = 0;
        }
        if (prod.isDeleted === undefined) {
          prod.isDeleted = false;
        }
      });
    }

    // Sanitize Documents
    if (db.documents) {
      await db.documents.toCollection().modify((d: any) => {
        if (!Array.isArray(d.lineItems)) {
          d.lineItems = [];
        }
        if (typeof d.grandTotal !== 'number') {
          d.grandTotal = 0;
        }
        if (typeof d.paidAmount !== 'number') {
          d.paidAmount = 0;
        }
        if (typeof d.balanceAmount !== 'number') {
          d.balanceAmount = 0;
        }
        if (d.isDeleted === undefined) {
          d.isDeleted = false;
        }
      });
    }
  } catch (err) {
    console.warn('[HisaabPro DB Sanitizer] DB sanitization completed with warnings:', err);
  }
}
