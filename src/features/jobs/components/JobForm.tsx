/** JobForm — shared by JobNewPage and JobEditPage */

import { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { PartySearchInput } from '@/features/invoices/components/PartySearchInput'
import { formatPaise, totalsFromItems } from '../jobs.utils'
import { JobItemRow, type JobFormItem } from './JobItemRow'
import type { CreateJobInput, CreateJobItemInput } from '../api/jobs.api.types'
import type { JobDetail } from '../jobs.types'

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
    <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Party picker — reuses invoice party search */}
      <div>
        <PartySearchInput value={partyId} onChange={handlePartyChange} error={errors.partyId} />
      </div>

      {/* Title */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label className="label" htmlFor="job-title">{t.jobTitleLabel} *</label>
        <input
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label className="label" htmlFor="job-desc">{t.jobDescLabel}</label>
        <textarea
          id="job-desc"
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t.jobDescPlaceholder}
          rows={3}
          maxLength={5000}
          style={{ resize: 'vertical', minHeight: 80 }}
        />
      </div>

      {/* Scheduled date */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label className="label" htmlFor="job-scheduled">{t.jobScheduledLabel}</label>
        <input
          id="job-scheduled"
          type="datetime-local"
          className="input"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
      </div>

      {/* Estimated vs actual hours (tracking-only — never summed into money) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label className="label" htmlFor="job-est-hours">{t.jobEstimatedHoursLabel}</label>
          <input
            id="job-est-hours"
            type="number"
            className="input"
            value={estimatedHours}
            min="0"
            step="0.5"
            onChange={(e) => setEstimatedHours(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label className="label" htmlFor="job-act-hours">{t.jobActualHoursLabel}</label>
          <input
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
        <span style={{ alignSelf: 'flex-start', fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full, 999px)', background: variance > 0 ? 'var(--color-error-50, #fef2f2)' : 'var(--color-success-50, #f0fdf4)', color: variance > 0 ? 'var(--color-error-600)' : 'var(--color-success-600, #16a34a)' }}>
          {t.jobHoursVariance}: {Math.abs(variance)}h {variance > 0 ? t.jobHoursOver : t.jobHoursUnder}
        </span>
      )}

      {/* Line items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="label" style={{ margin: 0 }}>{t.jobItemsLabel} *</span>
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

        <button type="button" className="btn btn-ghost btn-sm" onClick={addItem} style={{ alignSelf: 'flex-start', minHeight: 44 }}>
          <Plus size={16} aria-hidden="true" /> {t.jobAddItem}
        </button>
      </div>

      {/* Totals summary */}
      <div style={{ borderTop: '2px solid var(--color-border)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
          <span>{t.jobSubtotalLabel}</span>
          <span>₹{formatPaise(totals.subtotalPaise)}</span>
        </div>
        {totals.discountPaise > 0 && (
          <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--fs-sm)', color: 'var(--color-error-600)' }}>
            <span>{t.jobDiscountLabel}</span>
            <span>-₹{formatPaise(totals.discountPaise)}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text)' }}>
          <span>{t.jobTotalLabel}</span>
          <span>₹{formatPaise(totals.totalPaise)}</span>
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-lg"
        disabled={isSubmitting}
        style={{ minHeight: 48, width: '100%' }}
      >
        {isSubmitting ? t.savingJob : resolvedSubmitLabel}
      </button>
    </form>
  )
}
