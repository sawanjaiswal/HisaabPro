/**
 * api.utils.ts — pure helpers for the api() wrapper.
 *
 * Extracted from api.ts to keep that file ≤250 LOC under the new file-layer
 * discipline (CLAUDE.md). No React, no fetch, no side effects — pure
 * predicates and string transforms over which the api() wrapper composes.
 */

/** Detect network-level failures (no response at all). */
export function isOfflineError(err: unknown): boolean {
  // fetch throws TypeError on network failure (DNS, CORS, connection reset).
  if (err instanceof TypeError) return true
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  return false
}

/**
 * Best-effort entity type from API path (e.g. "/parties/abc" → "party").
 * Used as the fallback when a caller forgets to pass `entityType` — the
 * offline-queue UI then shows "Saving party" instead of "Offline change".
 */
export function inferEntityType(path: string): string {
  const segment = path.split('/').filter(Boolean)[0] ?? 'item'
  // Singularise: "parties" → "party", "invoices" → "invoice"
  if (segment.endsWith('ies')) return segment.slice(0, -3) + 'y'
  if (segment.endsWith('s')) return segment.slice(0, -1)
  return segment
}
