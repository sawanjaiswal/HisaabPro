/** Products — filter bottom-sheet (GPT mockup "Filters" chip).
 *
 * Status (All / Active / Inactive) + Sort by + order. Applies instantly;
 * footer "Done" closes. Mirrors the party filter drawer's pill pattern.
 */

import React from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { PRODUCT_SORT_OPTIONS } from '../product.constants'
import type { ProductSortBy } from '../product.types'
import type { ProductStatus } from '@/lib/types/product.types'

interface ProductFilterDrawerProps {
  open: boolean
  onClose: () => void
  status: ProductStatus | undefined
  sortBy: ProductSortBy
  sortOrder: 'asc' | 'desc'
  onStatusChange: (status: ProductStatus | undefined) => void
  onSortByChange: (sortBy: ProductSortBy) => void
  onSortOrderChange: (order: 'asc' | 'desc') => void
  onReset: () => void
}

export const ProductFilterDrawer: React.FC<ProductFilterDrawerProps> = ({
  open,
  onClose,
  status,
  sortBy,
  sortOrder,
  onStatusChange,
  onSortByChange,
  onSortOrderChange,
  onReset,
}) => {
  const { t } = useLanguage()

  const statusOptions: { value: ProductStatus | undefined; label: string }[] = [
    { value: undefined, label: t.all },
    { value: 'ACTIVE', label: t.active },
    { value: 'INACTIVE', label: t.inactive },
  ]

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t.filters}
      size="sm"
      footer={
        <div className="product-filter-drawer__footer">
          <Button variant="outline" onClick={onReset} className="flex-1">
            {t.reset}
          </Button>
          <Button variant="primary" onClick={onClose} className="flex-1">
            {t.done}
          </Button>
        </div>
      }
    >
      <div className="product-filter-drawer">
        <section className="product-filter-group py-0">
          <p className="product-filter-label">{t.status}</p>
          <div className="product-filter-pills">
            {statusOptions.map((opt) => (
              <Button
                key={opt.label}
                variant="none"
                className={`product-filter-pill${status === opt.value ? ' product-filter-pill--on' : ''}`}
                onClick={() => onStatusChange(opt.value)}
                aria-pressed={status === opt.value}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </section>

        <section className="product-filter-group py-0">
          <p className="product-filter-label">{t.sortBy}</p>
          <div className="product-filter-pills">
            {PRODUCT_SORT_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant="none"
                className={`product-filter-pill${sortBy === opt.value ? ' product-filter-pill--on' : ''}`}
                onClick={() => onSortByChange(opt.value)}
                aria-pressed={sortBy === opt.value}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </section>

        <section className="product-filter-group py-0">
          <p className="product-filter-label">{t.sortLabel}</p>
          <div className="product-filter-pills">
            {(['asc', 'desc'] as const).map((order) => (
              <Button
                key={order}
                variant="none"
                className={`product-filter-pill${sortOrder === order ? ' product-filter-pill--on' : ''}`}
                onClick={() => onSortOrderChange(order)}
                aria-pressed={sortOrder === order}
              >
                {order === 'asc' ? t.ascending : t.descending}
              </Button>
            ))}
          </div>
        </section>
      </div>
    </Drawer>
  )
}
