/**
 * CRM #127 — TypeScript interfaces for Party CRM additions.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §2.5, §3.4-§3.6
 *
 * NOTE on server-only fields (§3.6): `lastContactedAt` and `followUpAt` live
 * on the Party row, but only `followUpAt` is user-mutable (via partyPatchSchema).
 * `lastContactedAt` is touched server-side from share + reminder hooks only;
 * input Zod schemas MUST NOT accept it.
 */

import type { Party } from '@prisma/client'

// ─── Service context ────────────────────────────────────────────────────────
export interface PartyCrmServiceCtx {
  businessId: string
  userId: string
}

// ─── Tag aggregate ──────────────────────────────────────────────────────────

export interface TagSummary {
  tag: string
  partyCount: number
}

export interface TagSummaryPage {
  tags: TagSummary[]
  totalPartiesWithTags: number
  totalPartiesWithoutTags: number
}

// ─── Follow-up queue ────────────────────────────────────────────────────────

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

export interface FollowUpsQueryParams {
  withinDays: number               // architecture / v3 / M3 — capped at 365 in Zod + service
  cursor?: string
  limit?: number
}

// ─── Touch helpers (internal — service-layer only) ─────────────────────────

/**
 * Single party touch — called from share-log + payment-reminder hooks
 * (architecture §3.4 + race-window note §0.3).
 */
export interface TouchLastContactedInput {
  businessId: string
  partyId: string
  touchedAt?: Date                 // defaults to now
}

/**
 * Bulk touch — called from bulk-reminder service (§3.5).
 */
export interface TouchLastContactedManyInput {
  businessId: string
  partyIds: string[]
  touchedAt?: Date
}

// ─── Re-export Party (consumer convenience) ────────────────────────────────
export type { Party }
