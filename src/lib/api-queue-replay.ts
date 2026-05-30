/** Offline-queue replay-rejection bridge — FE-2 cut.
 *
 * Called by `offline.processor` when a queued mutation returns a non-
 * retryable conflict (4xx) on replay. Responsibilities:
 *
 *   1. Push a feature-aware toast (preserved from FE-1).
 *   2. Broadcast the rejection through the replay-bus so a mounted page can
 *      re-open the create drawer pre-filled with the snapshot ("Slot taken
 *      — pick another time").
 *   3. Capture a Sentry message for ops to track replay-rejection rates,
 *      with the entity type, status code and (sanitised) reason.
 *
 * No React-tree dependency — the offline processor is a vanilla module.
 */

import { useToastStore } from '@/hooks/useToast'
import { translations, type Language } from '@/lib/translations'
import { emitReplayRejected } from './replay-bus'
import { Sentry } from './sentry'
import { SENTRY_REPLAY_REJECTED_MSG } from '@/features/appointments/appointment.constants'

export interface ReplayRejectionPayload {
  entityType: string
  entityLabel: string
  method: string
  path: string
  status: number
  errorCode?: string
  errorMessage?: string
}

function readLanguage(): Language {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem('language') : null
    if (raw === 'hi' || raw === 'en') return raw
  } catch {
    /* ignore */
  }
  return 'en'
}

function interpolate(template: string, label: string): string {
  return template.replace(/\{(party|entity)\}/g, label)
}

export function notifyReplayRejection(payload: ReplayRejectionPayload): void {
  const lang = readLanguage()
  const dict = translations[lang]
  const template = payload.entityType === 'appointment'
    ? dict.appointmentReplayRejected
    : dict.offlineReplayRejected
  const message = interpolate(template, payload.entityLabel)
  useToastStore.getState().addToast({ type: 'error', message })

  // Broadcast so a mounted page can re-open the drawer.
  emitReplayRejected({
    entityType: payload.entityType,
    entityLabel: payload.entityLabel,
    method: payload.method,
    path: payload.path,
    status: payload.status,
    errorCode: payload.errorCode,
    errorMessage: payload.errorMessage,
  })

  // Sentry — appointment-specific message key, generic extras for non-appt.
  // We do NOT include the entityLabel (PII: party name) in the extras.
  try {
    const msgKey = payload.entityType === 'appointment'
      ? SENTRY_REPLAY_REJECTED_MSG
      : 'offline_replay_rejected'
    Sentry.captureMessage(msgKey, {
      level: 'warning',
      extra: {
        entityType: payload.entityType,
        method: payload.method,
        path: payload.path,
        statusCode: payload.status,
        errorCode: payload.errorCode,
      },
    })
  } catch {
    // Sentry is optional in dev; never fail the bridge call.
  }
}
