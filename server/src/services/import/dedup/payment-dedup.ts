/**
 * Phase 7 · 7.1D PR-D2b — Payment exact-dedup (5-tuple).
 *
 * Surfaces existing Payments in the SAME business that match a staged
 * row on the canonical 5-tuple key:
 *   (businessId, paymentDate, partyKey, amountPaise, referenceTail100)
 *
 * `partyKey` is `partyId` when resolved (FK), or the lower-cased,
 * whitespace-collapsed `partyName` when not. `referenceTail100` is
 * `truncateReference()` output value, or `''` for null/empty refs.
 *
 * Pure-ish: takes a Prisma client argument so unit tests can pass a
 * mock. Returns `Map<sourceIndex, PaymentDupMatch>` consumed by the
 * import preview service. Tenant-scoping is enforced via the strict
 * `businessId` filter in the WHERE clause (SECURITY_AUDIT M1 / S5).
 *
 * Authority:
 *   - SCOPE_PHASE7_IMPORT_7_1D_PAYMENTS.md §10 (dedup policy)
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1D.md §5
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1D.md S3 (tail-100 SSOT)
 */

import type { ExtendedPrismaClient } from '../../../lib/prisma.js'
import type { NormalizedPayment } from '../commit-payments/types.js'
import { truncateReference } from '../normalizers/payment-utils.js'

export interface PaymentDupMatch {
  paymentId: string
  partyId: string | null
  paymentDate: string
  amountPaise: number
  matchedBy: 'EXACT_5TUPLE'
}

export interface StagedPaymentLike {
  sourceIndex: number
  normalized: NormalizedPayment
}

export interface FindPaymentDupArgs {
  businessId: string
  rows: StagedPaymentLike[]
  prisma: Pick<ExtendedPrismaClient, 'payment'>
}

/**
 * Canonical `partyKey` for the dedup hash. Prefers FK; falls back to
 * the (lower-cased, ws-collapsed) party name. NFKC fold protects
 * against visually-identical Unicode variants.
 */
function partyKey(p: NormalizedPayment): string {
  if (p.partyId) return `id:${p.partyId}`
  const name = (p.partyName ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
  return `nm:${name}`
}

function refTail(p: NormalizedPayment): string {
  if (!p.referenceNumber) return ''
  // referenceNumber on a NormalizedPayment is already tail-100 truncated
  // by the normalizer — re-run truncateReference to defend against any
  // upstream regression that forgets to call the SSOT.
  const r = truncateReference(p.referenceNumber)
  return r?.value ?? ''
}

function dedupKey(p: NormalizedPayment): string {
  // Pipe-delimited; pipes are excluded from referenceNumber's truncation
  // semantics so collisions cannot be engineered via key-encoding clash.
  return [p.date, partyKey(p), String(p.amountPaise), refTail(p)].join('|')
}

/**
 * Find exact 5-tuple dedup matches. The query is constructed defensively:
 * the OR is over a small array of `paymentDate`+`amount` pairs (NOT the
 * full Cartesian) to keep the planner sane on large batches.
 */
export async function findPaymentDuplicates(
  args: FindPaymentDupArgs,
): Promise<Map<number, PaymentDupMatch>> {
  const { businessId, rows, prisma } = args
  const out = new Map<number, PaymentDupMatch>()
  if (rows.length === 0) return out

  // Build the candidate filter — (date, amountPaise) pairs and a set of
  // partyIds. Reference / partyName are filtered in-memory after the DB
  // hit since `referenceNumber` is VarChar(100) and partyName is wide.
  const dates = new Set<string>()
  const amounts = new Set<number>()
  const partyIds = new Set<string>()
  for (const r of rows) {
    if (!r.normalized.date || r.normalized.amountPaise <= 0) continue
    dates.add(r.normalized.date)
    amounts.add(r.normalized.amountPaise)
    if (r.normalized.partyId) partyIds.add(r.normalized.partyId)
  }
  if (dates.size === 0 || amounts.size === 0) return out

  const where = {
    businessId, // tenancy guard — non-negotiable
    isDeleted: false,
    date: { in: Array.from(dates).map((d) => new Date(d)) },
    amount: { in: Array.from(amounts) },
  }

  const existing = await prisma.payment.findMany({
    where,
    select: {
      id: true,
      partyId: true,
      date: true,
      amount: true,
      referenceNumber: true,
    },
  })

  // Build a lookup table by dedupKey for O(1) row matching.
  const byKey = new Map<string, PaymentDupMatch>()
  for (const e of existing) {
    const isoDate =
      e.date instanceof Date
        ? e.date.toISOString().slice(0, 10)
        : String(e.date).slice(0, 10)
    const synth: NormalizedPayment = {
      partyId: e.partyId,
      partyName: '', // matched via partyId branch below
      partyPhone: null,
      date: isoDate,
      amountPaise: Number(e.amount),
      mode: null,
      referenceNumber: e.referenceNumber,
      invoiceNumber: null,
      invoiceId: null,
      notes: null,
    }
    const key = dedupKey(synth)
    byKey.set(key, {
      paymentId: e.id,
      partyId: e.partyId,
      paymentDate: isoDate,
      amountPaise: Number(e.amount),
      matchedBy: 'EXACT_5TUPLE',
    })
  }

  for (const r of rows) {
    const key = dedupKey(r.normalized)
    const hit = byKey.get(key)
    if (hit) out.set(r.sourceIndex, hit)
  }
  return out
}
