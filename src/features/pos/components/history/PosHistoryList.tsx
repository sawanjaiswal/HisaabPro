/** POS — History list with infinite scroll */

import { useRef, useEffect, useCallback } from 'react'
import { RefreshCw, Receipt } from 'lucide-react'
import { PosSaleRow } from './PosSaleRow'
import { useLanguage } from '@/hooks/useLanguage'
import type { PosSaleDTO } from '../../types/pos.types'
import { Button } from '@/components/ui/Button'

interface PosHistoryListProps {
  sales:          PosSaleDTO[]
  isLoading:      boolean
  isError:        boolean
  isEmpty:        boolean
  hasMore:        boolean
  isFetchingMore: boolean
  totalCount:     number
  onSaleClick:    (id: string) => void
  fetchMore:      () => void
  onRetry:        () => void
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function HistorySkeleton() {
  return (
    <ul className="pos-history-list" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="pos-sale-row pos-sale-row--skeleton" aria-hidden="true">
          <div className="skeleton-box skeleton-box--receipt" />
          <div className="skeleton-box skeleton-box--amount" />
        </li>
      ))}
    </ul>
  )
}

export function PosHistoryList({
  sales,
  isLoading,
  isError,
  isEmpty,
  hasMore,
  isFetchingMore,
  totalCount,
  onSaleClick,
  fetchMore,
  onRetry,
}: PosHistoryListProps) {
  const { t }        = useLanguage()
  const sentinelRef  = useRef<HTMLDivElement | null>(null)
  const fetchMoreRef = useRef(fetchMore)
  fetchMoreRef.current = fetchMore

  const observe = useCallback<IntersectionObserverCallback>((entries) => {
    if (entries[0]?.isIntersecting) fetchMoreRef.current()
  }, [])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const obs = new IntersectionObserver(observe, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, observe])

  if (isLoading) return <HistorySkeleton />

  if (isError) {
    return (
      <div className="pos-grid-state pos-grid-state--center">
        <p className="pos-grid-state__title">{t.posHistoryError ?? 'Could not load sales'}</p>
        <Button variant="none" type="button" className="pos-grid-state__btn" onClick={onRetry}>
          <RefreshCw size={13} aria-hidden="true" />
          {t.tryAgain ?? 'Try again'}
        </Button>
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="pos-grid-state pos-grid-state--center">
        <Receipt size={40} className="pos-grid-state__icon" aria-hidden="true" strokeWidth={1.25} />
        <p className="pos-grid-state__title">{t.posNoSales ?? 'No sales yet'}</p>
      </div>
    )
  }

  return (
    <>
      <p className="pos-history-count">
        {(t.posSalesCount ?? '{n} sales').replace('{n}', String(totalCount))}
      </p>
      <ul className="pos-history-list" aria-label={t.posSalesHistory ?? 'Sales history'}>
        {sales.map((sale) => (
          <PosSaleRow key={sale.id} sale={sale} onClick={onSaleClick} />
        ))}
      </ul>

      {hasMore && (
        <div ref={sentinelRef} className="pos-grid-sentinel" aria-hidden="true" />
      )}
      {isFetchingMore && (
        <p className="pos-history-loading" aria-live="polite">
          {t.loading ?? 'Loading…'}
        </p>
      )}
    </>
  )
}
