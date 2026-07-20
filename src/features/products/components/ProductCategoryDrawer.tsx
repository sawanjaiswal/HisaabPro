/** Products — category picker bottom-sheet (GPT mockup "Categories" chip).
 *
 * Lists "All Categories" + the predefined categories with a colour dot and a
 * check on the active one. Selecting a row applies the filter and closes.
 */

import React from 'react'
import { Check } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { PREDEFINED_CATEGORIES } from '../product.constants'

interface ProductCategoryDrawerProps {
  open: boolean
  onClose: () => void
  activeCategoryId: string | 'ALL'
  onSelect: (categoryId: string | 'ALL') => void
}

export const ProductCategoryDrawer: React.FC<ProductCategoryDrawerProps> = ({
  open,
  onClose,
  activeCategoryId,
  onSelect,
}) => {
  const { t } = useLanguage()

  const choose = (id: string | 'ALL') => {
    onSelect(id)
    onClose()
  }

  const rows: { id: string | 'ALL'; name: string; color: string }[] = [
    { id: 'ALL', name: t.allItems, color: 'var(--color-gray-300)' },
    ...PREDEFINED_CATEGORIES.map((c) => ({ id: c.id, name: c.name, color: c.color })),
  ]

  return (
    <Drawer open={open} onClose={onClose} title={t.categories} size="sm">
      <ul className="product-cat-list" role="listbox" aria-label={t.categories}>
        {rows.map((row) => {
          const active = activeCategoryId === row.id
          return (
            <li key={row.id}>
              <Button
                variant="none"
                className={`product-cat-row${active ? ' product-cat-row--on' : ''}`}
                onClick={() => choose(row.id)}
                role="option"
                aria-selected={active}
              >
                <span
                  className="product-cat-dot"
                  style={{ background: row.color }}
                  aria-hidden="true"
                />
                <span className="product-cat-name">{row.name}</span>
                {active && <Check size={18} aria-hidden="true" className="product-cat-check" />}
              </Button>
            </li>
          )
        })}
      </ul>
    </Drawer>
  )
}
