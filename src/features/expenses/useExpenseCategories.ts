/** Expense categories (mockup #50) — list, search and create.
 *
 * The list is small and bounded (the server caps it at 200), so search filters
 * in memory rather than costing a round trip per keystroke.
 */

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { listExpenseCategories, createExpenseCategory } from './expense.service'
import type { ExpenseCategory } from './expense.types'

export function useExpenseCategories() {
  const { t } = useLanguage()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const query = useQuery({
    queryKey: queryKeys.expenses.categories(),
    queryFn: ({ signal }) => listExpenseCategories(signal),
  })

  const categories: ExpenseCategory[] = useMemo(() => {
    const all = query.data ?? []
    const q = search.trim().toLowerCase()
    return q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all
  }, [query.data, search])

  const createMutation = useMutation({
    mutationFn: (name: string) => createExpenseCategory({ name }),
    onSuccess: () => {
      // Expense lists show the category name, so both caches go stale together.
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.categories() })
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all() })
      toast.success(t.categoryCreated)
      setCreating(false)
    },
    onError: () => toast.error(t.couldNotSaveCategory),
  })

  return {
    categories,
    totalCount: query.data?.length ?? 0,
    status: query.status,
    refetch: query.refetch,
    search,
    setSearch,
    creating,
    setCreating,
    create: (name: string) => createMutation.mutate(name),
    isSaving: createMutation.isPending,
  }
}
