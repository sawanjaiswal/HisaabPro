/** Units Feature — State management hook
 *
 * Handles CRUD operations, search, and loading state for units.
 * Uses existing API service from products/unit.service.ts.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
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
  const [units, setUnits] = useState<Unit[]>([])
  const [conversions, setConversions] = useState<UnitConversion[]>([])
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<UnitsTab>('units')
  const abortRef = useRef<AbortController | null>(null)

  const fetchUnits = useCallback(async (query?: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const data = await getUnits(query || undefined, controller.signal)
      setUnits(data)
      setStatus('success')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setStatus('error')
    }
  }, [])

  const fetchConversions = useCallback(async () => {
    try {
      const data = await getUnitConversions()
      setConversions(data)
    } catch {
      // Non-critical — conversions tab will show error if needed
    }
  }, [])

  useEffect(() => {
    void fetchUnits()
    void fetchConversions()
    return () => abortRef.current?.abort()
  }, [fetchUnits, fetchConversions])

  const handleSearch = useCallback((query: string) => {
    setSearch(query)
    void fetchUnits(query)
  }, [fetchUnits])

  const handleCreate = useCallback(async (data: UnitInput): Promise<Unit | null> => {
    try {
      const created = await createUnit(data)
      setUnits((prev) => [...prev, created])
      toast.success('Unit created')
      return created
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create unit'
      toast.error(msg)
      return null
    }
  }, [toast])

  const handleUpdate = useCallback(async (id: string, data: Partial<UnitInput>): Promise<boolean> => {
    try {
      const updated = await updateUnit(id, data)
      setUnits((prev) => prev.map((u) => (u.id === id ? updated : u)))
      toast.success('Unit updated')
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update unit'
      toast.error(msg)
      return false
    }
  }, [toast])

  const handleDelete = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteUnit(id)
      setUnits((prev) => prev.filter((u) => u.id !== id))
      toast.success('Unit deleted')
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete unit'
      toast.error(msg)
      return false
    }
  }, [toast])

  const refresh = useCallback(() => {
    setStatus('loading')
    void fetchUnits(search)
    void fetchConversions()
  }, [fetchUnits, fetchConversions, search])

  return {
    units,
    conversions,
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
