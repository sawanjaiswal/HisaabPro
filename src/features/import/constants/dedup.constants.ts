/**
 * Phase 7 Slice 7.1A FE.4 — Dedup defaults.
 *
 * Defaults are intentionally conservative:
 *   - EXACT match (phone or GSTIN already exists) → SKIP. Phone/GSTIN
 *     collisions are almost always the same business, so creating a new
 *     party would generate a phone-uniqueness conflict downstream.
 *   - NEAR match (fuzzy name match in same phone-suffix bucket) → CREATE_NEW.
 *     Levenshtein near-hits are noisy enough that surfacing them as a
 *     "create new but please double-check" default fits the data we see.
 */

import type { DedupDecision } from '../types/dedup.types'

/** Map a match-type to its default per-row decision. */
export const DEFAULT_BY_MATCH_TYPE: Record<'EXACT' | 'NEAR', DedupDecision> = {
  EXACT: 'SKIP',
  NEAR: 'CREATE_NEW',
}

/** Ordered list for radio rendering. Keep alphabetical-by-effect order. */
export const DEDUP_DECISIONS: ReadonlyArray<DedupDecision> = [
  'SKIP',
  'OVERWRITE',
  'CREATE_NEW',
] as const
