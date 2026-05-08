/** BomComponentRow — single editable row in BOM form */

import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { getProducts } from '@/lib/services/product.service'
import { getUnits } from '@/features/products/unit.service'
import { useDebounce } from '@/hooks/useDebounce'
import type { BomComponentFormRow } from '../bom.types'
import type { Unit } from '@/features/products/product.types'

interface BomComponentRowProps {
  row: BomComponentFormRow
  index: number
  finishedProductId: string
  errors?: { qty?: string; productId?: string }
  onChange: (index: number, updates: Partial<BomComponentFormRow>) => void
  onRemove: (index: number) => void
}

interface ProductOption {
  id: string
  name: string
  currentStock: number
  unit: { symbol: string }
}

export function BomComponentRow({
  row, index, finishedProductId, errors, onChange, onRemove,
}: BomComponentRowProps) {
  const [query, setQuery] = useState(row.componentProductName)
  const [results, setResults] = useState<ProductOption[]>([])
  const [open, setOpen] = useState(false)
  const [units, setUnits] = useState<Unit[]>([])
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    getUnits(undefined).then(setUnits).catch(() => {})
  }, [])

  useEffect(() => {
    if (!open || debouncedQuery.trim().length < 1) { setResults([]); return }
    getProducts({ search: debouncedQuery, limit: 8 })
      .then((r) => setResults(r.products as unknown as ProductOption[]))
      .catch(() => setResults([]))
  }, [debouncedQuery, open])

  const selectProduct = (p: ProductOption) => {
    onChange(index, { componentProductId: p.id, componentProductName: p.name })
    setQuery(p.name)
    setOpen(false)
    setResults([])
  }

  return (
    <div className="bom-row" role="group" aria-label={`Component ${index + 1}`}>
      {/* Product search */}
      <div className="bom-row__product input-group">
        <label className="input-label sr-only" htmlFor={`comp-product-${index}`}>Product</label>
        <input
          id={`comp-product-${index}`}
          className={`input${errors?.productId ? ' input-error-border' : ''}`}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search product..."
          autoComplete="off"
          aria-label="Component product"
          aria-haspopup="listbox"
          aria-expanded={open}
        />
        {open && results.length > 0 && (
          <ul className="bom-row__suggestions" role="listbox">
            {results
              .filter((p) => p.id !== finishedProductId)
              .map((p) => (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={row.componentProductId === p.id}
                  className="bom-row__suggestion-item"
                  onMouseDown={() => selectProduct(p)}
                >
                  <span className="bom-row__suggestion-name">{p.name}</span>
                  <span className="bom-row__suggestion-stock">Stock: {p.currentStock}</span>
                </li>
              ))}
          </ul>
        )}
        {errors?.productId && <p className="input-error" role="alert">{errors.productId}</p>}
      </div>

      {/* Qty */}
      <div className="bom-row__qty input-group">
        <label className="input-label sr-only" htmlFor={`comp-qty-${index}`}>Qty</label>
        <input
          id={`comp-qty-${index}`}
          className={`input${errors?.qty ? ' input-error-border' : ''}`}
          type="number"
          min="0.001"
          step="0.001"
          value={row.quantity}
          onChange={(e) => onChange(index, { quantity: e.target.value })}
          placeholder="Qty"
          inputMode="decimal"
          aria-label="Component quantity"
        />
        {errors?.qty && <p className="input-error" role="alert">{errors.qty}</p>}
      </div>

      {/* Unit */}
      <div className="bom-row__unit input-group">
        <label className="input-label sr-only" htmlFor={`comp-unit-${index}`}>Unit</label>
        <select
          id={`comp-unit-${index}`}
          className="input"
          value={row.unitId}
          onChange={(e) => onChange(index, { unitId: e.target.value })}
          aria-label="Component unit"
        >
          <option value="">Unit (opt.)</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {/* Remove */}
      <button
        type="button"
        className="bom-row__remove btn btn-ghost btn-icon"
        onClick={() => onRemove(index)}
        aria-label={`Remove component ${index + 1}`}
        style={{ minWidth: 44, minHeight: 44 }}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
