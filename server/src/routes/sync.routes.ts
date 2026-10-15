import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';
import { requireActiveBusiness } from '../middleware/require-active-business.js';
import { sendSuccess } from '../lib/response.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import logger from '../lib/logger.js';
import { processSyncMutation } from './sync.mutations.js';

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
    const userId = req.user!.userId;
    const { mutations } = syncPushSchema.parse(req.body);

    const sortedMutations = [...mutations].sort(
      (a, b) => (TOPOLOGICAL_ORDER[a.entityType] || 99) - (TOPOLOGICAL_ORDER[b.entityType] || 99)
    );

    const accepted: Array<{ id: string; entityId: string; newServerVersion: number }> = [];
    const rejected: Array<{ id: string; entityId: string; reason: string }> = [];

    for (const mutation of sortedMutations) {
      try {
        await prisma.$transaction(async (tx) => {
          await processSyncMutation(tx, businessId, userId, mutation);
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
        include: {
          lineItems: true,
          party: { select: { name: true } },
        },
      }),
      prisma.payment.findMany({
        where: { businessId, updatedAt: { gt: since } },
        include: {
          party: { select: { name: true } },
        },
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
