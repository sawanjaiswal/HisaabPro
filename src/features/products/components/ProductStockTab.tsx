/** Product Detail — Stock movements tab */

import React from 'react'
import { ArrowDownLeft, ArrowUpRight, Package } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLanguage } from '@/hooks/useLanguage'
import type { StockMovement } from '../product.types'
import { formatMovementType } from '../product.utils'

interface ProductStockTabProps {
  movements: StockMovement[]
  unitSymbol: string
  onAdjust: () => void
}

const MOVEMENT_IN_TYPES = new Set(['PURCHASE', 'ADJUSTMENT_IN', 'OPENING', 'RETURN_IN'])

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export const ProductStockTab: React.FC<ProductStockTabProps> = ({ movements, unitSymbol, onAdjust }) => {
  const { t } = useLanguage()
  if (movements.length === 0) {
    return (
      <EmptyState
        icon={<Package size={40} aria-hidden="true" />}
        title={t.noStockMovements}
        description={t.noStockMovementsDesc}
        action={
          <button className="btn btn-primary btn-md" onClick={onAdjust} aria-label={t.adjustStock}>
            {t.adjustStock}
          </button>
        }
      />
    )
  }

  return (
    <div>
      <div className="card" role="list" aria-label={t.stockMovements}>
        {movements.map((movement) => {
          const isIn = MOVEMENT_IN_TYPES.has(movement.type)
          const directionClass = isIn ? 'in' : 'out'
          const qtyPrefix = isIn ? '+' : '-'

          return (
            <div key={movement.id} className="stock-movement-row" role="listitem">
              <div
                className={`stock-movement-icon stock-movement-icon-${directionClass}`}
                aria-hidden="true"
              >
                {isIn ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
              </div>

              <div className="stock-movement-info">
                <div className="stock-movement-type">{formatMovementType(movement.type)}</div>
                <div className="stock-movement-date">{formatDate(movement.createdAt)}</div>
              </div>

              <div className="stock-movement-meta">
                <div className={`stock-movement-qty stock-movement-qty--${directionClass}`}>
                  {qtyPrefix}{Math.abs(movement.quantity)} {unitSymbol}
                </div>
                <div className="stock-movement-balance">
                  {t.balLabel}: {movement.balanceAfter} {unitSymbol}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button
        className="btn btn-outline btn-md product-adjust-btn"
        onClick={onAdjust}
        aria-label={t.adjustStock}
      >
        {t.adjustStock}
      </button>
    </div>
  )
}
