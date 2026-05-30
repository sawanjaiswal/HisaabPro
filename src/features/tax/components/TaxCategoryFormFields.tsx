/** Tax — Tax Category form fields (sub-component)
 *
 * Name, rate (basis points → display %), cess, cessType, HSN, SAC.
 * All inputs use 16px font (iOS zoom prevention).
 */

import { formatRate } from '../tax.constants'
import { useLanguage } from '@/hooks/useLanguage'
import { Select, SelectItem } from '@/components/ui/Select'
import type { TaxCategoryFormData } from '../tax.types'
import { Input } from '@/components/ui/Input'

interface Props {
  form: TaxCategoryFormData
  errors: Record<string, string>
  onUpdate: <K extends keyof TaxCategoryFormData>(key: K, value: TaxCategoryFormData[K]) => void
}

export function TaxCategoryFormFields({ form, errors, onUpdate }: Props) {
  const { t } = useLanguage()
  return (
    <div className="tax-form-fields">
      <div className="form-group">
        <label className="form-label" htmlFor="tc-name">{t.categoryName}</label>
        <Input id="tc-name" className={`form-input${errors.name ? ' form-input-error' : ''}`} value={form.name} onChange={(e) => onUpdate('name', e.target.value)} placeholder={t.categoryNamePlaceholder} />
        {errors.name && <span className="form-error">{errors.name}</span>}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="tc-rate">{t.gstRate} ({formatRate(form.rate)})</label>
        <Input id="tc-rate" className={`form-input${errors.rate ? ' form-input-error' : ''}`} type="number" inputMode="decimal" min={0} max={10000} value={form.rate} onChange={(e) => onUpdate('rate', Number(e.target.value))} placeholder={t.basisPointsPlaceholder} />
        {errors.rate && <span className="form-error">{errors.rate}</span>}
      </div>

      <div className="form-row-2">
        <div className="form-group">
          <label className="form-label" htmlFor="tc-cess">{t.cessRate}</label>
          <Input id="tc-cess" className={`form-input${errors.cessRate ? ' form-input-error' : ''}`} type="number" inputMode="decimal" min={0} value={form.cessRate} onChange={(e) => onUpdate('cessRate', Number(e.target.value))} placeholder="0" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="tc-cess-type">{t.cessType}</label>
          <Select
            value={form.cessType}
            onValueChange={(v) => onUpdate('cessType', v as 'PERCENTAGE' | 'FIXED_PER_UNIT')}
            ariaLabel={t.cessType}
          >
            <SelectItem value="PERCENTAGE">{t.percentage}</SelectItem>
            <SelectItem value="FIXED_PER_UNIT">{t.fixedPerUnit}</SelectItem>
          </Select>
        </div>
      </div>

      <div className="form-row-2">
        <div className="form-group">
          <label className="form-label" htmlFor="tc-hsn">{t.hsnCodeLabel}</label>
          <Input id="tc-hsn" className="form-input" value={form.hsnCode} onChange={(e) => onUpdate('hsnCode', e.target.value)} placeholder={t.hsnCodePlaceholder} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="tc-sac">{t.sacCode}</label>
          <Input id="tc-sac" className="form-input" value={form.sacCode} onChange={(e) => onUpdate('sacCode', e.target.value)} placeholder={t.sacCodePlaceholder} />
        </div>
      </div>
    </div>
  )
}
