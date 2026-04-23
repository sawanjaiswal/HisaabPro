/** Create Product — Tax category, HSN/SAC, barcode, description, status section */

import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/hooks/useLanguage'
import type { ProductFormData, ProductStatus } from '../product.types'
import { PRODUCT_STATUS_LABELS, HSN_CODE_MAX, SAC_CODE_MAX, PRODUCT_DESCRIPTION_MAX } from '../product.constants'
import type { TaxCategory } from '@/lib/types/tax.types'
import { BarcodeField } from './BarcodeField'
import '../barcode.css'

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
  const { t } = useLanguage()
  return (
    <div className="create-party-section py-0">
      {taxCategories.length > 0 && (
        <div className="input-group">
          <label htmlFor="product-tax-cat" className="input-label">{t.taxCategoryLabel}</label>
          <select id="product-tax-cat" className="input" value={form.taxCategoryId ?? ''} onChange={(e) => onUpdate('taxCategoryId', e.target.value || null)} aria-label={t.selectTaxCategory}>
            <option value="">{t.noneExempt}</option>
            {taxCategories.map((tc) => (
              <option key={tc.id} value={tc.id}>{tc.name}</option>
            ))}
          </select>
        </div>
      )}

      <BarcodeField form={form} errors={errors} onUpdate={onUpdate} />

      <Input label={t.hsnCodeGoods} id="product-hsn" value={form.hsnCode ?? ''} onChange={(e) => onUpdate('hsnCode', e.target.value || undefined)} error={errors.hsnCode} placeholder="e.g. 19023090" maxLength={HSN_CODE_MAX} autoComplete="off" />

      <Input label={t.sacCodeServices} id="product-sac" value={form.sacCode ?? ''} onChange={(e) => onUpdate('sacCode', e.target.value || undefined)} error={errors.sacCode} placeholder="e.g. 998314" maxLength={SAC_CODE_MAX} autoComplete="off" />

      <div className="input-group">
        <label htmlFor="product-description" className="input-label">{t.descriptionLabel}</label>
        <textarea id="product-description" className="input input-textarea" value={form.description ?? ''} onChange={(e) => onUpdate('description', e.target.value || undefined)} placeholder={t.additionalProductDetails} rows={3} maxLength={PRODUCT_DESCRIPTION_MAX} aria-label={t.descriptionLabel} />
      </div>

      <div className="input-group">
        <span className="input-label" id="product-status-label">{t.statusLabel}</span>
        <div className="pill-tabs" role="group" aria-labelledby="product-status-label">
          {STATUS_OPTIONS.map((option) => (
            <button key={option.value} type="button" className={`pill-tab${form.status === option.value ? ' active' : ''}`} onClick={() => onUpdate('status', option.value)} aria-pressed={form.status === option.value} aria-label={`${t.setProductStatusTo} ${option.label}`}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
