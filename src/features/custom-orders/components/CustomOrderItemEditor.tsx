/** CustomOrderItemEditor — editable item row used by CustomOrderForm */

import { Trash2 } from 'lucide-react'
import type { CreateCustomOrderItemInput } from '../api/custom-orders.api.types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/context/LanguageContext'

interface FormItem extends CreateCustomOrderItemInput {
  _key: string
}

interface CustomOrderItemEditorProps {
  item: FormItem
  index: number
  showRemove: boolean
  onUpdate: (key: string, field: keyof CreateCustomOrderItemInput, value: string | number | null) => void
  onRemove: (key: string) => void
}

export function CustomOrderItemEditor({ item, index, showRemove, onUpdate, onRemove }: CustomOrderItemEditorProps) {
  const { t } = useLanguage()
  return (
    <div className="border border-[var(--color-border)] rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-secondary)] font-medium">{t.coItemLabel} {index + 1}</span>
        {showRemove && (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => onRemove(item._key)}
            aria-label={t.coRemoveItemAria}
            className="text-red-600 min-w-[44px] min-h-[44px]"
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        )}
      </div>
      <Input
        type="text"
        className="input"
        value={item.description}
        onChange={(e) => onUpdate(item._key, 'description', e.target.value)}
        placeholder={t.coItemDescPlaceholder}
        maxLength={500}
        aria-label={`${t.coItemLabel} ${index + 1} ${t.coItemDescAria}`}
      />
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--text-secondary)]">{t.qty}</label>
          <Input
            type="number"
            className="input"
            value={item.quantity}
            min="0"
            step="0.001"
            onChange={(e) => onUpdate(item._key, 'quantity', e.target.value)}
            aria-label={`${t.coItemLabel} ${index + 1} ${t.coItemQtyAria}`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--text-secondary)]">{t.coRate}</label>
          <Input
            type="number"
            className="input"
            value={item.ratePaise / 100}
            min="0"
            step="0.01"
            onChange={(e) => onUpdate(item._key, 'ratePaise', Math.round(parseFloat(e.target.value || '0') * 100))}
            aria-label={`${t.coItemLabel} ${index + 1} ${t.coItemRateAria}`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--text-secondary)]">{t.coDiscountRs}</label>
          <Input
            type="number"
            className="input"
            value={(item.discountPaise ?? 0) / 100}
            min="0"
            step="0.01"
            onChange={(e) => onUpdate(item._key, 'discountPaise', Math.round(parseFloat(e.target.value || '0') * 100))}
            aria-label={`${t.coItemLabel} ${index + 1} ${t.coItemDiscountAria}`}
          />
        </div>
      </div>
    </div>
  )
}
