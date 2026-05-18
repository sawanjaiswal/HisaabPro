// Barrel re-export — all settings types split into domain files
export type {
  PermissionAction,
  PermissionModule,
  PermissionMatrix,
  Role,
  RoleFormData,
  RolesListResponse,
  RoleDetailResponse,
  RoleDeleteResponse,
} from './role.types'

export type {
  StaffStatus,
  StaffMember,
  StaffInvite,
  StaffListResponse,
  InviteStaffData,
  InviteResponse,
} from './staff.types'

export type {
  TransactionLockConfig,
  TransactionLockResponse,
  ApprovalType,
  ApprovalStatus,
  ApprovalRequest,
  ApprovalsListResponse,
  AuditAction,
} from './security.types'

// Phase 6 PR4 — audit search/redactions/diff
export type {
  AuditSearchRow,
  AuditSearchFilters,
  AuditSearchResponse,
  AuditChangesPayload,
  RedactedSentinel,
  Redaction,
  RedactionUpsertInput,
  RedactionListResponse,
} from './audit.types'

export type {
  DateFormat,
  CalculatorPosition,
  AppSettings,
  AppSettingsResponse,
  PinStep,
  PinState,
  ShortcutConfig,
  ShortcutGroup,
  CalculatorMode,
  GstMode,
  CalculatorState,
  CalculatorSettings,
  SettingsSection,
  SettingsItem,
} from './app-settings.types'
