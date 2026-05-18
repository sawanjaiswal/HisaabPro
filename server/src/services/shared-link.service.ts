/**
 * SharedLink service — issue, revoke, list.
 *
 * Token strategy (§6.1 of ARCHITECTURE_EPIC_C):
 *   - 32 crypto-random bytes → base64url plaintext token (~43 chars)
 *   - sha256(token) hex stored in DB as tokenHash
 *   - Plaintext returned ONCE in the issue response; never readable again
 */

import crypto from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import type { SharedLink } from '@prisma/client'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

// Fields safe to expose in list responses — tokenHash MUST NOT appear.
type SafeSharedLink = Omit<SharedLink, 'tokenHash'>

function stripTokenHash(link: SharedLink): SafeSharedLink {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tokenHash: _tokenHash, ...safe } = link
  return safe
}

// ---------------------------------------------------------------------------
// issueSharedLink
// ---------------------------------------------------------------------------

export interface IssueSharedLinkArgs {
  resourceType: 'INVOICE' | 'INVITE' | 'STORE'
  resourceId: string
  businessId: string
  issuedById: string
  /** Days until expiry. Omit or pass undefined for no expiry. */
  ttlDays?: number
  metadata?: Record<string, unknown>
}

export interface IssuedLink {
  /** The row without tokenHash (safe to log/store elsewhere) */
  link: SafeSharedLink
  /** Plaintext opaque token — hand to the caller NOW; unrecoverable after this response */
  token: string
}

export async function issueSharedLink(args: IssueSharedLinkArgs): Promise<IssuedLink> {
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = sha256(token)

  const expiresAt = args.ttlDays != null
    ? new Date(Date.now() + args.ttlDays * 86_400_000)
    : null

  const link = await prisma.sharedLink.create({
    data: {
      tokenHash,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      businessId: args.businessId,
      issuedById: args.issuedById,
      expiresAt,
      metadata: args.metadata ?? undefined,
    },
  })

  return { link: stripTokenHash(link), token }
}

// ---------------------------------------------------------------------------
// revokeSharedLink
// ---------------------------------------------------------------------------

export interface RevokeSharedLinkArgs {
  id: string
  businessId: string
  userId: string
}

export async function revokeSharedLink(args: RevokeSharedLinkArgs): Promise<SafeSharedLink> {
  return prisma.$transaction(async (tx) => {
    const link = await tx.sharedLink.update({
      where: {
        id: args.id,
        businessId: args.businessId, // tenant scope — IDOR guard
      },
      data: { revokedAt: new Date() },
    })

    await tx.auditLog.create({
      data: {
        businessId: args.businessId,
        entityType: 'SharedLink',
        entityId: link.id,
        entityLabel: `${link.resourceType}:${link.resourceId}`.slice(0, 120),
        userId: args.userId,
        action: 'REVOKE',
        changes: { resourceType: link.resourceType, resourceId: link.resourceId },
      },
    })

    return stripTokenHash(link)
  })
}

// ---------------------------------------------------------------------------
// listSharedLinks
// ---------------------------------------------------------------------------

export interface ListSharedLinksArgs {
  resourceType: 'INVOICE' | 'INVITE' | 'STORE'
  resourceId: string
  businessId: string
}

export async function listSharedLinks(args: ListSharedLinksArgs): Promise<SafeSharedLink[]> {
  const links = await prisma.sharedLink.findMany({
    where: {
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      businessId: args.businessId,
      revokedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  })

  return links.map(stripTokenHash)
}
