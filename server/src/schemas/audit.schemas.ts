/**
 * Zod schemas for /api/audit endpoints (Phase 6 PR4).
 *
 * All schemas are `.strict()` per A01.1 (reject unknown body keys to defeat
 * mass-assignment attempts that would propagate into raw-SQL WHERE clauses).
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §18.5 row 109.
 */
import { z } from 'zod'

/**
 * AuditLog.action enum — must match the union shipped in PR1A + PR2 (suspend
 * service writes 'SUSPEND_FIRM' / 'REACTIVATE_FIRM'; PR3 writes 'PIN_RESET';
 * existing services use CREATE/UPDATE/DELETE/RESTORE/LOCK_OVERRIDE/ROLE_CHANGE/
 * APPROVAL_REQUEST/APPROVAL_RESPONSE per schema.prisma:1632 comment). Listed
 * here as a closed enum so the FE filter dropdown maps 1:1 to wire values.
 *
 * New values added to AuditLog.action MUST be appended here.
 */
export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'RESTORE',
  'LOCK_OVERRIDE',
  'PIN_RESET',
  'ROLE_CHANGE',
  'APPROVAL_REQUEST',
  'APPROVAL_RESPONSE',
  'SUSPEND_FIRM',
  'REACTIVATE_FIRM',
  'FINALIZE',
  'REVERSE',
] as const

/**
 * Cursor — base64-encoded JSON `{ createdAt: ISO, id: cuid }`. The /search
 * service decodes and validates the inner shape; here we only verify the
 * outer base64url envelope so the route returns 400 cleanly on a typo.
 */
const cursorSchema = z
  .string()
  .min(8, 'Cursor too short')
  .max(512, 'Cursor too long')
  .regex(/^[A-Za-z0-9+/=_-]+$/, 'Cursor must be base64')

/**
 * GET /api/audit?... — search query. Mirrors searchAuditLogs() signature.
 *
 * `q` capped at 200 chars to bound the websearch_to_tsquery parse cost.
 * `entityType` + `action` filter on the indexed B-tree predicates.
 * `userId` is a cuid (actor filter).
 * `dateFrom` / `dateTo` are ISO-8601 strings parsed to Date in the service.
 */
export const searchQuerySchema = z.object({
  q: z.string().trim().max(200, 'Query must be 200 characters or fewer').optional(),
  entityType: z.string().trim().min(1).max(64).optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  userId: z.string().cuid('Invalid userId').optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  cursor: cursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict()

/**
 * POST /api/audit/redactions — upsert one redaction rule.
 *
 * `fieldPath` accepts dot-notation (e.g. `phone`, `address.city`) with the
 * narrow [A-Za-z0-9_.] alphabet to prevent any prototype-pollution payload
 * (`__proto__.x`, `constructor.prototype.x`). setByPath() already guards
 * against magic keys but defense-in-depth at the schema costs nothing.
 */
export const redactionUpsertSchema = z.object({
  entityType: z.string().trim().min(1).max(64),
  fieldPath: z.string()
    .trim()
    .min(1, 'fieldPath is required')
    .max(120, 'fieldPath too long')
    .regex(/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/, 'fieldPath must be dot-separated identifiers'),
  enabled: z.boolean().default(true),
}).strict()

/** POST /api/audit/export — same filter surface as search, no cursor/limit. */
export const exportQuerySchema = searchQuerySchema
  .omit({ cursor: true, limit: true })
  .strict()

export type SearchQueryInput = z.infer<typeof searchQuerySchema>
export type RedactionUpsertInput = z.infer<typeof redactionUpsertSchema>
export type ExportQueryInput = z.infer<typeof exportQuerySchema>
export type AuditAction = (typeof AUDIT_ACTIONS)[number]
