/** Create/Edit Product — Stock configuration section */

import { useLanguage } from '@/hooks/useLanguage'
import type { ProductFormData, StockValidationMode } from '../product.types'
import { STOCK_VALIDATION_LABELS } from '../product.constants'
import { NumberInput } from '@/components/ui/NumberInput'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'

interface ProductFormStockProps {
  form: ProductFormData
  errors: Record<string, string>
  onUpdate: <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => void
  isEditMode?: boolean
}

const VALIDATION_MODE_OPTIONS: { value: StockValidationMode; label: string }[] = [
  { value: 'GLOBAL',     label: STOCK_VALIDATION_LABELS.GLOBAL },
  { value: 'WARN_ONLY',  label: STOCK_VALIDATION_LABELS.WARN_ONLY },
  { value: 'HARD_BLOCK', label: STOCK_VALIDATION_LABELS.HARD_BLOCK },
]

export function ProductFormStock({ form, errors, onUpdate, isEditMode }: ProductFormStockProps) {
  const { t } = useLanguage()
  return (
    <div className="create-party-section py-0">
      <div className="input-group">
        <NumberInput
          id="product-opening-stock"
          label={isEditMode ? (t.currentStock || 'Current Stock') : t.openingStockLabel}
          value={form.openingStock}
          onChange={(val) => onUpdate('openingStock', val)}
          allowDecimals={true}
          placeholder="0"
          error={errors.openingStock}
          hint={isEditMode ? 'Modifying this quantity will automatically record a stock adjustment.' : undefined}
        />
      </div>

      <div className="input-group">
        <NumberInput
          id="product-min-stock"
          label={t.minimumStockLevel}
          value={form.minStockLevel}
          onChange={(val) => onUpdate('minStockLevel', val)}
          allowDecimals={true}
          placeholder={t.minStockPlaceholder}
          error={errors.minStockLevel}
          hint={t.lowStockAlertHint}
        />
      </div>

      <div className="input-group">
        <NumberInput
          id="product-moq"
          label={t.moqLabel}
          value={form.moq}
          onChange={(val) => onUpdate('moq', val)}
          allowDecimals={false}
          placeholder="0"
          error={errors.moq}
          hint={t.moqHelperText}
        />
      </div>

      <div className="input-group">
        <span className="input-label" id="stock-validation-label">{t.stockValidationMode}</span>
        <Tabs
          value={form.stockValidation}
          onValueChange={(val) => onUpdate('stockValidation', val as StockValidationMode)}
          className="w-full"
        >
          <TabsList variant="segmented" fullWidth aria-labelledby="stock-validation-label">
            {VALIDATION_MODE_OPTIONS.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                aria-label={`${t.stockValidationPrefix}: ${option.label}`}
              >
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  )
}
