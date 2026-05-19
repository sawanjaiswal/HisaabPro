/**
 * Phase 7 Slice 7.1A FE.4 — Dedup resolution types.
 *
 * The per-row decision the user makes for each DUPLICATE_EXACT /
 * DUPLICATE_NEAR row in the preview. Consumed by FE.5, which will POST
 * these to the commit endpoint once the server adds support (current BE
 * commit service skips duplicate rows by status, so resolutions are
 * staged client-side only — see commit notes for the deviation).
 */

/** Decision values match the BE `DEDUP_ACTIONS` constant on purpose. */
export type DedupDecision = 'SKIP' | 'OVERWRITE' | 'CREATE_NEW'

/** Keyed by `ImportPreviewRow.id` (Prisma row id — stable across reloads). */
export type DedupResolutionMap = Record<string, DedupDecision>

/** Cohort summary for the footer counts. */
export interface DedupCounts {
  skip: number
  overwrite: number
  createNew: number
  total: number
}

/**
 * Match-meta extracted from a DUPLICATE row for display. We only have
 * `matchedPartyId` on the BE row (see ARCH §3 PreviewRow). For NEAR rows
 * the existing-party name is recoverable from `issues[0].message`
 * (server emits `Possibly matches existing party <name>`); for EXACT
 * rows we only carry the id and let the UI fall back to a generic label.
 */
export interface DedupMatchMeta {
  matchedPartyId: string
  matchedPartyName: string | null
  matchType: 'EXACT' | 'NEAR'
}
