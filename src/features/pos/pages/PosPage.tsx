/** POS — Main POS page (grid + cart FAB) */

import { useState, useMemo } from 'react'
import { ShoppingCart } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { usePosPage } from '../hooks/usePosPage'
import '../pos-billing.css'
import { ProductGrid } from '../components/grid/ProductGrid'
import { CartPanel } from '../components/cart/CartPanel'
import { PaymentSheet } from '../components/payment/PaymentSheet'
import { CustomerSelector } from '../components/customer/CustomerSelector'
import { ReceiptPreview } from '../components/receipt/ReceiptPreview'
import { Button } from '@/components/ui/Button'

const MOCK_BUSINESS = {
  name:    'My Business',
  gstEnabled: false,
}

export default function PosMainPage() {
  const { t }     = useLanguage()
  const page      = usePosPage()
  const [cartOpen, setCartOpen] = useState(false)

  const cartProductIds = useMemo(
    () => new Set(page.store.items.map((i) => i.productId)),
    [page.store.items],
  )

  // Receipt / success state
  if (page.checkoutState === 'success' && page.lastSale) {
    return (
      <AppShell>
        <div className="pos-page">
          <Header title={t.posReceiptTitle ?? 'Receipt'} backTo />
          <div className="pos-receipt-page">
            <ReceiptPreview sale={page.lastSale} businessInfo={MOCK_BUSINESS} />
            <div className="pos-receipt-page__actions">
              <Button variant="none"
                type="button"
                className="pos-primary-btn"
                onClick={page.newSale}
              >
                {t.posNewSale ?? 'New sale'}
              </Button>
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="pos-page">
        {/* Header */}
        <Header title={t.posBillingMode ?? 'POS Billing'} backTo={ROUTES.DASHBOARD} />

        {/* Customer selector */}
        <div className="pos-page__customer">
          <CustomerSelector
            partyId={page.store.partyId}
            walkInName={page.store.walkInName}
            walkInPhone={page.store.walkInPhone}
            onSelectParty={page.store.setParty}
            onClearParty={() => page.store.setParty(undefined)}
            onWalkInChange={(name, phone) => page.store.setWalkIn(name, phone)}
          />
        </div>

        {/* Product grid */}
        <div className="pos-page__grid">
          <ProductGrid
            productsHook={page.products}
            cartProductIds={cartProductIds}
            onSelect={page.addToCart}
          />
        </div>

        {/* Cart FAB */}
        {page.cartCount > 0 && (
          <Button variant="none"
            type="button"
            className="pos-cart-fab"
            onClick={() => setCartOpen(true)}
            aria-label={`${t.posCart ?? 'Cart'} — ${page.cartCount} items`}
          >
            <ShoppingCart size={20} aria-hidden="true" />
            <span className="pos-cart-fab__count" aria-hidden="true">
              {page.cartCount}
            </span>
          </Button>
        )}

        {/* Cart panel — <Drawer> brings its own backdrop and portal. */}
        <CartPanel
          open={cartOpen}
          items={page.store.items}
          totals={page.store.totals}
          onUpdateQty={page.store.updateQty}
          onRemove={page.store.removeItem}
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            setCartOpen(false)
            page.openPayment()
          }}
        />

        {/* Payment sheet */}
        <PaymentSheet
          open={page.checkoutState === 'open' || page.checkoutState === 'processing'}
          isProcessing={page.checkoutState === 'processing'}
          grandTotal={page.store.totals.grandTotal}
          onConfirm={() => void page.checkout.confirmCheckout()}
          onClose={page.checkout.closeCheckout}
        />
      </div>
    </AppShell>
  )
}
