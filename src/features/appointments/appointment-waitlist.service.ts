/** V2 Appointments — waitlist service.
 *
 * TODO FE-2.1 — the server endpoint
 *   POST /api/appointments/waitlist
 *   GET  /api/appointments/waitlist?employeeId=&from=&to=
 * is NOT implemented yet. The client is wired up so the UI is real, but the
 * hook layer treats 404 as a "feature coming soon" path.
 */

import { api } from '@/lib/api'
import { APPOINTMENT_ENTITY_TYPE } from './appointment.constants'
import type { WaitlistBody, WaitlistRow } from './appointment.types'

export async function addToWaitlist(
  body: WaitlistBody,
  partyNameForLabel: string,
  signal?: AbortSignal,
): Promise<WaitlistRow> {
  return api<WaitlistRow>('/appointments/waitlist', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
    entityType: APPOINTMENT_ENTITY_TYPE,
    entityLabel: `${partyNameForLabel} — waitlist`,
  })
}

export async function listWaitlist(
  params: { employeeId?: string; from?: string; to?: string },
  signal?: AbortSignal,
): Promise<WaitlistRow[]> {
  const qs = new URLSearchParams()
  if (params.employeeId) qs.set('employeeId', params.employeeId)
  if (params.from) qs.set('from', params.from)
  if (params.to) qs.set('to', params.to)
  const q = qs.toString()
  return api<WaitlistRow[]>(`/appointments/waitlist${q ? `?${q}` : ''}`, { signal })
}
