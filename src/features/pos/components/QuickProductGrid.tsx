/** POS Quick Product Grid — Frequently sold items for tap-to-add */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Package } from 'lucide-react'
import { api } from '@/lib/api'
import { formatPaise } from '@/lib/format'
import { QUICK_GRID_LIMIT } from '../pos.constants'

import type { QuickProduct } from '../pos.types'

interface QuickProductGridProps {
  onSelect: (product: QuickProduct) => void
}

export function QuickProductGrid({ onSelect }: QuickProductGridProps) {
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

    api<{ items: QuickProduct[] }>(
      `/products?take=${QUICK_GRID_LIMIT}&orderBy=salesCount&order=desc`,
      { signal: ctrl.signal },
    )
      .then((res) => { if (!ctrl.signal.aborted) setProducts(res.items) })
      .catch((err) => { if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : 'Failed to load') })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })

    return () => ctrl.abort()
  }, [fetchKey])

  const retry = useCallback(() => setFetchKey((k) => k + 1), [])

  if (loading) {
    return (
      <div className="pos-quick-grid" aria-label="Loading products">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={`pos-skel-${i}`} className="pos-quick-item pos-quick-item--skeleton" aria-hidden="true" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="pos-empty" role="alert">
        <Package size={40} className="pos-empty-icon" aria-hidden="true" />
        <p className="pos-empty-text">{error}</p>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={retry}
        >
          Retry
        </button>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="pos-empty" role="status">
        <Package size={40} className="pos-empty-icon" aria-hidden="true" />
        <p className="pos-empty-text">Scan a barcode or search to add items</p>
      </div>
    )
  }

  return (
    <div className="pos-quick-section">
      <h3 className="pos-quick-title">Quick Add</h3>
      <div className="pos-quick-grid" role="list" aria-label="Frequently sold products">
        {products.map((p) => (
          <button
            key={p.id}
            type="button"
            className="pos-quick-item"
            onClick={() => onSelect(p)}
            role="listitem"
            aria-label={`Add ${p.name} — ${formatPaise(p.salePrice)}`}
          >
            <span className="pos-quick-item-name">{p.name}</span>
            <span className="pos-quick-item-price">{formatPaise(p.salePrice)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
