/**
 * Audit-trail routes — Phase 6 PR4 (architecture §6.1 lines 713-714 + §18.5).
 *
 * Endpoints (all under /api/audit):
 *
 *   GET    /                  — search (paginated, filtered, full-text)
 *   GET    /redactions        — list per-business redaction rules
 *   POST   /redactions        — upsert one redaction rule
 *   DELETE /redactions/:id    — soft-disable a rule
 *   POST   /export            — CSV stream of search results
 *
 * Middleware chain (per architecture §11):
 *
 *   auth → requireActiveBusiness → requireRecentPin(class) → requireOwner → handler
 *
 * Phase 6 has NO per-feature requirePermission('audit.read'/'audit.export')
 * roles yet — the SCOPE document defers granular RBAC. Until those land we
 * gate audit visibility behind `requireOwner()` (same pattern as PR2's
 * suspend/reactivate routes). When per-key permissions ship in a future PR
 * the calls below get an extra `requirePermission(key)` line BEFORE
 * requireOwner without changing handler logic.
 *
 * Read class: `read-only` (60-min grace) for GET endpoints — the UX cost of
 * re-prompting a PIN inside an active audit-review session is high.
 * Mutation class: `mutation` (5-min grace) for redaction upserts/disables
 * AND the export endpoint, because exporting can leak the un-redacted-at-the-
 * source raw row id list to disk; treat it as a sensitive write.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { requireActiveBusiness } from '../middleware/require-active-business.js'
import { requireRecentPin } from '../middleware/require-recent-pin.js'
import { requireOwner } from '../middleware/permission.js'
import { validate } from '../middleware/validate.js'
import { sendSuccess } from '../lib/response.js'
import {
  searchQuerySchema,
  redactionUpsertSchema,
  exportQuerySchema,
} from '../schemas/audit.schemas.js'
import {
  searchAuditLogs,
  type AuditSearchRow,
} from '../services/audit/audit-search.service.js'
import {
  listRedactions,
  setRedaction,
  disableRedaction,
  applyRedactionsToRows,
} from '../services/audit/audit-redaction.service.js'

const router = Router()

// All audit routes require an authenticated, active-business session.
router.use(auth, requireActiveBusiness)

/**
 * GET /api/audit
 *
 * Query (all optional except via search): q, entityType, action, userId,
 * dateFrom, dateTo, cursor, limit (1..100, default 20).
 *
 * Response: { success, data: { rows: AuditSearchRow[], nextCursor: string|null } }
 *
 * We DON'T use `validate(schema)` here — that middleware parses req.body,
 * which is empty/undefined for GET requests. Instead, the handler parses
 * req.query directly with the same `.strict()` schema; on ZodError the
 * global errorHandler maps to 400 VALIDATION_ERROR (lib/errors.ts:202-207).
 */
router.get(
  '/',
  requireRecentPin('read-only'),
  requireOwner(),
  asyncHandler(async (req, res) => {
    const businessId = req.activeBusiness!.id
    const parsed = searchQuerySchema.parse(req.query)

    const result = await searchAuditLogs({ businessId, ...parsed })
    const redactions = await listRedactions(businessId)
    const rows = applyRedactionsToRows(result.rows, redactions)

    sendSuccess(res, { rows, nextCursor: result.nextCursor })
  }),
)

/**
 * GET /api/audit/redactions — list per-business redaction config rows
 * (both enabled and disabled).
 */
router.get(
  '/redactions',
  requireRecentPin('read-only'),
  requireOwner(),
  asyncHandler(async (req, res) => {
    const businessId = req.activeBusiness!.id
    const items = await listRedactions(businessId)
    sendSuccess(res, { items })
  }),
)

/**
 * POST /api/audit/redactions — upsert one redaction rule.
 * Body: { entityType, fieldPath, enabled? }
 */
router.post(
  '/redactions',
  requireRecentPin('mutation'),
  requireOwner(),
  validate(redactionUpsertSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.activeBusiness!.id
    const userId = req.user!.userId
    const { entityType, fieldPath, enabled } = req.body as {
      entityType: string; fieldPath: string; enabled?: boolean
    }
    const redaction = await setRedaction({
      businessId, entityType, fieldPath, enabled, createdById: userId,
    })
    sendSuccess(res, { redaction })
  }),
)

/**
 * DELETE /api/audit/redactions/:id — soft-disable (flips enabled=false).
 * The unique key (businessId, entityType, fieldPath) survives — re-enable by
 * re-POSTing to /redactions with enabled=true.
 */
router.delete(
  '/redactions/:id',
  requireRecentPin('mutation'),
  requireOwner(),
  asyncHandler(async (req, res) => {
    const businessId = req.activeBusiness!.id
    // String() wrap — Express's ParamsDictionary types `params[id]` as
    // string | string[] depending on the path-pattern; the rest of the
    // route surface follows the same convention (see recurring.route.ts).
    const redaction = await disableRedaction({ businessId, id: String(req.params.id) })
    sendSuccess(res, { redaction })
  }),
)

/**
 * POST /api/audit/export — CSV download of search results.
 *
 * Reuses searchAuditLogs() with cursor-walk to assemble the full result set,
 * then sends as a single buffered response with text/csv + Content-Disposition.
 * Walks pages of 100 rows up to a 100k-row hard cap (an admin who wants more
 * than 100k rows in one click is doing something wrong — the request times
 * out long before that).
 *
 * Buffered (not res.write streaming) because the global performanceMonitoring
 * middleware calls res.setHeader('X-Response-Time', …) inside its res.end()
 * override; streaming res.write() flushes headers early, then the perf
 * middleware throws ERR_HTTP_HEADERS_SENT on end. Buffering keeps headers
 * unflushed until res.send(), so the perf header lands cleanly. Memory cost
 * at the 100k cap is ~20MB worst-case (well under Node default).
 *
 * Class: 'mutation' (5-min grace) — exporting is a sensitive surface.
 */
router.post(
  '/export',
  requireRecentPin('mutation'),
  requireOwner(),
  validate(exportQuerySchema),
  asyncHandler(async (req, res) => {
    const businessId = req.activeBusiness!.id
    const filters = req.body as Record<string, unknown>
    const redactions = await listRedactions(businessId)

    const lines: string[] = [
      ['createdAt', 'actor', 'action', 'entityType',
        'entityId', 'entityLabel', 'changes', 'ipAddress'].join(','),
    ]

    const PAGE = 100
    const MAX_ROWS = 100_000
    let cursor: string | undefined
    let written = 0

    do {
      const page = await searchAuditLogs({
        businessId,
        ...filters,
        cursor,
        limit: PAGE,
      })
      const redacted = applyRedactionsToRows(page.rows, redactions)
      for (const row of redacted) {
        lines.push(rowToCsv(row))
        written++
        if (written >= MAX_ROWS) break
      }
      cursor = page.nextCursor ?? undefined
      if (written >= MAX_ROWS) break
    } while (cursor)

    const filename = `audit-export-${new Date().toISOString().slice(0, 10)}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(lines.join('\n') + '\n')
  }),
)

/** Hand-rolled CSV encoder — `csv-stringify` is not a dep (per server/package.json). */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = value instanceof Date
    ? value.toISOString()
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value)
  // Quote if the field contains comma, quote, CR, or LF; double internal quotes.
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function rowToCsv(row: AuditSearchRow): string {
  const actor = row.userName || row.userEmail || row.systemActor || ''
  const cells = [
    row.createdAt,
    actor,
    row.action,
    row.entityType,
    row.entityId,
    row.entityLabel ?? '',
    row.changes ?? '',
    row.ipAddress ?? '',
  ]
  return cells.map(csvEscape).join(',')
}

export default router
