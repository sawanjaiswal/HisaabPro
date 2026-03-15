/** Settings — App settings hook
 *
 * Fetches per-user app settings and exposes an optimistic updateSetting.
 * On API failure the optimistic update is rolled back.
 * userId comes from useAuth() since AppSettings are user-scoped.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { DEFAULT_APP_SETTINGS } from './settings.constants'
import { getAppSettings, updateAppSettings } from './settings.service'
import type { AppSettings } from './settings.types'

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

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!user) return

    const controller = new AbortController()
    setStatus('loading')

    getAppSettings(user.id, controller.signal)
      .then((response) => {
        setSettings(response.data)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load settings'
        toast.error(message)
      })

    return () => controller.abort()
  }, [user, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const updateSetting = useCallback(<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => {
    if (!user) return

    // Optimistic update
    const previous = settings[key]
    setSettings((prev) => ({ ...prev, [key]: value }))

    updateAppSettings(user.id, { [key]: value })
      .catch((err: unknown) => {
        // Roll back on failure
        setSettings((prev) => ({ ...prev, [key]: previous }))
        const message = err instanceof ApiError ? err.message : 'Failed to save setting'
        toast.error(message)
      })
  }, [user, settings, toast])

  return { settings, status, updateSetting, refresh }
}
