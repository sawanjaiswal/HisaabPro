/** JobForm — shared by JobNewPage and JobEditPage */

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { PartySearchInput } from '@/features/invoices/components/PartySearchInput'
import { formatPaise, totalsFromItems } from '../jobs.utils'
import { JobItemRow, type JobFormItem } from './JobItemRow'
import type { CreateJobInput, CreateJobItemInput } from '../api/jobs.api.types'
import type { JobDetail } from '../jobs.types'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { DateField } from '@/components/ui/DateField'

interface JobFormProps {
  initialData?: JobDetail
  onSubmit: (data: CreateJobInput) => void
  isSubmitting: boolean
  submitLabel?: string
}

function makeItem(): JobFormItem {
  return {
    _key: crypto.randomUUID(),
    kind: 'ITEM',
    description: '',
    quantity: '1.000',
    ratePaise: 0,
    discountPaise: 0,
    productId: null,
  }
}

const hoursToInput = (h: number | null): string => (h === null || h === undefined ? '' : String(h))

function fromDetail(detail: JobDetail): { partyId: string; title: string; description: string; scheduledAt: string; estimatedHours: string; actualHours: string; items: JobFormItem[] } {
  return {
    partyId: detail.partyId,
    title: detail.title,
    description: detail.description ?? '',
    scheduledAt: detail.scheduledAt ? detail.scheduledAt.slice(0, 16) : '',
    estimatedHours: hoursToInput(detail.estimatedHours),
    actualHours: hoursToInput(detail.actualHours),
    items: detail.items.map((it) => ({ _key: it.id, ...it, discountPaise: it.discountPaise ?? 0 })),
  }
}

export function JobForm({ initialData, onSubmit, isSubmitting, submitLabel }: JobFormProps) {
  const { t } = useLanguage()
  const resolvedSubmitLabel = submitLabel ?? t.saveJob
  const init = initialData ? fromDetail(initialData) : { partyId: '', title: '', description: '', scheduledAt: '', estimatedHours: '', actualHours: '', items: [makeItem()] }

  const [partyId, setPartyId]         = useState(init.partyId)
  const [title, setTitle]             = useState(init.title)
  const [description, setDescription] = useState(init.description)
  const [scheduledAt, setScheduledAt] = useState(init.scheduledAt)
  const [estimatedHours, setEstimatedHours] = useState(init.estimatedHours)
  const [actualHours, setActualHours] = useState(init.actualHours)
  const [items, setItems]             = useState<JobFormItem[]>(init.items)
  const [errors, setErrors]           = useState<Record<string, string>>({})

  const handlePartyChange = useCallback((id: string) => {
    setPartyId(id)
    if (id) setErrors((prev) => { const n = { ...prev }; delete n.partyId; return n })
  }, [])

  const updateItem = useCallback((key: string, field: keyof CreateJobItemInput, value: string | number | null) => {
    setItems((prev) => prev.map((it) => it._key === key ? { ...it, [field]: value } : it))
  }, [])

  const addItem = useCallback(() => setItems((prev) => [...prev, makeItem()]), [])
  const removeItem = useCallback((key: string) => setItems((prev) => prev.filter((it) => it._key !== key)), [])

  const totals = totalsFromItems(items.map((it) => ({ ...it, discountPaise: it.discountPaise ?? 0 })))

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!partyId) errs.partyId = t.jobItemRequired
    if (!title.trim()) errs.title = t.jobTitleRequired
    if (items.length === 0) errs.items = t.jobAtLeastOneItem
    for (const it of items) {
      if (!it.description.trim()) { errs.items = t.jobItemDescRequired; break }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const parseHours = (s: string): number | null => {
    const v = parseFloat(s)
    return s.trim() === '' || isNaN(v) ? null : v
  }

  const estNum = parseHours(estimatedHours)
  const actNum = parseHours(actualHours)
  const variance = estNum !== null && actNum !== null ? actNum - estNum : null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      partyId,
      title: title.trim(),
      description: description.trim() || null,
      scheduledAt: scheduledAt || null,
      estimatedHours: estNum,
      actualHours: actNum,
      items: items.map(({ _key: _, ...rest }) => ({ ...rest })),
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {/* Party picker — reuses invoice party search */}
      <div>
        <PartySearchInput value={partyId} onChange={handlePartyChange} error={errors.partyId} />
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1">
        <label className="label" htmlFor="job-title">{t.jobTitleLabel} *</label>
        <Input
          id="job-title"
          type="text"
          className="input"
          value={title}
          onChange={(e) => { setTitle(e.target.value); if (e.target.value) setErrors((p) => { const n = { ...p }; delete n.title; return n }) }}
          placeholder={t.jobTitlePlaceholder}
          maxLength={200}
          aria-required="true"
          aria-invalid={Boolean(errors.title)}
        />
        {errors.title && <span className="field-error" role="alert">{errors.title}</span>}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className="label" htmlFor="job-desc">{t.jobDescLabel}</label>
        <Textarea
          id="job-desc"
          className="input resize-y min-h-[80px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t.jobDescPlaceholder}
          rows={3}
          maxLength={5000}
        />
      </div>

      {/* Scheduled date */}
      <div className="flex flex-col gap-1">
        <label className="label" htmlFor="job-scheduled">{t.jobScheduledLabel}</label>
        <DateField
          id="job-scheduled"
          type="datetime-local"
          className="input"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
      </div>

      {/* Estimated vs actual hours (tracking-only — never summed into money) */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="job-est-hours">{t.jobEstimatedHoursLabel}</label>
          <Input
            id="job-est-hours"
            type="number"
            className="input"
            value={estimatedHours}
            min="0"
            step="0.5"
            onChange={(e) => setEstimatedHours(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="job-act-hours">{t.jobActualHoursLabel}</label>
          <Input
            id="job-act-hours"
            type="number"
            className="input"
            value={actualHours}
            min="0"
            step="0.5"
            onChange={(e) => setActualHours(e.target.value)}
          />
        </div>
      </div>
      {variance !== null && variance !== 0 && (
        <span className={`self-start text-xs font-semibold px-2 py-0.5 rounded-full ${variance > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {t.jobHoursVariance}: {Math.abs(variance)}h {variance > 0 ? t.jobHoursOver : t.jobHoursUnder}
        </span>
      )}

      {/* Line items */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="label m-0">{t.jobItemsLabel} *</span>
          {errors.items && <span className="field-error" role="alert">{errors.items}</span>}
        </div>

        {items.map((item, idx) => (
          <JobItemRow
            key={item._key}
            item={item}
            index={idx}
            canRemove={items.length > 1}
            onUpdate={updateItem}
            onRemove={removeItem}
          />
        ))}

        <Button type="button" variant="ghost" size="sm" onClick={addItem} className="self-start min-h-[44px]">
          <Plus size={16} aria-hidden="true" /> {t.jobAddItem}
        </Button>
      </div>

      {/* Totals summary */}
      <div className="border-t-2 border-[var(--color-border)] pt-3 flex flex-col gap-1 items-end">
        <div className="flex gap-4 text-sm text-[var(--color-text-secondary)]">
          <span>{t.jobSubtotalLabel}</span>
          <span>₹{formatPaise(totals.subtotalPaise)}</span>
        </div>
        {totals.discountPaise > 0 && (
          <div className="flex gap-4 text-sm text-red-600">
            <span>{t.jobDiscountLabel}</span>
            <span>-₹{formatPaise(totals.discountPaise)}</span>
          </div>
        )}
        <div className="flex gap-4 text-base font-bold text-[var(--color-text)]">
          <span>{t.jobTotalLabel}</span>
          <span>₹{formatPaise(totals.totalPaise)}</span>
        </div>
      </div>

      <Button
        type="submit"
        variant="primary" size="lg"
        disabled={isSubmitting}
        className="min-h-[48px] w-full"
      >
        {isSubmitting ? t.savingJob : resolvedSubmitLabel}
      </Button>
    </form>
  )
}
