/** Product Detail — Stock movements tab */

import React from 'react'
import { ArrowDownLeft, ArrowUpRight, Package } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
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
  if (movements.length === 0) {
    return (
      <EmptyState
        icon={<Package size={40} aria-hidden="true" />}
        title="No stock movements"
        description="Adjust stock or create an invoice to see movements here."
        action={
          <button className="btn btn-primary btn-md" onClick={onAdjust} aria-label="Adjust stock">
            Adjust Stock
          </button>
        }
      />
    )
  }

  return (
    <div>
      <div className="card" role="list" aria-label="Stock movements">
        {movements.map((movement) => {
          const isIn = MOVEMENT_IN_TYPES.has(movement.type)
          const qtyColor = isIn ? 'var(--color-success-600)' : 'var(--color-error-600)'
          const qtyPrefix = isIn ? '+' : '-'

          return (
            <div key={movement.id} className="stock-movement-row" role="listitem">
              <div
                className="stock-movement-icon"
                style={{
                  backgroundColor: isIn ? 'var(--color-success-50)' : 'var(--color-error-50)',
                  color: isIn ? 'var(--color-success-600)' : 'var(--color-error-600)',
                }}
                aria-hidden="true"
              >
                {isIn ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
              </div>

              <div className="stock-movement-info">
                <div className="stock-movement-type">{formatMovementType(movement.type)}</div>
                <div className="stock-movement-date">{formatDate(movement.createdAt)}</div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="stock-movement-qty" style={{ color: qtyColor }}>
                  {qtyPrefix}{Math.abs(movement.quantity)} {unitSymbol}
                </div>
                <div className="stock-movement-balance">
                  Bal: {movement.balanceAfter} {unitSymbol}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button
        className="btn btn-outline btn-md product-adjust-btn"
        onClick={onAdjust}
        aria-label="Adjust stock"
      >
        Adjust Stock
      </button>
    </div>
  )
}
