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
import { commitImportJob } from '../services/import.service'
import { IMPORT_JOB_POLL_KEY } from './useImportJobPolling'
import { readCommitToken } from '../utils/commit-token-store'
import type { CommitImportRes } from '../types/import.types'
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
