/** Expense Detail — fetch one expense and own its delete (mockup #13).
 *
 * Edit is not here: the detail page reopens the shared expense drawer in edit
 * mode, so the update path stays in one place.
 */

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { getExpense, deleteExpense } from './expense.service'
import type { Expense } from './expense.types'

type DetailStatus = 'loading' | 'error' | 'success'

interface UseExpenseDetailReturn {
  expense: Expense | null
  status: DetailStatus
  refresh: () => void
  handleDelete: () => void
}

export function useExpenseDetail(id: string): UseExpenseDetailReturn {
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useLanguage()

  const query = useQuery({
    queryKey: queryKeys.expenses.detail(id),
    queryFn: ({ signal }) => getExpense(id, signal),
  })

  const expense = query.data ?? null
  const status: DetailStatus = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.detail(id) })
  }, [queryClient, id])

  const deleteMutation = useMutation({
    mutationFn: () => deleteExpense(id),
    onSuccess: () => {
      toast.success(t.expenseDeleted)
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all() })
      navigate(ROUTES.EXPENSES)
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : t.couldNotLoadExpenses)
    },
  })

  const handleDelete = useCallback(() => {
    if (expense === null) return
    deleteMutation.mutate()
  }, [expense, deleteMutation])

  return { expense, status, refresh, handleDelete }
}
