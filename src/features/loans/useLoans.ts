/** useLoans — Manages loan list state */

import { useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { listLoans } from './loan.service'
import type { Loan } from './loan.types'

type Status = 'loading' | 'error' | 'success'

interface UseLoansReturn {
  items: Loan[]
  total: number
  status: Status
  refresh: () => void
}

export function useLoans(): UseLoansReturn {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.loans.list({}),
    queryFn: ({ signal }) => listLoans(signal),
  })

  useEffect(() => {
    if (query.isError) {
      const err = query.error
      toast.error(err instanceof ApiError ? err.message : 'Failed to load loans')
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.loans.all() })
  }, [queryClient])

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    status,
    refresh,
  }
}
