/** Product Detail — Stock / History tab: full stock-movement list.
 *  Reskinned to the `pd-card` / `pd-activity` language (matching the Overview
 *  Recent Activity block) so it's consistent with the rest of the detail page. */

import React from 'react'
import { ArrowUpRight, ArrowDownRight, ShoppingCart, Package } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import type { StockMovement } from '../product.types'
import { formatMovementType } from '../product.utils'
import { formatQuantity } from '@/lib/format'

interface ProductStockTabProps {
  movements: StockMovement[]
  unitSymbol: string
  onAdjust: () => void
}

const IN_TYPES = new Set(['PURCHASE', 'ADJUSTMENT_IN', 'OPENING', 'RETURN_IN'])

const fmtQty = (n: number) => formatQuantity(Math.abs(n))

const fmtWhen = (iso: string) =>
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
          <Button variant="primary" size="md" onClick={onAdjust} aria-label={t.adjustStock}>
            {t.adjustStock}
          </Button>
        }
      />
    )
  }

  return (
    <section className="pd-card pd-activity" aria-label={t.stockMovements}>
      <header className="pd-card__head">
        <h3 className="pd-card__title">{t.stockMovements}</h3>
      </header>

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
                <span className="pd-activity__time">
                  {fmtWhen(m.createdAt)} · {t.balLabel}: {m.balanceAfter} {unitSymbol}
                </span>
              </span>
              <span className={`pd-activity__delta pd-activity__delta--${tone} tabular-nums`}>
                {isIn ? '+' : '-'}{fmtQty(m.quantity)} {unitSymbol}
              </span>
            </li>
          )
        })}
      </ul>

      <Button variant="outline" className="pd-summary__cta" onClick={onAdjust} aria-label={t.adjustStock}>
        {t.adjustStock}
      </Button>
    </section>
  )
}
