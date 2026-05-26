/**
 * Phase 7 Slice 7.1A FE.5 — Commit mutation hook.
 *
 * Wraps `commitImportJob` in a TanStack mutation. The hook:
 *   - reads the commit token stashed at upload time,
 *   - generates a fresh `idempotencyKey` per call (replay-safe),
 *   - converts the FE `DedupResolutionMap` into the wire array shape,
 *   - invalidates the polling query on success so the orchestrator
 *     transitions from "committing" to the COMMITTED/PARTIALLY_COMMITTED
 *     result view as soon as the next poll lands.
 *
 * Offline behaviour: the commit service passes `offlineQueue: false`
 * (M3 four-field bind in BE makes queueing unsafe). If the network is
 * down the mutation just errors — handler shows a toast and lets the
 * user retry once online.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { commitImportJob } from '../services/import.service'
import { IMPORT_JOB_POLL_KEY } from './useImportJobPolling'
import { readCommitToken } from '../utils/commit-token-store'
import type {
  CommitBlockedProductDetail,
  CommitImportRes,
} from '../types/import.types'
import type { CommitBlockedInvoiceDetail } from '../types/payment.types'
import type { DedupResolutionMap } from '../types/dedup.types'

export interface UseImportCommitArgs {
  jobId: string
  onSuccess?: (res: CommitImportRes) => void
  onError?: (err: unknown) => void
}

export class MissingCommitTokenError extends Error {
  constructor() {
    super('Commit token missing — upload session lost')
    this.name = 'MissingCommitTokenError'
  }
}

/**
 * Best-effort extractor for the 409 `COMMIT_BLOCKED_PRODUCT_NOT_FOUND`
 * detail payload. BE wraps the `AppError.details` object as
 * `ApiError.detail` (see src/lib/api.ts 409 handler — entire `error`
 * object is forwarded). Returns null when the error is not the
 * commit-blocked sentinel.
 */
export function readCommitBlockedDetail(
  err: unknown,
): CommitBlockedProductDetail | null {
  if (!(err instanceof ApiError)) return null
  if (err.status !== 409) return null
  if (err.code !== 'COMMIT_BLOCKED_PRODUCT_NOT_FOUND') return null
  const raw = err.detail as
    | { details?: Partial<CommitBlockedProductDetail>; items?: unknown }
    | undefined
  // BE shape: `{ code, message, details: { blockedRowCount, missingSkuSample } }`.
  // The api wrapper passes the whole `error` object as `detail`.
  const details = (raw?.details ?? raw) as
    | Partial<CommitBlockedProductDetail>
    | undefined
  const sample = Array.isArray(details?.missingSkuSample)
    ? details!.missingSkuSample.filter((s): s is string => typeof s === 'string')
    : []
  const blocked =
    typeof details?.blockedRowCount === 'number' ? details.blockedRowCount : 0
  return { blockedRowCount: blocked, missingSkuSample: sample }
}

/**
 * 7.1D — sibling of {@link readCommitBlockedDetail} for the
 * `COMMIT_BLOCKED_INVOICE_NOT_FOUND` sentinel surfaced by payment imports.
 * Returns null when the error is not that specific 409.
 */
export function readCommitBlockedInvoiceDetail(
  err: unknown,
): CommitBlockedInvoiceDetail | null {
  if (!(err instanceof ApiError)) return null
  if (err.status !== 409) return null
  if (err.code !== 'COMMIT_BLOCKED_INVOICE_NOT_FOUND') return null
  const raw = err.detail as
    | { details?: Partial<CommitBlockedInvoiceDetail>; items?: unknown }
    | undefined
  const details = (raw?.details ?? raw) as
    | Partial<CommitBlockedInvoiceDetail>
    | undefined
  const sample = Array.isArray(details?.missingInvoiceSample)
    ? details!.missingInvoiceSample.filter((s): s is string => typeof s === 'string')
    : []
  const blocked =
    typeof details?.blockedRowCount === 'number' ? details.blockedRowCount : 0
  return { blockedRowCount: blocked, missingInvoiceSample: sample }
}

/** True iff BE returned 426 UPGRADE_REQUIRED (client-version floor missed). */
export function isClientVersionUpgrade(err: unknown): boolean {
  return err instanceof ApiError && err.status === 426
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function toWire(map: DedupResolutionMap) {
  const out: Array<{ rowId: string; decision: 'SKIP' | 'OVERWRITE' | 'CREATE_NEW' }> = []
  for (const rowId of Object.keys(map)) {
    const decision = map[rowId]
    if (decision) out.push({ rowId, decision })
  }
  return out
}

export function useImportCommit(args: UseImportCommitArgs) {
  const { jobId, onSuccess, onError } = args
  const qc = useQueryClient()

  const mutation = useMutation<CommitImportRes, unknown, DedupResolutionMap>({
    mutationFn: async (resolutions) => {
      const token = readCommitToken(jobId)
      if (!token) throw new MissingCommitTokenError()
      const wire = toWire(resolutions)
      return commitImportJob(jobId, {
        commitToken: token,
        idempotencyKey: newIdempotencyKey(),
        dedupResolutions: wire.length > 0 ? wire : undefined,
      })
    },
    onSuccess: (res) => {
      // Force a fresh poll so the job status flips to
      // COMMITTED / PARTIALLY_COMMITTED in the orchestrator view.
      void qc.invalidateQueries({ queryKey: IMPORT_JOB_POLL_KEY(jobId) })
      onSuccess?.(res)
    },
    onError: (err) => {
      onError?.(err)
    },
  })

  return {
    commit: mutation.mutate,
    commitAsync: mutation.mutateAsync,
    isCommitting: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  }
}
