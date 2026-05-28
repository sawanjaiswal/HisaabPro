/**
 * #147 Statement normaliser — PURE. The server never parses CSV text (S-M5: CSV
 * is parsed on the client; the server takes a bounded, Zod-validated JSON array).
 * These helpers normalise the already-parsed rows: trim/clamp text, compute the
 * import period, and derive a content hash for soft re-upload dedupe (Q4).
 */
import type { StatementRowInput } from './bank-reconciliation.types.js'

const DESC_MAX = 500
const REF_MAX = 100

function clampText(value: string | null | undefined, max: number): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

/** Canonical, storage-ready row (text clamped, ISO date normalised to UTC midnight). */
export interface NormalisedRow {
  txnDate: Date
  amount: number
  direction: 'CREDIT' | 'DEBIT'
  description: string | null
  referenceNumber: string | null
}

export function normaliseRow(row: StatementRowInput): NormalisedRow {
  return {
    txnDate: new Date(row.txnDate),
    amount: row.amount,
    direction: row.direction,
    description: clampText(row.description, DESC_MAX),
    referenceNumber: clampText(row.referenceNumber, REF_MAX),
  }
}

export function normaliseRows(rows: StatementRowInput[]): NormalisedRow[] {
  return rows.map(normaliseRow)
}

/** Inclusive [start, end] of txn dates across the batch, or null for empty input. */
export function computePeriod(rows: NormalisedRow[]): { start: Date; end: Date } | null {
  if (rows.length === 0) return null
  let start = rows[0].txnDate
  let end = rows[0].txnDate
  for (const r of rows) {
    if (r.txnDate < start) start = r.txnDate
    if (r.txnDate > end) end = r.txnDate
  }
  return { start, end }
}

/**
 * Stable content key for a row — used to warn (not block, per Q4) when a row
 * identical to one already imported for the same account is re-uploaded.
 */
export function contentHash(row: NormalisedRow): string {
  const day = row.txnDate.toISOString().slice(0, 10)
  const ref = (row.referenceNumber ?? '').toLowerCase()
  return `${day}|${row.amount}|${row.direction}|${ref}`
}

/** Candidate-pool date window: widen the batch period by ±14 days. */
export function poolWindow(period: { start: Date; end: Date }): { min: Date; max: Date } {
  const DAY = 86_400_000
  return {
    min: new Date(period.start.getTime() - 14 * DAY),
    max: new Date(period.end.getTime() + 14 * DAY),
  }
}
