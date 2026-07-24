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
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{t.coItemLabel} {index + 1}</span>
        {showRemove && (
          <Button variant="none"
            type="button"
            onClick={() => onRemove(item._key)}
            aria-label={t.coRemoveItemAria}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error-600)', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>{t.qty}</label>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>{t.coRate}</label>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>{t.coDiscountRs}</label>
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
