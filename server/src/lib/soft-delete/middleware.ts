/**
 * Prisma soft-delete extension — global read filter.
 *
 * Uses Prisma Client Extensions (v5+) instead of deprecated $use middleware.
 *
 * READ operations: auto-adds isDeleted=false to findMany/findFirst/findUnique/count etc.
 *
 * DELETE operations: Services must explicitly call .update() with
 * { isDeleted: true, deletedAt: new Date() } instead of .delete().
 * Prisma's query extensions cannot reliably change the operation type
 * (delete → update), especially inside $transaction contexts.
 *
 * To bypass read filter (e.g. recycle bin listing): pass { where: { isDeleted: true } }
 * explicitly — the extension respects explicit isDeleted values.
 */

import { Prisma } from '@prisma/client'
import { SOFT_DELETE_MODELS } from './models.js'

const softDeleteSet = new Set<string>(SOFT_DELETE_MODELS)

/** Actions that read data and should auto-filter deleted records */
const READ_ACTIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
])

/**
 * Creates a Prisma Client Extension that applies soft-delete read filtering
 * to all models in SOFT_DELETE_MODELS.
 */
export function createSoftDeleteExtension() {
  return Prisma.defineExtension({
    name: 'soft-delete',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !softDeleteSet.has(model)) {
            return query(args)
          }

          // --- READ: auto-filter deleted records ---
          if (READ_ACTIONS.has(operation)) {
            const where = (args as { where?: Record<string, unknown> }).where ?? {}
            // Only inject if caller did NOT explicitly set isDeleted
            if (where.isDeleted === undefined) {
              ;(args as { where: Record<string, unknown> }).where = {
                ...where,
                isDeleted: false,
              }
            }
            return query(args)
          }

          return query(args)
        },
      },
    },
  })
}
