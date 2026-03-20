import { useState, useCallback, useRef } from 'react'
import { api, ApiError } from '@/lib/api'
import { useApi } from '@/hooks/useApi'
import { useToast } from '@/hooks/useToast'
import type { VerificationDetail, RecordCountData } from './stock-verification.types'

export function useVerificationDetail(id: string | undefined) {
  const [isProcessing, setIsProcessing] = useState(false)
  const countGuardMap = useRef<Set<string>>(new Set())
  const completeGuard = useRef(false)
  const adjustGuard = useRef(false)
  const toast = useToast()

  const { data, status, error, refetch } = useApi<VerificationDetail>(
    id ? `/stock-verification/${id}` : null
  )

  const recordCount = useCallback(async (itemId: string, countData: RecordCountData) => {
    if (!id || countGuardMap.current.has(itemId)) return
    countGuardMap.current.add(itemId)
    setIsProcessing(true)
    try {
      await api(`/stock-verification/${id}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(countData),
      })
      toast.success('Count recorded')
      refetch()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to record count'
      toast.error(message)
    } finally {
      setIsProcessing(false)
      countGuardMap.current.delete(itemId)
    }
  }, [id, refetch, toast])

  const completeVerification = useCallback(async (notes?: string) => {
    if (!id || completeGuard.current) return
    completeGuard.current = true
    setIsProcessing(true)
    try {
      await api(`/stock-verification/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify(notes ? { notes } : {}),
      })
      toast.success('Verification completed')
      refetch()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to complete verification'
      toast.error(message)
    } finally {
      setIsProcessing(false)
      completeGuard.current = false
    }
  }, [id, refetch, toast])

  const adjustStock = useCallback(async () => {
    if (!id || adjustGuard.current) return
    adjustGuard.current = true
    setIsProcessing(true)
    try {
      await api(`/stock-verification/${id}/adjust`, { method: 'POST' })
      toast.success('Stock adjusted successfully')
      refetch()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to adjust stock'
      toast.error(message)
    } finally {
      setIsProcessing(false)
      adjustGuard.current = false
    }
  }, [id, refetch, toast])

  return {
    verification: data,
    items: data?.items ?? [],
    status,
    error,
    refetch,
    recordCount,
    completeVerification,
    adjustStock,
    isProcessing,
  }
}
