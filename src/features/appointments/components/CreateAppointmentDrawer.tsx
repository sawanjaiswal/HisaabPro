/** CreateAppointmentDrawer — FE-2 cut.
 *
 *  Changes vs FE-1:
 *    - Party + Employee pickers (was free-text id input).
 *    - Recurrence sub-form (was "Repeats: None" stub).
 *    - Vertical sourced from `useVertical()` when not explicitly passed.
 *    - `restoreSnapshot` API lets the parent re-open the drawer pre-filled
 *      with a queued mutation's payload after the replay-rejection flow.
 */

import { useEffect, useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DateField } from '@/components/ui/DateField'
import { Select, SelectItem } from '@/components/ui/Select'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useLanguage } from '@/hooks/useLanguage'
import { useVertical } from '@/hooks/useVertical'
import { useAppointmentForm } from '../hooks/useAppointmentForm'
import { useAppointmentMutations } from '../hooks/useAppointmentMutations'
import { ClinicNotesBanner } from './ClinicNotesBanner'
import { PartyPickerField } from './PartyPickerField'
import { EmployeePicker } from './EmployeePicker'
import { RecurrenceFields } from './RecurrenceFields'
import type {
  AppointmentFormState,
  AppointmentVertical,
} from '../appointment.types'

interface CreateAppointmentDrawerProps {
  open: boolean
  onClose: () => void
  seedDate?: Date
  seedStartHour?: number
  /** Explicit override. When omitted, vertical is read from useVertical(). */
  vertical?: AppointmentVertical
  /** Optional snapshot — re-open the drawer pre-filled (replay rejection flow). */
  restoreSnapshot?: Partial<AppointmentFormState>
  /** Banner text rendered above the form when reopening from a rejection. */
  restoreBannerMessage?: string
  onCreated?: (id: string) => void
}

function verticalFromBusinessType(type: string): AppointmentVertical {
  if (type === 'clinic') return 'clinic'
  if (type === 'salon') return 'salon'
  return 'general'
}

export function CreateAppointmentDrawer({
  open,
  onClose,
  seedDate,
  seedStartHour,
  vertical: explicitVertical,
  restoreSnapshot,
  restoreBannerMessage,
  onCreated,
}: CreateAppointmentDrawerProps) {
  const { t } = useLanguage()
  const verticalProfile = useVertical()
  const vertical: AppointmentVertical = explicitVertical
    ?? verticalFromBusinessType(verticalProfile.type)

  const formState = useAppointmentForm({ seedDate, seedStartHour })
  const { create, isCreating } = useAppointmentMutations()
  const [showDirtyConfirm, setShowDirtyConfirm] = useState(false)

  // Re-hydrate from a queued mutation's payload when the parent passes one.
  useEffect(() => {
    if (restoreSnapshot && open) {
      formState.restoreFromSnapshot(restoreSnapshot)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreSnapshot, open])

  const requestClose = () => {
    if (formState.isDirty) setShowDirtyConfirm(true)
    else onClose()
  }

  const handleSubmit = async () => {
    if (!formState.isValid) return
    const { body, partyName } = formState.toCreateBody()
    try {
      const created = await create(body, partyName)
      if (created && typeof created === 'object' && 'id' in created && typeof created.id === 'string') {
        onCreated?.(created.id)
      }
      formState.reset()
      onClose()
    } catch {
      // Toast surfaced by mutation hook.
    }
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={requestClose}
        title={t.newAppointment ?? 'New appointment'}
        size="md"
        footer={
          <div className="flex justify-end gap-2 p-3">
            <Button variant="ghost" onClick={requestClose}>{t.cancel}</Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!formState.isValid || isCreating}
            >
              {isCreating ? (t.saving ?? 'Saving…') : (t.save ?? 'Save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 p-3">
          {restoreBannerMessage && (
            <div
              className="p-3 rounded-[var(--radius-md)] text-[var(--fs-sm)]"
              style={{ background: 'var(--color-warning-bg, var(--color-surface-muted))', color: 'var(--color-text)' }}
              role="status"
            >
              {restoreBannerMessage}
            </div>
          )}

          {vertical === 'clinic' && <ClinicNotesBanner />}

          <PartyPickerField
            partyId={formState.form.partyId}
            partyName={formState.form.partyName}
            onChange={formState.setParty}
          />
          <EmployeePicker
            employeeId={formState.form.employeeId}
            onChange={formState.setEmployee}
          />

          <div className="grid grid-cols-2 gap-3">
            <DateField
              label={t.date ?? 'Date'}
              type="date"
              value={formState.form.dateISO}
              onChange={(e) => formState.setField('dateISO', e.target.value)}
              required
            />
            <DateField
              label={t.startTime ?? 'Start time'}
              type="time"
              value={formState.form.startTime}
              onChange={(e) => formState.setField('startTime', e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="appt-duration" className="text-[var(--fs-sm)] mb-1.5 inline-block">
              {t.duration ?? 'Duration'}
            </label>
            <Select
              value={String(formState.form.durationMinutes)}
              onValueChange={(v) => formState.setField('durationMinutes', Number(v))}
              ariaLabel={t.duration ?? 'Duration'}
            >
              {formState.durationOptions.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} {t.minutesShort ?? 'min'}
                </SelectItem>
              ))}
            </Select>
          </div>

          <Input
            label={t.notes ?? 'Notes'}
            value={formState.form.notes}
            onChange={(e) => formState.setField('notes', e.target.value)}
            placeholder={vertical === 'clinic' ? (t.clinicNotesNoPHI ?? '') : (t.notesPlaceholder ?? '')}
            maxLength={2000}
          />

          <RecurrenceFields
            value={formState.form.recurrence}
            onChange={formState.setRecurrence}
            startISO={(() => {
              const { startAt } = formState.toCreateBody().body
              return startAt
            })()}
          />
        </div>
      </Drawer>

      <ConfirmDialog
        open={showDirtyConfirm}
        onClose={() => setShowDirtyConfirm(false)}
        onConfirm={() => {
          setShowDirtyConfirm(false)
          formState.reset()
          onClose()
        }}
        title={t.discardChanges ?? 'Discard changes?'}
        description={t.unsavedAppointmentDesc ?? 'Your edits to this appointment will be lost.'}
        confirmLabel={t.discard ?? 'Discard'}
        cancelLabel={t.keepEditing ?? 'Keep editing'}
        isDanger
      />
    </>
  )
}
