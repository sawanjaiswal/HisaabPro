/** Payment Detail — Hook to fetch and manage a single payment record
 *
 * TanStack Query v5 migration. Fetches full PaymentDetail by ID,
 * manages tab state, and delete action. Query replaces useState +
 * useEffect + refreshKey.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { ROUTES } from '@/config/routes.config'
import { getPayment, deletePayment } from './payment.service'
import type { PaymentDetail, PaymentDetailTab } from './payment.types'

type DetailStatus = 'loading' | 'error' | 'success'

interface UsePaymentDetailReturn {
  payment: PaymentDetail | null
  status: DetailStatus
  activeTab: PaymentDetailTab
  setActiveTab: (tab: PaymentDetailTab) => void
  refresh: () => void
  handleDelete: () => void
}

export function usePaymentDetail(id: string): UsePaymentDetailReturn {
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<PaymentDetailTab>('overview')

  // TanStack Query replaces useState(payment) + useEffect(fetch) + refreshKey
  const query = useQuery({
    queryKey: queryKeys.payments.detail(id),
    queryFn: ({ signal }) => getPayment(id, signal),
  })

  const payment = query.data ?? null
  const status: DetailStatus = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  // Show toast on fetch error
  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load payment'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.payments.detail(id) })
  }, [queryClient, id])

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => deletePayment(id),
    onSuccess: () => {
      const label = payment ? `Payment of Rs${(payment.amount / 100).toFixed(2)}` : 'Payment'
      toast.success(`${label} deleted`)
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all() })
      navigate(ROUTES.PAYMENTS)
    },
    onError: (err: Error) => {
      const message = err instanceof ApiError ? err.message : 'Failed to delete payment'
      toast.error(message)
    },
  })

  const handleDelete = useCallback(() => {
    if (payment === null) return
    deleteMutation.mutate()
  }, [payment, deleteMutation])

  return {
    payment,
    status,
    activeTab,
    setActiveTab,
    refresh,
    handleDelete,
  }
}
