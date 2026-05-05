/**
 * Aging query helpers — raw SQL bucket aggregation for P50 < 800ms on 5K invoices.
 * Kept separate from aging.service.ts to stay within 250-line limit.
 */

import { prisma } from '../../lib/prisma.js'

export interface BucketRow {
  partyId: string
  partyName: string
  partyPhone: string | null
  bucket: 'current' | 'bucket_31' | 'bucket_61' | 'bucket_91'
  bucketAmount: number
  invoiceCount: number
}

export interface LastPaymentRow {
  partyId: string
  lastPaymentDate: Date | null
}

export interface PtpRow {
  partyId: string
  openPtpCount: number
  brokenPtpCount: number
}

/**
 * Single-query aggregation: groups all outstanding SALES_INVOICE rows by party
 * and assigns each to a bucket based on age of effective due date vs asOf.
 * Uses Prisma $queryRaw so we can do CASE WHEN bucketing in one pass.
 */
export async function fetchAgingRows(businessId: string, asOf: Date): Promise<BucketRow[]> {
  // Using tagged template — parameters are safely interpolated by Prisma
  const rows = await prisma.$queryRaw<Array<{
    party_id: string
    party_name: string
    party_phone: string | null
    bucket: string
    bucket_amount: bigint
    invoice_count: bigint
  }>>`
    SELECT
      p.id            AS party_id,
      p.name          AS party_name,
      p.phone         AS party_phone,
      CASE
        WHEN (COALESCE(d."dueDate", d."documentDate" + INTERVAL '30 days')) >= ${asOf}
          THEN 'current'
        WHEN (COALESCE(d."dueDate", d."documentDate" + INTERVAL '30 days')) >= ${asOf} - INTERVAL '30 days'
          THEN 'bucket_31'
        WHEN (COALESCE(d."dueDate", d."documentDate" + INTERVAL '30 days')) >= ${asOf} - INTERVAL '60 days'
          THEN 'bucket_61'
        ELSE 'bucket_91'
      END             AS bucket,
      SUM(d."balanceDue")::bigint AS bucket_amount,
      COUNT(*)::bigint            AS invoice_count
    FROM "Document" d
    JOIN "Party"    p ON p.id = d."partyId"
    WHERE
      d."businessId" = ${businessId}
      AND d.type     = 'SALES_INVOICE'
      AND d.status   IN ('SAVED', 'SHARED', 'COMPLETED')
      AND d."isDeleted" = false
      AND d."balanceDue" > 0
    GROUP BY p.id, p.name, p.phone, bucket
    ORDER BY bucket_amount DESC
  `

  return rows.map(r => ({
    partyId: r.party_id,
    partyName: r.party_name,
    partyPhone: r.party_phone,
    bucket: r.bucket as BucketRow['bucket'],
    bucketAmount: Number(r.bucket_amount),
    invoiceCount: Number(r.invoice_count),
  }))
}

/**
 * Fetch last payment date per party for the given business.
 * Reads from Payment (not PaymentAllocation) for simplicity.
 */
export async function fetchLastPaymentDates(businessId: string): Promise<LastPaymentRow[]> {
  const rows = await prisma.$queryRaw<Array<{
    party_id: string
    last_payment_date: Date | null
  }>>`
    SELECT "partyId" AS party_id, MAX("date") AS last_payment_date
    FROM "Payment"
    WHERE "businessId" = ${businessId}
      AND "isDeleted" = false
    GROUP BY "partyId"
  `
  return rows.map(r => ({
    partyId: r.party_id,
    lastPaymentDate: r.last_payment_date,
  }))
}

/**
 * Fetch open and broken PTP counts per party.
 */
export async function fetchPtpCounts(businessId: string): Promise<PtpRow[]> {
  const rows = await prisma.$queryRaw<Array<{
    party_id: string
    open_ptp_count: bigint
    broken_ptp_count: bigint
  }>>`
    SELECT
      "partyId"                                            AS party_id,
      COUNT(*) FILTER (WHERE status = 'OPEN')::bigint      AS open_ptp_count,
      COUNT(*) FILTER (WHERE status = 'BROKEN')::bigint    AS broken_ptp_count
    FROM "PromiseToPay"
    WHERE "businessId" = ${businessId}
      AND "isDeleted"  = false
    GROUP BY "partyId"
  `
  return rows.map(r => ({
    partyId: r.party_id,
    openPtpCount: Number(r.open_ptp_count),
    brokenPtpCount: Number(r.broken_ptp_count),
  }))
}
