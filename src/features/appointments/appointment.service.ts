/** V2 Appointments — API service layer.
 *
 * ALL calls go through `api()` so they get cookie auth, CSRF, replay
 * protection, offline queue + 401 refresh. Reads are network-only (no
 * `cacheReads: true`) because appointment rows can leak schedules across
 * sessions on shared devices — `OFFLINE_RULES.md` rule 3.
 */

import { api } from '@/lib/api'
import { APPOINTMENT_ENTITY_TYPE } from './appointment.constants'
import { buildEntityLabel } from './appointment.utils'
import type {
  AppointmentRow,
  AppointmentDetail,
  AppointmentListQuery,
  CreateAppointmentBody,
  PatchStatusBody,
} from './appointment.types'

function buildListQuery(q: AppointmentListQuery): string {
  const params = new URLSearchParams()
  params.set('from', q.from)
  params.set('to', q.to)
  if (q.employeeId) params.set('employeeId', q.employeeId)
  const s = params.toString()
  return s ? `?${s}` : ''
}

export async function listAppointments(
  q: AppointmentListQuery,
  signal?: AbortSignal
): Promise<AppointmentRow[]> {
  return api<AppointmentRow[]>(`/appointments${buildListQuery(q)}`, { signal })
}

export async function getAppointment(
  id: string,
  signal?: AbortSignal
): Promise<AppointmentDetail> {
  return api<AppointmentDetail>(`/appointments/${id}`, { signal })
}

/** Create — carries entityType + entityLabel so the offline-queue UI shows
 *  "Saving appointment — Raju Traders @ 09:30" instead of "Offline change".
 */
export async function createAppointment(
  body: CreateAppointmentBody,
  partyNameForLabel: string,
  signal?: AbortSignal
): Promise<AppointmentRow> {
  return api<AppointmentRow>('/appointments', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
    entityType: APPOINTMENT_ENTITY_TYPE,
    entityLabel: buildEntityLabel(partyNameForLabel, body.startAt),
  })
}

export async function patchAppointmentStatus(
  id: string,
  body: PatchStatusBody,
  partyNameForLabel: string,
  startAtForLabel: string,
  signal?: AbortSignal
): Promise<AppointmentRow> {
  return api<AppointmentRow>(`/appointments/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    signal,
    entityType: APPOINTMENT_ENTITY_TYPE,
    entityLabel: buildEntityLabel(partyNameForLabel, startAtForLabel),
  })
}
