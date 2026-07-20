/** Categories (mockup #53) — list, search, create, rename.
 *
 * The list is small and bounded (the server takes 200), so search filters in
 * memory rather than round-tripping on every keystroke.
 */

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCategories, createCategory, updateCategory } from './category.service'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import type { Category } from './product.types'

interface UseCategoriesReturn {
  categories: Category[]
  totalCount: number
  status: 'pending' | 'error' | 'success'
  refetch: () => void
  search: string
  setSearch: (value: string) => void
  /** null = the drawer is closed; a Category = rename; 'new' = create. */
  editing: Category | 'new' | null
  setEditing: (value: Category | 'new' | null) => void
  save: (name: string) => Promise<void>
  isSaving: boolean
}

export function useCategories(): UseCategoriesReturn {
  const toast = useToast()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Category | 'new' | null>(null)

  const query = useQuery({
    queryKey: queryKeys.products.categories(),
    queryFn: ({ signal }) => getCategories(undefined, signal),
  })

  const all = useMemo(() => query.data ?? [], [query.data])

  const categories = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return all
    return all.filter((c) => c.name.toLowerCase().includes(term))
  }, [all, search])

  const saveMutation = useMutation({
    mutationFn: async (name: string) => {
      if (editing && editing !== 'new') return updateCategory(editing.id, { name })
      return createCategory({ name })
    },
    onSuccess: () => {
      // Product lists show category names, so they go stale with this too.
      queryClient.invalidateQueries({ queryKey: queryKeys.products.categories() })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all() })
      toast.success(editing === 'new' ? t.categoryCreated : t.categoryUpdated)
      setEditing(null)
    },
    onError: () => toast.error(t.couldNotSaveCategory),
  })

  return {
    categories,
    totalCount: all.length,
    status: query.isPending ? 'pending' : query.isError ? 'error' : 'success',
    refetch: () => void query.refetch(),
    search,
    setSearch,
    editing,
    setEditing,
    save: async (name: string) => { await saveMutation.mutateAsync(name) },
    isSaving: saveMutation.isPending,
  }
}
