/**
 * PtpRecorderForm — bottom-sheet form to create or edit a Promise-to-Pay.
 * Reused for both create (no existingPtp) and edit (existingPtp present).
 */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { FormField } from '@/components/ui/FormField'
import { useLanguage } from '@/hooks/useLanguage'
import { toLocalISODate } from '@/lib/format'
import { useCreatePtp, useUpdatePtp } from './usePtp'
import type { Ptp } from './collections.types'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { DatePicker } from '@/components/ui/DatePicker'

interface Props {
  open: boolean
  onClose: () => void
  partyId: string
  partyName: string
  existingPtp?: Ptp
}

export function PtpRecorderForm({ open, onClose, partyId, partyName, existingPtp }: Props) {
  const { t } = useLanguage()
  const isEdit = Boolean(existingPtp)

  const todayStr = toLocalISODate(new Date())

  const [amountRs, setAmountRs] = useState<string>(
    existingPtp ? String(existingPtp.amountPaise / 100) : ''
  )
  const [promiseDate, setPromiseDate] = useState<string>(
    existingPtp ? existingPtp.promiseDate.slice(0, 10) : ''
  )
  const [notes, setNotes] = useState<string>(existingPtp?.notes ?? '')
  const [fieldErrors, setFieldErrors] = useState<{ amount?: string; date?: string; notes?: string }>({})

  const createMutation = useCreatePtp(partyId)
  const updateMutation = useUpdatePtp(partyId)
  const isPending = createMutation.isPending || updateMutation.isPending

  function validate(): { amount?: string; date?: string; notes?: string } | null {
    const rupees = parseFloat(amountRs)
    const errors: { amount?: string; date?: string; notes?: string } = {}
    if (!amountRs || isNaN(rupees) || rupees <= 0) errors.amount = t.ptpAmountRequired
    if (!promiseDate) errors.date = t.ptpDateRequired
    else if (promiseDate < todayStr) errors.date = t.ptpDateMustBeFuture
    if (notes.length > 500) errors.notes = t.ptpNoteTooLong

    return Object.keys(errors).length > 0 ? errors : null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (errs) {
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})

    const amountPaise = Math.round(parseFloat(amountRs) * 100)

    if (isEdit && existingPtp) {
      await updateMutation.mutateAsync({
        id: existingPtp.id,
        partyName,
        amountPaise,
        promiseDate,
        notes: notes.trim() || undefined,
      })
    } else {
      await createMutation.mutateAsync({
        partyId,
        partyName,
        amountPaise,
        promiseDate,
        notes: notes.trim() || undefined,
      })
    }

    onClose()
  }

  const footer = (
    <Button
      type="submit"
      form="ptp-form"
      variant="primary"
      size="md"
      disabled={isPending}
      aria-busy={isPending}
    >
      {isPending ? t.ptpSaving : isEdit ? t.ptpSaveChanges : t.ptpRecordPromise}
    </Button>
  )

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? t.ptpEditTitle : t.ptpRecordTitle}
      size="sm"
      footer={footer}
    >
      <form id="ptp-form" onSubmit={handleSubmit} noValidate className="space-y-4 pt-1">
        {/* Amount */}
        <div className="card p-3.5 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-surface)] shadow-xs">
          <FormField
            label={t.ptpAmountLabel}
            required
            error={fieldErrors.amount}
          >
            <div className="input-prefix-wrap">
              <span className="input-prefix" aria-hidden="true">
                {t.currencyPrefix ?? '₹'}
              </span>
              <Input
                id="ptp-amount"
                type="number"
                inputMode="decimal"
                min="1"
                step="0.01"
                className={`input input-prefixed text-base font-semibold${fieldErrors.amount ? ' input-error-border' : ''}`}
                placeholder="0.00"
                value={amountRs}
                onChange={e => {
                  setAmountRs(e.target.value)
                  if (fieldErrors.amount) setFieldErrors(prev => ({ ...prev, amount: undefined }))
                }}
                required
                aria-required="true"
                disabled={isPending}
                autoFocus
              />
            </div>
          </FormField>
        </div>

        {/* Promised Date */}
        <div className="card p-3.5 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-surface)] shadow-xs">
          <FormField
            label={t.ptpDateLabel}
            required
            error={fieldErrors.date}
          >
            <DatePicker
              id="ptp-date"
              value={promiseDate}
              minDate={todayStr}
              onChange={(val: string) => {
                setPromiseDate(val)
                if (fieldErrors.date) setFieldErrors(prev => ({ ...prev, date: undefined }))
              }}
              error={fieldErrors.date}
              disabled={isPending}
              placeholder="DD / MM / YYYY"
              className="w-full"
            />
          </FormField>
        </div>

        {/* Note */}
        <div className="card p-3.5 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-surface)] shadow-xs">
          <FormField
            label={t.ptpNoteLabel}
            error={fieldErrors.notes}
            hint={`${notes.length}/500`}
          >
            <Textarea
              id="ptp-note"
              rows={3}
              maxLength={500}
              placeholder={t.ptpNotePlaceholder}
              value={notes}
              onChange={e => {
                setNotes(e.target.value)
                if (fieldErrors.notes) setFieldErrors(prev => ({ ...prev, notes: undefined }))
              }}
              disabled={isPending}
              className="resize-y min-h-[80px]"
            />
          </FormField>
        </div>
      </form>
    </Drawer>
  )
}
