/** Library Category Grid — Browse by category */

import {
  ShoppingCart, Milk, Wrench, Smartphone, Shirt,
  Pen, Pill, Car, UtensilsCrossed, Building2,
} from 'lucide-react'
import { LIBRARY_CATEGORIES } from '../items-library.constants'
import type { LucideIcon } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingCart, Milk, Wrench, Smartphone, Shirt,
  Pen, Pill, Car, UtensilsCrossed, Building2,
}

interface LibraryCategoryGridProps {
  activeCategory: string | null
  onSelect: (categoryId: string | null) => void
}

export function LibraryCategoryGrid({ activeCategory, onSelect }: LibraryCategoryGridProps) {
  return (
    <div className="library-category-grid" role="listbox" aria-label="Product categories">
      <button
        type="button"
        className={`library-category-chip${activeCategory === null ? ' active' : ''}`}
        onClick={() => onSelect(null)}
        role="option"
        aria-selected={activeCategory === null}
      >
        All
      </button>
      {LIBRARY_CATEGORIES.map((cat) => {
        const Icon = ICON_MAP[cat.icon]
        return (
          <button
            key={cat.id}
            type="button"
            className={`library-category-chip${activeCategory === cat.id ? ' active' : ''}`}
            onClick={() => onSelect(activeCategory === cat.id ? null : cat.id)}
            role="option"
            aria-selected={activeCategory === cat.id}
          >
            {Icon && <Icon size={14} aria-hidden="true" />}
            <span>{cat.name}</span>
          </button>
        )
      })}
    </div>
  )
}
