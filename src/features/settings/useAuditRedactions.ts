/** Settings — Audit redactions hook (Phase 6 PR4)
 *
 * Manages the per-business list of {entityType, fieldPath} redactions used
 * by the audit-search read path. Server returns redacted fields as the
 * sentinel `{ __redacted: true }` inside `AuditSearchRow.changes`.
 *
 * All three operations are PinGated server-side (mutation routeClass for
 * upsert/disable, read-only for list); PR3's `api()` 403 interceptor
 * transparently retries after PIN verify.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import {
  listRedactions,
  upsertRedaction,
  disableRedaction,
} from './audit-log.service'
import type { Redaction, RedactionUpsertInput } from './audit.types'

const REDACTIONS_KEY = [...queryKeys.settings.all(), 'redactions'] as const

type Status = 'loading' | 'error' | 'success'

interface UseAuditRedactionsReturn {
  items: Redaction[]
  status: Status
  /** Saved at least once — used to render the empty-state vs. list */
  hasLoaded: boolean
  addOrUpdate: (input: RedactionUpsertInput) => Promise<void>
  disable: (id: string, label?: string) => Promise<void>
  /** True while either the add or disable mutation is in flight */
  isSaving: boolean
  refresh: () => void
}

export function useAuditRedactions(): UseAuditRedactionsReturn {
  const toast = useToast()
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: REDACTIONS_KEY,
    queryFn: ({ signal }) => listRedactions(signal),
  })

  // Toast on load error — dedupe by error identity (React Query keeps stable refs)
  const lastErrorRef = useRef<unknown>(null)
  useEffect(() => {
    if (!query.error) {
      lastErrorRef.current = null
      return
    }
    if (lastErrorRef.current === query.error) return
    lastErrorRef.current = query.error
    const message = query.error instanceof ApiError
      ? query.error.message
      : t.auditLoadError
    toast.error(message)
  }, [query.error, t.auditLoadError, toast])

  const items = query.data?.items ?? []
  const status: Status = (() => {
    if (query.isPending) return 'loading'
    if (query.isError) return 'error'
    return 'success'
  })()

  const upsertMutation = useMutation({
    mutationFn: (input: RedactionUpsertInput) => upsertRedaction(input),
    onSuccess: () => {
      // Optimistic invalidation — tolerate the api()'s offline {} return
      queryClient.invalidateQueries({ queryKey: REDACTIONS_KEY })
      // Also invalidate the audit search since changes now apply at read-time
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.auditLog({}) })
    },
  })

  const disableMutation = useMutation({
    mutationFn: ({ id, label }: { id: string; label?: string }) =>
      disableRedaction(id, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REDACTIONS_KEY })
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.auditLog({}) })
    },
  })

  const addOrUpdate = useCallback(async (input: RedactionUpsertInput) => {
    try {
      await upsertMutation.mutateAsync(input)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t.auditLoadError
      toast.error(message)
      throw err
    }
  }, [upsertMutation, toast, t.auditLoadError])

  const disable = useCallback(async (id: string, label?: string) => {
    try {
      await disableMutation.mutateAsync({ id, label })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t.auditLoadError
      toast.error(message)
      throw err
    }
  }, [disableMutation, toast, t.auditLoadError])

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: REDACTIONS_KEY })
  }, [queryClient])

  return {
    items,
    status,
    hasLoaded: query.isSuccess,
    addOrUpdate,
    disable,
    isSaving: upsertMutation.isPending || disableMutation.isPending,
    refresh,
  }
}
