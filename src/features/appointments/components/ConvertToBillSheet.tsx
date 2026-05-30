/** ConvertToBillSheet — bottom-sheet for converting an appointment to a Job
 *  (salon/services) or an Invoice (clinic/freelancer).
 *
 *  Server endpoint is stubbed; the hook handles 404/501 → friendly toast.
 *  Idempotency-Key is held by the hook and reused across retries.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/hooks/useLanguage'
import { useConvertAppointment } from '../hooks/useConvertAppointment'
import type {
  AppointmentRow,
  AppointmentVertical,
} from '../appointment.types'

interface ConvertToBillSheetProps {
  open: boolean
  onClose: () => void
  row: AppointmentRow
  vertical: AppointmentVertical
}

export function ConvertToBillSheet({ open, onClose, row, vertical }: ConvertToBillSheetProps) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { convert, isPending, idempotencyKey } = useConvertAppointment()
  const [notes, setNotes] = useState('')

  // Clinic + freelancer → invoice; everything else (salon/services/general) → job.
  const target: 'job' | 'invoice' = vertical === 'clinic' ? 'invoice' : 'job'
  const titleKey = target === 'invoice' ? 'convertToInvoice' : 'convertToJob'
  const ctaLabel = target === 'invoice' ? (t.convertToInvoice ?? 'Convert to invoice') : (t.convertToJob ?? 'Convert to job')

  const handleSubmit = async () => {
    const result = await convert({
      appointmentId: row.id,
      body: {
        target,
        serviceId: row.serviceId,
        notes: notes.trim() ? notes.trim() : null,
      },
      partyName: row.partyNameSnapshot,
      startAtISO: row.startAt,
    })
    if (result) {
      onClose()
      if (target === 'job' && result.jobId) navigate(`/jobs/${result.jobId}`)
      else if (target === 'invoice' && result.invoiceId) navigate(`/invoices/${result.invoiceId}`)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={(t[titleKey] as string | undefined) ?? 'Convert'}
      size="md"
      footer={
        <div className="flex justify-end gap-2 p-3">
          <Button variant="ghost" onClick={onClose}>{t.cancel}</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isPending}>
            <span className="flex items-center gap-1">
              {isPending ? (t.saving ?? 'Saving…') : ctaLabel}
              <ArrowRight size={14} aria-hidden="true" />
            </span>
          </Button>
        </div>
      }
    >
      <div className="space-y-3 p-3">
        <p className="text-[var(--fs-sm)]" style={{ color: 'var(--color-text-muted)' }}>
          {t.convertHint ?? 'Generate a billable record from this appointment.'}
        </p>
        <div
          className="p-3 rounded-[var(--radius-md)] text-[var(--fs-sm)]"
          style={{ background: 'var(--color-surface-muted)' }}
        >
          <div className="font-medium">{row.partyNameSnapshot}</div>
          {row.employeeNameSnapshot && (
            <div style={{ color: 'var(--color-text-muted)' }}>{row.employeeNameSnapshot}</div>
          )}
        </div>
        <Input
          label={t.notes ?? 'Notes'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t.notesPlaceholder ?? ''}
          maxLength={2000}
        />
        <p
          className="text-[var(--fs-xs)] tabular-nums"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {t.idempotencyKey ?? 'Key'}: {idempotencyKey().slice(0, 8)}…
        </p>
      </div>
    </Drawer>
  )
}
