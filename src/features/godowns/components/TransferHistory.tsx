/** TransferHistory — List of stock transfers between godowns */

import { ArrowRight, Package } from 'lucide-react'
import { useApi } from '@/hooks/useApi'
import { useLanguage } from '@/hooks/useLanguage'
import { Skeleton } from '@/components/feedback/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { formatStockQuantity } from '../godown.utils'
import { GODOWN_PAGE_SIZE } from '../godown.constants'
import type { TransferHistoryResponse } from '../godown.types'

export function TransferHistory() {
  const { t } = useLanguage()
  const { data, status, error, refetch } = useApi<TransferHistoryResponse>(
    `/godowns/transfers?limit=${GODOWN_PAGE_SIZE}`
  )

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="godown-transfer-list" aria-label={t.loadingTransfers}>
        <Skeleton height="4.5rem" count={4} />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <ErrorState
        title={t.couldNotLoadTransfers}
        message={error?.message ?? t.checkConnectionRetry}
        onRetry={refetch}
      />
    )
  }

  if (!data || data.transfers.length === 0) {
    return (
      <EmptyState
        icon={<Package size={40} aria-hidden="true" />}
        title={t.noTransfersYet}
        description={t.noTransfersDesc}
      />
    )
  }

  return (
    <div className="godown-transfer-list" role="list" aria-label={t.transferHistoryLabel}>
      {data.transfers.map((tx) => (
        <div key={tx.id} className="godown-transfer-row" role="listitem">
          <div className="godown-transfer-row__product">
            {tx.product?.name ?? t.unknownProduct}
          </div>
          <div className="godown-transfer-row__route">
            <span>{tx.fromGodown?.name ?? '—'}</span>
            <ArrowRight size={14} aria-hidden="true" />
            <span>{tx.toGodown?.name ?? '—'}</span>
          </div>
          <div className="godown-transfer-row__meta">
            <span className="godown-transfer-row__qty">
              {formatStockQuantity(tx.quantity)} {t.units2}
            </span>
            <span className="godown-transfer-row__date">
              {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
          {tx.notes && (
            <div className="godown-transfer-row__notes">{tx.notes}</div>
          )}
        </div>
      ))}
    </div>
  )
}
