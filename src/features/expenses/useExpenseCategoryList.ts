/** Expense categories for the list filter bar and the add drawer.
 *
 * A plain read of the category endpoint, cached by TanStack Query so the
 * page and the drawer share one fetch. Failure is non-critical — an empty
 * list only costs the category pills, so it degrades to "All".
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { listExpenseCategories } from './expense.service'
import type { ExpenseCategory } from './expense.types'

export function useExpenseCategoryList(): ExpenseCategory[] {
  const query = useQuery({
    queryKey: queryKeys.expenses.categories(),
    queryFn: ({ signal }) => listExpenseCategories(signal),
  })

  return query.data ?? []
}
