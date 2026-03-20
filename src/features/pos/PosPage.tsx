/** POS Quick-Sale — Main page */

import { useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/config/routes.config'
import { usePosCart } from './usePosCart'
import { usePosCheckout } from './usePosCheckout'
import { ScanBar } from './components/ScanBar'
import { CartItem } from './components/CartItem'
import { CartSummary } from './components/CartSummary'
import { CheckoutSheet } from './components/CheckoutSheet'
import { SaleReceipt } from './components/SaleReceipt'
import { QuickProductGrid } from './components/QuickProductGrid'
import './pos.css'

import type { PaymentMode } from './pos.types'

export default function PosPage() {
  const navigate = useNavigate()
  const cart = usePosCart()
  const checkout = usePosCheckout()

  const handleConfirm = useCallback((mode: PaymentMode, amountPaid: number) => {
    checkout.submit({ items: cart.items, paymentMode: mode, amountPaid, setStatus: cart.setStatus })
  }, [cart.items, cart.setStatus, checkout.submit])

  const handleNewSale = useCallback(() => {
    cart.clearCart()
    checkout.resetReceipt()
  }, [cart.clearCart, checkout.resetReceipt])

  if (cart.status === 'receipt' && checkout.receipt) {
    return (
      <div className="pos-page">
        <SaleReceipt receipt={checkout.receipt} items={checkout.receiptItems} onNewSale={handleNewSale} />
      </div>
    )
  }

  return (
    <div className="pos-page">
      <header className="pos-header">
        <button type="button" className="pos-back-btn" onClick={() => navigate(ROUTES.DASHBOARD)} aria-label="Back">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1 className="pos-header-title">Quick Sale</h1>
      </header>

      <ScanBar onProductFound={cart.addItem} />

      <div className="pos-body">
        {cart.items.length === 0 ? (
          <QuickProductGrid onSelect={cart.addItem} />
        ) : (
          <div className="pos-cart-list" role="list" aria-label="Cart items">
            {cart.items.map((item) => (
              <CartItem key={item.productId} item={item} onUpdateQty={cart.updateQty} onRemove={cart.removeItem} />
            ))}
          </div>
        )}
      </div>

      <CartSummary items={cart.items} onCheckout={() => cart.setStatus('checkout')} />
      <CheckoutSheet
        open={cart.status === 'checkout'}
        onClose={() => cart.setStatus('cart-active')}
        items={cart.items}
        isProcessing={checkout.isProcessing}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
