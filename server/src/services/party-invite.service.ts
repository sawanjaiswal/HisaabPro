/**
 * party-invite.service.ts — Invite issuance and atomic claim for Party portals.
 *
 * Security invariants (per SECURITY_AUDIT_EPIC_C.md):
 *   A5 / C3 / F3 — claim runs a single $transaction with guarded updateMany;
 *                  no read-then-write gap; concurrent claims: first wins (count=1),
 *                  rest see count=0 and get 409.
 *   C2            — every Party/Business fetch includes businessId scope (IDOR guard).
 *   F2            — existing-user branch: caller MUST pass a valid otpVerifiedToken;
 *                  this service validates it before any mutation.
 *
 * DO NOT modify auth.service.ts — use issueSharedLink from shared-link.service.ts
 * and the OTP helpers from invite-otp.service.ts only.
 */

import crypto from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { issueSharedLink } from './shared-link.service.js'
import { PublicLinkError } from '../middleware/resolve-public-token.js'
import { verifyOtpVerifiedToken } from './invite-otp.service.js'

// ---------------------------------------------------------------------------
// Internal helper — sha256 (mirrors resolve-public-token.ts)
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

// ---------------------------------------------------------------------------
// issueInvite — authenticated, owner/staff only
// ---------------------------------------------------------------------------

export interface IssueInviteArgs {
  partyId: string
  businessId: string
  issuedById: string
}

export interface IssuedInvite {
  token: string
  linkId: string
  expiresAt: string
  url: string
}

/**
 * Issue a 7-day invite link for a Party.
 * Fixed TTL (no picker) per architecture §11 / TASKS PR5.
 * Returns the plaintext token exactly once — store or discard, never recoverable.
 */
export async function issueInvite(args: IssueInviteArgs): Promise<IssuedInvite> {
  // Tenant-scope: Party must belong to caller's business (IDOR guard — C2)
  const party = await prisma.party.findFirst({
    where: {
      id: args.partyId,
      businessId: args.businessId,
      isDeleted: false,
    },
    select: { id: true, name: true, phone: true },
  })

  if (!party) {
    const err = new Error('Party not found') as Error & { statusCode: number }
    err.statusCode = 404
    throw err
  }

  const { link, token } = await issueSharedLink({
    resourceType: 'INVITE',
    resourceId: party.id,
    businessId: args.businessId,
    issuedById: args.issuedById,
    ttlDays: 7,
    metadata: {
      partyName: party.name,
      partyPhone: party.phone ?? null,
    },
  })

  return {
    token,
    linkId: link.id,
    expiresAt: link.expiresAt!.toISOString(),
    url: `/p/invite/${token}`,
  }
}

// ---------------------------------------------------------------------------
// claimInvite — atomic guarded transaction (A5 / C3 / F3)
// ---------------------------------------------------------------------------

export type ClaimKind = 'existing' | 'signup'

export interface ClaimInviteArgs {
  /** Raw plaintext token from the URL */
  rawToken: string
  /** userId to bind — must be resolved BEFORE calling this function */
  newUserId: string
  /** For 'existing': the signed otpVerifiedToken from /otp/verify */
  otpVerifiedToken?: string
  kind: ClaimKind
}

export interface ClaimInviteResult {
  partyId: string
  businessId: string
}

/**
 * Atomically consume the invite link and bind Party.userId.
 *
 * Transaction sequence (ARCHITECTURE §6.4):
 *  1. updateMany on SharedLink — WHERE {tokenHash, resource:'INVITE',
 *     revokedAt:null, claimedAt:null, not-expired} → SET {claimedAt, revokedAt}
 *     If count === 0: another request won the race → 409 LINK_CONSUMED
 *  2. Re-fetch link inside tx to get resourceId / businessId
 *  3. updateMany on Party — WHERE {id, businessId, userId:null} → SET {userId}
 *     If count === 0: Party already bound to another User → 409 PARTY_ALREADY_BOUND
 *
 * For the 'existing' branch, otpVerifiedToken MUST be validated before calling.
 * This function validates it again internally as belt-and-braces.
 */
export async function claimInvite(args: ClaimInviteArgs): Promise<ClaimInviteResult> {
  const tokenHash = sha256(args.rawToken)

  // F2 — OTP gate for existing-user branch
  if (args.kind === 'existing') {
    if (!args.otpVerifiedToken) {
      throw new PublicLinkError('LINK_NOT_FOUND', 401) // use generic to avoid info leak
    }
    let payload: ReturnType<typeof verifyOtpVerifiedToken>
    try {
      payload = verifyOtpVerifiedToken(args.otpVerifiedToken)
    } catch {
      throw new PublicLinkError('LINK_NOT_FOUND', 401)
    }
    // The otpVerifiedToken MUST be scoped to THIS link's tokenHash
    if (payload.tokenHash !== tokenHash) {
      throw new PublicLinkError('LINK_NOT_FOUND', 401)
    }
  }

  return prisma.$transaction(async (tx) => {
    const now = new Date()

    // 1. Atomic guarded mark on SharedLink — single SQL UPDATE with all conditions
    const marked = await tx.sharedLink.updateMany({
      where: {
        tokenHash,
        resourceType: 'INVITE',
        revokedAt: null,
        claimedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: {
        claimedAt: now,
        revokedAt: now,
      },
    })

    if (marked.count === 0) {
      // Either already claimed, revoked, expired, or never existed.
      // Use LINK_CONSUMED for any of these — they're all "not claimable".
      throw new PublicLinkError('LINK_CONSUMED', 409)
    }

    // 2. Re-fetch link for resourceId + businessId (safe because we just claimed it above)
    const link = await tx.sharedLink.findUnique({
      where: { tokenHash },
      select: { resourceId: true, businessId: true },
    })
    if (!link) {
      // Extremely unlikely — just marked it 1ms ago
      throw new PublicLinkError('LINK_CONSUMED', 409)
    }

    // 3. Atomic bind of Party.userId — only succeeds if still null (unique guard)
    const bound = await tx.party.updateMany({
      where: {
        id: link.resourceId,
        businessId: link.businessId, // IDOR guard — C2
        userId: null,
      },
      data: { userId: args.newUserId },
    })

    if (bound.count === 0) {
      // Party.userId already set — another invite won or a race on the same party
      throw new PublicLinkError('LINK_CONSUMED', 409)
    }

    return { partyId: link.resourceId, businessId: link.businessId }
  })
}
