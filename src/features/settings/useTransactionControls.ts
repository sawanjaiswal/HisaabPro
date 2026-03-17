import { useState, useEffect, useRef, useCallback } from 'react'
import { FALLBACK_BUSINESS_ID } from '@/config/app.config'
import { useAuth } from '@/context/AuthContext'
import { getTransactionLockConfig, updateTransactionLockConfig } from './security.service'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { DEFAULT_TRANSACTION_LOCK_CONFIG } from './settings.constants'
import type { TransactionLockConfig } from './settings.types'

const DEBOUNCE_MS = 500

export function useTransactionControls() {
  const { user } = useAuth()
  const businessId = user?.businessId ?? FALLBACK_BUSINESS_ID
  const toast = useToast()

  const [config, setConfig] = useState<TransactionLockConfig>(DEFAULT_TRANSACTION_LOCK_CONFIG)
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading')
  const [refreshKey, setRefreshKey] = useState(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    getTransactionLockConfig(businessId, controller.signal)
      .then((res) => {
        setConfig(res.data)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load settings'
        toast.error(message)
      })

    return () => controller.abort()
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const debouncedSave = useCallback((updated: TransactionLockConfig) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(() => {
      updateTransactionLockConfig(businessId, updated)
        .then(() => toast.success('Settings saved'))
        .catch((err: unknown) => {
          const message = err instanceof ApiError ? err.message : 'Failed to save settings'
          toast.error(message)
        })
    }, DEBOUNCE_MS)
  }, [toast]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const updateField = useCallback(<K extends keyof TransactionLockConfig>(
    key: K,
    value: TransactionLockConfig[K],
  ) => {
    setConfig((prev) => {
      const updated = { ...prev, [key]: value }
      debouncedSave(updated)
      return updated
    })
  }, [debouncedSave])

  return { config, status, refresh, updateField }
}
