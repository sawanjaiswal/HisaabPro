/**
 * PtpRecorderForm — bottom-sheet form to create or edit a Promise-to-Pay.
 * Reused for both create (no existingPtp) and edit (existingPtp present).
 */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { useLanguage } from '@/hooks/useLanguage'
import { toLocalISODate } from '@/lib/format'
import { useCreatePtp, useUpdatePtp } from './usePtp'
import type { Ptp } from './collections.types'
import { Textarea } from '@/components/ui/Textarea'

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
  const [validationErr, setValidationErr] = useState<string | null>(null)

  const createMutation = useCreatePtp(partyId)
  const updateMutation = useUpdatePtp(partyId)
  const isPending = createMutation.isPending || updateMutation.isPending

  function validate(): string | null {
    const rupees = parseFloat(amountRs)
    if (!amountRs || isNaN(rupees) || rupees <= 0) return t.ptpAmountRequired
    if (!promiseDate) return t.ptpDateRequired
    // F-10: align with server — today is allowed ("today or later", strictly >= today)
    if (promiseDate < todayStr) return t.ptpDateMustBeFuture
    if (notes.length > 500) return t.ptpNoteTooLong
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { setValidationErr(err); return }
    setValidationErr(null)

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
      variant="primary" size="md"
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
      <form id="ptp-form" onSubmit={handleSubmit} noValidate>
        {validationErr && (
          <p className="form-error" role="alert" style={{ marginBottom: 'var(--space-3)' }}>
            {validationErr}
          </p>
        )}

        {/* Amount */}
        <div className="form-group">
          <label className="form-label" htmlFor="ptp-amount">
            {t.ptpAmountLabel} *
          </label>
          <div style={{ position: 'relative' }}>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 'var(--space-3)',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-secondary)',
                fontWeight: 600,
                pointerEvents: 'none',
              }}
            >
              {t.currencyPrefix}
            </span>
            <input
              id="ptp-amount"
              type="number"
              inputMode="decimal"
              min="1"
              step="0.01"
              className="form-input"
              style={{ paddingLeft: 'var(--space-8)' }}
              placeholder="0"
              value={amountRs}
              onChange={e => setAmountRs(e.target.value)}
              required
              aria-required="true"
              disabled={isPending}
            />
          </div>
        </div>

        {/* Promised Date */}
        <div className="form-group">
          <label className="form-label" htmlFor="ptp-date">
            {t.ptpDateLabel} *
          </label>
          <input
            id="ptp-date"
            type="date"
            className="form-input"
            min={todayStr}
            value={promiseDate}
            onChange={e => setPromiseDate(e.target.value)}
            required
            aria-required="true"
            disabled={isPending}
          />
        </div>

        {/* Note */}
        <div className="form-group">
          <label className="form-label" htmlFor="ptp-note">
            {t.ptpNoteLabel}
          </label>
          <Textarea
            id="ptp-note"
            className="form-input"
            rows={3}
            maxLength={500}
            placeholder={t.ptpNotePlaceholder}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            disabled={isPending}
            style={{ resize: 'vertical', minHeight: 80 }}
          />
          <p className="form-hint" style={{ textAlign: 'right' }}>
            {notes.length}/500
          </p>
        </div>
      </form>
    </Drawer>
  )
}
