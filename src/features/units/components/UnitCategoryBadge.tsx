/** Category pill badge for unit grouping */

import type { UnitCategory } from '../unit.types'
import { UNIT_CATEGORY_LABELS } from '../unit.constants'

interface UnitCategoryBadgeProps {
  category: UnitCategory
}

export function UnitCategoryBadge({ category }: UnitCategoryBadgeProps) {
  return (
    <span className="unit-category-badge" data-category={category}>
      {UNIT_CATEGORY_LABELS[category]}
    </span>
  )
}
