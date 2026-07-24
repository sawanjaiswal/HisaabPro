/** Cash Register — Day-bucketed history list with infinite scroll */

import { useEffect, useRef } from 'react'
import { Inbox } from 'lucide-react'
import { HistoryEntryRow } from './HistoryEntryRow'
import { formatPaise } from '../cashRegister.utils'
import type { DayBucket } from '../cashRegister.types'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'

interface Props {
  buckets: DayBucket[]
  isLoading: boolean
  isError: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  onEdit: (id: string) => void
  onVoid: (id: string) => void
  onRestore: (id: string) => void
  onDelete: (id: string) => void
  onRetry: () => void
  isOwner: boolean
  filterLabel: string
}

function SkeletonRow({ i }: { i: number }) {
  return (
    <div key={i} className="cr-entry-row cr-entry-row--skeleton" aria-hidden="true">
      <div className="cr-entry-row__skeleton-dir" />
      <div className="cr-entry-row__skeleton-content">
        <div className="cr-entry-row__skeleton-expr" />
        <div className="cr-entry-row__skeleton-note" />
      </div>
      <div className="cr-entry-row__skeleton-amount" />
    </div>
  )
}

export function HistoryList({
  buckets,
  isLoading,
  isError,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onEdit,
  onVoid,
  onRestore,
  onDelete,
  onRetry,
  isOwner,
  filterLabel,
}: Props) {
  const { t } = useLanguage()
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore()
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, onLoadMore])

  if (isLoading) {
    return (
      <div className="cr-history-list" aria-label={t.cashRegLoadingEntries} aria-busy="true">
        {[0, 1, 2].map((i) => <SkeletonRow key={i} i={i} />)}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="cr-history-list cr-history-list--error">
        <div className="cr-history-list__error-card">
          <p>{t.cashRegHistoryError}</p>
          <Button variant="none" type="button" className="cr-history-list__retry" onClick={onRetry}>
            {t.cashRegHistoryRetry}
          </Button>
        </div>
      </div>
    )
  }

  if (buckets.length === 0) {
    return (
      <div className="cr-history-list cr-history-list--empty" role="status">
        <Inbox size={40} className="cr-history-list__empty-icon" aria-hidden="true" />
        <p className="cr-history-list__empty-text">{filterLabel}</p>
      </div>
    )
  }

  return (
    <div className="cr-history-list">
      {buckets.map((bucket) => (
        <section key={bucket.date} className="cr-bucket">
          <header className="cr-bucket__header">
            <span className="cr-bucket__date">
              {new Date(bucket.date + 'T00:00:00').toLocaleDateString('en-IN', {
                weekday: 'short', day: 'numeric', month: 'short',
              })}
            </span>
            <span className="cr-bucket__net">
              {t.cashRegSummaryNet}: {formatPaise(bucket.netPaise)}
            </span>
          </header>

          {bucket.entries.map((entry) => (
            <HistoryEntryRow
              key={entry.id}
              entry={entry}
              onEdit={onEdit}
              onVoid={onVoid}
              onRestore={onRestore}
              onDelete={onDelete}
              isOwner={isOwner}
            />
          ))}
        </section>
      ))}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="cr-history-list__sentinel" aria-hidden="true" />

      {isFetchingNextPage && (
        <div className="cr-history-list__loading-more" aria-label={t.cashRegLoadingMore}>
          <span className="cr-history-list__loading-dot" />
        </div>
      )}
    </div>
  )
}
