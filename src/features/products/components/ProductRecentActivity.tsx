/** Product Detail — Recent Activity list from the last stock movements.
 *  Direction-tinted icon square · type + timestamp · signed qty delta. */

import React from 'react'
import { ArrowUpRight, ArrowDownRight, ShoppingCart, Package } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/feedback/EmptyState'
import type { StockMovement } from '../product.types'
import { formatMovementType } from '../product.utils'
import { formatQuantity, formatDateTime } from '@/lib/format'

interface ProductRecentActivityProps {
  movements: StockMovement[]
  unitLabel: string
  onViewAll: () => void
}

const IN_TYPES = new Set(['PURCHASE', 'ADJUSTMENT_IN', 'OPENING', 'RETURN_IN'])

const fmtQty = (n: number) => formatQuantity(Math.abs(n))
const fmtWhen = (iso: string) => formatDateTime(iso)

export const ProductRecentActivity: React.FC<ProductRecentActivityProps> = ({
  movements,
  unitLabel,
  onViewAll,
}) => {
  const { t } = useLanguage()

  return (
    <section className="pd-card pd-activity" aria-label={t.recentActivity}>
      <header className="pd-card__head">
        <h3 className="pd-card__title">{t.recentActivity}</h3>
        <Button variant="none" type="button" className="pd-card__link" onClick={onViewAll}>{t.viewAll}</Button>
      </header>

      {movements.length === 0 ? (
        <EmptyState
          icon={<Package size={36} aria-hidden="true" />}
          title={t.noStockMovements}
          description={t.noStockMovementsDesc}
        />
      ) : (
        <ul className="pd-activity__list" role="list">
          {movements.map((m) => {
            const isIn = IN_TYPES.has(m.type)
            const tone = m.type === 'PURCHASE' ? 'info' : isIn ? 'ok' : 'bad'
            const icon = m.type === 'PURCHASE'
              ? <ShoppingCart size={18} />
              : isIn ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />
            return (
              <li key={m.id} className="pd-activity__row">
                <span className={`pd-activity__icon pd-activity__icon--${tone}`} aria-hidden="true">{icon}</span>
                <span className="pd-activity__body">
                  <span className="pd-activity__title">{formatMovementType(m.type)}</span>
                  <span className="pd-activity__time">{fmtWhen(m.createdAt)}</span>
                </span>
                <span className={`pd-activity__delta pd-activity__delta--${tone} tabular-nums`}>
                  {isIn ? '+' : '-'}{fmtQty(m.quantity)} {unitLabel}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
