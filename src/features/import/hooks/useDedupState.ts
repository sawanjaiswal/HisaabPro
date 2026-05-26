/**
 * Phase 7 Slice 7.1A FE.4 — Dedup resolution state machine.
 *
 * Owns the per-row decision map for a set of DUPLICATE_EXACT /
 * DUPLICATE_NEAR rows. Init seeds defaults from each row's match type
 * (see `DEFAULT_BY_MATCH_TYPE`). Exposes setOne / setAll + a memoized
 * counts summary for the footer chips.
 *
 * Owning the map by stable row.id (Prisma id) means the user can
 * paginate / re-filter without losing their choices.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_BY_MATCH_TYPE } from '../constants/dedup.constants'
import type {
  DedupCounts,
  DedupDecision,
  DedupMatchMeta,
  DedupResolutionMap,
} from '../types/dedup.types'
import type { ImportPreviewRow } from '../types/import.types'

/** One row + its extracted match-meta. */
export interface DedupRowWithMeta {
  row: ImportPreviewRow
  match: DedupMatchMeta
}

/**
 * Server emits NEAR matches with an issue of shape
 *   { field: 'name', code: 'NEAR_DUPLICATE',
 *     message: 'Possibly matches existing party <name>' }
 * — recover the name from that message for display. EXACT rows have no
 * such marker; fall back to a null name and let the UI generic-label.
 */
function extractMatchName(row: ImportPreviewRow): string | null {
  if (!Array.isArray(row.issues)) return null
  for (const issue of row.issues) {
    if (
      issue &&
      typeof issue === 'object' &&
      (issue as { code?: unknown }).code === 'NEAR_DUPLICATE'
    ) {
      const msg = (issue as { message?: unknown }).message
      if (typeof msg !== 'string') return null
      const m = msg.match(/existing party\s+(.+)$/i)
      return m ? m[1]!.trim() : null
    }
  }
  return null
}

/** Build a `DedupRowWithMeta` from a single DUPLICATE row. */
export function toMatchMeta(row: ImportPreviewRow): DedupRowWithMeta | null {
  if (!row.matchedPartyId) return null
  const matchType: 'EXACT' | 'NEAR' =
    row.status === 'DUPLICATE_EXACT' ? 'EXACT' : 'NEAR'
  return {
    row,
    match: {
      matchedPartyId: row.matchedPartyId,
      matchedPartyName: extractMatchName(row),
      matchType,
    },
  }
}

export interface UseDedupStateArgs {
  rows: ImportPreviewRow[]
  /** Optional seed from an earlier visit (back-navigation). */
  initial?: DedupResolutionMap
}

export interface UseDedupStateResult {
  /** Rows pruned to DUPLICATE_* and decorated with match-meta. */
  dupRows: DedupRowWithMeta[]
  resolutions: DedupResolutionMap
  counts: DedupCounts
  setOne: (rowId: string, decision: DedupDecision) => void
  setAll: (decision: DedupDecision) => void
  reset: () => void
}

export function useDedupState({
  rows,
  initial,
}: UseDedupStateArgs): UseDedupStateResult {
  const dupRows = useMemo(() => {
    const out: DedupRowWithMeta[] = []
    for (const r of rows) {
      const meta = toMatchMeta(r)
      if (meta) out.push(meta)
    }
    return out
  }, [rows])

  const seed = useMemo<DedupResolutionMap>(() => {
    const base: DedupResolutionMap = {}
    for (const { row, match } of dupRows) {
      base[row.id] = initial?.[row.id] ?? DEFAULT_BY_MATCH_TYPE[match.matchType]
    }
    return base
    // initial is intentionally a one-shot seed; ignore subsequent identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dupRows])

  const [resolutions, setResolutions] = useState<DedupResolutionMap>(seed)

  // Keep state in sync if the set of rows grows (pagination append in
  // PreviewTable). Existing user choices are preserved.
  useEffect(() => {
    setResolutions((prev) => {
      let changed = false
      const next: DedupResolutionMap = { ...prev }
      for (const key of Object.keys(seed)) {
        if (next[key] === undefined) {
          next[key] = seed[key]!
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [seed])

  const setOne = useCallback((rowId: string, decision: DedupDecision) => {
    setResolutions((prev) => ({ ...prev, [rowId]: decision }))
  }, [])

  const setAll = useCallback(
    (decision: DedupDecision) => {
      setResolutions(() => {
        const next: DedupResolutionMap = {}
        for (const { row } of dupRows) next[row.id] = decision
        return next
      })
    },
    [dupRows],
  )

  const reset = useCallback(() => setResolutions(seed), [seed])

  const counts = useMemo<DedupCounts>(() => {
    let skip = 0
    let overwrite = 0
    let createNew = 0
    for (const { row } of dupRows) {
      const d = resolutions[row.id]
      if (d === 'SKIP') skip++
      else if (d === 'OVERWRITE') overwrite++
      else if (d === 'CREATE_NEW') createNew++
    }
    return { skip, overwrite, createNew, total: dupRows.length }
  }, [dupRows, resolutions])

  return { dupRows, resolutions, counts, setOne, setAll, reset }
}

