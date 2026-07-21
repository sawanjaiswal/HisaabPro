/** POS — Orchestrates search, scan, cart, checkout for main page */

import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { usePosProducts } from './usePosProducts'
import { usePosCheckout, type CheckoutState } from './usePosCheckout'
import { usePosStore } from '../state/pos.store'
import { MAX_CART_ITEMS } from '../utils/pos.constants'
import type { PosSaleDTO, PosProductDTO } from '../types/pos.types'

export type PosView = 'grid' | 'cart' | 'receipt'

export function usePosPage() {
  const [view,          setView]         = useState<PosView>('grid')
  const [checkoutState, setCheckoutState] = useState<CheckoutState>('idle')
  const [lastSale,      setLastSale]      = useState<PosSaleDTO | null>(null)

  const toast   = useToast()
  const { t }   = useLanguage()
  const store   = usePosStore()
  const products = usePosProducts()

  const checkout = usePosCheckout(
    setCheckoutState,
    checkoutState,
    lastSale,
    setLastSale,
  )

  /** Add product to cart with user feedback */
  const addToCart = useCallback((product: PosProductDTO) => {
    const result = store.addItem(product)
    if (!result.ok) {
      if (result.reason === 'stock_limit') {
        toast.warning(
          (t.posOnlyXInStock ?? 'Only {count} in stock').replace('{count}', String(product.currentStock)),
        )
      } else if (result.reason === 'cart_limit') {
        toast.warning(
          (t.posMaxItems ?? 'Max {count} items').replace('{count}', String(MAX_CART_ITEMS)),
        )
      }
    } else {
      if (navigator.vibrate) navigator.vibrate(30)
      if (store.items.length === 0) setView('grid')
    }
  }, [store, toast, t])

  /** Switch view to cart */
  const openCart = useCallback(() => setView('cart'), [])

  /** Back to grid from cart */
  const backToGrid = useCallback(() => setView('grid'), [])

  /** Open payment sheet */
  const openPayment = useCallback(() => {
    checkout.openCheckout()
  }, [checkout])

  /** New sale after receipt */
  const newSale = useCallback(() => {
    checkout.resetSale()
    setView('grid')
  }, [checkout])

  const cartCount = store.items.reduce((s, i) => s + i.quantity, 0)

  return {
    view,
    setView,
    products,
    store,
    checkout,
    checkoutState,
    cartCount,
    lastSale,
    addToCart,
    openCart,
    backToGrid,
    openPayment,
    newSale,
  }
}
