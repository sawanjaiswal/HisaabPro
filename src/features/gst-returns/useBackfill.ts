/**
 * GST Backfill — TanStack Query hooks
 *
 * useBackfillPreview   — query (no cache)
 * useBackfillExecute  — mutation (tolerates {} optimistic return)
 * useBackfillStatus   — polling query (2 s while RUNNING)
 * useGstBackfillInvalidate — Done button cleanup
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { previewBackfill, executeBackfill, getBackfillStatus } from './gst-returns.service'
import type { BackfillExecutePayload } from './gst-returns.types'

export const BACKFILL_PREVIEW_KEY = ['gst', 'backfill', 'preview'] as const

export const BACKFILL_STATUS_KEY = (jobId: string) =>
  ['gst', 'backfill', 'status', jobId] as const

// ─── Preview ──────────────────────────────────────────────────────────────────

export function useBackfillPreview() {
  return useQuery({
    queryKey: BACKFILL_PREVIEW_KEY,
    queryFn: () => previewBackfill(),
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  })
}

// ─── Execute ──────────────────────────────────────────────────────────────────

export function useBackfillExecute() {
  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: BackfillExecutePayload
      idempotencyKey: string
    }) => executeBackfill(payload, idempotencyKey),
  })
}

// ─── Status polling ───────────────────────────────────────────────────────────

export function useBackfillStatus(jobId: string | null) {
  return useQuery({
    queryKey: BACKFILL_STATUS_KEY(jobId ?? ''),
    queryFn: () => getBackfillStatus(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) =>
      query.state.data?.status === 'RUNNING' ? 2000 : false,
    staleTime: 0,
  })
}

// ─── Invalidate on Done ───────────────────────────────────────────────────────

export function useGstBackfillInvalidate() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['tax'] })
    queryClient.invalidateQueries({ queryKey: BACKFILL_PREVIEW_KEY })
  }
}
