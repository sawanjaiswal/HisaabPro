import { useState, useCallback, useRef, useMemo } from 'react'
import { api, ApiError } from '@/lib/api'
import { useApi } from '@/hooks/useApi'
import { useToast } from '@/hooks/useToast'
import { VERIFICATION_PAGE_SIZE } from './stock-verification.constants'
import type { VerificationStatus, VerificationListResponse } from './stock-verification.types'

export function useVerifications() {
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const createGuard = useRef(false)
  const toast = useToast()

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: String(VERIFICATION_PAGE_SIZE) })
    if (statusFilter) params.set('status', statusFilter)
    return params.toString()
  }, [statusFilter])

  const { data, status, error, refetch } = useApi<VerificationListResponse>(
    `/stock-verification?${queryString}`
  )

  const createVerification = useCallback(async (notes?: string) => {
    if (createGuard.current) return null
    createGuard.current = true
    setIsCreating(true)
    try {
      const result = await api<{ id: string }>('/stock-verification', {
        method: 'POST',
        body: JSON.stringify(notes ? { notes } : {}),
      })
      toast.success('Stock verification created')
      refetch()
      return result.id
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create verification'
      toast.error(message)
      return null
    } finally {
      setIsCreating(false)
      createGuard.current = false
    }
  }, [refetch, toast])

  return {
    verifications: data?.verifications ?? [],
    total: data?.total ?? 0,
    status,
    error,
    refetch,
    createVerification,
    isCreating,
    statusFilter,
    setStatusFilter,
  }
}
