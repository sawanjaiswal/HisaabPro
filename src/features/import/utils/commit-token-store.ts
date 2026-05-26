/**
 * Phase 7 Slice 7.1A FE.5 — Commit-token session store.
 *
 * The BE issues `commitToken` only on POST /imports (upload response).
 * GET /imports/:id does NOT echo it back — exposing a commit token on
 * every poll would widen the window for token theft on shared devices.
 *
 * The user moves Upload → ImportJobPage via `navigate()`, so we stash
 * the token in `sessionStorage` keyed by jobId. sessionStorage is:
 *   - cleared on tab close (token can't outlive the session),
 *   - origin-scoped (no cross-site leak),
 *   - NOT entity PII — just an opaque single-use server-issued nonce.
 *
 * This is allowed under OFFLINE_RULES Rule 4 — which bans
 * `localStorage` for ENTITY data; `sessionStorage` for short-lived
 * server artefacts is explicitly the documented escape hatch.
 */

const KEY_PREFIX = 'hp.import.commitToken.'

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    // Safari private mode, iframe sandbox, etc.
    return null
  }
}

export function stashCommitToken(jobId: string, token: string | null): void {
  if (!token) return
  const s = storage()
  if (!s) return
  try {
    s.setItem(`${KEY_PREFIX}${jobId}`, token)
  } catch {
    // Quota / private-browsing — token loss is recoverable by re-upload.
  }
}

export function readCommitToken(jobId: string): string | null {
  const s = storage()
  if (!s) return null
  try {
    return s.getItem(`${KEY_PREFIX}${jobId}`)
  } catch {
    return null
  }
}

export function clearCommitToken(jobId: string): void {
  const s = storage()
  if (!s) return
  try {
    s.removeItem(`${KEY_PREFIX}${jobId}`)
  } catch {
    // ignore
  }
}
