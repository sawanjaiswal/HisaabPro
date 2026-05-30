/** JobItemRow — single line editor for JobForm, with an Item/Hourly toggle. */

import { Trash2 } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { CreateJobItemInput } from '../api/jobs.api.types'
import { Input } from '@/components/ui/Input'

export interface JobFormItem extends CreateJobItemInput {
  _key: string
}

interface JobItemRowProps {
  item: JobFormItem
  index: number
  canRemove: boolean
  onUpdate: (key: string, field: keyof CreateJobItemInput, value: string | number | null) => void
  onRemove: (key: string) => void
}

const labelStyle = { fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' } as const

export function JobItemRow({ item, index, canRemove, onUpdate, onRemove }: JobItemRowProps) {
  const { t } = useLanguage()
  const isHourly = item.kind === 'HOURLY'
  const n = index + 1

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{t.jobItemLabel} {n}</span>
        {canRemove && (
          <button type="button" onClick={() => onRemove(item._key)} aria-label="Remove item" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error-600)', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Item / Hourly toggle */}
      <div role="group" aria-label={`${t.jobItemLabel} ${n} type`} style={{ display: 'inline-flex', alignSelf: 'flex-start', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        {(['ITEM', 'HOURLY'] as const).map((k) => {
          const active = (item.kind ?? 'ITEM') === k
          return (
            <button
              key={k}
              type="button"
              aria-pressed={active}
              onClick={() => onUpdate(item._key, 'kind', k)}
              style={{
                minHeight: 44, padding: '0 var(--space-3)', border: 'none', cursor: 'pointer',
                fontSize: 'var(--fs-xs)', fontWeight: 600,
                background: active ? 'var(--color-primary-600)' : 'transparent',
                color: active ? 'var(--color-on-primary, #fff)' : 'var(--color-text-secondary)',
              }}
            >
              {k === 'ITEM' ? t.jobItemTypeItem : t.jobItemTypeHourly}
            </button>
          )
        })}
      </div>

      <Input
        type="text"
        className="input"
        value={item.description}
        onChange={(e) => onUpdate(item._key, 'description', e.target.value)}
        placeholder={t.jobItemDescPlaceholder}
        maxLength={500}
        aria-label={`${t.jobItemLabel} ${n} description`}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={labelStyle}>{isHourly ? t.jobItemHoursLabel : t.jobItemQtyLabel}</label>
          <Input
            type="number"
            className="input"
            value={item.quantity}
            min="0"
            step="0.001"
            onChange={(e) => onUpdate(item._key, 'quantity', e.target.value)}
            aria-label={`${t.jobItemLabel} ${n} ${isHourly ? t.jobItemHoursLabel : t.jobItemQtyLabel}`}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={labelStyle}>{isHourly ? t.jobItemRatePerHrLabel : t.jobItemRateLabel}</label>
          <Input
            type="number"
            className="input"
            value={item.ratePaise / 100}
            min="0"
            step="0.01"
            onChange={(e) => onUpdate(item._key, 'ratePaise', Math.round(parseFloat(e.target.value || '0') * 100))}
            aria-label={`${t.jobItemLabel} ${n} ${isHourly ? t.jobItemRatePerHrLabel : t.jobItemRateLabel}`}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={labelStyle}>{t.jobItemDiscountLabel}</label>
          <Input
            type="number"
            className="input"
            value={(item.discountPaise ?? 0) / 100}
            min="0"
            step="0.01"
            onChange={(e) => onUpdate(item._key, 'discountPaise', Math.round(parseFloat(e.target.value || '0') * 100))}
            aria-label={`${t.jobItemLabel} ${n} discount`}
          />
        </div>
      </div>
    </div>
  )
}
