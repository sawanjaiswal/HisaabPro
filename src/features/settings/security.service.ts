/** Security — Transaction Lock, Approvals & PIN — API service layer
 *
 * All service functions accept an optional AbortSignal for cleanup in useEffect.
 * The `api()` helper already prepends API_URL, so paths begin with /.
 */

import { api } from '@/lib/api'
import type {
  TransactionLockConfig,
  TransactionLockResponse,
  ApprovalsListResponse,
  ApprovalStatus,
} from './settings.types'

// ─── Local response shapes ────────────────────────────────────────────────────

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
      entityType: 'transaction-lock',
      entityLabel: 'Transaction lock settings',
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
      entityType: 'approval',
      entityLabel: action === 'APPROVE' ? 'Approve request' : 'Deny request',
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
      entityType: 'pin',
      entityLabel: data.currentPin ? 'Change PIN' : 'Set PIN',
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
      entityType: 'pin',
      entityLabel: 'Verify PIN',
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
      entityType: 'pin',
      entityLabel: 'Reset PIN',
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
      entityType: 'operation-pin',
      entityLabel: data.currentPin ? 'Change operation PIN' : 'Set operation PIN',
    }
  )
}
