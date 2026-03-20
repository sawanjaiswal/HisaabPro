/** TransferHistory — List of stock transfers between godowns */

import { ArrowRight, Package } from 'lucide-react'
import { useApi } from '@/hooks/useApi'
import { Skeleton } from '@/components/feedback/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { formatStockQuantity } from '../godown.utils'
import { GODOWN_PAGE_SIZE } from '../godown.constants'
import type { TransferHistoryResponse } from '../godown.types'

export function TransferHistory() {
  const { data, status, error, refetch } = useApi<TransferHistoryResponse>(
    `/godowns/transfers?limit=${GODOWN_PAGE_SIZE}`
  )

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="godown-transfer-list" aria-label="Loading transfers">
        <Skeleton height="4.5rem" count={4} />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <ErrorState
        title="Could not load transfers"
        message={error?.message ?? 'Check your connection and try again.'}
        onRetry={refetch}
      />
    )
  }

  if (!data || data.transfers.length === 0) {
    return (
      <EmptyState
        icon={<Package size={40} aria-hidden="true" />}
        title="No transfers yet"
        description="Transfer stock between godowns to see history here"
      />
    )
  }

  return (
    <div className="godown-transfer-list" role="list" aria-label="Transfer history">
      {data.transfers.map((t) => (
        <div key={t.id} className="godown-transfer-row" role="listitem">
          <div className="godown-transfer-row__product">
            {t.product?.name ?? 'Unknown product'}
          </div>
          <div className="godown-transfer-row__route">
            <span>{t.fromGodown?.name ?? '—'}</span>
            <ArrowRight size={14} aria-hidden="true" />
            <span>{t.toGodown?.name ?? '—'}</span>
          </div>
          <div className="godown-transfer-row__meta">
            <span className="godown-transfer-row__qty">
              {formatStockQuantity(t.quantity)} units
            </span>
            <span className="godown-transfer-row__date">
              {new Date(t.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
          {t.notes && (
            <div className="godown-transfer-row__notes">{t.notes}</div>
          )}
        </div>
      ))}
    </div>
  )
}
