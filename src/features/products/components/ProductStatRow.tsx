/** Product Detail — 4-up stat card (Current / Available / Reserved / Min. Stock).
 *  Value-over-unit-over-label columns, divided by hairlines. Min. Stock is
 *  warning-toned per the design. Pure display. */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { ProductStockStats } from '../product-analytics.types'
import { formatQuantity as fmt } from '@/lib/format'

interface ProductStatRowProps {
  stats: ProductStockStats
  /** Unit noun e.g. "Bags" / "pcs" (already pluralised label). */
  unitLabel: string
}

export const ProductStatRow: React.FC<ProductStatRowProps> = ({ stats, unitLabel }) => {
  const { t } = useLanguage()

  const cells = [
    { id: 'current', value: stats.current, label: t.stock, tone: 'default' as const },
    { id: 'available', value: stats.available, label: t.available, tone: 'default' as const },
    { id: 'reserved', value: stats.reserved, label: t.reserved, tone: 'default' as const },
    { id: 'min', value: stats.minStock, label: t.minStockShort, tone: 'warn' as const },
  ]

  return (
    <div className="pd-stats" role="list" aria-label={t.stock}>
      {cells.map((c) => (
        <div key={c.id} className={`pd-stats__cell pd-stats__cell--${c.tone}`} role="listitem">
          <span className="pd-stats__value tabular-nums">{fmt(c.value)}</span>
          <span className="pd-stats__unit">{unitLabel}</span>
          <span className="pd-stats__label">{c.label}</span>
        </div>
      ))}
    </div>
  )
}
