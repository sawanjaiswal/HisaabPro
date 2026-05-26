/**
 * create.route helpers — extracted to keep the route file ≤250L.
 *
 * - `compareVersions` — dotted-numeric comparator. Mirrors the helper
 *   in `middleware/require-min-client-version.ts` (duplicated because
 *   per-entity comparison runs AFTER multer/idempotency and we can't
 *   reuse the middleware shape which short-circuits via `res.send`).
 * - `sanitiseFileName` — M2 hardening: strips control bytes + RTL
 *   override codepoints, caps length at 255, and drops leading dots so
 *   the value can never look like a hidden dotfile when surfaced in
 *   audit/logs.
 * - `enforcePerEntityClientVersion` — AUDIT S2 per-entity floor. The
 *   global `requireMinClientVersion` middleware runs with the 7.1.0
 *   floor (so legacy clients can still POST parties/product); this
 *   tightens to the per-entity floor only when needed. Dev / test
 *   (no X-Client-Version header) skip per the same rule used in the
 *   middleware to keep curl smoke-tests one-line.
 *
 * All pure functions, no side effects.
 */

import type { Response } from 'express'
import { sendError } from '../../lib/response.js'
import {
  IMPORT_MIN_CLIENT_VERSION,
  IMPORT_MIN_CLIENT_VERSION_BY_ENTITY,
} from '../../constants/import.constants.js'

export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map((s) => Number.parseInt(s, 10) || 0)
  const partsB = b.split('.').map((s) => Number.parseInt(s, 10) || 0)
  const len = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < len; i++) {
    const x = partsA[i] ?? 0
    const y = partsB[i] ?? 0
    if (x !== y) return x - y
  }
  return 0
}

export function sanitiseFileName(input: string): string {
  return input
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F‪-‮⁦-⁩]/g, '')
    .slice(0, 255)
    .replace(/^\.+/, '')
}

/**
 * Returns `true` if the response was already sent (gate fired) — caller
 * MUST `return` immediately. Returns `false` to continue processing.
 */
export function enforcePerEntityClientVersion(
  res: Response,
  entity: 'parties' | 'product' | 'invoice' | 'payments',
  clientVersion: string | undefined,
): boolean {
  const entityMin = IMPORT_MIN_CLIENT_VERSION_BY_ENTITY[entity]
  if (!clientVersion || !entityMin || entityMin === IMPORT_MIN_CLIENT_VERSION) {
    return false
  }
  if (compareVersions(clientVersion, entityMin) < 0) {
    sendError(
      res,
      `Client too old for entity='${entity}' (need ${entityMin}). Please update the HisaabPro app.`,
      'UPGRADE_REQUIRED',
      426,
    )
    return true
  }
  return false
}
