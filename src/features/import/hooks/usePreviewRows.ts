/**
 * Phase 7 Slice 7.1A FE.3 — Cursor-paginated preview rows accumulator.
 *
 * The orchestrator hands us the initial `ImportJobView` (from
 * `useImportJobPolling`) which already contains the first page of rows
 * + a `nextCursor`. This hook keeps that initial page in state, exposes
 * a `loadMore()` that fetches the next page via the existing service,
 * and appends the result while de-duping by row.id (defensive — server
 * is the source of truth on page boundaries).
 *
 * No raw fetch — all calls flow through `api()` inside `getImportJob`.
 */

import { useCallback, useEffect, useState } from 'react'
import { getImportJob } from '../services/import.service'
import type { ImportPreviewRow } from '../types/import.types'

interface UsePreviewRowsArgs {
  jobId: string
  /** Page-1 rows shipped by the polling query. */
  initialRows: ImportPreviewRow[]
  /** Page-1 cursor shipped by the polling query (null = end). */
  initialNextCursor: string | null
}

interface UsePreviewRowsResult {
  rows: ImportPreviewRow[]
  hasMore: boolean
  loading: boolean
  error: string | null
  loadMore: () => Promise<void>
}

export function usePreviewRows(args: UsePreviewRowsArgs): UsePreviewRowsResult {
  const { jobId, initialRows, initialNextCursor } = args

  const [rows, setRows] = useState<ImportPreviewRow[]>(initialRows)
  const [cursor, setCursor] = useState<string | null>(initialNextCursor)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset whenever the polling query re-emits a fresh page-1
  // (e.g. status flips PARSING → PREVIEWED and rows arrive).
  useEffect(() => {
    setRows(initialRows)
    setCursor(initialNextCursor)
    setError(null)
  }, [initialRows, initialNextCursor])

  const loadMore = useCallback(async () => {
    if (loading || !cursor) return
    setLoading(true)
    setError(null)
    try {
      // The service currently fetches the *first* page only. Append cursor
      // via a fresh call — this keeps the service shape simple and lets
      // each consumer decide how to paginate. (FE.3 ships local appending;
      // a future paginated service helper can land if more screens need it.)
      const next = await getImportJob(jobId, { cursor })
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        const merged = [...prev]
        for (const r of next.rows) {
          if (!seen.has(r.id)) merged.push(r)
        }
        return merged
      })
      setCursor(next.nextCursor)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load more rows')
    } finally {
      setLoading(false)
    }
  }, [cursor, jobId, loading])

  return {
    rows,
    hasMore: cursor !== null,
    loading,
    error,
    loadMore,
  }
}
