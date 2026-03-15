/** Create Product — HSN/SAC, description, status section */

import { Input } from '@/components/ui/Input'
import type { ProductFormData, ProductStatus } from '../product.types'
import { PRODUCT_STATUS_LABELS, HSN_CODE_MAX, SAC_CODE_MAX, PRODUCT_DESCRIPTION_MAX } from '../product.constants'

interface ProductFormExtraProps {
  form: ProductFormData
  errors: Record<string, string>
  onUpdate: <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => void
}

const STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: 'ACTIVE',   label: PRODUCT_STATUS_LABELS.ACTIVE },
  { value: 'INACTIVE', label: PRODUCT_STATUS_LABELS.INACTIVE },
]

export function ProductFormExtra({ form, errors, onUpdate }: ProductFormExtraProps) {
  return (
    <div className="create-party-section">
      <Input
        label="HSN Code (goods)"
        id="product-hsn"
        value={form.hsnCode ?? ''}
        onChange={(e) => onUpdate('hsnCode', e.target.value || undefined)}
        error={errors.hsnCode}
        placeholder="e.g. 19023090"
        maxLength={HSN_CODE_MAX}
        autoComplete="off"
        aria-describedby="hsn-hint"
      />
      <p id="hsn-hint" style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginTop: 'calc(var(--space-1) * -1)' }}>
        For Phase 2 GST billing
      </p>

      <Input
        label="SAC Code (services)"
        id="product-sac"
        value={form.sacCode ?? ''}
        onChange={(e) => onUpdate('sacCode', e.target.value || undefined)}
        error={errors.sacCode}
        placeholder="e.g. 998314"
        maxLength={SAC_CODE_MAX}
        autoComplete="off"
      />

      <div className="input-group">
        <label htmlFor="product-description" className="input-label">Description</label>
        <textarea
          id="product-description"
          className="input create-party-textarea"
          value={form.description ?? ''}
          onChange={(e) => onUpdate('description', e.target.value || undefined)}
          placeholder="Additional product details..."
          rows={3}
          maxLength={PRODUCT_DESCRIPTION_MAX}
          aria-label="Product description"
          style={{ resize: 'vertical', height: 'auto', paddingTop: 'var(--space-3)', paddingBottom: 'var(--space-3)' }}
        />
      </div>

      <div className="input-group">
        <span className="input-label" id="product-status-label">Status</span>
        <div className="pill-tabs" role="group" aria-labelledby="product-status-label">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`pill-tab${form.status === option.value ? ' active' : ''}`}
              onClick={() => onUpdate('status', option.value)}
              aria-pressed={form.status === option.value}
              aria-label={`Set product status to ${option.label}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
