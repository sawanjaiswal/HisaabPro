/**
 * sanitize-invite-public.ts — Pick-based sanitizer for invite preview payloads.
 *
 * Security E1: explicit allowlist object construction — no Prisma spread.
 * Every field that leaves the server for GET /api/p/invite/:token must appear
 * in PublicInvitePreviewDto.  A field added to Party / Business / SharedLink
 * is invisible to the public until someone explicitly adds it here.
 *
 * PII rules (ARCHITECTURE §8 / security F2):
 *   - partyPhone exposed as last-4 masked only: "+91 **** XXXX"
 *   - No party email, address, GSTIN, PAN, notes, creditLimit, balance
 *   - No party id, businessId, userId, internal timestamps
 *   - No business email, bank, address, GSTIN, owner name, plan details
 */

import { maskPhonePublic } from '../lib/phone-pii.js'

// ---------------------------------------------------------------------------
// DTO type
// ---------------------------------------------------------------------------

export type PublicInvitePreviewDto = {
  businessName: string
  partyName: string
  /** Last 4 digits visible; rest masked — e.g. "+91 **** 3210" */
  partyPhoneMasked: string | null
  invitedAt: string // ISO — createdAt of the SharedLink
  expiresAt: string | null // ISO or null if no expiry
  /**
   * true  — a User with this phone already exists; claim requires OTP.
   * false — new-user signup branch (OTP via registration flow).
   */
  requiresOtp: boolean
}

// ---------------------------------------------------------------------------
// Input shape — only the fields we SELECT from the DB (avoids over-fetching)
// ---------------------------------------------------------------------------

type InviteParty = {
  name: string
  phone: string | null
}

type InviteBusiness = {
  name: string
}

type InviteSharedLink = {
  createdAt: Date
  expiresAt: Date | null
}

// ---------------------------------------------------------------------------
// Sanitizer
// ---------------------------------------------------------------------------

export function sanitizeInvitePreview(
  link: InviteSharedLink,
  party: InviteParty,
  business: InviteBusiness,
  existingUserWithPhone: boolean
): PublicInvitePreviewDto {
  return {
    businessName: business.name,
    partyName: party.name,
    partyPhoneMasked: maskPhonePublic(party.phone),
    invitedAt: link.createdAt.toISOString(),
    expiresAt: link.expiresAt?.toISOString() ?? null,
    requiresOtp: existingUserWithPhone,
  }
}
