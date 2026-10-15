import { handleDocumentMutation, handlePaymentMutation } from './sync.mutations.doc.js';

export async function processSyncMutation(
  tx: any,
  businessId: string,
  userId: string,
  mutation: {
    idempotencyKey?: string;
    entityType: 'PARTY' | 'PRODUCT' | 'DOCUMENT' | 'PAYMENT';
    entityId: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    baseVersion: number;
    payload?: any;
  }
): Promise<void> {
  const { idempotencyKey, entityType, entityId, operation, payload } = mutation;

  if (idempotencyKey) {
    const scopedKey = `${businessId}:${idempotencyKey}`;
    const executed = await tx.idempotencyLog.findUnique({ where: { key: scopedKey } });
    if (executed) return;
  }

  if (entityType === 'PARTY') {
    await handlePartyMutation(tx, businessId, entityId, operation, payload);
  } else if (entityType === 'PRODUCT') {
    await handleProductMutation(tx, businessId, entityId, operation, payload);
  } else if (entityType === 'DOCUMENT') {
    await handleDocumentMutation(tx, businessId, userId, entityId, operation, payload);
  } else if (entityType === 'PAYMENT') {
    await handlePaymentMutation(tx, businessId, userId, entityId, operation, payload);
  }

  if (idempotencyKey) {
    const scopedKey = `${businessId}:${idempotencyKey}`;
    await tx.idempotencyLog.create({
      data: {
        key: scopedKey,
        userId,
        response: { status: 'ACCEPTED', entityId },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }
}

async function handlePartyMutation(tx: any, businessId: string, entityId: string, operation: string, payload: any) {
  if (operation === 'CREATE') {
    const existing = await tx.party.findFirst({ where: { id: entityId, businessId } });
    if (!existing) {
      const openingAmount = payload?.openingBalance
        ? (typeof payload.openingBalance === 'number'
            ? payload.openingBalance
            : payload.openingBalance.type === 'RECEIVABLE'
              ? payload.openingBalance.amount
              : -payload.openingBalance.amount)
        : 0;

      await tx.party.create({
        data: {
          id: entityId,
          businessId,
          name: payload?.name || 'Unnamed Party',
          phone: payload?.phone || null,
          email: payload?.email || null,
          type: payload?.type || 'CUSTOMER',
          companyName: payload?.companyName || null,
          gstin: payload?.gstin || null,
          pan: payload?.pan || null,
          creditLimit: payload?.creditLimit || 0,
          creditLimitMode: payload?.creditLimitMode || 'WARN',
          notes: payload?.notes || null,
          tags: Array.isArray(payload?.tags) ? payload.tags : [],
          outstandingBalance: openingAmount,
          version: 1,
        },
      });
    }
  } else if (operation === 'UPDATE') {
    await tx.party.updateMany({
      where: { id: entityId, businessId },
      data: {
        name: payload?.name,
        phone: payload?.phone,
        email: payload?.email,
        type: payload?.type,
        companyName: payload?.companyName,
        gstin: payload?.gstin,
        pan: payload?.pan,
        creditLimit: payload?.creditLimit,
        creditLimitMode: payload?.creditLimitMode,
        notes: payload?.notes,
        tags: Array.isArray(payload?.tags) ? payload.tags : undefined,
        version: { increment: 1 },
      },
    });
  } else if (operation === 'DELETE') {
    await tx.party.updateMany({
      where: { id: entityId, businessId },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }
}

async function handleProductMutation(tx: any, businessId: string, entityId: string, operation: string, payload: any) {
  if (operation === 'CREATE') {
    const existing = await tx.product.findFirst({ where: { id: entityId, businessId } });
    if (!existing) {
      const unit = await tx.unit.findFirst({ where: { businessId } });
      await tx.product.create({
        data: {
          id: entityId,
          businessId,
          name: payload?.name || 'Unnamed Product',
          sku: payload?.sku || null,
          unitId: payload?.unitId || unit?.id || 'default_unit',
          salePrice: payload?.salePrice || 0,
          purchasePrice: payload?.purchasePrice || 0,
          currentStock: payload?.openingStock || payload?.currentStock || 0,
          minStockLevel: payload?.minStockLevel || 0,
        },
      });
    }
  } else if (operation === 'UPDATE') {
    await tx.product.updateMany({
      where: { id: entityId, businessId },
      data: {
        name: payload?.name,
        salePrice: payload?.salePrice,
        purchasePrice: payload?.purchasePrice,
      },
    });
  } else if (operation === 'DELETE') {
    await tx.product.updateMany({
      where: { id: entityId, businessId },
      data: { isDeleted: true },
    });
  }
}
