/**
 * CRM (#127) — Frontend types.
 *
 * Mirrors `server/src/types/party-crm.types.ts` field-for-field so the
 * service layer can pass through API JSON without re-shaping. Keys are
 * intentionally the same on the wire.
 *
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §2.5, §3.4-§3.6.
 */

// ─── Tag summary (GET /api/parties/tags) ─────────────────────────────────

export interface TagSummary {
  tag: string
  partyCount: number
}

export interface TagSummaryPage {
  tags: TagSummary[]
  totalPartiesWithTags: number
  totalPartiesWithoutTags: number
}

// ─── Follow-up queue (GET /api/parties/follow-ups) ───────────────────────

export interface FollowUpRow {
  id: string
  name: string
  phone: string | null
  lastContactedAt: string | null   // ISO
  followUpAt: string | null        // ISO
  daysOverdue: number              // negative = future, 0 = today, positive = overdue
}

export interface FollowUpPage {
  rows: FollowUpRow[]
  nextCursor: string | null
  totalCount: number
}

// ─── Filters / query state ───────────────────────────────────────────────

export interface FollowUpsQuery {
  /**
   * Architecture / M3 — capped at 365 client-side too. The server clamps
   * defensively but the hook validates so we never round-trip a 400 the
   * UI can avoid.
   */
  withinDays: number
  cursor?: string
  limit?: number
}

// ─── PATCH input (PATCH /api/parties/:id — CRM narrow) ───────────────────
//
// MUST mirror server `partyPatchSchema`. Server-only fields
// (`lastContactedAt`, `loyaltyPointsCache`, `loyaltyOptOut`) are absent
// from this shape on purpose — M2 (OWASP A01 mass-assignment).

export interface PartyCrmPatchInput {
  followUpAt?: string | null   // ISO datetime or null to clear
  tags?: string[]
}

// ─── Patched party (PATCH response) ──────────────────────────────────────

export interface PartyCrmPatched {
  id: string
  name: string
  tags: string[]
  followUpAt: string | null
  lastContactedAt: string | null
  updatedAt: string
}

// ─── Error codes the BE may surface (used by FE for friendly toasts) ─────

export type CrmErrorCode =
  | 'INVALID_WITHIN_DAYS_RANGE'
  | 'INVALID_FOLLOWUP_PAST'
  | 'VALIDATION_ERROR'

// ─── Range presets for FollowUpsPage chip-bar ─────────────────────────────

export type WithinDaysPreset = 7 | 30 | 90
