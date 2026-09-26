/** Create Product — Basic info section */

import { Text } from '@/components/ui/Text'
import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/Input'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { formatName } from '@/lib/format'
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
        // Fix 3: No auto-select — placeholder stays until user explicitly picks
      })
      .catch(() => {/* aborted or network error — silent, dropdown stays empty */})

    getUnits(undefined, controller.signal)
      .then((fetchedUnits) => {
        setUnits(fetchedUnits)
        // Fix 4: Auto-select ONLY when exactly 1 unit exists (single-unit shops)
        if (!form.unitId && fetchedUnits.length === 1) {
          onUpdate('unitId', fetchedUnits[0].id)
        }
      })
      .catch(() => {/* aborted or network error — silent, dropdown stays empty */})

    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // fetch once on mount; onUpdate is stable (useCallback), form defaults applied once

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }))
  const unitOptions = units.map((u) => ({ value: u.id, label: `${u.name} (${u.symbol})` }))

  return (
    <div className="create-party-section py-0">
      <Input
        label={t.productName}
        id="product-name"
        value={form.name}
        onChange={(e) => onUpdate('name', e.target.value)}
        onBlur={() => {
          if (form.name?.trim()) {
            const formatted = formatName(form.name)
            if (formatted && formatted !== '—') {
              onUpdate('name', formatted)
            }
          }
        }}
        error={errors.name}
        placeholder="e.g. Maggi Noodles 70g"
        required
        autoComplete="off"
        aria-required="true"
      />

      <div className="input-group">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="input-label mb-0" id="sku-mode-label">{t.sku}</span>
          <div className="pill-tabs mb-0 py-0" role="group" aria-labelledby="sku-mode-label">
            <Button variant="none"
              type="button"
              className={`pill-tab${form.autoGenerateSku ? ' active' : ''}`}
              onClick={() => onUpdate('autoGenerateSku', true)}
              aria-pressed={form.autoGenerateSku}
              aria-label={t.autoGenerateSku}
            >
              {t.autoGenerate}
            </Button>
            <Button variant="none"
              type="button"
              className={`pill-tab${!form.autoGenerateSku ? ' active' : ''}`}
              onClick={() => onUpdate('autoGenerateSku', false)}
              aria-pressed={!form.autoGenerateSku}
              aria-label={t.enterSkuManually}
            >
              {t.manualEntry}
            </Button>
          </div>
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
        {errors.sku && <Text className="input-error" role="alert">{errors.sku}</Text>}
      </div>

      {/* Fix 1 & 6 — Category: searchable options= API + skeleton loading state */}
      <div className="input-group">
        <label htmlFor="product-category" className="input-label">{t.category}</label>
        {categories.length === 0 ? (
          <div
            className="h-11 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-gray-200)]"
            role="status"
            aria-label={t.loading}
          />
        ) : (
          <Select
            id="product-category"
            value={form.categoryId || undefined}
            onValueChange={(v) => onUpdate('categoryId', v)}
            options={categoryOptions}
            searchable
            placeholder={t.selectProductCategory}
            ariaLabel={t.selectProductCategory}
          />
        )}
      </div>

      {/* Fix 2 & 6 — Unit: searchable + onCreateOption inline CTA + skeleton */}
      <div className="input-group">
        <label htmlFor="product-unit" className="input-label">{t.unit}</label>
        {units.length === 0 && !form.unitId ? (
          <div
            className="h-11 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-gray-200)]"
            role="status"
            aria-label={t.loading}
          />
        ) : (
          <Select
            id="product-unit"
            value={form.unitId || undefined}
            onValueChange={(v) => onUpdate('unitId', v)}
            options={unitOptions}
            searchable
            onCreateOption={() => setAddUnitOpen(true)}
            createOptionLabel={t.addCustomUnit}
            placeholder={t.selectProductUnit}
            ariaLabel={t.selectProductUnit}
          />
        )}
        {errors.unitId && <Text className="input-error" role="alert">{errors.unitId}</Text>}
      </div>

      {/* Sale Price */}
      <div className="input-group">
        <CurrencyInput
          id="product-sale-price"
          label={t.salePriceLabel}
          value={form.salePrice}
          onChange={(val) => onUpdate('salePrice', val)}
          error={errors.salePrice}
          placeholder="0.00"
        />
      </div>

      {/* Purchase Price */}
      <div className="input-group">
        <CurrencyInput
          id="product-purchase-price"
          label={`${t.purchasePriceLabel} (${t.notesOptionalLabel})`}
          value={form.purchasePrice ?? 0}
          onChange={(val) => onUpdate('purchasePrice', val)}
          placeholder="0.00"
        />
      </div>

      <AddUnitSheet
        open={addUnitOpen}
        onClose={() => setAddUnitOpen(false)}
        onSave={handleCreateUnit}
      />
    </div>
  )
}
