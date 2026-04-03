/**
 * Field-level permission filter — strips sensitive fields from responses
 * based on user's role permissions. Applied after route handlers.
 *
 * Intercepts res.json() to null out restricted fields recursively.
 * Owner and Partner roles have ALL permissions, so nothing is stripped.
 */

import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.js'

// Map field permissions to the actual response field names to null out
const FIELD_RESTRICTIONS: Record<string, string[]> = {
  'fields.viewPurchasePrice': ['purchasePrice', 'costPrice'],
  'fields.viewProfitMargin': ['profitMargin', 'marginPercent', 'profit'],
  'fields.viewPartyPhone': ['phone'],
  'fields.viewPartyOutstanding': ['outstandingBalance', 'outstanding', 'balanceDue'],
}

const ALL_RESTRICTED_KEYS = Object.keys(FIELD_RESTRICTIONS)

/**
 * Recursively null out restricted fields in an object or array.
 * Mutates in place for performance (response is about to be serialized).
 */
function nullifyFields(obj: unknown, restrictedFields: Set<string>): void {
  if (obj === null || obj === undefined || typeof obj !== 'object') return

  if (Array.isArray(obj)) {
    for (const item of obj) {
      nullifyFields(item, restrictedFields)
    }
    return
  }

  const record = obj as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (restrictedFields.has(key)) {
      record[key] = null
    } else if (typeof record[key] === 'object' && record[key] !== null) {
      nullifyFields(record[key], restrictedFields)
    }
  }
}

/**
 * Fetch the user's field permissions for the current business.
 * Returns null if user is unauthenticated, has no business, or is owner/partner.
 * Returns the set of restricted field names if the role is missing any field permissions.
 */
async function getRestrictedFields(
  userId: string | undefined,
  businessId: string | undefined
): Promise<Set<string> | null> {
  if (!userId || !businessId) return null

  const bu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId } },
    select: {
      role: true,
      roleRef: { select: { permissions: true } },
    },
  })

  if (!bu) return null

  // Owners bypass — no fields restricted
  if (bu.role === 'owner') return null

  const permissions = (bu.roleRef?.permissions as string[]) ?? []

  // Check if role has ALL field permissions — if so, nothing to restrict
  const missingFieldPerms = ALL_RESTRICTED_KEYS.filter(
    perm => !permissions.includes(perm)
  )
  if (missingFieldPerms.length === 0) return null

  // Build the set of actual field names to null out
  const restricted = new Set<string>()
  for (const perm of missingFieldPerms) {
    for (const field of FIELD_RESTRICTIONS[perm]) {
      restricted.add(field)
    }
  }

  return restricted
}

/**
 * Express middleware — intercepts res.json() to strip restricted fields.
 * Only activates for authenticated users with a role that lacks field permissions.
 */
export function fieldFilter(req: Request, res: Response, next: NextFunction) {
  // Skip if no authenticated user
  if (!req.user?.userId || !req.user?.businessId) {
    next()
    return
  }

  // Cache the permission lookup promise on the request
  let restrictedPromise: Promise<Set<string> | null> | null = null
  function getRestricted(): Promise<Set<string> | null> {
    if (!restrictedPromise) {
      restrictedPromise = getRestrictedFields(
        req.user?.userId,
        req.user?.businessId
      )
    }
    return restrictedPromise
  }

  // Override res.json to intercept the response body
  const originalJson = res.json.bind(res)
  res.json = function filteredJson(body: unknown) {
    // Only filter success responses with data
    if (
      body &&
      typeof body === 'object' &&
      (body as Record<string, unknown>).success === true
    ) {
      // Use the cached promise — resolve synchronously if already settled
      const promise = getRestricted()
      // We need to await the promise, so we return a thenable pattern
      promise
        .then(restricted => {
          if (restricted && restricted.size > 0) {
            nullifyFields(body, restricted)
          }
          originalJson(body)
        })
        .catch(() => {
          // On permission lookup failure, send response unfiltered
          originalJson(body)
        })
      return res
    }

    return originalJson(body)
  } as Response['json']

  // Eagerly start the permission lookup so it runs in parallel with the route
  getRestricted()

  next()
}
