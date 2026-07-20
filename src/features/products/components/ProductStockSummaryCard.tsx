/** Product Detail — Stock Summary breakdown (Opening/Purchased/Sold/Returned/
 *  Damaged) with tinted Available + Min-Alert rows and an Adjust Stock CTA. */

import React from 'react'
import {
  Boxes, ShoppingCart, Receipt, RotateCcw, XCircle,
  PackageCheck, AlertTriangle, Package,
} from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'
import type { ProductStockSummary } from '../product-analytics.types'
import { formatQuantity as fmt } from '@/lib/format'

interface ProductStockSummaryCardProps {
  summary: ProductStockSummary
  unitLabel: string
  onAdjust: () => void
  onViewAll: () => void
}

export const ProductStockSummaryCard: React.FC<ProductStockSummaryCardProps> = ({
  summary,
  unitLabel,
  onAdjust,
  onViewAll,
}) => {
  const { t } = useLanguage()

  const rows = [
    { id: 'opening', label: t.openingStock, value: summary.opening, icon: <Boxes size={18} />, tone: 'default' as const },
    { id: 'purchased', label: t.purchasedLabel, value: summary.purchased, icon: <ShoppingCart size={18} />, tone: 'default' as const },
    { id: 'sold', label: t.soldLabel, value: summary.sold, icon: <Receipt size={18} />, tone: 'default' as const },
    { id: 'returned', label: t.returnedLabel, value: summary.returned, icon: <RotateCcw size={18} />, tone: 'default' as const },
    { id: 'damaged', label: t.damagedLabel, value: summary.damaged, icon: <XCircle size={18} />, tone: 'default' as const },
    { id: 'available', label: t.availableStock, value: summary.available, icon: <PackageCheck size={18} />, tone: 'ok' as const },
    { id: 'min', label: t.minStockAlertRow, value: summary.minAlert, icon: <AlertTriangle size={18} />, tone: 'warn' as const },
  ]

  return (
    <section className="pd-card pd-summary" aria-label={t.stockSummaryHeading}>
      <header className="pd-card__head">
        <h3 className="pd-card__title">{t.stockSummaryHeading}</h3>
        <Button variant="none" type="button" className="pd-card__link" onClick={onViewAll}>{t.viewAll}</Button>
      </header>

      <ul className="pd-summary__list" role="list">
        {rows.map((r) => (
          <li key={r.id} className={`pd-summary__row pd-summary__row--${r.tone}`}>
            <span className={`pd-summary__icon pd-summary__icon--${r.tone}`} aria-hidden="true">{r.icon}</span>
            <span className="pd-summary__label">{r.label}</span>
            <span className="pd-summary__value tabular-nums">
              {fmt(r.value)} <span className="pd-summary__unit">{unitLabel}</span>
            </span>
          </li>
        ))}
      </ul>

      <Button variant="primary" className="pd-summary__cta" onClick={onAdjust} aria-label={t.adjustStock}>
        <Package size={18} aria-hidden="true" />
        {t.adjustStock}
      </Button>
    </section>
  )
}
