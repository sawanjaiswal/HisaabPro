/** Replay-rejection event bus — tiny vanilla emitter.
 *
 * The offline processor lives outside React and cannot use React-Query
 * invalidation or a Context dispatch. The replay-bus bridges that gap: it
 * notifies any mounted listener (e.g. AppointmentsPage / AppointmentDetailPage)
 * when a queued mutation was rejected by the server on replay, so the page
 * can re-open the CreateAppointmentDrawer pre-filled with the snapshot and
 * show a "Slot taken — pick another time" banner.
 *
 * Intentionally not a Zustand store — no React tree dependency, no SSR
 * concerns, and the payload is one-shot fire-and-forget (no persistence).
 */

import type { ReplayRejectedDetail } from '@/features/appointments/appointment.types'

type Listener = (detail: ReplayRejectedDetail) => void

const listeners = new Set<Listener>()

export function onReplayRejected(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitReplayRejected(detail: ReplayRejectedDetail): void {
  // Snapshot — listeners may unsubscribe during the loop.
  for (const l of Array.from(listeners)) {
    try {
      l(detail)
    } catch {
      // A buggy listener must not break the broadcast.
    }
  }
}

/** Test-only — drop every subscription. Reset between tests. */
export function _resetReplayBus(): void {
  listeners.clear()
}
