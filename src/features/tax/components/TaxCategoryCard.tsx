/** Tax — Tax Category card (list item)
 *
 * Displays name, rate badge, HSN/SAC, active/default state.
 * 44px min touch target. Chevron for navigation affordance.
 */

import { Receipt, ChevronRight } from 'lucide-react'
import { formatRate } from '../tax.constants'
import type { TaxCategory } from '../tax.types'

interface TaxCategoryCardProps {
  category: TaxCategory
  onClick: (id: string) => void
}

export function TaxCategoryCard({ category, onClick }: TaxCategoryCardProps) {
  const hsnLabel = category.hsnCode ?? category.sacCode ?? null

  return (
    <button
      className="tax-cat-card"
      onClick={() => onClick(category.id)}
      aria-label={`${category.name}, rate ${formatRate(category.rate)}`}
    >
      <span className="tax-cat-card-icon" aria-hidden="true">
        <Receipt size={20} />
      </span>
      <span className="tax-cat-card-body">
        <span className="tax-cat-card-header">
          <span className="tax-cat-card-name">{category.name}</span>
          <span className="tax-cat-badge-rate">{formatRate(category.rate)}</span>
          {category.isDefault && <span className="tax-cat-badge-default">Default</span>}
        </span>
        <span className="tax-cat-card-meta">
          {hsnLabel && <>HSN: {hsnLabel} &middot; </>}
          {category.cessRate > 0 && <>Cess: {formatRate(category.cessRate)} &middot; </>}
          {category.isActive ? 'Active' : 'Inactive'}
        </span>
      </span>
      <ChevronRight className="tax-cat-card-chevron" size={16} aria-hidden="true" />
    </button>
  )
}
