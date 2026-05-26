/**
 * requireMinClientVersion — header gate for the import API.
 *
 * Rejects requests from HP clients that pre-date the 7.1 import contract
 * with HTTP 426 UPGRADE_REQUIRED. Without this gate an older offline
 * client could replay queued imports against the new server and trip on
 * the M3 four-field bind because it never received a commitToken.
 *
 * Production: `X-Client-Version` header REQUIRED. Missing → 426.
 * Dev / test: header optional so curl smoke-tests stay one-line.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §3 middleware chain
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md M4 (no signed-URL fallback —
 *     ALL import endpoints sit behind auth-cookie + this gate).
 */

import type { Request, Response, NextFunction } from 'express'
import { sendError } from '../lib/response.js'
import { ErrorCode } from '../lib/errors.js'

const UPGRADE_REQUIRED_CODE = 'UPGRADE_REQUIRED'

/** Compare dotted-numeric versions. Missing segments treated as 0. */
function compareVersions(a: string, b: string): number {
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

export function requireMinClientVersion(minVersion: string) {
  return function requireMinClientVersionMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const raw = req.header('X-Client-Version')
    const isProd = process.env.NODE_ENV === 'production'

    if (!raw || raw.length === 0) {
      if (isProd) {
        sendError(
          res,
          `Client version header required (min ${minVersion}). Please update the HisaabPro app.`,
          UPGRADE_REQUIRED_CODE,
          426,
        )
        return
      }
      next()
      return
    }

    if (compareVersions(raw, minVersion) < 0) {
      sendError(
        res,
        `Client too old (need ${minVersion}). Please update the HisaabPro app.`,
        UPGRADE_REQUIRED_CODE,
        426,
      )
      return
    }
    next()
  }
}

// Re-exported solely so callers don't need a separate import for the
// ErrorCode in tests when asserting the response envelope shape.
export const _internal = { ErrorCode }
