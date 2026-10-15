import { db } from '../db/schema';

export interface SyncChanges {
  parties?: any[];
  products?: any[];
  documents?: any[];
  payments?: any[];
}

function safeIsoDate(val: unknown, fallback?: string): string {
  if (typeof val === 'string' && val.length > 0) return val
  if (val instanceof Date && !isNaN(val.getTime())) return val.toISOString()
  if (val) {
    const d = new Date(val as any)
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  return fallback || new Date().toISOString()
}

/**
 * Hydrates locally stored Dexie tables with delta changes pulled from the server.
 * Operates at Level 6 local-first SSOT with 0ms read capability.
 */
export async function hydrateLocalEntities(changes: SyncChanges): Promise<void> {
  const { parties, products, documents, payments } = changes;

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
        createdAt: safeIsoDate(p.createdAt),
        updatedAt: safeIsoDate(p.updatedAt),
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
        createdAt: safeIsoDate(p.createdAt),
        updatedAt: safeIsoDate(p.updatedAt),
      }))
    );
  }

  const needsPartyMap = (Array.isArray(documents) && documents.length > 0) || (Array.isArray(payments) && payments.length > 0);
  const partyMap = new Map<string, string>();
  if (needsPartyMap) {
    const allParties = await db.parties.toArray();
    allParties.forEach((p) => partyMap.set(p.id, p.name));
  }

  if (Array.isArray(documents) && documents.length > 0) {
    await db.documents.bulkPut(
      documents.map((d: any) => ({
        id: d.id,
        businessId: d.businessId,
        documentNumber: d.documentNumber || '',
        type: d.type,
        status: d.status,
        partyId: d.partyId,
        partyName: d.partyName || d.party?.name || partyMap.get(d.partyId) || '',
        documentDate: safeIsoDate(d.documentDate),
        dueDate: d.dueDate ? safeIsoDate(d.dueDate) : null,
        grandTotal: d.grandTotal || 0,
        paidAmount: d.paidAmount || 0,
        balanceAmount: d.balanceDue ?? (d.balanceAmount ?? ((d.grandTotal || 0) - (d.paidAmount || 0))),
        lineItems: d.lineItems || d.items || [],
        notes: d.notes || null,
        isDeleted: d.isDeleted ?? false,
        version: d.version || 1,
        createdAt: safeIsoDate(d.createdAt),
        updatedAt: safeIsoDate(d.updatedAt),
      }))
    );
  }

  if (Array.isArray(payments) && payments.length > 0) {
    await db.payments.bulkPut(
      payments.map((p: any) => ({
        id: p.id,
        businessId: p.businessId,
        paymentNumber: p.paymentNumber || undefined,
        type: p.type,
        partyId: p.partyId,
        partyName: p.partyName || p.party?.name || partyMap.get(p.partyId) || '',
        amount: p.amount || 0,
        mode: p.mode,
        date: safeIsoDate(p.date),
        referenceNumber: p.referenceNumber || null,
        notes: p.notes || null,
        isDeleted: p.isDeleted ?? false,
        version: p.version || 1,
        createdAt: safeIsoDate(p.createdAt),
        updatedAt: safeIsoDate(p.updatedAt),
      }))
    );
  }
}
