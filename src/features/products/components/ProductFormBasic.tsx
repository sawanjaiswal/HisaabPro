/** Create Product — Basic info section */

import { Input } from '@/components/ui/Input'
import type { ProductFormData } from '../product.types'
import { PREDEFINED_CATEGORIES, PREDEFINED_UNITS, DEFAULT_CATEGORY_ID, DEFAULT_UNIT_ID } from '../product.constants'

interface ProductFormBasicProps {
  form: ProductFormData
  errors: Record<string, string>
  onUpdate: <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => void
}

export function ProductFormBasic({ form, errors, onUpdate }: ProductFormBasicProps) {
  return (
    <div className="create-party-section">
      <Input
        label="Product Name"
        id="product-name"
        value={form.name}
        onChange={(e) => onUpdate('name', e.target.value)}
        error={errors.name}
        placeholder="e.g. Maggi Noodles 70g"
        required
        autoComplete="off"
        aria-required="true"
      />

      <div className="input-group">
        <span className="input-label" id="sku-mode-label">SKU</span>
        <div className="pill-tabs" role="group" aria-labelledby="sku-mode-label" style={{ marginBottom: 'var(--space-2)' }}>
          <button
            type="button"
            className={`pill-tab${form.autoGenerateSku ? ' active' : ''}`}
            onClick={() => onUpdate('autoGenerateSku', true)}
            aria-pressed={form.autoGenerateSku}
            aria-label="Auto-generate SKU"
          >
            Auto-generate
          </button>
          <button
            type="button"
            className={`pill-tab${!form.autoGenerateSku ? ' active' : ''}`}
            onClick={() => onUpdate('autoGenerateSku', false)}
            aria-pressed={!form.autoGenerateSku}
            aria-label="Enter SKU manually"
          >
            Manual
          </button>
        </div>
        {!form.autoGenerateSku && (
          <input
            id="product-sku"
            className={`input${errors.sku ? ' input-error-border' : ''}`}
            value={form.sku ?? ''}
            onChange={(e) => onUpdate('sku', e.target.value)}
            placeholder="e.g. PRD-0001"
            aria-label="Product SKU code"
          />
        )}
        {errors.sku && <p className="input-error" role="alert">{errors.sku}</p>}
      </div>

      <div className="input-group">
        <label htmlFor="product-category" className="input-label">Category</label>
        <select
          id="product-category"
          className="input"
          value={form.categoryId ?? DEFAULT_CATEGORY_ID}
          onChange={(e) => onUpdate('categoryId', e.target.value)}
          aria-label="Select product category"
        >
          {PREDEFINED_CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div className="input-group">
        <label htmlFor="product-unit" className="input-label">Unit</label>
        <select
          id="product-unit"
          className="input"
          value={form.unitId ?? DEFAULT_UNIT_ID}
          onChange={(e) => onUpdate('unitId', e.target.value)}
          aria-label="Select product unit"
        >
          {PREDEFINED_UNITS.map((unit) => (
            <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</option>
          ))}
        </select>
      </div>

      <div className="input-group">
        <span className="input-label">Sale Price</span>
        <div className="create-party-prefix-input">
          <span className="create-party-prefix" aria-hidden="true">Rs</span>
          <input
            id="product-sale-price"
            className={`input create-party-input-prefixed${errors.salePrice ? ' input-error-border' : ''}`}
            type="number"
            min="0"
            step="0.01"
            value={form.salePrice > 0 ? form.salePrice / 100 : ''}
            onChange={(e) => onUpdate('salePrice', Math.round((parseFloat(e.target.value) || 0) * 100))}
            placeholder="0.00"
            aria-label="Sale price in rupees"
            inputMode="decimal"
          />
        </div>
        {errors.salePrice && <p className="input-error" role="alert">{errors.salePrice}</p>}
      </div>

      <div className="input-group">
        <span className="input-label">Purchase Price <span style={{ color: 'var(--color-gray-400)', fontWeight: 400 }}>(optional)</span></span>
        <div className="create-party-prefix-input">
          <span className="create-party-prefix" aria-hidden="true">Rs</span>
          <input
            id="product-purchase-price"
            className="input create-party-input-prefixed"
            type="number"
            min="0"
            step="0.01"
            value={form.purchasePrice && form.purchasePrice > 0 ? form.purchasePrice / 100 : ''}
            onChange={(e) => onUpdate('purchasePrice', Math.round((parseFloat(e.target.value) || 0) * 100))}
            placeholder="0.00"
            aria-label="Purchase price in rupees"
            inputMode="decimal"
          />
        </div>
      </div>
    </div>
  )
}
