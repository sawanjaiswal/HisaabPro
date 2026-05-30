/** POS — Single product tile */

import { Plus } from 'lucide-react'
import { paiseToInr } from '../../utils/pos.format'
import { useLanguage } from '@/hooks/useLanguage'
import type { PosProductDTO } from '../../types/pos.types'
import { Button } from '@/components/ui/Button'

interface PosProductCardProps {
  product:   PosProductDTO
  onSelect:  (product: PosProductDTO) => void
  inCart:    boolean
}

export function PosProductCard({ product, onSelect, inCart }: PosProductCardProps) {
  const { t } = useLanguage()
  const outOfStock = product.stock <= 0

  const handleClick = () => {
    if (!outOfStock) onSelect(product)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <div
      role="button"
      tabIndex={outOfStock ? -1 : 0}
      aria-disabled={outOfStock}
      aria-label={`${product.name}, ${paiseToInr(product.salePrice)}${outOfStock ? ', out of stock' : ''}`}
      className={[
        'pos-product-card',
        outOfStock ? 'pos-product-card--oos' : '',
        inCart ? 'pos-product-card--in-cart' : '',
      ].filter(Boolean).join(' ')}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="pos-product-card__img"
          loading="lazy"
        />
      ) : (
        <div className="pos-product-card__img pos-product-card__img--placeholder" aria-hidden="true">
          <span className="pos-product-card__initial">
            {product.name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      <div className="pos-product-card__body">
        <p className="pos-product-card__name" title={product.name}>
          {product.name}
        </p>
        <p className="pos-product-card__price">{paiseToInr(product.salePrice)}</p>
        {outOfStock ? (
          <span className="pos-product-card__stock pos-product-card__stock--oos">
            {t.posOutOfStock ?? 'Out of stock'}
          </span>
        ) : (
          <span className="pos-product-card__stock">
            {(t.posStock ?? 'Stock: {n}').replace('{n}', String(product.stock))}
          </span>
        )}
      </div>

      {!outOfStock && (
        <Button variant="none"
          type="button"
          className="pos-product-card__add"
          tabIndex={-1}
          aria-hidden="true"
          onClick={(e) => { e.stopPropagation(); onSelect(product) }}
        >
          <Plus size={14} strokeWidth={2.5} />
        </Button>
      )}

      {inCart && <span className="pos-product-card__badge" aria-label="In cart" />}
    </div>
  )
}
