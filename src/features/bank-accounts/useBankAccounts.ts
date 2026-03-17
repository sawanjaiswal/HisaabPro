/** useBankAccounts — Manages bank account list state
 *
 * AbortController cleanup prevents stale updates.
 * refreshKey forces re-fetch without changing deps.
 */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { listBankAccounts } from './bank-account.service'
import type { BankAccount } from './bank-account.types'

type Status = 'loading' | 'error' | 'success'

interface UseBankAccountsReturn {
  items: BankAccount[]
  total: number
  status: Status
  refresh: () => void
}

export function useBankAccounts(): UseBankAccountsReturn {
  const toast = useToast()
  const [items, setItems] = useState<BankAccount[]>([])
  const [total, setTotal] = useState(0)
  const [fetchStatus, setFetchStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setFetchStatus('loading')

    listBankAccounts(controller.signal)
      .then((res) => {
        setItems(res.items)
        setTotal(res.total)
        setFetchStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setFetchStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load bank accounts'
        toast.error(message)
      })

    return () => controller.abort()
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  return { items, total, status: fetchStatus, refresh }
}
