// ─── StorefrontProductsSection — product list with actions ────────────────────

import { useState, useCallback } from 'react'
import { ChevronUp, ChevronDown, Eye, EyeOff, Trash2 } from 'lucide-react'
import { formatPaise } from '@/lib/format'
import { StorefrontProductPicker } from './StorefrontProductPicker'
import { useStorefrontProducts } from '../hooks/useStorefrontProducts'

export function StorefrontProductsSection() {
  const {
    products,
    status: prodStatus,
    addProducts,
    removeProduct,
    patchProduct,
    adding,
    removing,
    patching,
  } = useStorefrontProducts()

  const [pickerOpen, setPickerOpen] = useState(false)

  const handleMoveUp = useCallback(async (idx: number) => {
    if (idx === 0) return
    const p = products[idx]
    const prev = products[idx - 1]
    await patchProduct({ productId: p.productId, name: p.name, payload: { sortOrder: prev.sortOrder } })
    await patchProduct({ productId: prev.productId, name: prev.name, payload: { sortOrder: p.sortOrder } })
  }, [products, patchProduct])

  const handleMoveDown = useCallback(async (idx: number) => {
    if (idx === products.length - 1) return
    const p = products[idx]
    const next = products[idx + 1]
    await patchProduct({ productId: p.productId, name: p.name, payload: { sortOrder: next.sortOrder } })
    await patchProduct({ productId: next.productId, name: next.name, payload: { sortOrder: p.sortOrder } })
  }, [products, patchProduct])

  return (
    <section className="sf-card" aria-labelledby="sf-products-title">
      <h2 id="sf-products-title" className="sf-card__title">
        Store Products ({products.length})
      </h2>

      {prodStatus === 'loading' && (
        <div role="status" aria-label="Loading products">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="sf-skeleton__bar sf-skeleton__bar--full" style={{ marginBottom: 8 }} />
          ))}
        </div>
      )}

      {prodStatus === 'error' && (
        <p className="sf-error__msg" role="alert">Failed to load products.</p>
      )}

      {prodStatus === 'empty' && (
        <p className="sf-help" style={{ textAlign: 'center', padding: '16px 0' }}>
          No products added yet — tap below to add from your catalogue.
        </p>
      )}

      {prodStatus === 'success' && (
        <ul className="sf-products-list" aria-label="Store products">
          {products.map((p, idx) => (
            <li key={p.id} className="sf-product-row">
              {p.imageUrl
                ? <img src={p.imageUrl} alt="" className="sf-product-row__img" />
                : <div className="sf-product-row__img-placeholder" aria-hidden="true" />
              }
              <div className="sf-product-row__info">
                <p className="sf-product-row__name">{p.name}</p>
                <p className="sf-product-row__price">{formatPaise(p.sellingPrice)}</p>
              </div>
              <div className="sf-product-row__actions">
                <button
                  type="button"
                  className="sf-icon-btn"
                  onClick={() => { void handleMoveUp(idx) }}
                  disabled={idx === 0 || patching}
                  aria-label={`Move ${p.name} up`}
                >
                  <ChevronUp size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="sf-icon-btn"
                  onClick={() => { void handleMoveDown(idx) }}
                  disabled={idx === products.length - 1 || patching}
                  aria-label={`Move ${p.name} down`}
                >
                  <ChevronDown size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="sf-icon-btn"
                  onClick={() => { void patchProduct({ productId: p.productId, name: p.name, payload: { visible: !p.visible } }) }}
                  disabled={patching}
                  aria-label={p.visible ? `Hide ${p.name}` : `Show ${p.name}`}
                  aria-pressed={p.visible}
                >
                  {p.visible ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  className="sf-icon-btn sf-icon-btn--danger"
                  onClick={() => { void removeProduct({ productId: p.productId, name: p.name }) }}
                  disabled={removing}
                  aria-label={`Remove ${p.name} from store`}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="sf-add-products-btn"
        onClick={() => setPickerOpen(true)}
        aria-label="Add products to store"
      >
        + Add Products
      </button>

      <StorefrontProductPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        alreadyAdded={products.map(p => p.productId)}
        onConfirm={ids => addProducts({ productIds: ids })}
        adding={adding}
      />
    </section>
  )
}
