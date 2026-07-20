/** Product Detail — Stock History tab, mockup #67.
 *
 * Segmented filter (all / in / out / adjustments) over month-grouped rows:
 * date on the left, what happened in the middle, the signed delta and its
 * source document on the right.
 */

import React, { useMemo, useState } from 'react'
import { Package } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/Button'
import { FilterChips, type FilterChipOption } from '@/components/ui/FilterChips'
import { useLanguage } from '@/hooks/useLanguage'
import { formatQuantity } from '@/lib/format'
import { formatMovementType } from '../product.utils'
import { filterMovements, groupByMonth, isInbound, type StockHistoryFilter } from '../stock-history.utils'
import type { StockMovement } from '../product.types'
import '../stock-history.css'

interface ProductStockTabProps {
  movements: StockMovement[]
  unitSymbol: string
  onAdjust: () => void
}

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export const ProductStockTab: React.FC<ProductStockTabProps> = ({ movements, unitSymbol, onAdjust }) => {
  const { t } = useLanguage()
  const [filter, setFilter] = useState<StockHistoryFilter>('ALL')

  const groups = useMemo(
    () => groupByMonth(filterMovements(movements, filter)),
    [movements, filter],
  )

  const chips: FilterChipOption<StockHistoryFilter>[] = [
    { value: 'ALL', label: t.all },
    { value: 'IN', label: t.stockIn },
    { value: 'OUT', label: t.stockOut },
    { value: 'ADJUSTMENTS', label: t.adjustments },
  ]

  // Nothing has ever moved — the only state that warrants the CTA.
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
    <section className="stock-history" aria-label={t.stockMovements}>
      <FilterChips options={chips} value={filter} onChange={setFilter} label={t.stockMovements} />

      {groups.length === 0 ? (
        <EmptyState
          icon={<Package size={40} aria-hidden="true" />}
          title={t.noResults}
          description={t.noStockMovementsDesc}
        />
      ) : (
        groups.map((group) => (
          <div key={group.label} className="stock-history-group">
            <h3 className="stock-history-month">{group.label}</h3>

            <ul className="stock-history-list" role="list">
              {group.movements.map((m) => {
                const isIn = isInbound(m.type)
                return (
                  <li key={m.id} className="stock-history-row">
                    <span className="stock-history-date">{fmtDay(m.createdAt)}</span>

                    <span className="stock-history-type">{formatMovementType(m.type)}</span>

                    <span className="stock-history-right">
                      <span
                        className={`stock-history-delta tabular-nums stock-history-delta--${isIn ? 'in' : 'out'}`}
                      >
                        {isIn ? '+' : '−'}{formatQuantity(Math.abs(m.quantity))} {unitSymbol}
                      </span>
                      {m.referenceNumber && (
                        <span className="stock-history-ref">{m.referenceNumber}</span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))
      )}

      <Button variant="outline" className="w-full" onClick={onAdjust} aria-label={t.adjustStock}>
        {t.adjustStock}
      </Button>
    </section>
  )
}
