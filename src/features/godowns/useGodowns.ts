/** Godowns list — Hook */

import { useState, useCallback, useRef } from 'react'
import { useApi } from '@/hooks/useApi'
import { useToast } from '@/hooks/useToast'
import { api, ApiError } from '@/lib/api'
import { GODOWN_PAGE_SIZE } from './godown.constants'
import type { GodownListResponse } from './godown.types'

interface UseGodownsReturn {
  data: GodownListResponse | null
  status: 'idle' | 'loading' | 'success' | 'error'
  error: ApiError | null
  refetch: () => void
  deleteGodown: (id: string, name: string) => void
  isDeleting: boolean
}

export function useGodowns(): UseGodownsReturn {
  const toast = useToast()
  const [isDeleting, setIsDeleting] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const deletingRef = useRef(false)

  const path = `/godowns?limit=${GODOWN_PAGE_SIZE}&_r=${refreshKey}`
  const { data, status, error } = useApi<GodownListResponse>(path)

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const deleteGodown = useCallback((id: string, name: string) => {
    if (deletingRef.current) return
    deletingRef.current = true
    setIsDeleting(true)

    api(`/godowns/${id}`, { method: 'DELETE', entityType: 'godown', entityLabel: name })
      .then(() => {
        toast.success(`${name} deleted`)
        refresh()
      })
      .catch((err: unknown) => {
        const message = err instanceof ApiError
          ? err.message
          : 'Failed to delete godown'
        toast.error(message)
      })
      .finally(() => {
        deletingRef.current = false
        setIsDeleting(false)
      })
  }, [toast, refresh])

  return {
    data,
    status,
    error,
    refetch: refresh,
    deleteGodown,
    isDeleting,
  }
}
