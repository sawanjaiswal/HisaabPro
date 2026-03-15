/** Create Product — Stock configuration section */

import type { ProductFormData, StockValidationMode } from '../product.types'
import { STOCK_VALIDATION_LABELS } from '../product.constants'

interface ProductFormStockProps {
  form: ProductFormData
  errors: Record<string, string>
  onUpdate: <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => void
}

const VALIDATION_MODE_OPTIONS: { value: StockValidationMode; label: string }[] = [
  { value: 'GLOBAL',     label: STOCK_VALIDATION_LABELS.GLOBAL },
  { value: 'WARN_ONLY',  label: STOCK_VALIDATION_LABELS.WARN_ONLY },
  { value: 'HARD_BLOCK', label: STOCK_VALIDATION_LABELS.HARD_BLOCK },
]

export function ProductFormStock({ form, errors, onUpdate }: ProductFormStockProps) {
  return (
    <div className="create-party-section">
      <div className="input-group">
        <label htmlFor="product-opening-stock" className="input-label">Opening Stock</label>
        <input
          id="product-opening-stock"
          className={`input${errors.openingStock ? ' input-error-border' : ''}`}
          type="number"
          min="0"
          step="any"
          value={form.openingStock || ''}
          onChange={(e) => onUpdate('openingStock', parseFloat(e.target.value) || 0)}
          placeholder="0"
          aria-label="Opening stock quantity"
          inputMode="decimal"
        />
        {errors.openingStock && <p className="input-error" role="alert">{errors.openingStock}</p>}
      </div>

      <div className="input-group">
        <label htmlFor="product-min-stock" className="input-label">
          Minimum Stock Level
          <span style={{ color: 'var(--color-gray-400)', fontWeight: 400 }}> (low stock alert)</span>
        </label>
        <input
          id="product-min-stock"
          className={`input${errors.minStockLevel ? ' input-error-border' : ''}`}
          type="number"
          min="0"
          step="any"
          value={form.minStockLevel || ''}
          onChange={(e) => onUpdate('minStockLevel', parseFloat(e.target.value) || 0)}
          placeholder="0 (disabled)"
          aria-label="Minimum stock level for low stock alerts"
          inputMode="decimal"
        />
        {errors.minStockLevel && <p className="input-error" role="alert">{errors.minStockLevel}</p>}
      </div>

      <div className="input-group">
        <span className="input-label" id="stock-validation-label">Stock Validation Mode</span>
        <div className="pill-tabs" role="group" aria-labelledby="stock-validation-label">
          {VALIDATION_MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`pill-tab${form.stockValidation === option.value ? ' active' : ''}`}
              onClick={() => onUpdate('stockValidation', option.value)}
              aria-pressed={form.stockValidation === option.value}
              aria-label={`Stock validation: ${option.label}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
