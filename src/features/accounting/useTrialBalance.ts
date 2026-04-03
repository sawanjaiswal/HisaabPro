/** useTrialBalance — Fetches trial balance with optional as-of date (TanStack Query) */

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { getTrialBalance } from './accounting.service'
import { getTodayISO } from './accounting.utils'
import type { TrialBalanceData } from './accounting.types'

type Status = 'loading' | 'error' | 'success'

interface UseTrialBalanceReturn {
  data: TrialBalanceData | null
  status: Status
  asOf: string
  setAsOf: (date: string) => void
  refresh: () => void
}

export function useTrialBalance(): UseTrialBalanceReturn {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [asOf, setAsOfDate] = useState<string>(getTodayISO)

  const filters = { asOf }

  const query = useQuery({
    queryKey: queryKeys.accounting.trialBalance(filters),
    queryFn: ({ signal }) => getTrialBalance(asOf, signal),
  })

  const data = query.data ?? null
  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  // Show toast on fetch error
  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load trial balance'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const setAsOf = useCallback((date: string) => {
    setAsOfDate(date)
  }, [])

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.accounting.all() })
  }, [queryClient])

  return { data, status, asOf, setAsOf, refresh }
}
