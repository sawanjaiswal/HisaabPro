/** PriceListEntryFormDrawer — add / edit a price list entry */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { useLanguage } from '@/hooks/useLanguage'
import { PRICE_LIST_MODES, MODE_LABELS, MODE_DESCRIPTIONS, bpsToPercent } from '../price-list.constants'
import { PriceListProductPicker } from './PriceListProductPicker'
import type { PriceListEntry, PriceListEntryFormData, PriceListMode } from '../price-list.types'
import { Input } from '@/components/ui/Input'

interface PriceListEntryFormDrawerProps {
  open: boolean
  initial?: PriceListEntry | null
  isLoading: boolean
  onClose: () => void
  onSubmit: (data: PriceListEntryFormData) => void
}

interface SelectedProduct {
  id: string
  name: string
  salePrice: number
}

function entryToDisplayValue(entry: PriceListEntry): string {
  switch (entry.mode) {
    case 'ABSOLUTE':    return entry.valuePaise !== null ? String(entry.valuePaise / 100) : ''
    case 'PERCENT_OFF': return entry.percentBps !== null ? bpsToPercent(entry.percentBps) : ''
    case 'FIXED_OFF':   return entry.fixedOffPaise !== null ? String(entry.fixedOffPaise / 100) : ''
  }
}

export function PriceListEntryFormDrawer({
  open,
  initial,
  isLoading,
  onClose,
  onSubmit,
}: PriceListEntryFormDrawerProps) {
  const { t } = useLanguage()
  const isEdit = !!initial

  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null)
  const [mode, setMode] = useState<PriceListMode>('ABSOLUTE')
  const [value, setValue] = useState('')
  const [minQty, setMinQty] = useState('1')
  const [maxQty, setMaxQty] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setSelectedProduct(
        initial
          ? { id: initial.productId, name: initial.productName, salePrice: 0 }
          : null
      )
      setMode(initial?.mode ?? 'ABSOLUTE')
      setValue(initial ? entryToDisplayValue(initial) : '')
      setMinQty(String(initial?.minQty ?? 1))
      setMaxQty(initial?.maxQty !== null && initial?.maxQty !== undefined ? String(initial.maxQty) : '')
      setErrors({})
    }
  }, [open, initial])

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!selectedProduct) e.product = t.plEntryProductRequired
    if (!value.trim()) e.value = t.plEntryValueRequired
    if (isNaN(parseFloat(value))) e.value = t.plEntryValueInvalid
    if (parseInt(minQty, 10) < 1) e.minQty = t.plEntryQtyMin
    if (maxQty && parseInt(maxQty, 10) < parseInt(minQty, 10)) e.maxQty = t.plEntryMaxQtyGte
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || !selectedProduct) return
    onSubmit({
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      mode,
      value,
      minQty,
      maxQty,
    })
  }

  const valuePlaceholder = mode === 'PERCENT_OFF' ? t.plValuePlaceholderPct : t.plValuePlaceholderRs
  const valueLabel = mode === 'PERCENT_OFF' ? t.plValueLabelPct : mode === 'FIXED_OFF' ? t.plValueLabelFlat : t.plValueLabelFixed

  const footer = (
    <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-4)' }}>
      <button type="button" className="btn btn-outline flex-1" onClick={onClose}>{t.cancel}</button>
      <Button type="submit" form="pl-entry-form" variant="primary" className="flex-1" disabled={isLoading} aria-busy={isLoading}>
        {isLoading ? t.saving : t.save}
      </Button>
    </div>
  )

  return (
    <Drawer open={open} onClose={onClose} title={isEdit ? t.plEntryEditTitle : t.plEntryAddTitle} footer={footer}>
      <form id="pl-entry-form" className="pl-form" onSubmit={handleSubmit} noValidate>

        {/* Product picker */}
        <div className="pl-form__field">
          <label className="pl-form__label">{t.plEntryProduct}</label>
          <PriceListProductPicker
            selected={selectedProduct}
            onSelect={setSelectedProduct}
            onClear={() => setSelectedProduct(null)}
            error={errors.product}
            readOnly={isEdit}
          />
          {!errors.product && (
            <p className="pl-form__hint">{t.plEntryProductHint}</p>
          )}
        </div>

        {/* Mode selector */}
        <div className="pl-form__field">
          <span className="pl-form__label">{t.plMode}</span>
          <div className="pl-form__mode-grid">
            {PRICE_LIST_MODES.map((m) => (
              <button
                key={m}
                type="button"
                className="pl-form__mode-btn"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
              >
                <span className="pl-form__mode-btn__label">{MODE_LABELS[m]}</span>
                <span className="pl-form__mode-btn__desc">{MODE_DESCRIPTIONS[m]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Value */}
        <div className="pl-form__field">
          <label htmlFor="pl-entry-value" className="pl-form__label">{valueLabel}</label>
          <Input
            id="pl-entry-value"
            type="number"
            className={`input${errors.value ? ' input--error' : ''}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={valuePlaceholder}
            min="0"
            step="0.01"
            aria-invalid={!!errors.value}
          />
          {errors.value && <span className="input__error" role="alert">{errors.value}</span>}
        </div>

        {/* Qty range */}
        <div className="pl-form__field">
          <span className="pl-form__label">{t.plQtyRange}</span>
          <div className="pl-form__row">
            <div className="pl-form__field">
              <label htmlFor="pl-entry-minqty" className="pl-form__hint">{t.plMinQty}</label>
              <Input
                id="pl-entry-minqty"
                type="number"
                className={`input${errors.minQty ? ' input--error' : ''}`}
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
                min="1"
                placeholder="1"
                aria-invalid={!!errors.minQty}
              />
              {errors.minQty && <span className="input__error" role="alert">{errors.minQty}</span>}
            </div>
            <div className="pl-form__field">
              <label htmlFor="pl-entry-maxqty" className="pl-form__hint">{t.plMaxQty}</label>
              <Input
                id="pl-entry-maxqty"
                type="number"
                className={`input${errors.maxQty ? ' input--error' : ''}`}
                value={maxQty}
                onChange={(e) => setMaxQty(e.target.value)}
                min={minQty || '1'}
                placeholder={t.plMaxQtyPlaceholder}
                aria-invalid={!!errors.maxQty}
              />
              {errors.maxQty && <span className="input__error" role="alert">{errors.maxQty}</span>}
            </div>
          </div>
          <p className="pl-form__hint">{t.plQtyRangeHint}</p>
        </div>
      </form>
    </Drawer>
  )
}
