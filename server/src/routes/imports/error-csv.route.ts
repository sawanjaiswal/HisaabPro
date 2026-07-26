/**
 * GET /api/imports/:id/error-csv — stream ERROR rows as CSV.
 *
 * M4 fix — there is NO signed-URL fallback. The entire endpoint sits
 * behind the same auth chain as get.route (cookie → active-business →
 * owner → feature). Re-using the auth cookie eliminates the
 * pre-signed S3 / GCS link, which had three problems:
 *   1. Lifetime drift — anyone with the link could re-fetch for hours.
 *   2. No revocation — rotating user roles didn't kill outstanding URLs.
 *   3. Tenant-leak via header confusion when the URL was forwarded.
 *
 * Every cell is run through `prefixUnsafeCell` so a value like
 * `=cmd|'/c calc'!A0` becomes `'=cmd|'/c calc'!A0` — Excel renders it
 * as text, no formula evaluation.
 *
 * Cross-references:
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md M4, S12
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §3 (auth chain)
 */

import { Router, type Request, type Response } from 'express'
import { auth } from '../../middleware/auth.js'
import { requireActiveBusiness } from '../../middleware/require-active-business.js'
import { requireOwner } from '../../middleware/permission.js'
import { requireFeature } from '../../middleware/require-feature.js'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { prisma } from '../../lib/prisma.js'
import { sendError } from '../../lib/response.js'
import { ErrorCode } from '../../lib/errors.js'
import { getAuth } from '../../lib/auth-helper.js'
import { prefixUnsafeCell } from '../../services/import/security/csv-injection.js'

const ERROR_ROW_PAGE = 500

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const raw = typeof value === 'string' ? value : JSON.stringify(value)
  // Sanitise FIRST, then quote — the sanitised prefix doesn't change
  // the quoting requirement but guarantees no formula trigger leaks.
  const safe = prefixUnsafeCell(raw).replace(/"/g, '""')
  return `"${safe}"`
}

function joinIssues(issues: unknown): string {
  if (!Array.isArray(issues)) return ''
  return issues
    .map((i) => {
      if (i && typeof i === 'object' && 'code' in i && 'message' in i) {
        const o = i as { code: string; message: string }
        return `${o.code}: ${o.message}`
      }
      return ''
    })
    .filter(Boolean)
    .join(' | ')
}

export const errorCsvImportRoute = Router({ mergeParams: true })

errorCsvImportRoute.get(
  '/:id/error-csv',
  auth,
  requireActiveBusiness,
  requireOwner(),
  requireFeature('DATA_IMPORT'),
  // NO requireMinClientVersion here — deliberately. This endpoint is reached by
  // a top-level browser navigation (the download), and a navigation cannot
  // carry a custom header, so in production the gate would 426 every download
  // no matter how new the client is. The gate exists to stop a stale client
  // replaying queued COMMITS against the 7.1 contract; a read-only CSV of the
  // job's own error rows has no such hazard. Auth + ownership still apply.
  asyncHandler(async (req: Request, res: Response) => {
    const jobId = String(req.params.id ?? '')
    if (!jobId) {
      sendError(res, 'Job id missing in path', ErrorCode.VALIDATION_ERROR, 400)
      return
    }
    const auth_ = getAuth(req)

    const job = await prisma.importJob.findFirst({
      where: { id: jobId, businessId: auth_.businessId, userId: auth_.userId },
      select: { id: true },
    })
    if (!job) {
      sendError(res, 'Import job not found', ErrorCode.NOT_FOUND, 404)
      return
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="errors-${jobId}.csv"`,
    )
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')

    res.write('sourceIndex,errors,raw\n')

    let cursor: string | undefined
    for (;;) {
      const rows = await prisma.importJobRow.findMany({
        where: {
          jobId,
          status: 'ERROR',
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: 'asc' },
        take: ERROR_ROW_PAGE,
        select: { id: true, sourceIndex: true, issues: true, raw: true },
      })
      if (rows.length === 0) break
      for (const r of rows) {
        const line = [
          csvCell(String(r.sourceIndex)),
          csvCell(joinIssues(r.issues)),
          csvCell(r.raw),
        ].join(',')
        res.write(line + '\n')
      }
      const last = rows[rows.length - 1]!
      cursor = last.id
      if (rows.length < ERROR_ROW_PAGE) break
    }
    res.end()
  }),
)
