/** Purchase list (mockup #11) — the four filter segments.
 *
 * "This month" is a date window the server can answer, so it goes into the
 * query. "Pending" / "Paid" are derived from paidAmount vs grandTotal, which
 * the list API does not filter on, so they narrow the fetched page in memory.
 */

import { useMemo, useState } from 'react'
import { toLocalISODate } from '@/lib/format'
import type { DocumentSummary, DocumentFilters } from '@/features/invoices/invoice.types'

export type PurchaseFilter = 'ALL' | 'THIS_MONTH' | 'PENDING' | 'PAID'

/** First day of the current month, as a local ISO date. */
function monthStart(): string {
  const now = new Date()
  return toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1))
}

interface UsePurchaseFiltersReturn {
  filter: PurchaseFilter
  setFilter: (next: PurchaseFilter) => void
  /** Applied to the query — undefined when the segment needs no date window. */
  fromDate: string | undefined
  visible: (documents: DocumentSummary[]) => DocumentSummary[]
}

export function usePurchaseFilters(
  setQueryFilter: <K extends keyof DocumentFilters>(key: K, value: DocumentFilters[K]) => void,
): UsePurchaseFiltersReturn {
  const [filter, setFilterState] = useState<PurchaseFilter>('ALL')

  const fromDate = filter === 'THIS_MONTH' ? monthStart() : undefined

  const setFilter = (next: PurchaseFilter) => {
    setFilterState(next)
    setQueryFilter('fromDate', next === 'THIS_MONTH' ? monthStart() : undefined)
  }

  const visible = useMemo(() => {
    return (documents: DocumentSummary[]) => {
      if (filter === 'PAID') return documents.filter((d) => d.balanceDue <= 0)
      if (filter === 'PENDING') return documents.filter((d) => d.balanceDue > 0)
      return documents
    }
  }, [filter])

  return { filter, setFilter, fromDate, visible }
}
