/** Create Product — Stock configuration section */

import { useLanguage } from '@/hooks/useLanguage'
import type { ProductFormData, StockValidationMode } from '../product.types'
import { STOCK_VALIDATION_LABELS } from '../product.constants'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

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
  const { t } = useLanguage()
  return (
    <div className="create-party-section py-0">
      <div className="input-group">
        <label htmlFor="product-opening-stock" className="input-label">{t.openingStockLabel}</label>
        <Input
          id="product-opening-stock"
          className={`input${errors.openingStock ? ' input-error-border' : ''}`}
          type="number"
          min="0"
          step="any"
          value={form.openingStock || ''}
          onChange={(e) => onUpdate('openingStock', parseFloat(e.target.value) || 0)}
          placeholder="0"
          aria-label={t.openingStockQty}
          inputMode="decimal"
        />
        {errors.openingStock && <p className="input-error" role="alert">{errors.openingStock}</p>}
      </div>

      <div className="input-group">
        <label htmlFor="product-min-stock" className="input-label">
          {t.minimumStockLevel}
          <span className="text-optional"> ({t.lowStockAlertHint})</span>
        </label>
        <Input
          id="product-min-stock"
          className={`input${errors.minStockLevel ? ' input-error-border' : ''}`}
          type="number"
          min="0"
          step="any"
          value={form.minStockLevel || ''}
          onChange={(e) => onUpdate('minStockLevel', parseFloat(e.target.value) || 0)}
          placeholder={t.minStockPlaceholder}
          aria-label={t.minimumStockLevel}
          inputMode="decimal"
        />
        {errors.minStockLevel && <p className="input-error" role="alert">{errors.minStockLevel}</p>}
      </div>

      <div className="input-group">
        <label htmlFor="product-moq" className="input-label">
          {t.moqLabel}
          <span className="text-optional"> ({t.moqHint})</span>
        </label>
        <Input
          id="product-moq"
          className={`input${errors.moq ? ' input-error-border' : ''}`}
          type="number"
          min="0"
          step="1"
          value={form.moq || ''}
          onChange={(e) => onUpdate('moq', parseInt(e.target.value, 10) || 0)}
          placeholder="0"
          aria-label={t.moqLabel}
          inputMode="numeric"
        />
        <p className="input-helper-text">{t.moqHelperText}</p>
        {errors.moq && <p className="input-error" role="alert">{errors.moq}</p>}
      </div>

      <div className="input-group">
        <span className="input-label" id="stock-validation-label">{t.stockValidationMode}</span>
        <div className="pill-tabs" role="group" aria-labelledby="stock-validation-label">
          {VALIDATION_MODE_OPTIONS.map((option) => (
            <Button variant="none"
              key={option.value}
              type="button"
              className={`pill-tab${form.stockValidation === option.value ? ' active' : ''}`}
              onClick={() => onUpdate('stockValidation', option.value)}
              aria-pressed={form.stockValidation === option.value}
              aria-label={`${t.stockValidationPrefix}: ${option.label}`}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
