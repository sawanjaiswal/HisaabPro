/** Tax — Single tax category detail hook */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError, api } from '@/lib/api'
import type { TaxCategory } from './tax.types'

type Status = 'loading' | 'error' | 'success'

export function useTaxCategoryDetail(id: string) {
  const toast = useToast()
  const [category, setCategory] = useState<TaxCategory | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    setStatus('loading')
    api<TaxCategory>(`/tax-categories/${id}`, { signal: controller.signal })
      .then((data) => { setCategory(data); setStatus('success') })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        toast.error(err instanceof ApiError ? err.message : 'Failed to load tax category')
      })
    return () => controller.abort()
  }, [id, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])
  return { category, status, refresh }
}
