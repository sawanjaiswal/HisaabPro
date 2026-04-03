/** Settings — App settings hook (TanStack Query)
 *
 * Fetches per-user app settings and exposes an optimistic updateSetting.
 * On API failure the optimistic update is rolled back.
 * userId comes from useAuth() since AppSettings are user-scoped.
 */

import { useEffect, useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { DEFAULT_APP_SETTINGS } from './settings.constants'
import { getAppSettings, updateAppSettings } from './app-settings.service'
import type { AppSettings, AppSettingsResponse } from './settings.types'

type Status = 'loading' | 'error' | 'success'

interface UseAppSettingsReturn {
  settings: AppSettings
  status: Status
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  refresh: () => void
}

export function useAppSettings(): UseAppSettingsReturn {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.settings.app(),
    queryFn: ({ signal }) => getAppSettings(user!.id, signal),
    enabled: !!user,
  })

  const settings = query.data?.data ?? DEFAULT_APP_SETTINGS
  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  // Show toast on fetch error
  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load settings'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.app() })
  }, [queryClient])

  // Optimistic update mutation
  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: keyof AppSettings; value: AppSettings[keyof AppSettings] }) =>
      updateAppSettings(user!.id, { [key]: value }),
    onMutate: async ({ key, value }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.settings.app() })

      // Snapshot previous value
      const previous = queryClient.getQueryData<AppSettingsResponse>(queryKeys.settings.app())

      // Optimistic update
      queryClient.setQueryData<AppSettingsResponse>(queryKeys.settings.app(), (old) => {
        if (!old) return old
        return { ...old, data: { ...old.data, [key]: value } }
      })

      return { previous }
    },
    onError: (err: Error, _vars, context) => {
      // Roll back on failure
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.settings.app(), context.previous)
      }
      const message = err instanceof ApiError ? err.message : 'Failed to save setting'
      toast.error(message)
    },
  })

  const updateSetting = useCallback(<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => {
    if (!user) return
    updateMutation.mutate({ key, value })
  }, [user, updateMutation])

  return { settings, status, updateSetting, refresh }
}
