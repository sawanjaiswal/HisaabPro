/**
 * CRM (#127) — Frontend service.
 *
 * Goes through `api()` (offline queue + auth + CSRF + replay protection).
 * Mutations carry `entityType` + `entityLabel` so the offline-queue UI
 * shows e.g. "Saving party — Raju Traders" instead of "Offline change"
 * (HisaabPro OFFLINE_RULES rule 2).
 *
 * Reads are intentionally NOT cached: follow-up lists rotate as the user
 * works through them and tag aggregates change on every party edit.
 * Caching would mask "freshness lost" to the user (OFFLINE_RULES rule 3).
 */

import { api } from '@/lib/api'
import type {
  FollowUpPage,
  FollowUpsQuery,
  PartyCrmPatched,
  PartyCrmPatchInput,
  TagSummaryPage,
} from '../crm.types'

// `api()` (src/lib/api.ts) already unwraps the backend's
// `{ success: true, data: <T> }` envelope and returns `json.data` — callers
// type `T` as the payload shape directly, not wrapped again.

// ─── Tag summary ──────────────────────────────────────────────────────────

export async function getTagSummary(signal?: AbortSignal): Promise<TagSummaryPage> {
  return api<TagSummaryPage>('/parties/tags', { signal })
}

// ─── Follow-up queue ──────────────────────────────────────────────────────

export async function getFollowUps(
  query: FollowUpsQuery,
  signal?: AbortSignal,
): Promise<FollowUpPage> {
  const params = new URLSearchParams()
  params.set('withinDays', String(query.withinDays))
  if (query.cursor) params.set('cursor', query.cursor)
  if (query.limit !== undefined) params.set('limit', String(query.limit))
  return api<FollowUpPage>(`/parties/follow-ups?${params.toString()}`, { signal })
}

// ─── Narrow PATCH /api/parties/:id (followUpAt + tags) ────────────────────

export async function patchPartyCrm(
  partyId: string,
  patch: PartyCrmPatchInput,
  partyName: string,
): Promise<PartyCrmPatched> {
  const res = await api<{ party: PartyCrmPatched }>(
    `/parties/${encodeURIComponent(partyId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
      // OFFLINE_RULES rule 2 — mutations carry human-readable metadata.
      entityType: 'party',
      entityLabel: partyName,
    },
  )
  // OFFLINE_RULES rule 5 — `api()` returns `{}` when queued offline. Guard
  // the deref so callers can still optimistically update without crashing.
  return res.party ?? ({} as PartyCrmPatched)
}
