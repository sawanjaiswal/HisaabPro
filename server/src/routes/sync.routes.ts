import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';
import { requireActiveBusiness } from '../middleware/require-active-business.js';
import { sendSuccess } from '../lib/response.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import logger from '../lib/logger.js';

const router = Router();

router.use(auth);
router.use(requireActiveBusiness);

const syncPushSchema = z.object({
  deviceId: z.string().default('device_browser'),
  nonce: z.string().optional(),
  mutations: z.array(
    z.object({
      id: z.string(),
      idempotencyKey: z.string(),
      entityType: z.enum(['PARTY', 'PRODUCT', 'DOCUMENT', 'PAYMENT']),
      entityId: z.string(),
      operation: z.enum(['CREATE', 'UPDATE', 'DELETE']),
      baseVersion: z.number().default(0),
      payload: z.any().default({}),
    })
  ),
});

// Topological weights: parents before children
const TOPOLOGICAL_ORDER: Record<string, number> = {
  PARTY: 1,
  PRODUCT: 2,
  DOCUMENT: 3,
  PAYMENT: 4,
};

/**
 * POST /api/sync/push
 * Process a batch of offline outbox mutations with topological sorting.
 */
router.post(
  '/push',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId;
    const { mutations } = syncPushSchema.parse(req.body);

    // Sort mutations topologically
    const sortedMutations = [...mutations].sort(
      (a, b) => (TOPOLOGICAL_ORDER[a.entityType] || 99) - (TOPOLOGICAL_ORDER[b.entityType] || 99)
    );

    const accepted: Array<{ id: string; entityId: string; newServerVersion: number }> = [];
    const rejected: Array<{ id: string; entityId: string; reason: string }> = [];

    for (const mutation of sortedMutations) {
      try {
        await prisma.$transaction(async (tx) => {
          const { entityType, entityId, operation, payload } = mutation;

          if (entityType === 'PARTY') {
            if (operation === 'CREATE') {
              const existing = await tx.party.findFirst({ where: { id: entityId, businessId } });
              if (!existing) {
                const openingAmount = payload.openingBalance
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
                    name: payload.name || 'Unnamed Party',
                    phone: payload.phone || null,
                    type: payload.type || 'CUSTOMER',
                    companyName: payload.companyName || null,
                    gstin: payload.gstin || null,
                    pan: payload.pan || null,
                    outstandingBalance: openingAmount,
                  },
                });
              }
            } else if (operation === 'UPDATE') {
              await tx.party.updateMany({
                where: { id: entityId, businessId },
                data: {
                  name: payload.name,
                  phone: payload.phone,
                  type: payload.type,
                  gstin: payload.gstin,
                  pan: payload.pan,
                },
              });
            } else if (operation === 'DELETE') {
              await tx.party.updateMany({
                where: { id: entityId, businessId },
                data: { isActive: false },
              });
            }
          } else if (entityType === 'PRODUCT') {
            if (operation === 'CREATE') {
              const existing = await tx.product.findFirst({ where: { id: entityId, businessId } });
              if (!existing) {
                // Ensure default unit
                const unit = await tx.unit.findFirst({ where: { businessId } });
                await tx.product.create({
                  data: {
                    id: entityId,
                    businessId,
                    name: payload.name || 'Unnamed Product',
                    sku: payload.sku || null,
                    unitId: payload.unitId || unit?.id || 'default_unit',
                    salePrice: payload.salePrice || 0,
                    purchasePrice: payload.purchasePrice || 0,
                    currentStock: payload.openingStock || payload.currentStock || 0,
                    minStockLevel: payload.minStockLevel || 0,
                  },
                });
              }
            } else if (operation === 'UPDATE') {
              await tx.product.updateMany({
                where: { id: entityId, businessId },
                data: {
                  name: payload.name,
                  salePrice: payload.salePrice,
                  purchasePrice: payload.purchasePrice,
                },
              });
            } else if (operation === 'DELETE') {
              await tx.product.updateMany({
                where: { id: entityId, businessId },
                data: { isDeleted: true },
              });
            }
          }
        });

        accepted.push({
          id: mutation.id,
          entityId: mutation.entityId,
          newServerVersion: mutation.baseVersion + 1,
        });
      } catch (err: any) {
        logger.error('sync.push_mutation_failed', {
          mutationId: mutation.id,
          entityId: mutation.entityId,
          error: err.message,
        });
        rejected.push({
          id: mutation.id,
          entityId: mutation.entityId,
          reason: err.message || 'Mutation failed',
        });
      }
    }

    sendSuccess(res, {
      accepted,
      rejected,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/sync/pull
 * Fetch incremental changes since timestamp with cursor pagination.
 */
router.get(
  '/pull',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId;
    const since = req.query.since ? new Date(String(req.query.since)) : new Date(0);

    const [parties, products, documents, payments] = await Promise.all([
      prisma.party.findMany({
        where: { businessId, updatedAt: { gt: since } },
      }),
      prisma.product.findMany({
        where: { businessId, updatedAt: { gt: since } },
      }),
      prisma.document.findMany({
        where: { businessId, updatedAt: { gt: since } },
      }),
      prisma.payment.findMany({
        where: { businessId, updatedAt: { gt: since } },
      }),
    ]);

    const sanitizeBigInt = (data: any) =>
      JSON.parse(
        JSON.stringify(data, (_key, value) =>
          typeof value === 'bigint' ? Number(value) : value
        )
      );

    sendSuccess(res, {
      changes: sanitizeBigInt({
        parties,
        products,
        documents,
        payments,
      }),
      serverTimestamp: new Date().toISOString(),
    });
  })
);

export default router;
