/** BomFormHeader — header section of the BOM form */

import { useState, useEffect } from 'react'
import { getProducts } from '@/lib/services/product.service'
import { useDebounce } from '@/hooks/useDebounce'
import { useLanguage } from '@/context/LanguageContext'
import type { BomFormData } from '../bom.types'
import type { BomValidationErrors } from '../bom.utils'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'

interface BomFormHeaderProps {
  form: BomFormData
  errors: BomValidationErrors
  editMode: boolean
  onUpdate: <K extends keyof BomFormData>(key: K, value: BomFormData[K]) => void
}

interface ProductOption {
  id: string
  name: string
}

export function BomFormHeader({ form, errors, editMode, onUpdate }: BomFormHeaderProps) {
  const { t } = useLanguage()
  const [productQuery, setProductQuery] = useState(form.productName)
  const [productResults, setProductResults] = useState<ProductOption[]>([])
  const [productOpen, setProductOpen] = useState(false)
  const debouncedQ = useDebounce(productQuery, 300)

  useEffect(() => {
    if (!productOpen || debouncedQ.trim().length < 1) { setProductResults([]); return }
    getProducts({ search: debouncedQ, limit: 8 })
      .then((r) => setProductResults(r.products.map((p) => ({ id: p.id, name: p.name }))))
      .catch(() => setProductResults([]))
  }, [debouncedQ, productOpen])

  const selectProduct = (p: ProductOption) => {
    onUpdate('productId', p.id)
    onUpdate('productName', p.name)
    setProductQuery(p.name)
    setProductOpen(false)
  }

  return (
    <div className="bom-form-header">
      {/* Recipe name */}
      <div className="input-group">
        <label htmlFor="bom-name" className="input-label">{t.bomRecipeName}</label>
        <Input
          id="bom-name"
          className={`input${errors.name ? ' input-error-border' : ''}`}
          value={form.name}
          onChange={(e) => onUpdate('name', e.target.value)}
          placeholder={t.bomRecipeNameHint}
          maxLength={100}
          autoComplete="off"
          required
          aria-required="true"
        />
        {errors.name && <p className="input-error" role="alert">{errors.name}</p>}
      </div>

      {/* Finished product picker */}
      <div className="input-group">
        <label htmlFor="bom-product" className="input-label">
          {t.bomFinishedProduct}
          {editMode && <span className="text-optional"> {t.bomLockedAfterRun}</span>}
        </label>
        <div className="bom-form-header__product-wrap">
          <Input
            id="bom-product"
            className={`input${errors.productId ? ' input-error-border' : ''}`}
            value={productQuery}
            onChange={(e) => { setProductQuery(e.target.value); setProductOpen(true) }}
            onFocus={() => setProductOpen(true)}
            onBlur={() => setTimeout(() => setProductOpen(false), 150)}
            placeholder={t.bomSearchFinishedProduct}
            autoComplete="off"
            aria-label={t.bomFinishedProduct}
            aria-haspopup="listbox"
            aria-expanded={productOpen}
          />
          {productOpen && productResults.length > 0 && (
            <ul className="bom-row__suggestions" role="listbox" aria-label={t.bomProductResults}>
              {productResults.map((p) => (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={form.productId === p.id}
                  className="bom-row__suggestion-item"
                  onMouseDown={() => selectProduct(p)}
                >
                  {p.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        {errors.productId && <p className="input-error" role="alert">{errors.productId}</p>}
      </div>

      {/* isDefault */}
      <div className="input-group">
        <label className="bom-form-header__toggle">
          <Input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => onUpdate('isDefault', e.target.checked)}
            aria-label={t.bomSetDefaultAria}
          />
          <span>{t.bomSetDefault}</span>
        </label>
      </div>

      {/* isActive (edit only) */}
      {editMode && (
        <div className="input-group">
          <label className="bom-form-header__toggle">
            <Input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => onUpdate('isActive', e.target.checked)}
              aria-label={t.bomRecipeActive}
            />
            <span>{t.bomRecipeActive}</span>
          </label>
        </div>
      )}

      {/* Notes */}
      <div className="input-group">
        <label htmlFor="bom-notes" className="input-label">
          {t.notes} <span className="text-optional">({t.optional})</span>
        </label>
        <Textarea
          id="bom-notes"
          className="input"
          value={form.notes}
          onChange={(e) => onUpdate('notes', e.target.value)}
          placeholder={t.bomNotesHint}
          rows={2}
          aria-label={t.bomRecipeNotesAria}
        />
      </div>
    </div>
  )
}
