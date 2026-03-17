/** Tax — Tax Category form fields (sub-component)
 *
 * Name, rate (basis points → display %), cess, cessType, HSN, SAC.
 * All inputs use 16px font (iOS zoom prevention).
 */

import { formatRate } from '../tax.constants'
import type { TaxCategoryFormData } from '../tax.types'

interface Props {
  form: TaxCategoryFormData
  errors: Record<string, string>
  onUpdate: <K extends keyof TaxCategoryFormData>(key: K, value: TaxCategoryFormData[K]) => void
}

export function TaxCategoryFormFields({ form, errors, onUpdate }: Props) {
  return (
    <div className="tax-form-fields">
      <div className="form-group">
        <label className="form-label" htmlFor="tc-name">Category Name</label>
        <input id="tc-name" className={`form-input${errors.name ? ' form-input-error' : ''}`} value={form.name} onChange={(e) => onUpdate('name', e.target.value)} placeholder='e.g. "GST 18%"' />
        {errors.name && <span className="form-error">{errors.name}</span>}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="tc-rate">GST Rate ({formatRate(form.rate)})</label>
        <input id="tc-rate" className={`form-input${errors.rate ? ' form-input-error' : ''}`} type="number" inputMode="decimal" min={0} max={10000} value={form.rate} onChange={(e) => onUpdate('rate', Number(e.target.value))} placeholder="Basis points (1800 = 18%)" />
        {errors.rate && <span className="form-error">{errors.rate}</span>}
      </div>

      <div className="form-row-2">
        <div className="form-group">
          <label className="form-label" htmlFor="tc-cess">Cess Rate</label>
          <input id="tc-cess" className={`form-input${errors.cessRate ? ' form-input-error' : ''}`} type="number" inputMode="decimal" min={0} value={form.cessRate} onChange={(e) => onUpdate('cessRate', Number(e.target.value))} placeholder="0" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="tc-cess-type">Cess Type</label>
          <select id="tc-cess-type" className="form-input" value={form.cessType} onChange={(e) => onUpdate('cessType', e.target.value as 'PERCENTAGE' | 'FIXED_PER_UNIT')}>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED_PER_UNIT">Fixed per unit</option>
          </select>
        </div>
      </div>

      <div className="form-row-2">
        <div className="form-group">
          <label className="form-label" htmlFor="tc-hsn">HSN Code</label>
          <input id="tc-hsn" className="form-input" value={form.hsnCode} onChange={(e) => onUpdate('hsnCode', e.target.value)} placeholder="e.g. 1001" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="tc-sac">SAC Code</label>
          <input id="tc-sac" className="form-input" value={form.sacCode} onChange={(e) => onUpdate('sacCode', e.target.value)} placeholder="e.g. 998311" />
        </div>
      </div>
    </div>
  )
}
