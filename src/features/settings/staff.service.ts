/** Staff Management — API service layer
 *
 * All service functions accept an optional AbortSignal for cleanup in useEffect.
 * The `api()` helper already prepends API_URL, so paths begin with /.
 */

import { api } from '@/lib/api'
import type {
  StaffListResponse,
  InviteStaffData,
  InviteResponse,
  StaffMember,
  StaffInvite,
} from './settings.types'

// ─── Local response shapes ────────────────────────────────────────────────────

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

// ─── Staff ────────────────────────────────────────────────────────────────────

/**
 * Fetch all active staff members and pending invites for the business.
 * staff[] contains joined members; pending[] contains unexpired invite records.
 */
export async function getStaff(
  businessId: string,
  signal?: AbortSignal
): Promise<StaffListResponse> {
  // api() unwraps the success envelope; re-wrap for consumers using `.data.staff`.
  const unwrapped = await api<{ staff: StaffMember[]; pending: StaffInvite[] }>(
    `/businesses/${businessId}/staff`,
    { signal }
  )
  return {
    success: true,
    data: {
      staff: unwrapped?.staff ?? [],
      pending: unwrapped?.pending ?? [],
    },
  }
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
      entityType: 'staff-invite',
      entityLabel: data.phone ? `Invite ${data.phone}` : 'Invite staff',
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
      entityType: 'staff',
      entityLabel: 'Update staff role',
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
      entityType: 'staff',
      entityLabel: 'Suspend staff',
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
      entityType: 'staff',
      entityLabel: 'Remove staff',
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
      entityType: 'staff-invite',
      entityLabel: 'Resend invite',
    }
  )
}
