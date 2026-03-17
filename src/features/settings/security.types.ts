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

export interface AuditChange {
  field: string
  before: string
  after: string
}

export interface AuditLogEntry {
  id: string
  action: AuditAction
  entityType: string
  entityId: string
  entityLabel: string | null
  userId: string
  userName: string
  changes: AuditChange[] | null
  reason: string | null
  ipAddress: string | null
  deviceInfo: string | null
  createdAt: string
}

export interface AuditLogResponse {
  success: boolean
  data: {
    entries: AuditLogEntry[]
    pagination: { page: number; limit: number; total: number }
  }
}

export interface AuditLogFilters {
  userId?: string
  entityType?: string
  action?: AuditAction
  from?: string
  to?: string
  page: number
  limit: number
}
