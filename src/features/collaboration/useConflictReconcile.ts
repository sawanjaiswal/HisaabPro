// #150 useConflictReconcile — wraps a save so a 409 CONFLICT opens a
// reconcile dialog instead of a generic error toast. The user can reload
// (discard local edits, refetch server truth) or overwrite (re-save with the
// server's current version — succeeds because it now matches the lock).
import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { CONFLICT_CODE } from './collaboration.constants'
import type { ConflictInfo } from './collaboration.types'

interface ConflictState extends ConflictInfo {
  retry: (versionOverride: number) => Promise<void>
}

export function isConflictError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.code === CONFLICT_CODE && err.status === 409
}

export function getConflictInfo(err: ApiError): ConflictInfo {
  const detail = err.detail as { details?: ConflictInfo } | undefined
  return detail?.details ?? {}
}

export function useConflictReconcile() {
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const [overwriting, setOverwriting] = useState(false)
  const queryClient = useQueryClient()

  /**
   * Run `save(version?)`. `save` must forward `version` to api()'s
   * `entityVersion` option. On CONFLICT the dialog opens; other errors rethrow.
   */
  const withConflictGuard = useCallback(async (save: (version?: number) => Promise<void>) => {
    try {
      await save()
    } catch (err) {
      if (isConflictError(err)) {
        const info = getConflictInfo(err)
        setConflict({
          ...info,
          retry: async (versionOverride) => {
            await save(versionOverride)
            setConflict(null)
          },
        })
        return
      }
      throw err
    }
  }, [])

  const dismiss = useCallback(() => setConflict(null), [])

  const reload = useCallback(() => {
    void queryClient.invalidateQueries()
    setConflict(null)
  }, [queryClient])

  const overwrite = useCallback(async () => {
    if (!conflict || conflict.serverVersion === undefined) return
    setOverwriting(true)
    try {
      await conflict.retry(conflict.serverVersion)
    } finally {
      setOverwriting(false)
    }
  }, [conflict])

  return { conflict, overwriting, withConflictGuard, dismiss, reload, overwrite }
}
