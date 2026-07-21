/** POS — Zustand cart store with sessionStorage persistence */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { recalcCart, applyQtyChange, applyDiscountChange } from './pos.cart-calc'
import { MAX_CART_ITEMS } from '../utils/pos.constants'
import { basisPointsToPercent } from '../utils/pos.utils'
import type { PosCartItem, PosCartTotals, PaymentSplit, PosProductDTO } from '../types/pos.types'

const SESSION_KEY = 'pos-cart-v2'

interface PosCartState {
  items: PosCartItem[]
  totals: PosCartTotals
  payments: PaymentSplit[]
  partyId?: string
  walkInName?: string
  walkInPhone?: string

  // Actions
  addItem:        (product: PosProductDTO) => { ok: boolean; reason?: string }
  removeItem:     (productId: string) => void
  updateQty:      (productId: string, qty: number) => void
  updateDiscount: (productId: string, discountPaise: number) => void
  setPayments:    (splits: PaymentSplit[]) => void
  setParty:       (id: string | undefined) => void
  setWalkIn:      (name?: string, phone?: string) => void
  clearCart:      () => void
}

const EMPTY_TOTALS: PosCartTotals = {
  subtotal:      0,
  totalDiscount: 0,
  totalTaxable:  0,
  totalTax:      0,
  grandTotal:    0,
}

export const usePosStore = create<PosCartState>()(
  persist(
    (set, get) => ({
      items:    [],
      totals:   EMPTY_TOTALS,
      payments: [],

      addItem: (product) => {
        const { items } = get()
        const existing = items.find((i) => i.productId === product.id)

        if (existing) {
          if (existing.quantity >= product.currentStock) {
            return { ok: false, reason: 'stock_limit' }
          }
          const updated = items.map((i) =>
            i.productId === product.id
              ? { ...i, quantity: i.quantity + 1 }
              : i,
          )
          const totals = recalcCart(updated)
          set({ items: updated, totals })
          return { ok: true }
        }

        if (items.length >= MAX_CART_ITEMS) {
          return { ok: false, reason: 'cart_limit' }
        }

        const newItem: PosCartItem = {
          productId: product.id,
          name:      product.name,
          sku:       product.sku ?? '',
          hsnCode:   product.hsnCode ?? undefined,
          quantity:  1,
          unitPrice: product.salePricePaise,
          discount:  0,
          stock:     product.currentStock,
          // The wire carries basis points (1800 = 18%); the cart maths in
          // pos.cart-calc.ts divides by 100, so convert at this boundary.
          // Passing gstRate through raw would tax the line 100x over.
          taxRate:   basisPointsToPercent(product.gstRate),
          unit:      product.unitSymbol ?? '',
        }
        const updated = [...items, newItem]
        const totals  = recalcCart(updated)
        set({ items: updated, totals })
        return { ok: true }
      },

      removeItem: (productId) => {
        const updated = get().items.filter((i) => i.productId !== productId)
        set({ items: updated, totals: recalcCart(updated) })
      },

      updateQty: (productId, qty) => {
        const updated = applyQtyChange(get().items, productId, qty)
        set({ items: updated, totals: recalcCart(updated) })
      },

      updateDiscount: (productId, discountPaise) => {
        const updated = applyDiscountChange(get().items, productId, discountPaise)
        set({ items: updated, totals: recalcCart(updated) })
      },

      setPayments: (splits) => set({ payments: splits }),

      setParty: (id) => set({ partyId: id }),

      setWalkIn: (name, phone) => set({ walkInName: name, walkInPhone: phone }),

      clearCart: () =>
        set({
          items:       [],
          totals:      EMPTY_TOTALS,
          payments:    [],
          partyId:     undefined,
          walkInName:  undefined,
          walkInPhone: undefined,
        }),
    }),
    {
      name:    SESSION_KEY,
      storage: createJSONStorage(() => sessionStorage),
      // Only persist cart data; derived totals are recomputed on load
      partialize: (state) => ({
        items:       state.items,
        payments:    state.payments,
        partyId:     state.partyId,
        walkInName:  state.walkInName,
        walkInPhone: state.walkInPhone,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.totals = recalcCart(state.items)
        }
      },
    },
  ),
)
