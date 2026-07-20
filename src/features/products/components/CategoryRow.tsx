/** Category row (mockup #53) — tinted icon square, name, product count, chevron.
 *
 * The square is tinted with the category's own colour so the list stays
 * scannable when a business has fifteen of them.
 */

import React from 'react'
import { ChevronRight, Tag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import type { Category } from '../product.types'

interface CategoryRowProps {
  category: Category
  /** Opens the products list filtered to this category. */
  onOpen: (categoryId: string) => void
  onRename: (category: Category) => void
}

export const CategoryRow: React.FC<CategoryRowProps> = ({ category, onOpen, onRename }) => {
  const { t } = useLanguage()
  const countLabel = `${category.productCount} ${
    category.productCount === 1 ? t.productLabel : t.products
  }`

  return (
    <div className="category-row" role="listitem">
      <Button
        type="button"
        variant="ghost"
        className="category-row-main"
        onClick={() => onOpen(category.id)}
        aria-label={`${category.name} — ${countLabel}`}
      >
        <span
          className="category-row-icon"
          style={{ color: category.color }}
          aria-hidden="true"
        >
          <Tag size={20} />
        </span>

        <span className="category-row-text">
          <span className="category-row-name">{category.name}</span>
          <span className="category-row-count tabular-nums">{countLabel}</span>
        </span>

        <ChevronRight size={18} className="category-row-chevron" aria-hidden="true" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="category-row-rename"
        onClick={() => onRename(category)}
        aria-label={`${t.rename} — ${category.name}`}
      >
        {t.rename}
      </Button>
    </div>
  )
}
