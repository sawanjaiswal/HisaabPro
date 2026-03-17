/** useChartOfAccounts — Fetches and groups accounts by type */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { getAccounts, seedDefaultAccounts } from './accounting.service'
import { groupAccountsByType } from './accounting.utils'
import type { LedgerAccount, AccountType } from './accounting.types'

type Status = 'loading' | 'error' | 'success'

interface UseChartOfAccountsReturn {
  grouped: Map<AccountType, LedgerAccount[]>
  total: number
  status: Status
  isSeedingLoading: boolean
  refresh: () => void
  handleSeed: () => Promise<void>
}

export function useChartOfAccounts(): UseChartOfAccountsReturn {
  const toast = useToast()
  const [status, setStatus] = useState<Status>('loading')
  const [accounts, setAccounts] = useState<LedgerAccount[]>([])
  const [total, setTotal] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isSeedingLoading, setIsSeedingLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    getAccounts(1, 200, controller.signal)
      .then((res) => {
        setAccounts(res.items)
        setTotal(res.total)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load accounts'
        toast.error(message)
      })

    return () => controller.abort()
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const handleSeed = useCallback(async () => {
    setIsSeedingLoading(true)
    try {
      await seedDefaultAccounts()
      toast.success('Default accounts created')
      setRefreshKey((k) => k + 1)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to seed accounts'
      toast.error(message)
    } finally {
      setIsSeedingLoading(false)
    }
  }, [toast])

  return {
    grouped: groupAccountsByType(accounts),
    total,
    status,
    isSeedingLoading,
    refresh,
    handleSeed,
  }
}
