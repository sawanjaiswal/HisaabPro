/** POS — Checkout mutation with idempotency key + online guard */

import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { createSale, buildCreateSalePayload } from '../api/pos.service'
import { usePosStore } from '../state/pos.store'
import { splitTotal } from '../utils/pos.utils'
import { POS_PRODUCTS_KEY } from './usePosProducts'
import type { PosSaleDTO } from '../types/pos.types'

export type CheckoutState = 'idle' | 'open' | 'processing' | 'success'

interface UsePosCheckoutReturn {
  checkoutState:  CheckoutState
  lastSale:       PosSaleDTO | null
  openCheckout:   () => void
  closeCheckout:  () => void
  confirmCheckout: () => Promise<void>
  resetSale:      () => void
}

export function usePosCheckout(
  setCheckoutState: (s: CheckoutState) => void,
  checkoutState:    CheckoutState,
  lastSale:         PosSaleDTO | null,
  setLastSale:      (sale: PosSaleDTO | null) => void,
): UsePosCheckoutReturn {
  const toast        = useToast()
  const { t }        = useLanguage()
  const qc           = useQueryClient()
  const store        = usePosStore()

  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof createSale>[0]) =>
      createSale(payload, payload.walkInName ?? t.posWalkIn ?? 'Walk-in'),
    onSuccess: (sale) => {
      setLastSale(sale)
      setCheckoutState('success')
      store.clearCart()
      void qc.invalidateQueries({ queryKey: [POS_PRODUCTS_KEY] })
      // The sale is done either way, so these are toasts and not a blocked
      // flow — but a shelf that just went negative, or an expired batch that
      // was sold anyway, is exactly what the person at the counter has to hear
      // while the customer is still standing there.
      sale.warnings?.forEach((w) => toast.warning(w))
      if (navigator.vibrate) navigator.vibrate([100, 50, 100])
    },
    onError: (err) => {
      setCheckoutState('open')
      const msg = err instanceof Error ? err.message : (t.posSaleFailed ?? 'Checkout failed')
      toast.error(msg)
    },
  })

  const openCheckout = useCallback(() => {
    if (!navigator.onLine) {
      toast.error(t.posOfflineCheckout ?? 'Internet required to complete sale')
      return
    }
    if (store.items.length === 0) {
      toast.error(t.posCartEmpty ?? 'Cart is empty')
      return
    }
    setCheckoutState('open')
  }, [store.items.length, toast, t, setCheckoutState])

  const closeCheckout = useCallback(() => setCheckoutState('idle'), [setCheckoutState])

  const confirmCheckout = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error(t.posOfflineCheckout ?? 'Internet required to complete sale')
      return
    }
    const { items, payments, partyId, walkInName, walkInPhone, totals } = store
    if (items.length === 0) {
      toast.error(t.posCartEmpty ?? 'Cart is empty')
      return
    }
    const paid = splitTotal(payments)
    if (paid < totals.grandTotal) {
      toast.error(t.posAmountShort ?? 'Payment amount is less than total')
      return
    }
    const payload = buildCreateSalePayload(items, payments, partyId, walkInName, walkInPhone)
    setCheckoutState('processing')
    await mutation.mutateAsync(payload)
  }, [store, toast, t, mutation, setCheckoutState])

  const resetSale = useCallback(() => {
    setLastSale(null)
    setCheckoutState('idle')
  }, [setLastSale, setCheckoutState])

  return {
    checkoutState,
    lastSale,
    openCheckout,
    closeCheckout,
    confirmCheckout,
    resetSale,
  }
}
