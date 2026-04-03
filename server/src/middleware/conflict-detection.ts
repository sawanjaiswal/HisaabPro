/**
 * Offline conflict detection middleware.
 * Compares client's `X-Updated-At` header with server record's updatedAt.
 * Returns 409 Conflict if server version is newer (someone else edited while client was offline).
 */

import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.js'

const CONFLICT_METHODS = new Set(['PUT', 'PATCH'])

/** Map API path segments to Prisma model names */
const PATH_TO_MODEL: Record<string, string> = {
  parties: 'party',
  products: 'product',
  documents: 'document',
  payments: 'payment',
  expenses: 'expense',
  cheques: 'cheque',
  loans: 'loanAccount',
  godowns: 'godown',
  batches: 'batch',
  'serial-numbers': 'serialNumber',
  recurring: 'recurringInvoice',
  templates: 'termsAndConditionsTemplate',
}

/**
 * Check for update conflicts on PUT/PATCH requests.
 * Client sends `X-Updated-At` header with the updatedAt timestamp they last fetched.
 * If server record is newer → 409 Conflict with both versions' timestamps.
 */
export async function conflictDetection(req: Request, res: Response, next: NextFunction) {
  if (!CONFLICT_METHODS.has(req.method)) return next()

  const clientUpdatedAt = req.headers['x-updated-at'] as string | undefined
  if (!clientUpdatedAt) return next() // No conflict header → skip (backward compatible)

  const clientDate = new Date(clientUpdatedAt)
  if (isNaN(clientDate.getTime())) return next() // Invalid date → skip

  // Extract resource and ID from path: /api/parties/:id → { resource: 'parties', id: ':id' }
  const segments = req.path.replace(/^\/api\//, '').split('/').filter(Boolean)
  const resource = segments[0]
  const entityId = segments[1]

  if (!resource || !entityId || entityId.length < 10) return next() // No valid ID
  const modelName = PATH_TO_MODEL[resource]
  if (!modelName) return next() // Unknown resource

  try {
    // Dynamic model access — Prisma client supports this pattern
    const model = (prisma as Record<string, unknown>)[modelName] as {
      findFirst: (args: { where: Record<string, unknown>; select: Record<string, boolean> }) => Promise<{ updatedAt: Date } | null>
    } | undefined

    if (!model?.findFirst) return next()

    const record = await model.findFirst({
      where: { id: entityId, businessId: req.user?.businessId },
      select: { updatedAt: true },
    })

    if (!record) return next() // Record not found — let route handler return 404

    // Compare: if server is newer than client's version → conflict
    if (record.updatedAt.getTime() > clientDate.getTime()) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'This record was modified by another user. Please refresh and try again.',
          serverUpdatedAt: record.updatedAt.toISOString(),
          clientUpdatedAt: clientDate.toISOString(),
        },
      })
    }
  } catch {
    // Conflict check failure should never block the request
  }

  next()
}
