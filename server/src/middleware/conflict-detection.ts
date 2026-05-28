/**
 * #150 Optimistic-lock fast pre-check (NOT the authoritative lock).
 *
 * The authoritative lock lives in the write: each update service runs a
 * version-guarded `updateMany` inside its transaction (see lib/optimistic-lock.ts).
 * That is what actually prevents lost updates — this middleware is a cheap,
 * best-effort fast-fail that rejects an obviously-stale PUT/PATCH before the
 * heavy transaction (and replay-protection / validation) runs.
 *
 * Because it is advisory, a race here is harmless: if the row changes between
 * this read and the write, the in-transaction guard still 409s. It emits the
 * SAME 409 contract as the write lock ({ code:'CONFLICT', serverVersion }) so
 * the client has one conflict shape to handle.
 *
 * Tenant-safe: the read is scoped to req.user.businessId, and a miss (foreign
 * tenant or unknown id) falls through to next() — never leaks existence.
 */

import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.js'

const CONFLICT_METHODS = new Set(['PUT', 'PATCH'])

/** API path segment → Prisma model carrying a `version` column. */
const PATH_TO_MODEL: Record<string, string> = {
  parties: 'party',
  products: 'product',
  documents: 'document',
  payments: 'payment',
}

export async function conflictDetection(req: Request, res: Response, next: NextFunction) {
  if (!CONFLICT_METHODS.has(req.method)) return next()

  const rawVersion = req.headers['x-entity-version']
  if (typeof rawVersion !== 'string' || rawVersion === '') return next() // no token → skip
  const expectedVersion = Number(rawVersion)
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) return next()

  const businessId = req.user?.businessId
  if (!businessId) return next() // auth runs first; defensive

  const segments = req.path.replace(/^\/api\//, '').split('/').filter(Boolean)
  const resource = segments[0]
  const entityId = segments[1]
  if (!resource || !entityId || entityId.length < 10) return next()

  const modelName = PATH_TO_MODEL[resource]
  if (!modelName) return next()

  try {
    const model = (prisma as Record<string, unknown>)[modelName] as {
      findFirst: (args: { where: Record<string, unknown>; select: Record<string, boolean> }) => Promise<{ version: number } | null>
    } | undefined
    if (!model?.findFirst) return next()

    const record = await model.findFirst({
      where: { id: entityId, businessId },
      select: { version: true },
    })
    if (!record) return next() // not ours / not found — let the route 404

    if (record.version !== expectedVersion) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'This record was changed by another user. Reload to see the latest, then re-apply your change.',
          details: { serverVersion: record.version },
        },
      })
    }
  } catch {
    // Pre-check failure must never block the request — the write lock is authoritative.
  }

  next()
}
