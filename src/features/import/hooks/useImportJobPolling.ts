/**
 * Phase 7 Slice 7.1A FE.2 — Poll GET /api/imports/:id every 2s while
 * `status === 'PARSING'`, stop on any terminal status.
 *
 * PII-safe: response carries normalized row data, so we do NOT pass
 * `cacheReads: true` in the service. TanStack Query holds it in memory
 * only (no IDB persistence).
 */

import { useQuery } from '@tanstack/react-query'
import { getImportJob } from '../services/import.service'
import type { ImportJobStatus, ImportJobView } from '../types/import.types'

export const IMPORT_JOB_POLL_KEY = (jobId: string) =>
  ['import', 'job', jobId] as const

/** Statuses that mean the orchestrator/parser is still working. */
export const ACTIVE_STATUSES: ReadonlySet<ImportJobStatus> = new Set([
  'UPLOADED',
  'PARSING',
])

/** Statuses where polling must stop (terminal or user-actionable). */
export const TERMINAL_STATUSES: ReadonlySet<ImportJobStatus> = new Set([
  'PREVIEWED',
  'COMMITTING',
  'COMMITTED',
  'PARTIALLY_COMMITTED',
  'FAILED',
  'CANCELLED',
])

export const POLL_INTERVAL_MS = 2000

export function useImportJobPolling(jobId: string | undefined) {
  return useQuery<ImportJobView>({
    queryKey: IMPORT_JOB_POLL_KEY(jobId ?? ''),
    queryFn: () => getImportJob(jobId!),
    enabled: Boolean(jobId),
    // Poll only while the parser is still active. Returning `false` stops
    // the timer; TanStack also honours `refetchIntervalInBackground: false`
    // by default so the tab can sleep without burning network on 2G.
    refetchInterval: (query) => {
      const status = query.state.data?.job.status
      if (!status) return POLL_INTERVAL_MS
      return ACTIVE_STATUSES.has(status) ? POLL_INTERVAL_MS : false
    },
    staleTime: 0,
    gcTime: 0,
    retry: 2,
  })
}
