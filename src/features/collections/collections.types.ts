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
