/** Create Invoice — Page (lazy loaded)
 *
 * Follows CreatePartyPage.tsx pattern: pill tabs for sections,
 * sticky bottom totals bar with save actions.
 * Sections: Items · Details · Charges
 */

import { useState, useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { useInvoiceForm } from './useInvoiceForm'
import { InvoiceTotalsBar } from './components/InvoiceTotalsBar'
import { InvoiceItemsSection } from './components/InvoiceItemsSection'
import { InvoiceDetailsSection } from './components/InvoiceDetailsSection'
import { InvoiceChargesSection } from './components/InvoiceChargesSection'
import { FORM_SECTIONS } from './invoice.constants'
import './invoice-party-search.css'
import './invoice-line-items.css'
import './invoice-product-search.css'
import './invoice-summary.css'

export default function CreateInvoicePage() {
  const nav = useNavigate()
  const {
    form,
    errors,
    isSubmitting,
    activeSection,
    setActiveSection,
    updateField,
    addLineItem,
    updateLineItem,
    removeLineItem,
    addCharge,
    updateCharge,
    removeCharge,
    totals,
    stockWarnings,
    hasStockBlocks,
    handleSubmit,
    handleSaveDraft,
  } = useInvoiceForm('SALE_INVOICE')

  const location = useLocation()
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [showProductSearch, setShowProductSearch] = useState(false)

  // Pre-populate from bill scan navigation state
  useEffect(() => {
    const state = location.state as { scannedItems?: Array<{ productId: string; productName: string; quantity: number; rate: number; discountType: 'PERCENTAGE'; discountValue: number }>; scannedDate?: string } | null
    if (!state?.scannedItems?.length) return

    const names: Record<string, string> = {}
    for (const item of state.scannedItems) {
      // Use a scan-prefixed ID so items render with names
      const scanId = item.productId || `scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      names[scanId] = item.productName
      addLineItem({ productId: scanId, quantity: item.quantity, rate: item.rate, discountType: item.discountType, discountValue: item.discountValue })
    }
    setProductNames((prev) => ({ ...prev, ...names }))

    if (state.scannedDate) {
      updateField('documentDate', state.scannedDate)
    }

    // Clear navigation state so refresh doesn't re-add
    window.history.replaceState({}, '')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePartyChange = useCallback((id: string, _name: string) => {
    updateField('partyId', id)
  }, [updateField])

  const handleProductSelect = useCallback((productId: string, ratePaise: number, productName: string) => {
    const alreadyAdded = form.lineItems.some((item) => item.productId === productId)
    if (alreadyAdded) return

    setProductNames((prev) => ({ ...prev, [productId]: productName }))
    addLineItem({
      productId,
      quantity: 1,
      rate: ratePaise,
      discountType: 'PERCENTAGE',
      discountValue: 0,
    })
  }, [form.lineItems, addLineItem])

  const toggleProductSearch = useCallback(() => {
    setShowProductSearch((v) => !v)
  }, [])

  return (
    <AppShell>
      <Header
        title="New Invoice"
        backTo={ROUTES.INVOICES}
        actions={
          <button className="btn btn-ghost btn-sm" onClick={() => nav(ROUTES.BILL_SCAN)} aria-label="Scan bill to add items">
            <Camera size={18} aria-hidden="true" />
            <span>Scan</span>
          </button>
        }
      />

      <PageContainer className="invoice-details-section">
        <nav className="pill-tabs" role="tablist" aria-label="Invoice form sections">
          {FORM_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              role="tab"
              className={`pill-tab${activeSection === section.id ? ' active' : ''}`}
              onClick={() => setActiveSection(section.id)}
              aria-selected={activeSection === section.id}
              aria-controls={`section-panel-${section.id}`}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div
          id={`section-panel-${activeSection}`}
          role="tabpanel"
          aria-label={FORM_SECTIONS.find((s) => s.id === activeSection)?.label}
        >
          {activeSection === 'items' && (
            <InvoiceItemsSection
              partyId={form.partyId}
              lineItems={form.lineItems}
              productNames={productNames}
              showProductSearch={showProductSearch}
              errors={errors}
              stockWarnings={stockWarnings}
              hasStockBlocks={hasStockBlocks}
              onPartyChange={handlePartyChange}
              onProductSelect={handleProductSelect}
              onUpdateLineItem={updateLineItem}
              onRemoveLineItem={removeLineItem}
              onToggleProductSearch={toggleProductSearch}
            />
          )}

          {activeSection === 'details' && (
            <InvoiceDetailsSection
              documentDate={form.documentDate}
              paymentTerms={form.paymentTerms}
              notes={form.notes ?? ''}
              termsAndConditions={form.termsAndConditions ?? ''}
              includeSignature={form.includeSignature}
              onUpdateField={updateField}
            />
          )}

          {activeSection === 'charges' && (
            <InvoiceChargesSection
              charges={form.additionalCharges}
              onUpdateCharge={updateCharge}
              onRemoveCharge={removeCharge}
              onAddCharge={addCharge}
            />
          )}
        </div>
      </PageContainer>

      <InvoiceTotalsBar
        subtotal={totals.subtotal}
        totalDiscount={totals.totalDiscount}
        totalCharges={totals.totalCharges}
        roundOff={totals.roundOff}
        grandTotal={totals.grandTotal}
        totalProfit={totals.totalProfit}
        profitPercent={totals.profitPercent}
        isSubmitting={isSubmitting}
        onSave={handleSubmit}
        onSaveDraft={handleSaveDraft}
        showProfit={false}
      />
    </AppShell>
  )
}
