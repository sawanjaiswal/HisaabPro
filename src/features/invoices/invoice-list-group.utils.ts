/** Invoice list — day-grouping helpers (pure)
 *
 * Groups the loaded documents by calendar day for the redesigned list
 * (mockup #1: "Today / Yesterday / 18 Jul 2026" section headers with a
 * per-day total on the right).
 *
 * Deliberately NOT reusing `groupLedgerByMonth` from the party ledger: that
 * groups by MONTH and threads an opening/running balance through each group
 * (ledger semantics). Here we group by DAY and sum grand totals — no balance
 * concept exists on a document list.
 *
 * i18n-free by design. `isToday` / `isYesterday` are flags; the component maps
 * them to `t.dateToday` / `t.dateYesterday` so this file stays pure.
 */

import type { DocumentSummary } from './invoice.types'

export interface InvoiceDayGroup {
  /** Stable key — the local calendar day, `YYYY-MM-DD`. */
  key: string
  /** Pre-formatted absolute label, e.g. "18 Jul 2026". */
  label: string
  isToday: boolean
  isYesterday: boolean
  /** Sum of `grandTotal` for the group, in PAISE. */
  totalPaise: number
  documents: DocumentSummary[]
}

/** Local calendar day key — avoids the UTC shift `toISOString()` would apply. */
function dayKey(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Group documents by calendar day, newest day first, preserving the incoming
 * order of documents within each day (the API already sorts them).
 */
export function groupInvoicesByDay(
  documents: DocumentSummary[],
  now: Date = new Date(),
): InvoiceDayGroup[] {
  const todayKey = dayKey(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = dayKey(yesterday)

  const byKey = new Map<string, InvoiceDayGroup>()

  for (const doc of documents) {
    const date = new Date(doc.documentDate)
    if (Number.isNaN(date.getTime())) continue
    const key = dayKey(date)

    let group = byKey.get(key)
    if (!group) {
      group = {
        key,
        label: dayLabel(date),
        isToday: key === todayKey,
        isYesterday: key === yesterdayKey,
        totalPaise: 0,
        documents: [],
      }
      byKey.set(key, group)
    }

    group.documents.push(doc)
    group.totalPaise += doc.grandTotal
  }

  return Array.from(byKey.values()).sort((a, b) => b.key.localeCompare(a.key))
}

/**
 * Per-day totals for the footer sparkline, oldest → newest so the trace reads
 * left-to-right. Values are REAL sums of the loaded documents — no synthetic
 * or interpolated points.
 */
export function toDailyTotalsSeries(groups: InvoiceDayGroup[]): number[] {
  return groups.map((g) => g.totalPaise).reverse()
}
