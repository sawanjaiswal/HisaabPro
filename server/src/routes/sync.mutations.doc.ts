import { getOutstandingDelta, STOCK_DECREASE_TYPES, STOCK_INCREASE_TYPES } from '../services/document/helpers.js';
import { paymentTypeDirection } from '../lib/payment-types.js';

export async function handleDocumentMutation(
  tx: any,
  businessId: string,
  userId: string,
  entityId: string,
  operation: string,
  payload: any
): Promise<void> {
  if (operation === 'CREATE') {
    const existing = await tx.document.findFirst({ where: { id: entityId, businessId } });
    if (!existing) {
      const docType = payload?.type || 'SALE_INVOICE';
      const grandTotal = Math.round(Number(payload?.grandTotal ?? 0));
      const receivedPayment = payload?.payment?.amountReceived !== undefined
        ? Number(payload.payment.amountReceived)
        : (payload?.paidAmount !== undefined ? Number(payload.paidAmount) : 0);
      const paidAmount = Math.max(0, Math.round(receivedPayment));
      const balanceDue = payload?.balanceDue !== undefined
        ? Math.max(0, Math.round(Number(payload.balanceDue)))
        : Math.max(0, grandTotal - paidAmount);
      const lineItemsData = Array.isArray(payload?.lineItems)
        ? payload.lineItems
            .filter((it: any) => it.productId)
            .map((it: any, idx: number) => ({
              productId: it.productId,
              sortOrder: idx,
              quantity: Number(it.quantity) || 1,
              rate: Math.round(Number(it.rate ?? it.unitPrice ?? 0)),
              lineTotal: Math.round(Number(it.lineTotal ?? (Number(it.quantity || 1) * Number(it.rate ?? it.unitPrice ?? 0)))),
            }))
        : [];

      await tx.document.create({
        data: {
          id: entityId,
          businessId,
          type: docType,
          status: payload?.status || 'SAVED',
          documentNumber: payload?.documentNumber || null,
          partyId: payload?.partyId,
          documentDate: payload?.documentDate ? new Date(payload.documentDate) : new Date(),
          dueDate: payload?.dueDate ? new Date(payload.dueDate) : null,
          grandTotal,
          subtotal: payload?.subtotal ? Math.round(Number(payload.subtotal)) : grandTotal,
          paidAmount,
          balanceDue,
          notes: payload?.notes || null,
          createdBy: userId,
          ...(lineItemsData.length > 0 ? { lineItems: { create: lineItemsData } } : {}),
        },
      });

      if (payload?.partyId) {
        const delta = getOutstandingDelta(docType, grandTotal);
        if (delta !== 0) {
          await tx.party.update({
            where: { id: payload.partyId },
            data: {
              outstandingBalance: { increment: delta },
              totalBusiness: { increment: Math.abs(delta) },
              lastTransactionAt: new Date(),
            },
          });
        }

        if (paidAmount > 0 && docType === 'SALE_INVOICE') {
          const pCount = await tx.payment.count({ where: { businessId } });
          const payNumber = `PAY-${new Date().getFullYear()}-${String(pCount + 1).padStart(4, '0')}`;
          const paymentRecord = await tx.payment.create({
            data: {
              businessId,
              type: 'PAYMENT_IN',
              paymentNumber: payNumber,
              partyId: payload.partyId,
              amount: paidAmount,
              date: payload.documentDate ? new Date(payload.documentDate) : new Date(),
              mode: payload.payment?.mode || 'CASH',
              referenceNumber: payload.payment?.referenceNumber || null,
              notes: `Payment for ${payload.documentNumber || 'invoice'}`,
              createdBy: userId,
            },
          });
          const allocationAmt = Math.min(paidAmount, grandTotal);
          if (allocationAmt > 0) {
            await tx.paymentAllocation.create({
              data: {
                paymentId: paymentRecord.id,
                invoiceId: entityId,
                amount: allocationAmt,
              },
            });
          }
          await tx.party.update({
            where: { id: payload.partyId },
            data: { outstandingBalance: { decrement: paidAmount } },
          });
        }
      }

      if (lineItemsData.length > 0) {
        const isDecrease = STOCK_DECREASE_TYPES.has(docType);
        const isIncrease = STOCK_INCREASE_TYPES.has(docType);
        if (isDecrease || isIncrease) {
          for (const item of lineItemsData) {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                currentStock: isDecrease ? { decrement: item.quantity } : { increment: item.quantity },
              },
            });
          }
        }
      }
    }
  } else if (operation === 'UPDATE') {
    await tx.document.updateMany({
      where: { id: entityId, businessId },
      data: {
        status: payload?.status,
        notes: payload?.notes,
      },
    });
  } else if (operation === 'DELETE') {
    const existing = await tx.document.findFirst({
      where: { id: entityId, businessId },
      include: { lineItems: true },
    });
    if (existing && existing.status !== 'DELETED') {
      const delta = getOutstandingDelta(existing.type, existing.grandTotal);
      if (delta !== 0 && existing.partyId) {
        await tx.party.update({
          where: { id: existing.partyId },
          data: { outstandingBalance: { decrement: delta } },
        });
      }
      if (Array.isArray(existing.lineItems) && existing.lineItems.length > 0) {
        const wasDecreased = STOCK_DECREASE_TYPES.has(existing.type);
        const wasIncreased = STOCK_INCREASE_TYPES.has(existing.type);
        if (wasDecreased || wasIncreased) {
          for (const item of existing.lineItems) {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                currentStock: wasDecreased ? { increment: item.quantity } : { decrement: item.quantity },
              },
            });
          }
        }
      }
      await tx.document.update({
        where: { id: entityId },
        data: { status: 'DELETED', isDeleted: true, deletedAt: new Date() },
      });
    }
  }
}

export async function handlePaymentMutation(
  tx: any,
  businessId: string,
  userId: string,
  entityId: string,
  operation: string,
  payload: any
): Promise<void> {
  if (operation === 'CREATE') {
    const existing = await tx.payment.findFirst({ where: { id: entityId, businessId } });
    if (!existing) {
      const amount = payload?.amount || 0;
      const paymentType = payload?.type || 'PAYMENT_IN';

      await tx.payment.create({
        data: {
          id: entityId,
          businessId,
          type: paymentType,
          partyId: payload?.partyId,
          amount,
          date: payload?.date ? new Date(payload.date) : new Date(),
          mode: payload?.mode || 'CASH',
          referenceNumber: payload?.referenceNumber || null,
          notes: payload?.notes || null,
          createdBy: userId,
        },
      });

      if (payload?.partyId) {
        const dir = paymentTypeDirection(paymentType);
        const delta = dir * amount;
        if (delta !== 0) {
          await tx.party.update({
            where: { id: payload.partyId },
            data: {
              outstandingBalance: { increment: delta },
              lastTransactionAt: new Date(),
            },
          });
        }
      }
    }
  } else if (operation === 'DELETE') {
    const existing = await tx.payment.findFirst({ where: { id: entityId, businessId } });
    if (existing && !existing.isDeleted) {
      if (existing.partyId) {
        const dir = paymentTypeDirection(existing.type as any);
        const delta = dir * existing.amount;
        if (delta !== 0) {
          await tx.party.update({
            where: { id: existing.partyId },
            data: { outstandingBalance: { decrement: delta } },
          });
        }
      }
      await tx.payment.update({
        where: { id: entityId },
        data: { isDeleted: true, deletedAt: new Date() },
      });
    }
  }
}
