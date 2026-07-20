/** useExpenses — expense list state: category, month segment, search.
 *
 * The month segment is a date window the server can answer, so it goes into
 * the query. Search is not a server filter on /expenses, so it narrows the
 * fetched page in memory — matching category, notes, reference or party.
 */

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { toLocalISODate } from '@/lib/format'
import { listExpenses } from './expense.service'
import type { Expense } from './expense.types'

type Status = 'loading' | 'error' | 'success'

interface UseExpensesReturn {
  /** Page contents after the in-memory search filter. */
  items: Expense[]
  /** Everything the server returned for this page, before search. */
  fetched: Expense[]
  total: number
  page: number
  status: Status
  categoryFilter: string | null
  setCategoryFilter: (id: string | null) => void
  thisMonthOnly: boolean
  setThisMonthOnly: (on: boolean) => void
  search: string
  setSearch: (term: string) => void
  setPage: (p: number) => void
  refresh: () => void
}

/** First day of the current month, as a local ISO date. */
function monthStart(): string {
  const now = new Date()
  return toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1))
}

function matches(expense: Expense, term: string): boolean {
  const haystack = [
    expense.categoryName, expense.notes, expense.referenceNumber, expense.partyName,
  ].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(term)
}

export function useExpenses(): UseExpensesReturn {
  const toast = useToast()
  const queryClient = useQueryClient()
  // Arriving from the category list (#50) pre-applies that category.
  const [searchParams] = useSearchParams()
  const [categoryFilter, setCategoryFilterState] = useState<string | null>(
    () => searchParams.get('categoryId'),
  )
  const [page, setPage] = useState(1)
  const [thisMonthOnly, setThisMonthOnlyState] = useState(false)
  const [search, setSearchState] = useState('')

  const from = thisMonthOnly ? monthStart() : undefined
  const filters = { page, categoryFilter, from }

  const query = useQuery({
    queryKey: queryKeys.expenses.list(filters),
    queryFn: ({ signal }) => listExpenses(page, categoryFilter, signal, from),
  })

  const fetched = query.data?.items ?? []
  const term = search.trim().toLowerCase()
  const items = term ? fetched.filter((e) => matches(e, term)) : fetched
  const total = query.data?.total ?? 0
  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  // Show toast on fetch error
  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load expenses'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all() })
  }, [queryClient])

  const setCategoryFilter = useCallback((id: string | null) => {
    setCategoryFilterState(id)
    setPage(1)
  }, [])

  const setThisMonthOnly = useCallback((on: boolean) => {
    setThisMonthOnlyState(on)
    setPage(1)
  }, [])

  const setSearch = useCallback((next: string) => {
    setSearchState(next)
  }, [])

  return {
    items, fetched, total, page, status,
    categoryFilter, setCategoryFilter,
    thisMonthOnly, setThisMonthOnly,
    search, setSearch,
    setPage, refresh,
  }
}
