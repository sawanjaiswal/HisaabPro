/** JobItemRow — single line editor for JobForm, with an Item/Hourly toggle. */

import { Trash2 } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { CreateJobItemInput } from '../api/jobs.api.types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

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

export function JobItemRow({ item, index, canRemove, onUpdate, onRemove }: JobItemRowProps) {
  const { t } = useLanguage()
  const isHourly = item.kind === 'HOURLY'
  const n = index + 1

  return (
    <div className="border border-[var(--color-border)] rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-secondary)] font-medium">{t.jobItemLabel} {n}</span>
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => onRemove(item._key)}
            aria-label="Remove item"
            className="text-red-600 min-w-[44px] min-h-[44px]"
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* Item / Hourly toggle */}
      <div role="group" aria-label={`${t.jobItemLabel} ${n} type`} className="inline-flex self-start border border-[var(--color-border)] rounded-lg overflow-hidden">
        {(['ITEM', 'HOURLY'] as const).map((k) => {
          const active = (item.kind ?? 'ITEM') === k
          return (
            <Button
              variant="none"
              key={k}
              type="button"
              aria-pressed={active}
              onClick={() => onUpdate(item._key, 'kind', k)}
              className={`min-h-[44px] px-3 text-xs font-semibold ${
                active ? 'bg-[var(--color-primary-600)] text-white' : 'bg-transparent text-[var(--color-text-secondary)]'
              }`}
            >
              {k === 'ITEM' ? t.jobItemTypeItem : t.jobItemTypeHourly}
            </Button>
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

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--color-text-secondary)]">{isHourly ? t.jobItemHoursLabel : t.jobItemQtyLabel}</label>
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
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--color-text-secondary)]">{isHourly ? t.jobItemRatePerHrLabel : t.jobItemRateLabel}</label>
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
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--color-text-secondary)]">{t.jobItemDiscountLabel}</label>
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
