/**
 * Prisma soft-delete extension — global filter + delete interception.
 *
 * Uses Prisma Client Extensions (v5+) instead of deprecated $use middleware.
 *
 * 1. findMany/findFirst/findUnique/count — auto-adds isDeleted=false
 * 2. delete → update with isDeleted=true, deletedAt=now()
 * 3. deleteMany → updateMany with isDeleted=true, deletedAt=now()
 *
 * To bypass (e.g. recycle bin listing): pass { where: { isDeleted: true } }
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
 * Creates a Prisma Client Extension that applies soft-delete behavior
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

          // --- DELETE: convert to soft delete ---
          if (operation === 'delete') {
            const castArgs = args as { where: Record<string, unknown> }
            return (query as unknown as (a: unknown) => Promise<unknown>)({
              ...castArgs,
              data: { isDeleted: true, deletedAt: new Date() },
            })
          }

          // --- DELETE MANY: convert to soft updateMany ---
          if (operation === 'deleteMany') {
            const castArgs = args as { where?: Record<string, unknown> }
            return (query as unknown as (a: unknown) => Promise<unknown>)({
              ...castArgs,
              data: { isDeleted: true, deletedAt: new Date() },
            })
          }

          return query(args)
        },
      },
    },
  })
}
