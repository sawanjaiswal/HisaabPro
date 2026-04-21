/** GodownStockList — Stock items in a godown */

import { Package } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Skeleton } from '@/components/feedback/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { formatStockQuantity } from '../godown.utils'
import type { GodownStockResponse } from '../godown.types'

interface GodownStockListProps {
  stockData: GodownStockResponse | null
  status: 'loading' | 'error' | 'success' | 'idle'
  onRetry: () => void
}

export function GodownStockList({ stockData, status, onRetry }: GodownStockListProps) {
  const { t } = useLanguage()
  return (
    <>
      <h2 className="godown-section-title py-0">{t.stockInGodown}</h2>

      {status === 'loading' && <Skeleton height="3.5rem" count={4} />}

      {status === 'error' && (
        <ErrorState
          title={t.couldNotLoadStock}
          message={t.couldNotLoadStockMsg}
          onRetry={onRetry}
        />
      )}

      {status === 'success' && stockData && stockData.stock.length === 0 && (
        <EmptyState
          icon={<Package size={36} aria-hidden="true" />}
          title={t.noStock}
          description={t.noStockDesc}
        />
      )}

      {status === 'success' && stockData && stockData.stock.length > 0 && (
        <div className="godown-stock-list" role="list" aria-label={t.stockItems}>
          {stockData.stock.map((item) => (
            <div key={item.id} className="godown-stock-row" role="listitem">
              <div className="godown-stock-row__name">
                {item.product?.name ?? t.unknownProduct}
                {item.product?.sku && (
                  <span className="godown-stock-row__sku">{t.skuPrefix} {item.product.sku}</span>
                )}
              </div>
              <div className="godown-stock-row__qty">
                {formatStockQuantity(item.quantity)}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
