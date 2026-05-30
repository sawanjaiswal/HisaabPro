/** V2 Appointments — Frontend type definitions.
 *
 * Mirrors `server/src/types/appointment.types.ts` over the wire. Times come
 * down as ISO-8601 strings; this file keeps them as strings on `*Row` DTOs
 * and lets the utils layer coerce to Date only at the boundary.
 *
 * Money fields are NOT present here (appointments don't carry currency —
 * billing lives on Job/Invoice post-conversion).
 */

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'

export type AppointmentRecurrenceFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY'

/** UI-only mutex: end the recurrence by count OR by until-date, never both.
 *  Matches server schema where only one of {occurrences, recurrenceEndAt} is
 *  honoured per request. */
export type RecurrenceEndMode = 'count' | 'until'

/** Form state for the recurrence sub-section of CreateAppointmentDrawer. */
export interface RecurrenceFormState {
  enabled: boolean
  frequency: AppointmentRecurrenceFreq
  interval: number
  endMode: RecurrenceEndMode
  count: number
  until: string // yyyy-mm-dd; empty when endMode === 'count'
  /** Weekly only — 0=Sun..6=Sat. Empty array == defer to startAt's weekday. */
  byweekday: number[]
}

/** Vertical context — clinic gets the no-PHI banner, general does not. */
export type AppointmentVertical = 'general' | 'clinic' | 'salon'

/** Wire DTO — what the GET list/detail endpoints return.
 *
 * `partyNameSnapshot` / `employeeNameSnapshot` are server-captured names
 * frozen at creation time so cards remain legible even if the underlying
 * Party or Employee row is later soft-deleted (FK goes null).
 */
export interface AppointmentRow {
  id: string
  businessId: string
  partyId: string | null
  employeeId: string | null
  partyNameSnapshot: string
  employeeNameSnapshot: string | null
  serviceId: string | null
  status: AppointmentStatus
  startAt: string
  endAt: string
  notes: string | null
  vertical: AppointmentVertical
  recurrenceTemplateId: string | null
  createdAt: string
  updatedAt: string
}

export interface AppointmentStatusEventRow {
  id: string
  appointmentId: string
  fromStatus: AppointmentStatus | null
  toStatus: AppointmentStatus
  actorUserId: string
  reason: string | null
  createdAt: string
}

export interface AppointmentDetail extends AppointmentRow {
  events?: AppointmentStatusEventRow[]
}

export interface RecurrenceInputDTO {
  frequency: AppointmentRecurrenceFreq
  endAt: string // ISO
  occurrences: number
}

/** Body for POST /api/appointments. Times serialised as ISO. */
export interface CreateAppointmentBody {
  partyId: string
  employeeId: string | null
  startAt: string
  endAt: string
  serviceId?: string | null
  notes?: string | null
  idempotencyKey?: string
  recurrence?: RecurrenceInputDTO | null
}

export interface PatchStatusBody {
  toStatus: AppointmentStatus
  reason?: string | null
}

/** List query — both bounds inclusive on the server. */
export interface AppointmentListQuery {
  from: string // ISO
  to: string // ISO
  employeeId?: string
}

/** Form state local to the create drawer. UI-side only; transforms to DTO
 *  before hitting the wire. */
export interface AppointmentFormState {
  partyId: string
  partyName: string
  employeeId: string | null
  employeeName: string | null
  serviceId: string | null
  dateISO: string // yyyy-mm-dd
  startTime: string // HH:mm
  durationMinutes: number
  notes: string
  /** FE-2 — full recurrence state. `enabled=false` ⇒ wire payload omits recurrence. */
  recurrence: RecurrenceFormState
  /** Stable Idempotency-Key for this create attempt. Survives retries + offline
   *  replay so server-side dedup matches the same payload to the same key. */
  idempotencyKey: string
}

export type ViewMode = 'day' | 'week'

/** Payload broadcast by the replay-bus when a queued appointment mutation is
 *  rejected by the server (status no longer valid, slot taken, etc.). */
export interface ReplayRejectedDetail {
  entityType: string
  entityLabel: string
  method: string
  path: string
  status: number
  errorCode?: string
  errorMessage?: string
}

/** Body for POST /api/appointments/:id/convert (server endpoint deferred —
 *  see FE-2 TODO note in appointment-convert.service.ts). */
export interface ConvertAppointmentBody {
  /** Convert to a Job (salon/services) or an Invoice (clinic/freelancer). */
  target: 'job' | 'invoice'
  /** Optional override — server defaults to the appointment's serviceId. */
  serviceId?: string | null
  notes?: string | null
}

export interface ConvertAppointmentResponse {
  /** Created Job id, when target='job'. */
  jobId?: string
  /** Created Invoice id, when target='invoice'. */
  invoiceId?: string
}

/** Body for POST /api/appointments/waitlist. */
export interface WaitlistBody {
  partyId: string
  employeeId?: string | null
  desiredStartAt: string
  desiredEndAt: string
  serviceId?: string | null
  notes?: string | null
}

export interface WaitlistRow {
  id: string
  partyId: string
  partyNameSnapshot: string
  employeeId: string | null
  desiredStartAt: string
  desiredEndAt: string
  createdAt: string
}
