/** POS Quick Product Grid — Frequently sold items for tap-to-add */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Package } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { getProducts } from '@/features/products/product-crud.service'
import { formatPaise } from '@/lib/format'
import { useLanguage } from '@/hooks/useLanguage'
import { QUICK_GRID_LIMIT } from '../pos.constants'

import type { QuickProduct } from '../pos.types'
import { Button } from '@/components/ui/Button'

interface QuickProductGridProps {
  onSelect: (product: QuickProduct) => void
}

export function QuickProductGrid({ onSelect }: QuickProductGridProps) {
  const { t } = useLanguage()
  const [products, setProducts] = useState<QuickProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchKey, setFetchKey] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)

    // Canonical product-list fetch — `getProducts` owns the query-string shape
    // and the response type. Hand-rolling either is how this grid ended up
    // reading a `res.items` key the server has never sent.
    getProducts({ limit: QUICK_GRID_LIMIT, status: 'ACTIVE' }, ctrl.signal)
      .then((res) => { if (!ctrl.signal.aborted) setProducts(res.products) })
      .catch((err) => { if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : t.errorTitle) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })

    return () => ctrl.abort()
  }, [fetchKey, t])

  const retry = useCallback(() => setFetchKey((k) => k + 1), [])

  if (loading) {
    return (
      <div className="pos-quick-grid" aria-label={t.posLoadingProducts}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={`pos-skel-${i}`} className="pos-quick-item pos-quick-item--skeleton" aria-hidden="true" />
        ))}
      </div>
    )
  }

  if (error) {
    return <ErrorState title={error} onRetry={retry} />
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={<Package size={22} aria-hidden="true" />}
        title={t.posScanOrSearchToAdd}
      />
    )
  }

  return (
    <div className="pos-quick-section py-0">
      <h3 className="pos-quick-title">{t.posQuickAdd}</h3>
      <div className="pos-quick-grid" role="list" aria-label={t.posFrequentProducts}>
        {products.map((p) => (
          <Button variant="none"
            key={p.id}
            type="button"
            className="pos-quick-item"
            onClick={() => onSelect(p)}
            role="listitem"
            aria-label={`${t.add} ${p.name} — ${formatPaise(p.salePrice)}`}
          >
            <span className="pos-quick-item-name">{p.name}</span>
            <span className="pos-quick-item-price">{formatPaise(p.salePrice)}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}
