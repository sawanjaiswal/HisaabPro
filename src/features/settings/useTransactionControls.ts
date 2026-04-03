/** Settings — Transaction controls hook (TanStack Query)
 *
 * Fetches and debounce-saves transaction lock config.
 * Optimistic local state with debounced mutation for snappy UX.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { DEFAULT_TRANSACTION_LOCK_CONFIG } from './settings.constants'
import { getTransactionLockConfig, updateTransactionLockConfig } from './security.service'
import type { TransactionLockConfig } from './settings.types'

const DEBOUNCE_MS = 500

export function useTransactionControls() {
  const { user } = useAuth()
  const businessId = user?.businessId ?? ''
  const toast = useToast()
  const queryClient = useQueryClient()

  // Local state for optimistic UI
  const [localConfig, setLocalConfig] = useState<TransactionLockConfig | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const query = useQuery({
    queryKey: queryKeys.settings.transactionControls(),
    queryFn: ({ signal }) => getTransactionLockConfig(businessId, signal),
    enabled: !!businessId,
  })

  // Sync server data to local state when fetched (only if no local override active)
  useEffect(() => {
    if (query.data && localConfig === null) {
      setLocalConfig(query.data.data)
    }
  }, [query.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const config = localConfig ?? query.data?.data ?? DEFAULT_TRANSACTION_LOCK_CONFIG
  const status: 'loading' | 'error' | 'success' = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  // Show toast on fetch error
  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load settings'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    setLocalConfig(null)
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.transactionControls() })
  }, [queryClient])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (updated: TransactionLockConfig) =>
      updateTransactionLockConfig(businessId, updated),
    onSuccess: () => {
      toast.success('Settings saved')
    },
    onError: (err: Error) => {
      const message = err instanceof ApiError ? err.message : 'Failed to save settings'
      toast.error(message)
    },
  })

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const updateField = useCallback(<K extends keyof TransactionLockConfig>(
    key: K,
    value: TransactionLockConfig[K],
  ) => {
    setLocalConfig((prev) => {
      const base = prev ?? DEFAULT_TRANSACTION_LOCK_CONFIG
      const updated = { ...base, [key]: value }

      // Debounced save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveMutation.mutate(updated)
      }, DEBOUNCE_MS)

      return updated
    })
  }, [saveMutation])

  return { config, status, refresh, updateField }
}
