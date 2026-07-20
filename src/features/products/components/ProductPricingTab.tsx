/** Product Detail — Pricing tab: sale / purchase / margin rows + live
 *  price-preview panel. Extracted from the old overview so Overview can hold
 *  the analytics grid. */

import { IndianRupee, TrendingUp, Tag } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { ProductDetail } from '../product.types'
import { formatProductPrice } from '../product.utils'
import { ProductPricePreviewPanel } from './ProductPricePreviewPanel'

interface ProductPricingTabProps {
  product: ProductDetail
}

export function ProductPricingTab({ product }: ProductPricingTabProps) {
  const { t } = useLanguage()

  const marginPercent =
    product.purchasePrice && product.purchasePrice > 0 && product.salePrice > 0
      ? Math.round(((product.salePrice - product.purchasePrice) / product.salePrice) * 100)
      : null

  const rows = [
    { id: 'sale', icon: <IndianRupee size={18} />, label: t.salePriceLabel, value: formatProductPrice(product.salePrice), tone: 'default' as const },
    { id: 'purchase', icon: <Tag size={18} />, label: t.purchasePriceLabel, value: product.purchasePrice !== null ? formatProductPrice(product.purchasePrice) : t.notSet, tone: 'default' as const },
  ]

  return (
    <div className="space-y-6">
      <section className="pd-card pd-summary" aria-label={t.pricingSection}>
        <header className="pd-card__head">
          <h3 className="pd-card__title">{t.pricingSection}</h3>
        </header>
        <ul className="pd-summary__list" role="list">
          {rows.map((r) => (
            <li key={r.id} className={`pd-summary__row pd-summary__row--${r.tone}`}>
              <span className={`pd-summary__icon pd-summary__icon--${r.tone}`} aria-hidden="true">{r.icon}</span>
              <span className="pd-summary__label">{r.label}</span>
              <span className="pd-summary__value tabular-nums">{r.value}</span>
            </li>
          ))}
          {marginPercent !== null && (
            <li className="pd-summary__row pd-summary__row--ok">
              <span className="pd-summary__icon pd-summary__icon--ok" aria-hidden="true"><TrendingUp size={18} /></span>
              <span className="pd-summary__label">{t.marginLabel}</span>
              <span className="pd-summary__value tabular-nums">{marginPercent}%</span>
            </li>
          )}
        </ul>
      </section>

      <ProductPricePreviewPanel productId={product.id} salePrice={product.salePrice} />
    </div>
  )
}
