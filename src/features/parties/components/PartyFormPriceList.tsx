/** Create/Edit Party — Price List picker field */

import { useEffect } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { usePriceLists } from '@/features/price-lists/price-list-queries'
import type { PartyFormData } from '../party.types'

interface PartyFormPriceListProps {
  /** Current priceListId from form state (undefined = not yet set, null = explicitly none) */
  value: string | null | undefined
  /** Whether the form is in edit mode — skips auto-default behaviour */
  isEditMode?: boolean
  onUpdate: <K extends keyof PartyFormData>(key: K, value: PartyFormData[K]) => void
}

export function PartyFormPriceList({ value, isEditMode = false, onUpdate }: PartyFormPriceListProps) {
  const { t } = useLanguage()
  const { items, status } = usePriceLists(1)

  // On create mode: auto-select the business default list when lists first load
  useEffect(() => {
    if (isEditMode) return
    if (value !== undefined) return
    const defaultList = items.find(l => l.isDefault)
    if (defaultList) {
      onUpdate('priceListId', defaultList.id)
    }
  }, [items, isEditMode, value, onUpdate])

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate('priceListId', e.target.value || null)
  }

  return (
    <div className="input-group">
      <label htmlFor="party-price-list" className="input-label">
        {t.priceListLabel}
      </label>
      <select
        id="party-price-list"
        className="input"
        value={value ?? ''}
        onChange={handleChange}
        aria-label={t.priceListLabel}
        disabled={status === 'loading'}
      >
        <option value="">{t.priceListNone}</option>
        {items.map((list) => (
          <option key={list.id} value={list.id}>
            {list.name}{list.isDefault ? ` (${t.priceListDefaultBadge})` : ''}
          </option>
        ))}
      </select>
      <p className="gstin-hint">{t.priceListHint}</p>
    </div>
  )
}
