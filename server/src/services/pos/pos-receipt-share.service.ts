/**
 * POS Receipt Share Service — generate signed shareable receipt URLs.
 * Supports WhatsApp and email channels with 30-day TTL.
 * HMAC-SHA256 signature keyed by POS_SHARE_SECRET env var.
 */

import crypto from 'node:crypto'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { notFoundError } from '../../lib/errors.js'
import type { PosServiceCtx } from './pos.types.js'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ShareChannel = 'WHATSAPP' | 'EMAIL'

export interface ShareLinkResult {
  channel: ShareChannel
  link: string
  expires: Date
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SHARE_TTL_DAYS = 30
const POS_RECEIPT_EVENT = 'RECEIPT_SHARED' as const

function getShareSecret(): string {
  return process.env.POS_SHARE_SECRET ?? 'pos-share-dev-secret'
}

function getBaseUrl(): string {
  return (process.env.BASE_URL ?? 'https://app.hisaabpro.in').replace(/\/$/, '')
}

// ─── HMAC helpers ─────────────────────────────────────────────────────────────

function buildSignature(posSaleId: string, expiresUnix: number): string {
  const payload = `${posSaleId}:${expiresUnix}`
  return crypto
    .createHmac('sha256', getShareSecret())
    .update(payload)
    .digest('hex')
}

function buildShareUrl(posSaleId: string, expiresUnix: number): string {
  const sig = buildSignature(posSaleId, expiresUnix)
  return `${getBaseUrl()}/share/pos/${posSaleId}?exp=${expiresUnix}&sig=${sig}`
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function buildShareLink(
  ctx: PosServiceCtx,
  posSaleId: string,
  opts: { channel: ShareChannel }
): Promise<ShareLinkResult> {
  // Verify sale belongs to this business
  const sale = await prisma.posSale.findFirst({
    where: { id: posSaleId, businessId: ctx.businessId },
    select: { id: true },
  })
  if (!sale) throw notFoundError('PosSale', { posSaleId })

  // Compute TTL
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SHARE_TTL_DAYS)
  const expiresUnix = Math.floor(expiresAt.getTime() / 1000)

  // Build signed URL
  const link = buildShareUrl(posSaleId, expiresUnix)

  // Append audit event
  await prisma.posSaleEvent.create({
    data: {
      posSaleId,
      type: POS_RECEIPT_EVENT,
      actorId: ctx.userId,
      payload: { channel: opts.channel, expiresAt: expiresAt.toISOString() },
    },
  })

  logger.info('POS receipt share link generated', {
    posSaleId,
    channel: opts.channel,
    expiresAt: expiresAt.toISOString(),
    userId: ctx.userId,
    businessId: ctx.businessId,
  })

  return { channel: opts.channel, link, expires: expiresAt }
}

/**
 * Verify a share link signature (used by the public share endpoint, not the POS API).
 * Returns true if the signature is valid and the link has not expired.
 */
export function verifyShareLink(
  posSaleId: string,
  expiresUnix: number,
  sig: string
): boolean {
  const now = Math.floor(Date.now() / 1000)
  if (expiresUnix < now) return false
  const expected = buildSignature(posSaleId, expiresUnix)
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
}
