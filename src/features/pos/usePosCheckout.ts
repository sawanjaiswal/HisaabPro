/** POS Checkout — Submit sale + receipt data */

import { useState, useRef, useCallback } from 'react'
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
  const [isProcessing, setIsProcessing] = useState(false)
  const [receipt, setReceipt] = useState<QuickSaleResult | null>(null)
  const [receiptItems, setReceiptItems] = useState<PosCartItem[]>([])
  const submitRef = useRef(false)
  const toast = useToast()
  const { t } = useLanguage()

  const submit = useCallback(async ({ items, paymentMode, amountPaid, setStatus }: CheckoutArgs) => {
    if (submitRef.current) return
    const error = validateCart(items, t)
    if (error) { toast.error(error); return }

    const total = cartSubtotal(items)
    if (amountPaid < total) {
      toast.error(t.posAmountLessThanTotal)
      return
    }

    submitRef.current = true
    setIsProcessing(true)
    setStatus('processing')

    try {
      const payload = buildPayload(items, paymentMode, amountPaid)
      const idempotencyKey = crypto.randomUUID()
      const result = await api<QuickSaleResult>('/documents/quick-sale', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'X-Idempotency-Key': idempotencyKey },
      })
      setReceipt(result)
      setReceiptItems([...items])
      setStatus('receipt')
      // TODO: structured log — sale.completed {documentId, itemCount, total, paymentMode}
      if (navigator.vibrate) navigator.vibrate([100, 50, 100])
    } catch (err) {
      setStatus('checkout')
      const msg = err instanceof Error ? err.message : t.posSaleFailed
      toast.error(msg)
    } finally {
      setIsProcessing(false)
      submitRef.current = false
    }
  }, [toast, t])

  const resetReceipt = useCallback(() => {
    setReceipt(null)
    setReceiptItems([])
  }, [])

  return { isProcessing, receipt, receiptItems, submit, resetReceipt }
}
