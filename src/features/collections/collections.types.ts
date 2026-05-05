/**
 * Collections feature — shared TypeScript types.
 * Mirrors the server-side AgingBucketResult shape.
 */

export type AgingBucket = 'current' | 'bucket_31' | 'bucket_61' | 'bucket_91'

export interface BucketSummary {
  label: string
  totalAmount: number
  partyCount: number
}

export interface AgingBucketSummary {
  totalReceivable: number
  buckets: Record<AgingBucket, BucketSummary>
}

export interface TopOutstandingParty {
  partyId: string
  name: string
  phone: string | null
  totalOutstanding: number
  overdueInvoiceCount: number
}

export interface AgingBucketResult {
  summary: AgingBucketSummary
  topOutstanding: TopOutstandingParty[]
  brokenPtps: number
}

export interface PartyInBucket {
  partyId: string
  name: string
  phone: string | null
  bucketAmount: number
  totalOutstanding: number
  overdueInvoiceCount: number
  lastPaymentDate: string | null
  openPtpCount: number
  brokenPtpCount: number
}

export interface AgingPartiesResult {
  data: PartyInBucket[]
  nextCursor: string | null
}

export type AgingBucketParam = 'current' | '31' | '61' | '91'

// ─── Promise-to-Pay (PTP) ─────────────────────────────────────────────────

export type PtpStatus = 'OPEN' | 'KEPT' | 'BROKEN' | 'CANCELLED'

export interface Ptp {
  id: string
  partyId: string
  invoiceId: string | null
  amountPaise: number
  promisedDate: string
  note: string | null
  status: PtpStatus
  createdAt: string
  updatedAt: string
}

export interface PtpListResult {
  data: Ptp[]
  nextCursor: string | null
}

export interface CreatePtpInput {
  partyId: string
  invoiceId?: string
  amountPaise: number
  promisedDate: string
  note?: string
}

export interface UpdatePtpInput {
  amountPaise?: number
  promisedDate?: string
  note?: string
}
