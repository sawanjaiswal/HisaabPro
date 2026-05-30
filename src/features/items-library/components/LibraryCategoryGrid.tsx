/** Library Category Grid — Browse by category */

import {
  ShoppingCart, Milk, Wrench, Smartphone, Shirt,
  Pen, Pill, Car, UtensilsCrossed, Building2,
} from 'lucide-react'
import { LIBRARY_CATEGORIES } from '../items-library.constants'
import type { LucideIcon } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingCart, Milk, Wrench, Smartphone, Shirt,
  Pen, Pill, Car, UtensilsCrossed, Building2,
}

interface LibraryCategoryGridProps {
  activeCategory: string | null
  onSelect: (categoryId: string | null) => void
}

export function LibraryCategoryGrid({ activeCategory, onSelect }: LibraryCategoryGridProps) {
  const { t } = useLanguage()
  return (
    <div className="library-category-grid" role="listbox" aria-label={t.productCategories}>
      <Button variant="none"
        type="button"
        className={`library-category-chip${activeCategory === null ? ' active' : ''}`}
        onClick={() => onSelect(null)}
        role="option"
        aria-selected={activeCategory === null}
      >
        All
      </Button>
      {LIBRARY_CATEGORIES.map((cat) => {
        const Icon = ICON_MAP[cat.icon]
        return (
          <Button variant="none"
            key={cat.id}
            type="button"
            className={`library-category-chip${activeCategory === cat.id ? ' active' : ''}`}
            onClick={() => onSelect(activeCategory === cat.id ? null : cat.id)}
            role="option"
            aria-selected={activeCategory === cat.id}
          >
            {Icon && <Icon size={14} aria-hidden="true" />}
            <span>{cat.name}</span>
          </Button>
        )
      })}
    </div>
  )
}
