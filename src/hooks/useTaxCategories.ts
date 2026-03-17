/** Shared hook — Tax categories list, used by products and tax features */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { listTaxCategories, deleteTaxCategory, seedDefaultTaxCategories } from '@/lib/services/tax.service'
import type { TaxCategory } from '@/lib/types/tax.types'

type Status = 'loading' | 'error' | 'success'

export function useTaxCategories(businessId: string) {
  const toast = useToast()
  const [categories, setCategories] = useState<TaxCategory[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!businessId) return
    const controller = new AbortController()
    setStatus('loading')
    listTaxCategories(businessId)
      .then((data) => { setCategories(data); setStatus('success') })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        toast.error(err instanceof ApiError ? err.message : 'Failed to load tax categories')
      })
    return () => controller.abort()
  }, [businessId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const remove = useCallback(async (id: string) => {
    try {
      await deleteTaxCategory(id)
      setCategories((prev) => prev.filter((c) => c.id !== id))
      toast.success('Tax category deleted')
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete')
    }
  }, [toast])

  const seedDefaults = useCallback(async (bid: string) => {
    try {
      await seedDefaultTaxCategories(bid)
      toast.success('Default tax categories created')
      refresh()
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to seed defaults')
    }
  }, [toast, refresh])

  return { categories, status, refresh, remove, seedDefaults }
}
