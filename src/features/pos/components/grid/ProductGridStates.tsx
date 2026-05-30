/** POS — Product grid loading / error / empty states */

import { ShoppingBag, AlertTriangle, RefreshCw } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'

// ─── Skeleton ────────────────────────────────────────────────────────────────

export function ProductGridSkeleton() {
  return (
    <div className="pos-grid" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="pos-product-card pos-product-card--skeleton" aria-hidden="true">
          <div className="pos-product-card__img skeleton-box" />
          <div className="pos-product-card__body">
            <div className="skeleton-box skeleton-box--name" />
            <div className="skeleton-box skeleton-box--price" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Error ───────────────────────────────────────────────────────────────────

interface ErrorProps { onRetry: () => void }

export function ProductGridError({ onRetry }: ErrorProps) {
  const { t } = useLanguage()
  return (
    <div className="pos-grid-state pos-grid-state--center">
      <AlertTriangle size={40} className="pos-grid-state__icon pos-grid-state__icon--error" aria-hidden="true" />
      <p className="pos-grid-state__title">{t.posProductsError ?? 'Could not load products'}</p>
      <Button variant="none" type="button" className="pos-grid-state__btn" onClick={onRetry}>
        <RefreshCw size={14} aria-hidden="true" />
        {t.tryAgain ?? 'Try again'}
      </Button>
    </div>
  )
}

// ─── Empty ───────────────────────────────────────────────────────────────────

interface EmptyProps { search: string }

export function ProductGridEmpty({ search }: EmptyProps) {
  const { t } = useLanguage()
  return (
    <div className="pos-grid-state pos-grid-state--center">
      <ShoppingBag size={40} className="pos-grid-state__icon" aria-hidden="true" />
      <p className="pos-grid-state__title">
        {search
          ? (t.posNoProductsSearch ?? 'No products match "{q}"').replace('{q}', search)
          : (t.posNoProducts ?? 'No products available')}
      </p>
    </div>
  )
}
