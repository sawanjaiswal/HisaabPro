/**
 * Aging Service — receivables bucket computation + cache wrapper.
 *
 * computeAgingBuckets: one-pass SQL aggregation over SALES_INVOICE documents.
 * getAgingBuckets:     cache-wrapped version (5-min TTL in-process).
 * getAgingParties:     cursor-paginated party list for a single bucket.
 */

import { getOrCompute } from '../../lib/cache.js'
import logger from '../../lib/logger.js'
import {
  fetchAgingRows,
  fetchLastPaymentDates,
  fetchPtpCounts,
  type BucketRow,
} from './aging-query.js'

const CACHE_TTL = 300 // 5 minutes

export type AgingBucket = 'current' | 'bucket_31' | 'bucket_61' | 'bucket_91'

export interface BucketSummary {
  label: string
  totalAmount: number
  partyCount: number
}

export interface AgingBucketResult {
  summary: {
    totalReceivable: number
    buckets: Record<AgingBucket, BucketSummary>
  }
  topOutstanding: TopOutstandingParty[]
  brokenPtps: number
}

export interface TopOutstandingParty {
  partyId: string
  name: string
  phone: string | null
  totalOutstanding: number
  overdueInvoiceCount: number
}

export interface PartyInBucket {
  partyId: string
  name: string
  phone: string | null
  bucketAmount: number
  totalOutstanding: number
  overdueInvoiceCount: number
  lastPaymentDate: Date | null
  openPtpCount: number
  brokenPtpCount: number
}

const BUCKET_LABELS: Record<AgingBucket, string> = {
  current:   '0–30 days',
  bucket_31: '31–60 days',
  bucket_61: '61–90 days',
  bucket_91: '90+ days',
}

// ─── Core computation ────────────────────────────────────────────────────────

export async function computeAgingBuckets(
  businessId: string,
  asOf: Date
): Promise<AgingBucketResult> {
  const [rows, ptpRows] = await Promise.all([
    fetchAgingRows(businessId, asOf),
    fetchPtpCounts(businessId),
  ])

  // Aggregate bucket totals and per-party totals
  const buckets: Record<AgingBucket, BucketSummary> = {
    current:   { label: BUCKET_LABELS.current,   totalAmount: 0, partyCount: 0 },
    bucket_31: { label: BUCKET_LABELS.bucket_31, totalAmount: 0, partyCount: 0 },
    bucket_61: { label: BUCKET_LABELS.bucket_61, totalAmount: 0, partyCount: 0 },
    bucket_91: { label: BUCKET_LABELS.bucket_91, totalAmount: 0, partyCount: 0 },
  }

  // Build per-party totals across all buckets
  const partyTotals = new Map<string, { total: number; row: BucketRow }>()

  for (const row of rows) {
    buckets[row.bucket].totalAmount += row.bucketAmount
    buckets[row.bucket].partyCount++

    const existing = partyTotals.get(row.partyId)
    if (existing) {
      existing.total += row.bucketAmount
    } else {
      partyTotals.set(row.partyId, { total: row.bucketAmount, row })
    }
  }

  const totalReceivable = Object.values(buckets).reduce((s, b) => s + b.totalAmount, 0)

  // Top 5 parties by total outstanding
  const topOutstanding: TopOutstandingParty[] = Array.from(partyTotals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map(({ total, row }) => ({
      partyId: row.partyId,
      name: row.partyName,
      phone: row.partyPhone,
      totalOutstanding: total,
      overdueInvoiceCount: rows
        .filter(r => r.partyId === row.partyId && r.bucket !== 'current')
        .reduce((s, r) => s + r.invoiceCount, 0),
    }))

  const brokenPtps = ptpRows.reduce((s, r) => s + r.brokenPtpCount, 0)

  logger.info('Aging buckets computed', { businessId, totalReceivable, brokenPtps })

  return { summary: { totalReceivable, buckets }, topOutstanding, brokenPtps }
}

// ─── Cache-wrapped entry point ───────────────────────────────────────────────

export async function getAgingBuckets(businessId: string): Promise<AgingBucketResult> {
  const key = `aging:${businessId}`
  return getOrCompute(key, CACHE_TTL, () => computeAgingBuckets(businessId, new Date()))
}

// ─── Cursor-paginated parties in a bucket ───────────────────────────────────

export async function getAgingParties(
  businessId: string,
  bucket: AgingBucket,
  cursor: string | undefined,
  limit: number
): Promise<{ data: PartyInBucket[]; nextCursor: string | null }> {
  const asOf = new Date()
  const [rows, lastPaymentRows, ptpRows] = await Promise.all([
    fetchAgingRows(businessId, asOf),
    fetchLastPaymentDates(businessId),
    fetchPtpCounts(businessId),
  ])

  const lastPaymentMap = new Map(lastPaymentRows.map(r => [r.partyId, r.lastPaymentDate]))
  const ptpMap = new Map(ptpRows.map(r => [r.partyId, r]))

  // Filter to requested bucket, then aggregate per party
  const bucketRows = rows.filter(r => r.bucket === bucket)

  // Build per-party map for requested bucket
  const partyMap = new Map<string, PartyInBucket>()
  for (const row of rows) {
    const ptp = ptpMap.get(row.partyId)
    if (!partyMap.has(row.partyId)) {
      partyMap.set(row.partyId, {
        partyId: row.partyId,
        name: row.partyName,
        phone: row.partyPhone,
        bucketAmount: 0,
        totalOutstanding: 0,
        overdueInvoiceCount: 0,
        lastPaymentDate: lastPaymentMap.get(row.partyId) ?? null,
        openPtpCount: ptp?.openPtpCount ?? 0,
        brokenPtpCount: ptp?.brokenPtpCount ?? 0,
      })
    }
    const entry = partyMap.get(row.partyId)!
    entry.totalOutstanding += row.bucketAmount
    if (row.bucket === bucket) {
      entry.bucketAmount += row.bucketAmount
      if (bucket !== 'current') entry.overdueInvoiceCount += row.invoiceCount
    }
  }

  // Filter to parties that actually appear in the requested bucket
  const bucketPartyIds = new Set(bucketRows.map(r => r.partyId))
  let parties = Array.from(partyMap.values())
    .filter(p => bucketPartyIds.has(p.partyId))
    .sort((a, b) => b.bucketAmount - a.bucketAmount)

  // Cursor: skip everything up to and including the cursor partyId
  if (cursor) {
    const idx = parties.findIndex(p => p.partyId === cursor)
    if (idx !== -1) parties = parties.slice(idx + 1)
  }

  const page = parties.slice(0, limit + 1)
  const hasMore = page.length > limit
  const data = hasMore ? page.slice(0, limit) : page
  const nextCursor = hasMore ? (data[data.length - 1]?.partyId ?? null) : null

  return { data, nextCursor }
}
