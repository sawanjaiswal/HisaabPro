/** Party Invite-Claim — API service layer (Epic C PR5 / #131) */

import { api } from '@/lib/api'
import type {
  InviteIssueResponse,
  InvitePreview,
  OtpSendResponse,
  OtpVerifyResponse,
  ClaimBody,
  ClaimResponse,
} from './invite-claim.types'

// ─── Auth-side (issued by business user) ────────────────────────────────────

/** POST /api/parties/:partyId/invite — authenticated */
export async function issueInvite(partyId: string): Promise<InviteIssueResponse> {
  return api<InviteIssueResponse>(`/parties/${partyId}/invite`, {
    method:      'POST',
    entityType:  'invite',
    entityLabel: `Party ${partyId}`,
  })
}

// ─── Public (no auth required) ───────────────────────────────────────────────

/**
 * GET /api/p/invite/:token — public preview.
 * cacheReads intentionally false — link tokens are sensitive one-time artefacts.
 */
export async function getInvitePreview(token: string): Promise<InvitePreview> {
  return api<InvitePreview>(`/p/invite/${token}`)
}

/** POST /api/p/invite/:token/otp/send */
export async function sendInviteOtp(token: string): Promise<OtpSendResponse> {
  return api<OtpSendResponse>(`/p/invite/${token}/otp/send`, {
    method:      'POST',
    entityType:  'invite-otp',
    entityLabel: 'OTP send',
  })
}

/** POST /api/p/invite/:token/otp/verify */
export async function verifyInviteOtp(
  token: string,
  body: { otpSessionId: string; code: string },
): Promise<OtpVerifyResponse> {
  return api<OtpVerifyResponse>(`/p/invite/${token}/otp/verify`, {
    method:      'POST',
    body:        JSON.stringify(body),
    entityType:  'invite-otp',
    entityLabel: 'OTP verify',
  })
}

/** POST /api/p/invite/:token/claim */
export async function claimInvite(
  token: string,
  body: ClaimBody,
): Promise<ClaimResponse> {
  return api<ClaimResponse>(`/p/invite/${token}/claim`, {
    method:      'POST',
    body:        JSON.stringify(body),
    entityType:  'invite-claim',
    entityLabel: 'Claim portal',
  })
}
