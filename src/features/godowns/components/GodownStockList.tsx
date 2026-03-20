/** GodownStockList — Stock items in a godown */

import { Package } from 'lucide-react'
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
  return (
    <>
      <h2 className="godown-section-title">Stock in Godown</h2>

      {status === 'loading' && <Skeleton height="3.5rem" count={4} />}

      {status === 'error' && (
        <ErrorState
          title="Could not load stock"
          message="Try again to see stock in this godown."
          onRetry={onRetry}
        />
      )}

      {status === 'success' && stockData && stockData.stock.length === 0 && (
        <EmptyState
          icon={<Package size={36} aria-hidden="true" />}
          title="No stock"
          description="This godown has no inventory yet"
        />
      )}

      {status === 'success' && stockData && stockData.stock.length > 0 && (
        <div className="godown-stock-list" role="list" aria-label="Stock items">
          {stockData.stock.map((item) => (
            <div key={item.id} className="godown-stock-row" role="listitem">
              <div className="godown-stock-row__name">
                {item.product?.name ?? 'Unknown product'}
                {item.product?.sku && (
                  <span className="godown-stock-row__sku">SKU: {item.product.sku}</span>
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
