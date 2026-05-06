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
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useGstGate } from '@/features/gst/useGstGate'
import { useInvoiceForm } from './useInvoiceForm'
import { InvoiceTotalsBar } from './components/InvoiceTotalsBar'
import { InvoiceItemsSection } from './components/InvoiceItemsSection'
import { InvoiceDetailsSection } from './components/InvoiceDetailsSection'
import { InvoiceChargesSection } from './components/InvoiceChargesSection'
import { GstInvoiceHeader } from './components/GstInvoiceHeader'
import { UntaggedTaxDialog } from './components/UntaggedTaxDialog'
import { StockShortageBanner } from './components/StockShortageBanner'
import { ExpiredBatchBanner } from '@/features/inventory/components/ExpiredBatchBanner'
import { FORM_SECTIONS } from './invoice.constants'
import './invoice-party-search.css'
import './invoice-line-items.css'
import './invoice-product-search.css'
import './invoice-summary.css'
import './invoice-gst-banners.css'

export default function CreateInvoicePage() {
  const nav = useNavigate()
  const { t } = useLanguage()
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
    gstEnabled,
    showUntaggedDialog,
    confirmUntaggedSubmit,
    dismissUntaggedDialog,
    stockShortageItems,
    clearStockShortage,
    batchErrorCode,
    clearBatchError,
  } = useInvoiceForm('SALE_INVOICE')

  const { compositionScheme } = useGstGate()
  const location = useLocation()
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [showProductSearch, setShowProductSearch] = useState(false)

  // Pre-populate from bill scan navigation state
  useEffect(() => {
    const state = location.state as { scannedItems?: Array<{ productId: string; productName: string; quantity: number; rate: number; discountType: 'PERCENTAGE'; discountValue: number }>; scannedDate?: string } | null
    if (!state?.scannedItems?.length) return

    const names: Record<string, string> = {}
    for (const item of state.scannedItems) {
      const scanId = item.productId || `scan-${crypto.randomUUID()}`
      names[scanId] = item.productName
      addLineItem({ productId: scanId, quantity: item.quantity, rate: item.rate, discountType: item.discountType, discountValue: item.discountValue, taxCategoryId: null, hsnCode: '' })
    }
    setProductNames((prev) => ({ ...prev, ...names }))

    if (state.scannedDate) {
      updateField('documentDate', state.scannedDate)
    }

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
      taxCategoryId: null,
      hsnCode: '',
    })
  }, [form.lineItems, addLineItem])

  const toggleProductSearch = useCallback(() => {
    setShowProductSearch((v) => !v)
  }, [])

  const formTitle = gstEnabled && form.supplyType === 'B2C_SMALL'
    ? t.newInvoice
    : t.newInvoice

  return (
    <AppShell>
      <Header
        title={formTitle}
        backTo={ROUTES.INVOICES}
        actions={
          <Button variant="ghost" size="sm" onClick={() => nav(ROUTES.BILL_SCAN)} aria-label={t.scanBillAddItems}>
            <Camera size={18} aria-hidden="true" />
            <span>{t.scan}</span>
          </Button>
        }
      />

      <PageContainer className="invoice-details-section stagger-enter py-0 space-y-6">
        {stockShortageItems.length > 0 && (
          <StockShortageBanner items={stockShortageItems} onDismiss={clearStockShortage} />
        )}

        {batchErrorCode && (
          <ExpiredBatchBanner
            code={batchErrorCode}
            onDismiss={clearBatchError}
            onReopenPicker={() => {
              clearBatchError()
              // Picker is opened via LineItemEditor's internal state on the relevant line
            }}
          />
        )}

        {gstEnabled && (
          <GstInvoiceHeader
            form={form}
            errors={errors}
            onUpdateField={updateField}
          />
        )}

        <nav className="pill-tabs" role="tablist" aria-label={t.invoiceFormSections}>
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
              gstEnabled={gstEnabled}
              compositionScheme={compositionScheme}
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
              vehicleNumber={form.vehicleNumber ?? ''}
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

      {showUntaggedDialog && (
        <UntaggedTaxDialog
          onConfirm={confirmUntaggedSubmit}
          onCancel={dismissUntaggedDialog}
        />
      )}
    </AppShell>
  )
}
