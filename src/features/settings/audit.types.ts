/** Audit Log — Phase 6 PR4 shapes
 *
 * Mirrors server/src/services/audit/audit-search.service.ts and
 * server/src/services/audit/audit-redaction.service.ts contracts.
 *
 * `AuditAction` extends the pre-PR4 enum with v2.3 actions:
 *   SUSPEND_FIRM, REACTIVATE_FIRM, FINALIZE, REVERSE.
 */

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'RESTORE'
  | 'LOCK_OVERRIDE'
  | 'PIN_RESET'
  | 'ROLE_CHANGE'
  | 'APPROVAL_REQUEST'
  | 'APPROVAL_RESPONSE'
  // Phase 6 PR4 additions
  | 'SUSPEND_FIRM'
  | 'REACTIVATE_FIRM'
  | 'FINALIZE'
  | 'REVERSE'

/** Server returns this as the `changes` field — may be null, primitive, flat
 * patch object, or a `{ before, after }` envelope. Redacted sub-values appear
 * as the sentinel `{ __redacted: true }` at the redacted field path. */
export type AuditChangesPayload = unknown

/** Redaction sentinel — the BE replaces any redacted value at read-time. */
export interface RedactedSentinel {
  __redacted: true
}

export interface AuditSearchRow {
  id: string
  businessId: string
  action: AuditAction
  entityType: string
  entityId: string
  entityLabel: string | null
  userId: string | null
  systemActor: string | null
  changes: AuditChangesPayload
  reason: string | null
  ipAddress: string | null
  deviceInfo: string | null
  createdAt: string
  userName: string | null
  userEmail: string | null
}

/** Filters bound to the FE filter drawer + URL state. */
export interface AuditSearchFilters {
  q?: string
  entityType?: string
  action?: AuditAction
  userId?: string
  dateFrom?: string
  dateTo?: string
}

export interface AuditSearchResponse {
  rows: AuditSearchRow[]
  nextCursor: string | null
}

export interface Redaction {
  id: string
  entityType: string
  fieldPath: string
  enabled: boolean
  createdAt: string
  createdById: string | null
}

export interface RedactionUpsertInput {
  entityType: string
  fieldPath: string
  enabled?: boolean
}

export interface RedactionListResponse {
  items: Redaction[]
}
