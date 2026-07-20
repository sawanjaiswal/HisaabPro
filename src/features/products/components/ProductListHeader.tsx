/** Products — list section header: "N Products" + Sort dropdown (GPT mockup).
 * Mirrors PartyListHeader; sort options come from PRODUCT_SORT_OPTIONS. */

import React from 'react'
import { ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/DropdownMenu'
import { useLanguage } from '@/hooks/useLanguage'
import { PRODUCT_SORT_OPTIONS } from '../product.constants'
import type { ProductSortBy } from '../product.types'

interface ProductListHeaderProps {
  total: number
  activeSortBy: ProductSortBy
  onSortChange: (sortBy: ProductSortBy) => void
}

export const ProductListHeader: React.FC<ProductListHeaderProps> = ({
  total,
  activeSortBy,
  onSortChange,
}) => {
  const { t } = useLanguage()
  const activeLabel =
    PRODUCT_SORT_OPTIONS.find((o) => o.value === activeSortBy)?.label ?? ''

  return (
    <div className="product-section-header">
      <span className="product-section-count">
        {total} {t.products}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="none" className="product-sort-btn" aria-label={t.sortLabel}>
            <span>{t.sortLabel}: {activeLabel}</span>
            <ArrowUpDown size={16} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {PRODUCT_SORT_OPTIONS.map((option) => (
            <DropdownMenuItem key={option.value} onSelect={() => onSortChange(option.value)}>
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
