/** Create Product — Basic info section */

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/hooks/useLanguage'
import type { ProductFormData, Category, Unit } from '../product.types'
import { getCategories, getUnits, createUnit } from '../product.service'
import type { UnitInput } from '../unit.service'
import { AddUnitSheet } from '@/features/units/components/AddUnitSheet'

interface ProductFormBasicProps {
  form: ProductFormData
  errors: Record<string, string>
  onUpdate: <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => void
}

export function ProductFormBasic({ form, errors, onUpdate }: ProductFormBasicProps) {
  const { t } = useLanguage()
  const [categories, setCategories] = useState<Category[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [addUnitOpen, setAddUnitOpen] = useState(false)

  const handleCreateUnit = useCallback(async (data: UnitInput): Promise<Unit | null> => {
    try {
      const created = await createUnit(data)
      setUnits((prev) => [...prev, created])
      onUpdate('unitId', created.id)
      return created
    } catch {
      return null
    }
  }, [onUpdate])

  useEffect(() => {
    const controller = new AbortController()

    getCategories(undefined, controller.signal)
      .then((cats) => {
        setCategories(cats)
        if (!form.categoryId && cats.length > 0) {
          onUpdate('categoryId', cats[0].id)
        }
      })
      .catch(() => {/* aborted or network error — silent, dropdown stays empty */})

    getUnits(undefined, controller.signal)
      .then((fetchedUnits) => {
        setUnits(fetchedUnits)
        if (!form.unitId && fetchedUnits.length > 0) {
          onUpdate('unitId', fetchedUnits[0].id)
        }
      })
      .catch(() => {/* aborted or network error — silent, dropdown stays empty */})

    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // fetch once on mount; onUpdate is stable (useCallback), form defaults applied once

  return (
    <div className="create-party-section">
      <Input
        label={t.productName}
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
        <span className="input-label" id="sku-mode-label">{t.sku}</span>
        <div className="pill-tabs" role="group" aria-labelledby="sku-mode-label" style={{ marginBottom: 'var(--space-2)' }}>
          <button
            type="button"
            className={`pill-tab${form.autoGenerateSku ? ' active' : ''}`}
            onClick={() => onUpdate('autoGenerateSku', true)}
            aria-pressed={form.autoGenerateSku}
            aria-label={t.autoGenerateSku}
          >
            {t.autoGenerate}
          </button>
          <button
            type="button"
            className={`pill-tab${!form.autoGenerateSku ? ' active' : ''}`}
            onClick={() => onUpdate('autoGenerateSku', false)}
            aria-pressed={!form.autoGenerateSku}
            aria-label={t.enterSkuManually}
          >
            {t.manualEntry}
          </button>
        </div>
        {!form.autoGenerateSku && (
          <input
            id="product-sku"
            className={`input${errors.sku ? ' input-error-border' : ''}`}
            value={form.sku ?? ''}
            onChange={(e) => onUpdate('sku', e.target.value)}
            placeholder="e.g. PRD-0001"
            aria-label={t.productSkuCode}
          />
        )}
        {errors.sku && <p className="input-error" role="alert">{errors.sku}</p>}
      </div>

      <div className="input-group">
        <label htmlFor="product-category" className="input-label">{t.category}</label>
        <select
          id="product-category"
          className="input"
          value={form.categoryId ?? ''}
          onChange={(e) => onUpdate('categoryId', e.target.value)}
          aria-label={t.selectProductCategory}
          disabled={categories.length === 0}
        >
          {categories.length === 0 && (
            <option value="">{t.loading}</option>
          )}
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div className="input-group">
        <label htmlFor="product-unit" className="input-label">{t.unit}</label>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <select
            id="product-unit"
            className="input"
            value={form.unitId}
            onChange={(e) => onUpdate('unitId', e.target.value)}
            aria-label={t.selectProductUnit}
            disabled={units.length === 0}
            style={{ flex: 1 }}
          >
            {units.length === 0 && (
              <option value="">{t.loading}</option>
            )}
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setAddUnitOpen(true)}
            aria-label={t.addCustomUnit}
            style={{ flexShrink: 0 }}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
        {errors.unitId && <p className="input-error" role="alert">{errors.unitId}</p>}
      </div>

      <div className="input-group">
        <span className="input-label">{t.salePriceLabel}</span>
        <div className="create-party-prefix-input">
          <span className="create-party-prefix" aria-hidden="true">{t.currencyPrefix}</span>
          <input
            id="product-sale-price"
            className={`input create-party-input-prefixed${errors.salePrice ? ' input-error-border' : ''}`}
            type="number"
            min="0"
            step="0.01"
            value={form.salePrice > 0 ? form.salePrice / 100 : ''}
            onChange={(e) => onUpdate('salePrice', Math.round((parseFloat(e.target.value) || 0) * 100))}
            placeholder="0.00"
            aria-label={t.salePriceRupees}
            inputMode="decimal"
          />
        </div>
        {errors.salePrice && <p className="input-error" role="alert">{errors.salePrice}</p>}
      </div>

      <div className="input-group">
        <span className="input-label">{t.purchasePriceLabel} <span style={{ color: 'var(--color-gray-400)', fontWeight: 400 }}>({t.notesOptionalLabel})</span></span>
        <div className="create-party-prefix-input">
          <span className="create-party-prefix" aria-hidden="true">{t.currencyPrefix}</span>
          <input
            id="product-purchase-price"
            className="input create-party-input-prefixed"
            type="number"
            min="0"
            step="0.01"
            value={form.purchasePrice && form.purchasePrice > 0 ? form.purchasePrice / 100 : ''}
            onChange={(e) => onUpdate('purchasePrice', Math.round((parseFloat(e.target.value) || 0) * 100))}
            placeholder="0.00"
            aria-label={t.purchasePriceRupees}
            inputMode="decimal"
          />
        </div>
      </div>

      <AddUnitSheet
        open={addUnitOpen}
        onClose={() => setAddUnitOpen(false)}
        onSave={handleCreateUnit}
      />
    </div>
  )
}
