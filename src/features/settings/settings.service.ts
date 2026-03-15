/** Settings & Security — API service layer
 *
 * All service functions accept an optional AbortSignal for cleanup in useEffect.
 * The `api()` helper already prepends API_URL, so paths begin with /.
 *
 * businessId and userId are always passed as function arguments — never hardcoded.
 */

import { api } from '@/lib/api'
import type {
  RolesListResponse,
  RoleDetailResponse,
  RoleFormData,
  RoleDeleteResponse,
  PermissionMatrix,
  StaffListResponse,
  InviteStaffData,
  InviteResponse,
  TransactionLockConfig,
  TransactionLockResponse,
  ApprovalsListResponse,
  ApprovalStatus,
  AuditLogFilters,
  AuditLogResponse,
  AppSettings,
  AppSettingsResponse,
} from './settings.types'

// ─── Local response shapes ────────────────────────────────────────────────────

export interface PermissionMatrixResponse {
  success: boolean
  data: PermissionMatrix
}

export interface StaffRoleUpdateResponse {
  success: boolean
  data: { staffId: string; roleId: string; roleName: string }
}

export interface StaffSuspendResponse {
  success: boolean
  data: { staffId: string; status: 'SUSPENDED' }
}

export interface StaffRemoveResponse {
  success: boolean
  data: { staffId: string; removedAt: string }
}

export interface ResendInviteResponse {
  success: boolean
  data: { inviteId: string; expiresAt: string }
}

export interface ReviewApprovalResponse {
  success: boolean
  data: {
    approvalId: string
    status: ApprovalStatus
    reviewedAt: string
  }
}

export interface SetPinResponse {
  success: boolean
  data: { pinEnabled: boolean; updatedAt: string }
}

export interface VerifyPinResponse {
  success: boolean
  data: { valid: boolean; attemptsRemaining: number | null }
}

export interface ResetPinResponse {
  success: boolean
  data: { pinEnabled: boolean; updatedAt: string }
}

export interface SetOperationPinResponse {
  success: boolean
  data: { operationPinSet: boolean; updatedAt: string }
}

// ─── Query builder helpers ────────────────────────────────────────────────────

/**
 * Builds a URLSearchParams query string from AuditLogFilters.
 * Only appends params that have defined, non-empty values.
 */
function buildAuditQuery(filters: AuditLogFilters): string {
  const params = new URLSearchParams()

  const { userId, entityType, action, from, to, page, limit } = filters

  if (userId !== undefined) params.set('userId', userId)
  if (entityType !== undefined) params.set('entityType', entityType)
  if (action !== undefined) params.set('action', action)
  if (from !== undefined) params.set('from', from)
  if (to !== undefined) params.set('to', to)
  params.set('page', String(page))
  params.set('limit', String(limit))

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// ─── Roles ────────────────────────────────────────────────────────────────────

/**
 * Fetch all roles for a business.
 * System roles (OWNER, ADMIN, STAFF) are always present; custom roles appear after.
 * Response includes staffCount per role so the UI can show "N staff".
 */
export async function getRoles(
  businessId: string,
  signal?: AbortSignal
): Promise<RolesListResponse> {
  return api<RolesListResponse>(
    `/businesses/${businessId}/roles`,
    { signal }
  )
}

/**
 * Fetch detail for a single role, including the full permissions array.
 */
export async function getRole(
  businessId: string,
  roleId: string,
  signal?: AbortSignal
): Promise<RoleDetailResponse> {
  return api<RoleDetailResponse>(
    `/businesses/${businessId}/roles/${roleId}`,
    { signal }
  )
}

/**
 * Create a new custom role for the business.
 * System roles (isSystem: true) cannot be created via this endpoint.
 * Returns the created role as RoleDetailResponse (201 Created).
 */
export async function createRole(
  businessId: string,
  data: RoleFormData,
  signal?: AbortSignal
): Promise<RoleDetailResponse> {
  return api<RoleDetailResponse>(
    `/businesses/${businessId}/roles`,
    {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    }
  )
}

/**
 * Update an existing custom role's name, description, permissions, or default status.
 * Returns 403 if attempting to modify a system role.
 * Returns the updated role as RoleDetailResponse.
 */
export async function updateRole(
  businessId: string,
  roleId: string,
  data: Partial<RoleFormData>,
  signal?: AbortSignal
): Promise<RoleDetailResponse> {
  return api<RoleDetailResponse>(
    `/businesses/${businessId}/roles/${roleId}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
      signal,
    }
  )
}

/**
 * Delete a custom role. All staff currently on this role must be reassigned.
 * Pass reassignTo (another roleId) — server moves staff atomically.
 * Returns the number of staff reassigned.
 * Returns 400 if reassignTo is the same as the deleted role.
 * Returns 403 if attempting to delete a system role.
 */
export async function deleteRole(
  businessId: string,
  roleId: string,
  reassignTo: string,
  signal?: AbortSignal
): Promise<RoleDeleteResponse> {
  return api<RoleDeleteResponse>(
    `/businesses/${businessId}/roles/${roleId}?reassignTo=${encodeURIComponent(reassignTo)}`,
    {
      method: 'DELETE',
      signal,
    }
  )
}

// ─── Permissions ──────────────────────────────────────────────────────────────

/**
 * Fetch the global permission matrix — all modules and their available actions.
 * This is a static reference endpoint (not business-specific).
 * Used to populate the role builder UI.
 */
export async function getPermissionMatrix(
  signal?: AbortSignal
): Promise<PermissionMatrixResponse> {
  return api<PermissionMatrixResponse>('/permissions/matrix', { signal })
}

// ─── Staff ────────────────────────────────────────────────────────────────────

/**
 * Fetch all active staff members and pending invites for the business.
 * staff[] contains joined members; pending[] contains unexpired invite records.
 */
export async function getStaff(
  businessId: string,
  signal?: AbortSignal
): Promise<StaffListResponse> {
  return api<StaffListResponse>(
    `/businesses/${businessId}/staff`,
    { signal }
  )
}

/**
 * Invite a new staff member by phone number and assign them a role.
 * Sends an OTP-based invite link. Expires in 48 hours.
 * Returns the created invite record including a join code.
 * Returns 409 if the phone is already a staff member.
 */
export async function inviteStaff(
  businessId: string,
  data: InviteStaffData,
  signal?: AbortSignal
): Promise<InviteResponse> {
  return api<InviteResponse>(
    `/businesses/${businessId}/staff/invite`,
    {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    }
  )
}

/**
 * Change the role assigned to an existing staff member.
 * Takes effect immediately — staff member's permissions update on next request.
 * Returns 403 if trying to reassign the business OWNER.
 */
export async function updateStaffRole(
  businessId: string,
  staffId: string,
  roleId: string,
  signal?: AbortSignal
): Promise<StaffRoleUpdateResponse> {
  return api<StaffRoleUpdateResponse>(
    `/businesses/${businessId}/staff/${staffId}`,
    {
      method: 'PUT',
      body: JSON.stringify({ roleId }),
      signal,
    }
  )
}

/**
 * Suspend a staff member — they can no longer log in to this business.
 * Their data and audit history are preserved. Can be reactivated later.
 * Returns 403 if trying to suspend the OWNER.
 */
export async function suspendStaff(
  businessId: string,
  staffId: string,
  signal?: AbortSignal
): Promise<StaffSuspendResponse> {
  return api<StaffSuspendResponse>(
    `/businesses/${businessId}/staff/${staffId}/suspend`,
    {
      method: 'POST',
      signal,
    }
  )
}

/**
 * Permanently remove a staff member from the business.
 * Their audit log entries remain. Cannot be undone.
 * Returns 403 if trying to remove the OWNER.
 */
export async function removeStaff(
  businessId: string,
  staffId: string,
  signal?: AbortSignal
): Promise<StaffRemoveResponse> {
  return api<StaffRemoveResponse>(
    `/businesses/${businessId}/staff/${staffId}`,
    {
      method: 'DELETE',
      signal,
    }
  )
}

/**
 * Resend an invite to a staff member whose invite is still PENDING (not EXPIRED).
 * Generates a new expiry (48h from now) and sends a fresh OTP.
 * Returns 400 if the invite has already expired — create a new invite instead.
 */
export async function resendInvite(
  businessId: string,
  inviteId: string,
  signal?: AbortSignal
): Promise<ResendInviteResponse> {
  return api<ResendInviteResponse>(
    `/businesses/${businessId}/staff/invite/${inviteId}/resend`,
    {
      method: 'POST',
      signal,
    }
  )
}

// ─── Transaction Lock ─────────────────────────────────────────────────────────

/**
 * Fetch the current transaction lock configuration for the business.
 * Controls how many days before transactions are locked and what requires approval.
 */
export async function getTransactionLockConfig(
  businessId: string,
  signal?: AbortSignal
): Promise<TransactionLockResponse> {
  return api<TransactionLockResponse>(
    `/businesses/${businessId}/settings/transaction-lock`,
    { signal }
  )
}

/**
 * Update transaction lock settings.
 * Pass a partial object — only provided fields are updated.
 * Returns the full updated config.
 * Note: setting operationPin via this endpoint is not supported — use setOperationPin().
 */
export async function updateTransactionLockConfig(
  businessId: string,
  data: Partial<TransactionLockConfig>,
  signal?: AbortSignal
): Promise<TransactionLockResponse> {
  return api<TransactionLockResponse>(
    `/businesses/${businessId}/settings/transaction-lock`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
      signal,
    }
  )
}

// ─── Approvals ────────────────────────────────────────────────────────────────

/**
 * Fetch all pending approval requests for the business.
 * Filtered to status=PENDING by default so owners/admins see only actionable items.
 * Returns 403 if the caller does not have the REVIEW_APPROVALS permission.
 */
export async function getApprovals(
  businessId: string,
  signal?: AbortSignal
): Promise<ApprovalsListResponse> {
  return api<ApprovalsListResponse>(
    `/businesses/${businessId}/approvals?status=PENDING`,
    { signal }
  )
}

/**
 * Approve or deny a pending approval request.
 * Requires the operation PIN to confirm identity before acting.
 * APPROVE: executes the queued mutation atomically.
 * DENY: marks request as DENIED; the requesting staff sees the denial reason.
 * Returns 401 if the operationPin is incorrect.
 * Returns 400 if the approval has already expired.
 */
export async function reviewApproval(
  businessId: string,
  approvalId: string,
  action: 'APPROVE' | 'DENY',
  operationPin: string,
  signal?: AbortSignal
): Promise<ReviewApprovalResponse> {
  return api<ReviewApprovalResponse>(
    `/businesses/${businessId}/approvals/${approvalId}`,
    {
      method: 'PUT',
      body: JSON.stringify({ action, operationPin }),
      signal,
    }
  )
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

/**
 * Fetch the audit log for the business with optional filters.
 * Supports filtering by userId, entityType, action type, and date range.
 * Paginated — default limit 50, max 200.
 * Returns 403 if the caller does not have AUDIT_LOG permission.
 */
export async function getAuditLog(
  businessId: string,
  filters: AuditLogFilters,
  signal?: AbortSignal
): Promise<AuditLogResponse> {
  return api<AuditLogResponse>(
    `/businesses/${businessId}/audit-log${buildAuditQuery(filters)}`,
    { signal }
  )
}

// ─── App Settings ─────────────────────────────────────────────────────────────

/**
 * Fetch per-user app settings (date format, theme, language, calculator position, PIN status).
 * These are user-scoped — not business-scoped. Each staff member has their own preferences.
 */
export async function getAppSettings(
  userId: string,
  signal?: AbortSignal
): Promise<AppSettingsResponse> {
  return api<AppSettingsResponse>(
    `/users/${userId}/settings`,
    { signal }
  )
}

/**
 * Update per-user app settings.
 * Pass a partial object — only provided fields are updated.
 * Returns the full updated settings object.
 */
export async function updateAppSettings(
  userId: string,
  data: Partial<AppSettings>,
  signal?: AbortSignal
): Promise<AppSettingsResponse> {
  return api<AppSettingsResponse>(
    `/users/${userId}/settings`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
      signal,
    }
  )
}

// ─── PIN ──────────────────────────────────────────────────────────────────────

/**
 * Set or change the user's app lock PIN.
 * Pass currentPin when changing an existing PIN (required if pinEnabled: true).
 * Omit currentPin when setting a PIN for the first time.
 * PIN is a 4-digit code — validated server-side.
 */
export async function setPin(
  userId: string,
  data: { currentPin?: string; newPin: string },
  signal?: AbortSignal
): Promise<SetPinResponse> {
  return api<SetPinResponse>(
    `/users/${userId}/pin`,
    {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    }
  )
}

/**
 * Verify the user's app lock PIN (used before sensitive operations).
 * Returns valid: true + attemptsRemaining: null on success.
 * Returns valid: false + attemptsRemaining on failure (locks after 5 attempts).
 */
export async function verifyPin(
  userId: string,
  pin: string,
  signal?: AbortSignal
): Promise<VerifyPinResponse> {
  return api<VerifyPinResponse>(
    `/users/${userId}/pin/verify`,
    {
      method: 'POST',
      body: JSON.stringify({ pin }),
      signal,
    }
  )
}

/**
 * Reset the app lock PIN using an OTP sent to the user's registered phone.
 * Use when the user has forgotten their PIN and been locked out.
 * Returns the updated PIN state (pinEnabled: true, updatedAt).
 */
export async function resetPin(
  userId: string,
  data: { otp: string; newPin: string },
  signal?: AbortSignal
): Promise<ResetPinResponse> {
  return api<ResetPinResponse>(
    `/users/${userId}/pin/reset`,
    {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    }
  )
}

/**
 * Set or change the business-level operation PIN.
 * The operation PIN is used by owners/admins to approve sensitive actions
 * (approve locked-transaction edits, bulk deletes, role changes).
 * Pass currentPin if an operation PIN is already set (operationPinSet: true).
 * Returns 400 if currentPin is wrong when one is already set.
 */
export async function setOperationPin(
  businessId: string,
  data: { currentPin?: string; newPin: string },
  signal?: AbortSignal
): Promise<SetOperationPinResponse> {
  return api<SetOperationPinResponse>(
    `/businesses/${businessId}/operation-pin`,
    {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    }
  )
}
