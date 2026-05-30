/** Create Product — Basic info section */

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select, SelectItem } from '@/components/ui/Select'
import { useLanguage } from '@/hooks/useLanguage'
import type { ProductFormData, Category, Unit } from '../product.types'
import { getCategories, getUnits, createUnit } from '../product.service'
import type { UnitInput } from '../unit.service'
import { AddUnitSheet } from '@/features/units/components/AddUnitSheet'
import { Button } from '@/components/ui/Button'

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
    <div className="create-party-section py-0">
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
        <div className="pill-tabs pill-tabs--with-input" role="group" aria-labelledby="sku-mode-label">
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
          <Input
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
        <Select
          value={form.categoryId || undefined}
          onValueChange={(v) => onUpdate('categoryId', v)}
          ariaLabel={t.selectProductCategory}
          placeholder={categories.length === 0 ? t.loading : undefined}
          disabled={categories.length === 0}
        >
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
          ))}
        </Select>
      </div>

      <div className="input-group">
        <label htmlFor="product-unit" className="input-label">{t.unit}</label>
        <div className="input-with-action">
          <Select
            value={form.unitId || undefined}
            onValueChange={(v) => onUpdate('unitId', v)}
            ariaLabel={t.selectProductUnit}
            placeholder={units.length === 0 ? t.loading : undefined}
            disabled={units.length === 0}
          >
            {units.map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</SelectItem>
            ))}
          </Select>
          <Button
            type="button"
            variant="ghost" size="sm" className="input-with-action__btn"
            onClick={() => setAddUnitOpen(true)}
            aria-label={t.addCustomUnit}
          >
            <Plus size={16} aria-hidden="true" />
          </Button>
        </div>
        {errors.unitId && <p className="input-error" role="alert">{errors.unitId}</p>}
      </div>

      <div className="input-group">
        <span className="input-label">{t.salePriceLabel}</span>
        <div className="input-prefix-wrap">
          <span className="input-prefix" aria-hidden="true">{t.currencyPrefix}</span>
          <Input
            id="product-sale-price"
            className={`input input-prefixed${errors.salePrice ? ' input-error-border' : ''}`}
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
        <span className="input-label">{t.purchasePriceLabel} <span className="text-optional">({t.notesOptionalLabel})</span></span>
        <div className="input-prefix-wrap">
          <span className="input-prefix" aria-hidden="true">{t.currencyPrefix}</span>
          <Input
            id="product-purchase-price"
            className="input input-prefixed"
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
