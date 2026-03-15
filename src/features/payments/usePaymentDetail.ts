/** Payment Detail — Hook to fetch and manage a single payment record
 *
 * Fetches full PaymentDetail by ID, manages tab state, and supports
 * manual refresh via refreshKey. Mirrors useInvoiceDetail.ts exactly.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
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

  const [payment, setPayment] = useState<PaymentDetail | null>(null)
  const [status, setStatus] = useState<DetailStatus>('loading')
  const [activeTab, setActiveTab] = useState<PaymentDetailTab>('overview')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    getPayment(id, controller.signal)
      .then((data: PaymentDetail) => {
        setPayment(data)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load payment'
        toast.error(message)
      })

    return () => controller.abort()
  }, [id, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const handleDelete = useCallback(() => {
    if (payment === null) return

    const label = `Payment of ₹${(payment.amount / 100).toFixed(2)}`

    deletePayment(payment.id)
      .then(() => {
        toast.success(`${label} deleted`)
        navigate(ROUTES.PAYMENTS)
      })
      .catch((err: unknown) => {
        const message = err instanceof ApiError ? err.message : 'Failed to delete payment'
        toast.error(message)
      })
  }, [payment, toast, navigate])

  return {
    payment,
    status,
    activeTab,
    setActiveTab,
    refresh,
    handleDelete,
  }
}
