/** usePayroll — Phase 6 PR6 FE
 *
 * Three hooks:
 *   - usePayrollPreview(req)    — fetch-on-demand preview (manual trigger
 *                                  via `enabled` flag flipped by wizard).
 *   - usePayrollMutations()     — finalize / reverse with idempotency keys.
 *   - usePayslipSnapshot(id)    — single immutable snapshot for PDF/share.
 *
 * Preview uses `useQuery` with `enabled: false` semantics: the wizard's
 * "Preview" CTA calls `query.refetch()` so the user controls when the rate-
 * limited compute fires. We do NOT preview on every keystroke — at 10/min
 * the BE caps the budget and a typo would burn through it fast.
 *
 * Finalize / reverse tolerate the offline queue's optimistic `{}` return:
 * the `onSuccess` callback never derefs `result.payrollRunId` blindly;
 * the wizard navigates to the run-detail page only when `navigator.onLine`
 * (queued mutations show a toast and stay on the wizard).
 *
 * Error mapping (finalize):
 *   409 PAYROLL_PERIOD_OVERLAP → "Period already finalized" toast
 *   400 NO_PAYABLE_LINES       → "No employees to pay in this period"
 *   429 (preview rate limit)   → "Too many previews — wait a minute"
 *
 * Error mapping (reverse):
 *   409 PAYROLL_ALREADY_REVERSED / PAYMENT_ALREADY_REVERSED
 *                              → "Already reversed" toast (one user msg, two BE codes)
 */

import { useCallback } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import {
  finalizePayroll,
  getPayslipSnapshot,
  previewPayroll,
  reversePayroll,
} from './payroll.service'
import { idempotencyKey } from './hr.constants'
import type {
  PayrollFinalizeRequest,
  PayrollFinalizeResult,
  PayrollPreviewRequest,
  PayrollReverseResult,
  PayslipSnapshotResponse,
} from './payroll.types'

// ─── Query keys ──────────────────────────────────────────────────────────────

export const payrollKeys = {
  all:      () => ['payroll'] as const,
  preview:  (req: PayrollPreviewRequest) =>
    ['payroll', 'preview', req.fromDate, req.toDate, (req.employeeIds ?? []).join(',')] as const,
  snapshot: (payrollId: string) => ['payroll', 'snapshot', payrollId] as const,
}

// ─── usePayrollPreview ───────────────────────────────────────────────────────

/**
 * Manually-triggered preview. The wizard flips `enabled` to true on the
 * "Preview" CTA; React Query handles caching keyed by (from, to, ids).
 *
 * `staleTime: 30_000` so revisiting the wizard within 30s shows the cached
 * preview instantly (the period hasn't changed underneath us in 30s).
 */
export function usePayrollPreview(req: PayrollPreviewRequest, enabled: boolean) {
  const query = useQuery({
    queryKey: payrollKeys.preview(req),
    queryFn: ({ signal }) => previewPayroll(req, signal),
    enabled,
    staleTime: 30_000,
    retry: (failureCount, err) => {
      // Don't retry rate-limit 429 — wait it out.
      if (err instanceof ApiError && err.status === 429) return false
      return failureCount < 2
    },
  })

  const status: 'loading' | 'error' | 'success' | 'idle' =
    !enabled ? 'idle'
    : query.isPending ? 'loading'
    : query.isError ? 'error'
    : 'success'

  return {
    preview: query.data ?? null,
    status,
    error: query.error,
    refetch: query.refetch,
  }
}

// ─── usePayrollMutations ─────────────────────────────────────────────────────

export function usePayrollMutations() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useLanguage()

  const finalize = useMutation({
    mutationFn: (body: PayrollFinalizeRequest): Promise<PayrollFinalizeResult> =>
      finalizePayroll(body, idempotencyKey()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: payrollKeys.all() })
      const msg = navigator.onLine
        ? (t.payrollFinalizedToast as string)
        : `${t.payrollFinalizedToast} — ${t.willSyncWhenOnlineSuffix}`
      toast.success(msg)
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.status === 409 && err.code === 'PAYROLL_PERIOD_OVERLAP') {
          toast.error(t.payrollPeriodOverlapToast as string)
          return
        }
        if (err.status === 400 && err.message.includes('NO_PAYABLE_LINES')) {
          toast.error(t.payrollNoPayableLinesToast as string)
          return
        }
        toast.error(err.message)
        return
      }
      toast.error(t.payrollFinalizeErrorToast as string)
    },
  })

  const reverse = useMutation({
    mutationFn: (payrollRunId: string): Promise<PayrollReverseResult> =>
      reversePayroll(payrollRunId, idempotencyKey()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: payrollKeys.all() })
      const msg = navigator.onLine
        ? (t.payrollReversedToast as string)
        : `${t.payrollReversedToast} — ${t.willSyncWhenOnlineSuffix}`
      toast.success(msg)
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 409) {
        // Both BE codes mean the same to the user.
        toast.error(t.payrollAlreadyReversedToast as string)
        return
      }
      const msg = err instanceof ApiError ? err.message : (t.payrollReverseErrorToast as string)
      toast.error(msg)
    },
  })

  return { finalize, reverse }
}

// ─── usePayslipSnapshot ──────────────────────────────────────────────────────

export function usePayslipSnapshot(payrollId: string | undefined) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: payrollKeys.snapshot(payrollId ?? '_missing'),
    queryFn: ({ signal }): Promise<PayslipSnapshotResponse> => {
      if (!payrollId) throw new Error('payrollId is required')
      return getPayslipSnapshot(payrollId, signal)
    },
    enabled: Boolean(payrollId),
    staleTime: Infinity, // snapshot is immutable by design — never stale
  })

  const refresh = useCallback(() => {
    if (payrollId) {
      void queryClient.invalidateQueries({ queryKey: payrollKeys.snapshot(payrollId) })
    }
  }, [queryClient, payrollId])

  const status: 'loading' | 'error' | 'success' =
    query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  return {
    data: query.data ?? null,
    status,
    error: query.error,
    refresh,
    notFound: query.error instanceof ApiError && query.error.status === 404,
  }
}
