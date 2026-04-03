/** useBankAccounts — Manages bank account list state (TanStack Query) */

import { useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { listBankAccounts } from './bank-account.service'

type Status = 'loading' | 'error' | 'success'

interface UseBankAccountsReturn {
  items: import('./bank-account.types').BankAccount[]
  total: number
  status: Status
  refresh: () => void
}

export function useBankAccounts(): UseBankAccountsReturn {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.bankAccounts.list(),
    queryFn: ({ signal }) => listBankAccounts(signal),
  })

  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0
  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  // Show toast on fetch error
  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load bank accounts'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.bankAccounts.all() })
  }, [queryClient])

  return { items, total, status, refresh }
}
