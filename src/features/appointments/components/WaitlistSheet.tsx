/** WaitlistSheet — add-to-waitlist drawer for unavailable slots.
 *
 *  Server endpoint stubbed; hook handles 404/501 → toast.
 */

import { useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'
import { PartyPickerField } from './PartyPickerField'
import { useWaitlist } from '../hooks/useWaitlist'

interface WaitlistSheetProps {
  open: boolean
  onClose: () => void
  employeeId?: string
  desiredStartAt: string
  desiredEndAt: string
  serviceId?: string | null
}

export function WaitlistSheet({
  open,
  onClose,
  employeeId,
  desiredStartAt,
  desiredEndAt,
  serviceId,
}: WaitlistSheetProps) {
  const { t } = useLanguage()
  const { rows, isPending, add, isAdding } = useWaitlist({
    employeeId,
    from: desiredStartAt,
    to: desiredEndAt,
  })
  const [partyId, setPartyId] = useState('')
  const [partyName, setPartyName] = useState('')
  const [notes, setNotes] = useState('')

  const canSubmit = partyId.length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    const result = await add(
      {
        partyId,
        employeeId: employeeId ?? null,
        desiredStartAt,
        desiredEndAt,
        serviceId: serviceId ?? null,
        notes: notes.trim() ? notes.trim() : null,
      },
      partyName,
    )
    if (result) {
      setPartyId('')
      setPartyName('')
      setNotes('')
      onClose()
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t.addToWaitlist ?? 'Add to waitlist'}
      size="md"
      footer={
        <div className="flex justify-end gap-2 p-3">
          <Button variant="ghost" onClick={onClose}>{t.cancel}</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit || isAdding}
          >
            {isAdding ? (t.saving ?? 'Saving…') : (t.addToWaitlist ?? 'Add to waitlist')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 p-3">
        <p className="text-[var(--fs-sm)]" style={{ color: 'var(--color-text-muted)' }}>
          {t.slotUnavailable ?? 'Slot unavailable'}
        </p>
        <PartyPickerField
          partyId={partyId}
          partyName={partyName}
          onChange={(id, name) => { setPartyId(id); setPartyName(name) }}
        />
        <Input
          label={t.notes ?? 'Notes'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
        />

        <div className="text-[var(--fs-sm)] font-medium mt-3">
          {t.waitlistCurrent ?? 'Currently on waitlist'}
        </div>
        {isPending ? (
          <Skeleton height="32px" />
        ) : rows.length === 0 ? (
          <p className="text-[var(--fs-sm)]" style={{ color: 'var(--color-text-muted)' }}>
            {t.waitlistEmpty ?? 'Nobody on the waitlist for this slot.'}
          </p>
        ) : (
          <ul className="space-y-1 text-[var(--fs-sm)]">
            {rows.map((r) => (
              <li key={r.id} className="tabular-nums">{r.partyNameSnapshot}</li>
            ))}
          </ul>
        )}
      </div>
    </Drawer>
  )
}
