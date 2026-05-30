/**
 * V2 Appointments — TS interfaces and DTOs.
 *
 * Money in paise (Int). Times are ISO-8601 strings on the wire, Date in app code.
 * No PII in log objects — `notes` is redacted via `redactPiiFields` middleware.
 */

import type {
  Appointment,
  AppointmentStatus,
  AppointmentRecurrenceFreq,
  AppointmentStatusEvent,
  AppointmentRecurrenceTemplate,
  AppointmentWaitlist,
} from '@prisma/client'

export type { AppointmentStatus, AppointmentRecurrenceFreq }
export type AppointmentRow = Appointment

/** Inputs accepted by the create endpoint (post-Zod parse). */
export interface CreateAppointmentInput {
  partyId: string
  employeeId: string | null
  startAt: Date
  endAt: Date
  serviceId?: string | null
  notes?: string | null
  vertical?: string // resolved from business if absent
  idempotencyKey?: string
  recurrence?: RecurrenceInput | null
}

export interface RecurrenceInput {
  frequency: AppointmentRecurrenceFreq
  endAt: Date
  occurrences: number
}

export interface PatchStatusInput {
  toStatus: AppointmentStatus
  reason?: string | null
}

export interface AvailabilityQuery {
  employeeId: string
  date: Date
  serviceDurationMinutes: number
  stepMinutes?: number
}

export interface AvailabilitySlot {
  startAt: Date
  endAt: Date
}

export interface ConvertToJobInput {
  appointmentId: string
  idempotencyKey?: string
}

export interface ConvertToInvoiceInput {
  appointmentId: string
  idempotencyKey?: string
}

export interface PublicBookingPayload {
  businessId: string
  employeeId: string | null
  expiresAt: Date
}

export interface PublicBookingSignedLink {
  token: string // base64url(payload).base64url(sig)
  expiresAt: Date
}

export type {
  AppointmentStatusEvent,
  AppointmentRecurrenceTemplate,
  AppointmentWaitlist,
}
