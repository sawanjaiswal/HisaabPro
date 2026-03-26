/** Add/Edit Unit — Bottom sheet (Drawer) */

import { useState, useCallback, useEffect } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import type { Unit } from '../unit.types'
import type { UnitInput } from '../../products/unit.service'
import { validateUnitName, validateUnitSymbol } from '../unit.utils'
import { UNIT_NAME_MAX, UNIT_SYMBOL_MAX } from '../unit.constants'
import { useLanguage } from '@/hooks/useLanguage'

interface AddUnitSheetProps {
  open: boolean
  onClose: () => void
  onSave: (data: UnitInput) => Promise<Unit | null>
  onUpdate?: (id: string, data: Partial<UnitInput>) => Promise<boolean>
  /** If set, we're editing this unit */
  editUnit?: Unit | null
}

export function AddUnitSheet({ open, onClose, onSave, onUpdate, editUnit }: AddUnitSheetProps) {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [errors, setErrors] = useState<{ name?: string; symbol?: string }>({})
  const [isSaving, setIsSaving] = useState(false)

  const isEdit = Boolean(editUnit)

  useEffect(() => {
    if (open && editUnit) {
      setName(editUnit.name)
      setSymbol(editUnit.symbol)
    } else if (open) {
      setName('')
      setSymbol('')
    }
    setErrors({})
  }, [open, editUnit])

  const validate = useCallback((): boolean => {
    const nameErr = validateUnitName(name)
    const symbolErr = validateUnitSymbol(symbol)
    setErrors({ name: nameErr ?? undefined, symbol: symbolErr ?? undefined })
    return !nameErr && !symbolErr
  }, [name, symbol])

  const handleSubmit = useCallback(async () => {
    if (!validate() || isSaving) return
    setIsSaving(true)

    const data: UnitInput = { name: name.trim(), symbol: symbol.trim() }

    if (isEdit && editUnit && onUpdate) {
      const ok = await onUpdate(editUnit.id, data)
      if (ok) onClose()
    } else {
      const created = await onSave(data)
      if (created) onClose()
    }

    setIsSaving(false)
  }, [validate, isSaving, name, symbol, isEdit, editUnit, onUpdate, onSave, onClose])

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? t.editUnit : t.addCustomUnit}
      size="sm"
      footer={
        <button
          type="button"
          className="btn btn-primary btn-md"
          style={{ width: '100%' }}
          onClick={handleSubmit}
          disabled={isSaving}
          aria-label={isEdit ? t.saveChanges : t.createUnit}
        >
          {isSaving ? t.loading : isEdit ? t.saveChanges : t.createUnit}
        </button>
      }
    >
      <div className="unit-sheet-form">
        <div className="line-item-field">
          <label className="label" htmlFor="unit-name">{t.unitNameLabel}</label>
          <input
            id="unit-name"
            type="text"
            className={`input${errors.name ? ' input--error' : ''}`}
            placeholder={t.unitNamePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const err = validateUnitName(name)
              setErrors((prev) => ({ ...prev, name: err ?? undefined }))
            }}
            maxLength={UNIT_NAME_MAX}
            autoFocus
            style={{ minHeight: '44px' }}
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </div>

        <div className="line-item-field">
          <label className="label" htmlFor="unit-symbol">{t.symbolLabel}</label>
          <input
            id="unit-symbol"
            type="text"
            className={`input${errors.symbol ? ' input--error' : ''}`}
            placeholder={t.symbolPlaceholder}
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            onBlur={() => {
              const err = validateUnitSymbol(symbol)
              setErrors((prev) => ({ ...prev, symbol: err ?? undefined }))
            }}
            maxLength={UNIT_SYMBOL_MAX}
            style={{ minHeight: '44px' }}
          />
          {errors.symbol && <span className="field-error">{errors.symbol}</span>}
        </div>
      </div>
    </Drawer>
  )
}
