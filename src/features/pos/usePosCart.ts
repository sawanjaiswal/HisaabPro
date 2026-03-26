/** POS Cart — State management hook */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { MAX_CART_ITEMS, MAX_ITEM_QTY } from './pos.constants'

import type { PosCartItem, PosStatus, QuickProduct } from './pos.types'

const SESSION_KEY = 'pos-cart'

export function usePosCart() {
  const [items, setItems] = useState<PosCartItem[]>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [status, setStatus] = useState<PosStatus>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY)
      const parsed = saved ? JSON.parse(saved) : []
      return parsed.length > 0 ? 'cart-active' : 'idle'
    } catch {
      return 'idle'
    }
  })
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const { t } = useLanguage()
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(items)) } catch {}
  }, [items])

  const addItem = useCallback((product: QuickProduct) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        if (existing.quantity >= product.stock) {
          queueMicrotask(() =>
            toastRef.current.warning(
              tRef.current.posOnlyXInStock.replace('{count}', String(product.stock)),
            ),
          )
          return prev
        }
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: Math.min(i.quantity + 1, MAX_ITEM_QTY) }
            : i,
        )
      }
      if (prev.length >= MAX_CART_ITEMS) {
        queueMicrotask(() =>
          toastRef.current.warning(
            tRef.current.posMaxItems.replace('{count}', String(MAX_CART_ITEMS)),
          ),
        )
        return prev
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: 1,
        unitPrice: product.salePrice,
        discount: 0,
        stock: product.stock,
      }]
    })
    setStatus('cart-active')
    if (navigator.vibrate) navigator.vibrate(50)
  }, [])

  const updateQty = useCallback((productId: string, qty: number) => {
    if (qty < 1) return
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, quantity: Math.min(qty, MAX_ITEM_QTY, i.stock) }
          : i,
      ),
    )
  }, [])

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.productId !== productId)
      if (next.length === 0) setStatus('idle')
      return next
    })
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    setStatus('idle')
    sessionStorage.removeItem(SESSION_KEY)
  }, [])

  return { items, status, setStatus, addItem, updateQty, removeItem, clearCart }
}
