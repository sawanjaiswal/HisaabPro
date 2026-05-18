// ─── Transaction Lock ────────────────────────────────────────────────────────

export interface TransactionLockConfig {
  lockAfterDays: number | null
  requireApprovalForEdit: boolean
  requireApprovalForDelete: boolean
  priceChangeThresholdPercent: number | null
  discountThresholdPercent: number | null
  operationPinSet: boolean
}

export interface TransactionLockResponse {
  success: boolean
  data: TransactionLockConfig
}

// ─── Approval Requests ───────────────────────────────────────────────────────

export type ApprovalType =
  | 'EDIT_LOCKED_TRANSACTION'
  | 'DELETE_TRANSACTION'
  | 'PRICE_OVERRIDE'
  | 'DISCOUNT_OVERRIDE'

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED'

export interface ApprovalRequest {
  id: string
  type: ApprovalType
  entityType: string
  entityId: string
  requestedBy: string
  requestedByName: string
  requestedChanges: {
    field: string
    before: string
    after: string
    reason?: string
  }
  status: ApprovalStatus
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNote: string | null
  expiresAt: string
  createdAt: string
}

export interface ApprovalsListResponse {
  success: boolean
  data: { approvals: ApprovalRequest[] }
}

// ─── Audit Log ───────────────────────────────────────────────────────────────
//
// As of Phase 6 PR4 (audit search + redactions), the audit log domain types
// live in `./audit.types.ts`. `AuditAction` is re-exported here so existing
// consumers (`settings.types` barrel + the audit-coverage badges) keep
// working with the wider v2.3 union (adds SUSPEND_FIRM, REACTIVATE_FIRM,
// FINALIZE, REVERSE).
export type { AuditAction } from './audit.types'
