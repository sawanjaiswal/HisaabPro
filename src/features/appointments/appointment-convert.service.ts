/** V2 Appointments — convert-to-bill service.
 *
 * TODO FE-2.0 — the server endpoint
 *   POST /api/appointments/:id/convert
 * is NOT implemented yet. ARC plan defers it to a later cut. We still ship the
 * client-side wiring (idempotency key, error path, query invalidation) so the
 * UI is real; the hook handles 404 (route missing) and 501 (server stub) the
 * same way: a friendly "coming soon" toast.
 *
 * Idempotency-Key strategy:
 *   - Drawer mounts → mint a uuid and keep it in form state.
 *   - Every retry sends the SAME key.
 *   - Offline replay (if the user is mid-convert when the connection drops)
 *     also matches the same key, so a successful server-side convert is never
 *     double-applied.
 */

import { api } from '@/lib/api'
import { APPOINTMENT_ENTITY_TYPE } from './appointment.constants'
import { buildEntityLabel } from './appointment.utils'
import type {
  ConvertAppointmentBody,
  ConvertAppointmentResponse,
} from './appointment.types'

export async function convertAppointment(
  appointmentId: string,
  body: ConvertAppointmentBody,
  partyNameForLabel: string,
  startAtForLabel: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<ConvertAppointmentResponse> {
  return api<ConvertAppointmentResponse>(`/appointments/${appointmentId}/convert`, {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
    headers: { 'X-Idempotency-Key': idempotencyKey },
    entityType: APPOINTMENT_ENTITY_TYPE,
    entityLabel: buildEntityLabel(partyNameForLabel, startAtForLabel),
  })
}
