// ─── Permissions ─────────────────────────────────────────────────────────────

export interface PermissionAction {
  key: string
  label: string
  description?: string
}

export interface PermissionModule {
  key: string
  label: string
  actions: PermissionAction[]
}

export interface PermissionMatrix {
  modules: PermissionModule[]
}

// ─── Roles ───────────────────────────────────────────────────────────────────

export interface Role {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  isDefault: boolean
  priority: number
  /** Flat permission keys, e.g. ["invoicing.view", "invoicing.create"] */
  permissions: string[]
  staffCount: number
  createdAt: string
  updatedAt: string
}

export interface RoleFormData {
  name: string
  description: string
  permissions: string[]
  isDefault: boolean
}

export interface RolesListResponse {
  success: boolean
  data: { roles: Role[] }
}

export interface RoleDetailResponse {
  success: boolean
  data: { role: Role }
}

export interface RoleDeleteResponse {
  success: boolean
  data: { reassignedStaff: number }
}

// ─── Staff ───────────────────────────────────────────────────────────────────

export type StaffStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING'

export interface StaffMember {
  id: string
  userId: string
  name: string
  phone: string
  role: { id: string; name: string }
  status: StaffStatus
  lastActiveAt: string | null
  invitedBy: string
  joinedAt: string
}

export interface StaffInvite {
  id: string
  name: string
  phone: string
  roleName: string
  status: 'PENDING' | 'EXPIRED'
  expiresAt: string
}

export interface StaffListResponse {
  success: boolean
  data: {
    staff: StaffMember[]
    pending: StaffInvite[]
  }
}

export interface InviteStaffData {
  name: string
  phone: string
  roleId: string
}

export interface InviteResponse {
  success: boolean
  data: {
    invite: {
      id: string
      code: string
      expiresAt: string
      status: string
      staffName: string
      staffPhone: string
      roleName: string
    }
  }
}

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

// ─── App Settings ────────────────────────────────────────────────────────────

export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'

export type CalculatorPosition = 'BOTTOM_RIGHT' | 'BOTTOM_LEFT'

export interface AppSettings {
  dateFormat: DateFormat
  pinEnabled: boolean
  biometricEnabled: boolean
  operationPinSet: boolean
  calculatorPosition: CalculatorPosition
  language: string
  theme: 'light' | 'dark'
}

export interface AppSettingsResponse {
  success: boolean
  data: AppSettings
}

// ─── PIN ─────────────────────────────────────────────────────────────────────

export type PinStep = 'enter' | 'confirm' | 'verify' | 'lockout' | 'forgot'

export interface PinState {
  step: PinStep
  pin: string
  confirmPin: string
  attemptsRemaining: number
  lockedUntil: string | null
  error: string | null
}

// ─── Keyboard Shortcuts ──────────────────────────────────────────────────────

export interface ShortcutConfig {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  label: string
}

export type ShortcutGroup = 'billing' | 'navigation'

// ─── Calculator ──────────────────────────────────────────────────────────────

export type CalculatorMode = 'basic' | 'gst'

export type GstMode = 'exclusive' | 'inclusive'

export interface CalculatorState {
  display: string
  expression: string
  result: number | null
  history: Array<{ expression: string; result: number }>
  mode: CalculatorMode
  gstRate: number | null
  gstMode: GstMode
}

// ─── Settings Hub ────────────────────────────────────────────────────────────

export interface SettingsSection {
  id: string
  title: string
  items: SettingsItem[]
}

export interface SettingsItem {
  id: string
  label: string
  description?: string
  icon: string
  route?: string
  type: 'navigation' | 'toggle' | 'select'
  value?: string | boolean
}
