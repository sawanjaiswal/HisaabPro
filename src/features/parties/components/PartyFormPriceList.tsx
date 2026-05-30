/** Create/Edit Party — Price List picker field */

import { useEffect } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { usePriceLists } from '@/features/price-lists/price-list-queries'
import { Select, SelectItem } from '@/components/ui/Select'
import type { PartyFormData } from '../party.types'

const NONE = '__none__' as const

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

  const handleChange = (v: string) => {
    onUpdate('priceListId', v === NONE ? null : v)
  }

  return (
    <div className="input-group">
      <label htmlFor="party-price-list" className="input-label">
        {t.priceListLabel}
      </label>
      <Select
        value={value ?? NONE}
        onValueChange={handleChange}
        ariaLabel={t.priceListLabel}
        disabled={status === 'loading'}
      >
        <SelectItem value={NONE}>{t.priceListNone}</SelectItem>
        {items.map((list) => (
          <SelectItem key={list.id} value={list.id}>
            {list.name}{list.isDefault ? ` (${t.priceListDefaultBadge})` : ''}
          </SelectItem>
        ))}
      </Select>
      <p className="gstin-hint">{t.priceListHint}</p>
    </div>
  )
}
