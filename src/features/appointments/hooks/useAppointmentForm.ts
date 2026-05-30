/** V2 Appointments — local form state + dirty tracking for the create drawer.
 *
 *  FE-2 additions vs FE-1:
 *   - Full recurrence sub-state (RecurrenceFields).
 *   - Stable Idempotency-Key minted at form construction; preserved across
 *     retries so server-side dedup matches.
 *   - `restoreFromSnapshot(...)` re-hydrates the form from a queued mutation
 *     payload (used by the replay-rejection flow to re-open the drawer).
 */

import { useCallback, useMemo, useState } from 'react'
import { emptyForm, emptyRecurrence, formToCreateBody } from '../appointment.utils'
import { validateRecurrence, recurrenceToDTO } from '../recurrence.utils'
import { DURATION_OPTIONS } from '../appointment.constants'
import type {
  AppointmentFormState,
  CreateAppointmentBody,
  RecurrenceFormState,
} from '../appointment.types'

interface UseAppointmentFormOptions {
  initial?: Partial<AppointmentFormState>
  seedDate?: Date
  seedStartHour?: number
}

export interface AppointmentFormError {
  field: keyof AppointmentFormState | 'submit' | 'recurrence'
  message: string
}

interface UseAppointmentFormReturn {
  form: AppointmentFormState
  setField: <K extends keyof AppointmentFormState>(key: K, value: AppointmentFormState[K]) => void
  setParty: (id: string, name: string) => void
  setEmployee: (id: string | null, name: string | null) => void
  setRecurrence: (next: RecurrenceFormState) => void
  isDirty: boolean
  errors: AppointmentFormError[]
  isValid: boolean
  durationOptions: readonly number[]
  toCreateBody: () => { body: CreateAppointmentBody; partyName: string }
  reset: () => void
  restoreFromSnapshot: (snapshot: Partial<AppointmentFormState>) => void
}

/** Pure validator. */
export function validateForm(form: AppointmentFormState): AppointmentFormError[] {
  const errors: AppointmentFormError[] = []
  if (!form.partyId) errors.push({ field: 'partyId', message: 'partyRequired' })
  if (!form.dateISO) errors.push({ field: 'dateISO', message: 'dateRequired' })
  if (!form.startTime) errors.push({ field: 'startTime', message: 'startTimeRequired' })
  if (form.durationMinutes <= 0) errors.push({ field: 'durationMinutes', message: 'durationInvalid' })

  // Recurrence — only validate when enabled.
  if (form.recurrence.enabled) {
    const { startAt } = formToCreateBody(form)
    const rv = validateRecurrence(form.recurrence, startAt)
    if (!rv.ok && rv.messageKey) {
      errors.push({ field: 'recurrence', message: rv.messageKey })
    }
  }
  return errors
}

export function useAppointmentForm(options: UseAppointmentFormOptions = {}): UseAppointmentFormReturn {
  const initial = useMemo<AppointmentFormState>(
    () => ({ ...emptyForm({ date: options.seedDate, startHour: options.seedStartHour }), ...options.initial }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const [form, setForm] = useState<AppointmentFormState>(initial)

  const setField = useCallback(
    <K extends keyof AppointmentFormState>(key: K, value: AppointmentFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const setParty = useCallback((id: string, name: string) => {
    setForm((prev) => ({ ...prev, partyId: id, partyName: name }))
  }, [])

  const setEmployee = useCallback((id: string | null, name: string | null) => {
    setForm((prev) => ({ ...prev, employeeId: id, employeeName: name }))
  }, [])

  const setRecurrence = useCallback((next: RecurrenceFormState) => {
    setForm((prev) => ({ ...prev, recurrence: next }))
  }, [])

  const errors = useMemo(() => validateForm(form), [form])
  const isValid = errors.length === 0

  const isDirty = useMemo(() => {
    const keys = Object.keys(form) as (keyof AppointmentFormState)[]
    return keys.some((k) => {
      // recurrence is an object — compare by JSON for dirty detection.
      if (k === 'recurrence') return JSON.stringify(form[k]) !== JSON.stringify(initial[k])
      return form[k] !== initial[k]
    })
  }, [form, initial])

  const toCreateBody = useCallback(() => {
    const { startAt, endAt } = formToCreateBody(form)
    const recurrence = recurrenceToDTO(form.recurrence, startAt)
    const body: CreateAppointmentBody = {
      partyId: form.partyId,
      employeeId: form.employeeId,
      startAt,
      endAt,
      serviceId: form.serviceId,
      notes: form.notes.trim() ? form.notes.trim() : null,
      idempotencyKey: form.idempotencyKey,
      recurrence: recurrence
        ? { frequency: recurrence.frequency, endAt: recurrence.endAt, occurrences: recurrence.occurrences }
        : null,
    }
    return { body, partyName: form.partyName }
  }, [form])

  const reset = useCallback(() => {
    // Mint a fresh idempotency key on reset so the next attempt is a new request.
    setForm({ ...initial, ...emptyForm(), recurrence: emptyRecurrence() })
  }, [initial])

  const restoreFromSnapshot = useCallback((snapshot: Partial<AppointmentFormState>) => {
    setForm((prev) => ({ ...prev, ...snapshot }))
  }, [])

  return {
    form,
    setField,
    setParty,
    setEmployee,
    setRecurrence,
    isDirty,
    errors,
    isValid,
    durationOptions: DURATION_OPTIONS,
    toCreateBody,
    reset,
    restoreFromSnapshot,
  }
}
