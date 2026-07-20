/** Document list segments — the four chips shared by every document list.
 *
 * "This month" is a date window the server can answer, so it goes into the
 * query. "Pending" / "Settled" are derived from balanceDue, which the list
 * API does not filter on, so they narrow the fetched page in memory.
 *
 * Used by the purchase list (#11) and both return lists (#44, #51).
 */

import { useMemo, useState } from 'react'
import { toLocalISODate } from '@/lib/format'
import type { DocumentSummary, DocumentFilters } from './invoice.types'

export type DocumentSegment = 'ALL' | 'THIS_MONTH' | 'PENDING' | 'PAID'

/** First day of the current month, as a local ISO date. */
function monthStart(): string {
  const now = new Date()
  return toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1))
}

interface UseDocumentSegmentsReturn {
  segment: DocumentSegment
  setSegment: (next: DocumentSegment) => void
  /** Applied to the query — undefined when the segment needs no date window. */
  fromDate: string | undefined
  visible: (documents: DocumentSummary[]) => DocumentSummary[]
}

export function useDocumentSegments(
  setQueryFilter: <K extends keyof DocumentFilters>(key: K, value: DocumentFilters[K]) => void,
): UseDocumentSegmentsReturn {
  const [segment, setSegmentState] = useState<DocumentSegment>('ALL')

  const fromDate = segment === 'THIS_MONTH' ? monthStart() : undefined

  const setSegment = (next: DocumentSegment) => {
    setSegmentState(next)
    setQueryFilter('fromDate', next === 'THIS_MONTH' ? monthStart() : undefined)
  }

  const visible = useMemo(() => {
    return (documents: DocumentSummary[]) => {
      if (segment === 'PAID') return documents.filter((d) => d.balanceDue <= 0)
      if (segment === 'PENDING') return documents.filter((d) => d.balanceDue > 0)
      return documents
    }
  }, [segment])

  return { segment, setSegment, fromDate, visible }
}
