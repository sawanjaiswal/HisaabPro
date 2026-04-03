/** POS Checkout -- Submit sale + receipt data (TanStack Query mutation) */

import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { buildPayload, cartSubtotal, validateCart } from './pos.utils'

import type { PosCartItem, PaymentMode, QuickSaleResult, PosStatus } from './pos.types'

interface CheckoutArgs {
  items: PosCartItem[]
  paymentMode: PaymentMode
  amountPaid: number
  setStatus: (s: PosStatus) => void
}

export function usePosCheckout() {
  const [receipt, setReceipt] = useState<QuickSaleResult | null>(null)
  const [receiptItems, setReceiptItems] = useState<PosCartItem[]>([])
  const toast = useToast()
  const { t } = useLanguage()

  const mutation = useMutation({
    mutationFn: async ({ items, paymentMode, amountPaid }: Omit<CheckoutArgs, 'setStatus'>) => {
      const payload = buildPayload(items, paymentMode, amountPaid)
      const idempotencyKey = crypto.randomUUID()
      return api<QuickSaleResult>('/documents/quick-sale', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'X-Idempotency-Key': idempotencyKey },
      })
    },
  })

  const submit = useCallback(async ({ items, paymentMode, amountPaid, setStatus }: CheckoutArgs) => {
    if (mutation.isPending) return
    const error = validateCart(items, t)
    if (error) { toast.error(error); return }

    const total = cartSubtotal(items)
    if (amountPaid < total) {
      toast.error(t.posAmountLessThanTotal)
      return
    }

    setStatus('processing')

    try {
      const result = await mutation.mutateAsync({ items, paymentMode, amountPaid })
      setReceipt(result)
      setReceiptItems([...items])
      setStatus('receipt')
      if (navigator.vibrate) navigator.vibrate([100, 50, 100])
    } catch (err) {
      setStatus('checkout')
      const msg = err instanceof Error ? err.message : t.posSaleFailed
      toast.error(msg)
    }
  }, [toast, t, mutation])

  const resetReceipt = useCallback(() => {
    setReceipt(null)
    setReceiptItems([])
  }, [])

  return { isProcessing: mutation.isPending, receipt, receiptItems, submit, resetReceipt }
}
