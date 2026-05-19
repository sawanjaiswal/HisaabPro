/**
 * Phase 7 Slice 7.1A FE.3 — Pure filter helpers for the preview table.
 *
 * The orchestrator fetches rows page-by-page from `GET /api/imports/:id`
 * (cursor pagination) and these helpers narrow the in-memory list to the
 * currently selected tab. Filters are pure so they're trivially memoised
 * by callers via `useMemo`.
 */

import type { ImportPreviewRow } from '../types/import.types'

/** Tab keys for `<PreviewFilters>`. */
export type PreviewFilterKey = 'all' | 'valid' | 'errors' | 'duplicates'

/** Server row status that maps to "valid / staged to commit". */
export const VALID_STATUSES: ReadonlySet<ImportPreviewRow['status']> = new Set([
  'STAGED',
  'WARNING',
])

/** Server row statuses that mean a hard validation failure. */
export const ERROR_STATUSES: ReadonlySet<ImportPreviewRow['status']> = new Set([
  'ERROR',
])

/** Server row statuses that mean a probable duplicate of an existing party. */
export const DUPLICATE_STATUSES: ReadonlySet<ImportPreviewRow['status']> = new Set([
  'DUPLICATE_EXACT',
  'DUPLICATE_NEAR',
])

export function isValidRow(row: ImportPreviewRow): boolean {
  return VALID_STATUSES.has(row.status)
}

export function isErrorRow(row: ImportPreviewRow): boolean {
  return ERROR_STATUSES.has(row.status)
}

export function isDuplicateRow(row: ImportPreviewRow): boolean {
  return DUPLICATE_STATUSES.has(row.status)
}

export function filterRows(
  rows: ImportPreviewRow[],
  key: PreviewFilterKey,
): ImportPreviewRow[] {
  switch (key) {
    case 'valid':
      return rows.filter(isValidRow)
    case 'errors':
      return rows.filter(isErrorRow)
    case 'duplicates':
      return rows.filter(isDuplicateRow)
    case 'all':
    default:
      return rows
  }
}

/**
 * RowIssue shape (mirrors server `RowIssue` in party-normalizer.ts) — the
 * BE serialises issues as `{ field, code, message }[]` for ERROR/WARNING
 * rows. Anything else (null, array of strings, foreign shape) is rendered
 * as a generic string by the table cell.
 */
export interface RowIssue {
  field: string
  code: string
  message: string
}

/** Best-effort first-error message extractor. */
export function firstIssueMessage(issues: unknown): string | null {
  if (!Array.isArray(issues) || issues.length === 0) return null
  const head = issues[0] as Partial<RowIssue> | string | null | undefined
  if (typeof head === 'string') return head
  if (head && typeof head === 'object' && typeof head.message === 'string') {
    return head.message
  }
  return null
}

/** Pull a normalised display name from `row.normalized.name` if present. */
export function readNormalizedName(row: ImportPreviewRow): string {
  const n = row.normalized?.name
  return typeof n === 'string' ? n : ''
}

/** Pull a normalised phone (string) from `row.normalized.phone` if present. */
export function readNormalizedPhone(row: ImportPreviewRow): string {
  const p = row.normalized?.phone
  return typeof p === 'string' ? p : ''
}

/**
 * Pull a balance in paise from `row.normalized.openingBalance` (server
 * party-normalizer field). Falls back to 0 if missing/non-numeric.
 */
export function readNormalizedBalancePaise(row: ImportPreviewRow): number {
  const b = row.normalized?.openingBalance
  return typeof b === 'number' && Number.isFinite(b) ? b : 0
}
