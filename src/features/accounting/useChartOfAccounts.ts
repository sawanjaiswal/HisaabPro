/** useChartOfAccounts — Fetches and groups accounts by type (TanStack Query) */

import { useEffect, useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
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
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.accounting.chart(),
    queryFn: ({ signal }) => getAccounts(1, 200, signal),
  })

  const accounts = query.data?.items ?? []
  const total = query.data?.total ?? 0
  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  // Show toast on fetch error
  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load accounts'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.accounting.all() })
  }, [queryClient])

  // Seed default accounts mutation
  const seedMutation = useMutation({
    mutationFn: () => seedDefaultAccounts(),
    onSuccess: () => {
      toast.success('Default accounts created')
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.all() })
    },
    onError: (err: Error) => {
      const message = err instanceof ApiError ? err.message : 'Failed to seed accounts'
      toast.error(message)
    },
  })

  const handleSeed = useCallback(async () => {
    await seedMutation.mutateAsync()
  }, [seedMutation])

  return {
    grouped: groupAccountsByType(accounts),
    total,
    status,
    isSeedingLoading: seedMutation.isPending,
    refresh,
    handleSeed,
  }
}
