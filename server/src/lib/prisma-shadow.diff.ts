/**
 * Id extraction and symmetric difference (File #4, ARCHITECTURE §5, §9.3).
 *
 * Pure: no DB, no ALS, no clock. Takes both result sets, returns a diff. That
 * purity is what lets this suite run with no database at all.
 *
 * Two different caps live here and they are NOT interchangeable:
 *   SHADOW_MAX_ROWS — comparison ceiling (FM-7). Above it, compare counts only.
 *   SHADOW_MAX_IDS  — persistence cap (B-6). How many ids are durably stored.
 * Rev 2 lost the second one between documents, leaving the id arrays uncapped.
 */
import { SHADOW_MAX_IDS, SHADOW_MAX_ROWS } from './prisma-shadow.constants.js'
import type { ShadowDiff } from './prisma-shadow.types.js'

/** A Prisma result: one row, an array of rows, or null from a findFirst. */
type ResultSet = unknown

const EMPTY: ShadowDiff = {
  onlyUnscoped: [],
  onlyScoped: [],
  unscopedCount: 0,
  scopedCount: 0,
  truncated: false,
  unsupportedShape: false,
}

/** Normalise any read result to an array of rows. `null` ⇒ no rows. */
function toRows(result: ResultSet): unknown[] {
  if (result === null || result === undefined) return []
  return Array.isArray(result) ? result : [result]
}

/**
 * Pull `id` off each row. Returns null if ANY row lacks a usable string id —
 * the caller then records `unsupported-shape` rather than a false clean, since
 * a `select` that omitted `id` would otherwise diff two empty sets and look
 * identical to a genuinely non-divergent read.
 */
function extractIds(rows: unknown[]): string[] | null {
  const ids: string[] = []
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) return null
    const id = (row as { id?: unknown }).id
    if (typeof id !== 'string') return null
    ids.push(id)
  }
  return ids
}

/** Cap an id array for persistence, reporting whether the cap bit. */
function capIds(ids: string[]): { ids: string[]; truncated: boolean } {
  return ids.length > SHADOW_MAX_IDS
    ? { ids: ids.slice(0, SHADOW_MAX_IDS), truncated: true }
    : { ids, truncated: false }
}

export function diffIds(unscoped: ResultSet, scoped: ResultSet): ShadowDiff {
  const unscopedRows = toRows(unscoped)
  const scopedRows = toRows(scoped)

  if (unscopedRows.length === 0 && scopedRows.length === 0) return EMPTY

  // FM-7: enormous result sets are compared by magnitude only. A count-only
  // comparison still detects a whole-tenant divergence, which is the shape that
  // matters most, without materialising two huge id sets on every sampled read.
  if (unscopedRows.length > SHADOW_MAX_ROWS || scopedRows.length > SHADOW_MAX_ROWS) {
    return {
      onlyUnscoped: [],
      onlyScoped: [],
      unscopedCount: unscopedRows.length,
      scopedCount: scopedRows.length,
      truncated: true,
      unsupportedShape: false,
    }
  }

  const unscopedIds = extractIds(unscopedRows)
  const scopedIds = extractIds(scopedRows)

  if (unscopedIds === null || scopedIds === null) {
    return {
      onlyUnscoped: [],
      onlyScoped: [],
      unscopedCount: unscopedRows.length,
      scopedCount: scopedRows.length,
      truncated: false,
      unsupportedShape: true,
    }
  }

  const scopedSet = new Set(scopedIds)
  const unscopedSet = new Set(unscopedIds)

  const onlyUnscoped = capIds(unscopedIds.filter((id) => !scopedSet.has(id)))
  const onlyScoped = capIds(scopedIds.filter((id) => !unscopedSet.has(id)))

  return {
    onlyUnscoped: onlyUnscoped.ids,
    onlyScoped: onlyScoped.ids,
    unscopedCount: unscopedRows.length,
    scopedCount: scopedRows.length,
    truncated: onlyUnscoped.truncated || onlyScoped.truncated,
    unsupportedShape: false,
  }
}
