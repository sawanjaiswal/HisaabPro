/** Create Product — Tax category, HSN/SAC, description, status section */

import { Input } from '@/components/ui/Input'
import type { ProductFormData, ProductStatus } from '../product.types'
import { PRODUCT_STATUS_LABELS, HSN_CODE_MAX, SAC_CODE_MAX, PRODUCT_DESCRIPTION_MAX } from '../product.constants'
import type { TaxCategory } from '@/lib/types/tax.types'

interface ProductFormExtraProps {
  form: ProductFormData
  errors: Record<string, string>
  onUpdate: <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => void
  taxCategories?: TaxCategory[]
}

const STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: 'ACTIVE',   label: PRODUCT_STATUS_LABELS.ACTIVE },
  { value: 'INACTIVE', label: PRODUCT_STATUS_LABELS.INACTIVE },
]

export function ProductFormExtra({ form, errors, onUpdate, taxCategories = [] }: ProductFormExtraProps) {
  return (
    <div className="create-party-section">
      {taxCategories.length > 0 && (
        <div className="input-group">
          <label htmlFor="product-tax-cat" className="input-label">Tax Category</label>
          <select id="product-tax-cat" className="input" value={form.taxCategoryId ?? ''} onChange={(e) => onUpdate('taxCategoryId', e.target.value || null)} aria-label="Select tax category">
            <option value="">None (Exempt)</option>
            {taxCategories.map((tc) => (
              <option key={tc.id} value={tc.id}>{tc.name}</option>
            ))}
          </select>
        </div>
      )}

      <Input label="HSN Code (goods)" id="product-hsn" value={form.hsnCode ?? ''} onChange={(e) => onUpdate('hsnCode', e.target.value || undefined)} error={errors.hsnCode} placeholder="e.g. 19023090" maxLength={HSN_CODE_MAX} autoComplete="off" />

      <Input label="SAC Code (services)" id="product-sac" value={form.sacCode ?? ''} onChange={(e) => onUpdate('sacCode', e.target.value || undefined)} error={errors.sacCode} placeholder="e.g. 998314" maxLength={SAC_CODE_MAX} autoComplete="off" />

      <div className="input-group">
        <label htmlFor="product-description" className="input-label">Description</label>
        <textarea id="product-description" className="input create-party-textarea" value={form.description ?? ''} onChange={(e) => onUpdate('description', e.target.value || undefined)} placeholder="Additional product details..." rows={3} maxLength={PRODUCT_DESCRIPTION_MAX} aria-label="Product description" style={{ resize: 'vertical', height: 'auto', paddingTop: 'var(--space-3)', paddingBottom: 'var(--space-3)' }} />
      </div>

      <div className="input-group">
        <span className="input-label" id="product-status-label">Status</span>
        <div className="pill-tabs" role="group" aria-labelledby="product-status-label">
          {STATUS_OPTIONS.map((option) => (
            <button key={option.value} type="button" className={`pill-tab${form.status === option.value ? ' active' : ''}`} onClick={() => onUpdate('status', option.value)} aria-pressed={form.status === option.value} aria-label={`Set product status to ${option.label}`}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
