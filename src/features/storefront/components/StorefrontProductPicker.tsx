// ─── StorefrontProductPicker — drawer to add products to the store ────────────

import { useState, useCallback } from 'react'
import { Search, Check } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Drawer } from '@/components/ui/Drawer'
import { formatPaise } from '@/lib/format'
import type { ProductListResponse } from '@/features/products/product-api.types'

interface Props {
  open: boolean
  onClose: () => void
  alreadyAdded: string[]  // productIds already in the store
  onConfirm: (productIds: string[]) => Promise<unknown>
  adding: boolean
}

export function StorefrontProductPicker({
  open,
  onClose,
  alreadyAdded,
  onConfirm,
  adding,
}: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data, isPending } = useQuery({
    queryKey: ['products', 'picker', search],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ limit: '50', status: 'ACTIVE' })
      if (search) params.set('search', search)
      return api<ProductListResponse>(`/products?${params}`, { signal })
    },
    enabled: open,
    staleTime: 30_000,
  })

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleConfirm = async () => {
    if (selected.size === 0) return
    await onConfirm(Array.from(selected))
    setSelected(new Set())
    setSearch('')
    onClose()
  }

  const products = data?.products ?? []
  const available = products.filter(p => !alreadyAdded.includes(p.id))

  return (
    <Drawer
      open={open}
      onClose={() => { setSelected(new Set()); setSearch(''); onClose() }}
      title="Add Products to Store"
      footer={
        <button
          type="button"
          className="sf-save-btn"
          onClick={() => { void handleConfirm() }}
          disabled={selected.size === 0 || adding}
        >
          {adding ? 'Adding...' : `Add ${selected.size > 0 ? `${selected.size} ` : ''}Product${selected.size !== 1 ? 's' : ''}`}
        </button>
      }
    >
      <div className="sf-picker">
        <div className="sf-picker__search-wrap">
          <Search size={16} className="sf-picker__search-icon" aria-hidden="true" />
          <input
            type="search"
            className="sf-picker__search"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search products"
          />
        </div>

        {isPending && (
          <div className="sf-picker__loading" role="status" aria-label="Loading products">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="sf-picker__skeleton-row" />
            ))}
          </div>
        )}

        {!isPending && available.length === 0 && (
          <p className="sf-picker__empty">
            {search ? 'No products match your search' : 'All products are already added'}
          </p>
        )}

        {!isPending && (
          <ul className="sf-picker__list" role="listbox" aria-label="Products">
            {available.map(product => {
              const isSelected = selected.has(product.id)
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`sf-picker__item${isSelected ? ' sf-picker__item--selected' : ''}`}
                    onClick={() => toggle(product.id)}
                  >
                    {product.imageUrl
                      ? <img src={product.imageUrl} alt="" className="sf-picker__img" />
                      : <div className="sf-picker__img-placeholder" aria-hidden="true" />
                    }
                    <div className="sf-picker__item-info">
                      <span className="sf-picker__item-name">{product.name}</span>
                      <span className="sf-picker__item-price">
                        {formatPaise(product.salePrice)}
                      </span>
                    </div>
                    {isSelected && <Check size={18} className="sf-picker__check" aria-hidden="true" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Drawer>
  )
}
