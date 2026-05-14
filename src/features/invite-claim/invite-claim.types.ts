/** Party Invite-Claim — Type definitions (Epic C PR5 / #131) */

export interface InviteIssueResponse {
  linkId:    string
  token:     string
  url:       string
  expiresAt: string
}

export interface InvitePreview {
  businessName:     string
  partyName:        string
  partyPhoneMasked: string
  invitedAt:        string
  expiresAt:        string
  requiresOtp:      boolean
}

export interface OtpSendResponse {
  otpSessionId: string
  expiresIn:    number
}

export interface OtpVerifyResponse {
  otpVerifiedToken: string
}

export interface ClaimSignupBody {
  kind:     'signup'
  name:     string
  password: string
}

export interface ClaimExistingBody {
  kind:             'existing'
  otpVerifiedToken: string
}

export type ClaimBody = ClaimSignupBody | ClaimExistingBody

export interface ClaimResponse {
  ok:       boolean
  redirect: string
}

/** API error codes returned by the claim endpoint */
export type InviteErrorCode =
  | 'LINK_REVOKED'
  | 'LINK_EXPIRED'
  | 'LINK_CONSUMED'
  | 'PARTY_ALREADY_BOUND'
  | 'OTP_REQUIRED'
  | 'OTP_INVALID'

export type InvitePageStatus =
  | 'loading'
  | 'revoked'
  | 'expired'
  | 'consumed'
  | 'not-found'
  | 'error'
  | 'preview'
