/** Units Feature -- State management hook
 *
 * Handles CRUD operations, search, and loading state for units.
 * Uses existing API service from products/unit.service.ts.
 */

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import type { Unit, UnitConversion, UnitsTab } from './unit.types'
import {
  getUnits,
  createUnit,
  updateUnit,
  deleteUnit,
  getUnitConversions,
} from '../products/unit.service'
import type { UnitInput } from '../products/unit.service'
import { useToast } from '@/hooks/useToast'

export function useUnitManager() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<UnitsTab>('units')

  const unitsQuery = useQuery({
    queryKey: [...queryKeys.units.list(), { search }] as const,
    queryFn: ({ signal }) => getUnits(search || undefined, signal),
  })

  const conversionsQuery = useQuery({
    queryKey: queryKeys.units.conversions(),
    queryFn: () => getUnitConversions(),
  })

  const status: 'loading' | 'error' | 'success' = unitsQuery.isPending
    ? 'loading'
    : unitsQuery.isError ? 'error' : 'success'

  const createMutation = useMutation({
    mutationFn: (data: UnitInput) => createUnit(data),
    onSuccess: () => {
      toast.success('Unit created')
      void queryClient.invalidateQueries({ queryKey: queryKeys.units.all() })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create unit'
      toast.error(msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UnitInput> }) => updateUnit(id, data),
    onSuccess: () => {
      toast.success('Unit updated')
      void queryClient.invalidateQueries({ queryKey: queryKeys.units.all() })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update unit'
      toast.error(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUnit(id),
    onSuccess: () => {
      toast.success('Unit deleted')
      void queryClient.invalidateQueries({ queryKey: queryKeys.units.all() })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete unit'
      toast.error(msg)
    },
  })

  const handleSearch = useCallback((query: string) => {
    setSearch(query)
  }, [])

  const handleCreate = useCallback(async (data: UnitInput): Promise<Unit | null> => {
    try {
      const created = await createMutation.mutateAsync(data)
      return created
    } catch {
      return null
    }
  }, [createMutation])

  const handleUpdate = useCallback(async (id: string, data: Partial<UnitInput>): Promise<boolean> => {
    try {
      await updateMutation.mutateAsync({ id, data })
      return true
    } catch {
      return false
    }
  }, [updateMutation])

  const handleDelete = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync(id)
      return true
    } catch {
      return false
    }
  }, [deleteMutation])

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.units.all() })
  }, [queryClient])

  return {
    units: unitsQuery.data ?? [] as Unit[],
    conversions: conversionsQuery.data ?? [] as UnitConversion[],
    status,
    search,
    activeTab,
    setActiveTab,
    handleSearch,
    handleCreate,
    handleUpdate,
    handleDelete,
    refresh,
  }
}
