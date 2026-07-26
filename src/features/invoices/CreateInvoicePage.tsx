/** Create Invoice — Page (lazy). One continuous scroll; sticky totals bar saves. */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { useGstGate } from '@/features/gst/useGstGate'
import { useInvoiceForm } from './useInvoiceForm'
import { useInvoiceHotkeys } from './useInvoiceHotkeys'
import { useBillScanPrefill } from './useBillScanPrefill'
import { getCreateTitle, getCreateBackTo } from '@/features/sales/sales.utils'
import type { DocumentType } from './invoice.types'
import { InvoiceTotalsBar } from './components/InvoiceTotalsBar'
import { InvoiceHeaderMeta } from './components/InvoiceHeaderMeta'
import { InvoiceItemsSection } from './components/InvoiceItemsSection'
import { GstInvoiceHeader } from './components/GstInvoiceHeader'
import { UntaggedTaxDialog } from './components/UntaggedTaxDialog'
import { InvoicePreviewDrawer } from './components/InvoicePreviewDrawer'
import { InvoiceOptionalSections } from './components/InvoiceOptionalSections'
import { InvoiceGstSummary } from './components/InvoiceGstSummary'
import { ReceivePaymentToggle } from './components/ReceivePaymentToggle'
import { useInvoiceGstSummary } from './useInvoiceGstSummary'
import { StockShortageBanner } from './components/StockShortageBanner'
import { ExpiredBatchBanner } from '@/features/inventory/components/ExpiredBatchBanner'
import './invoice-party-search.css'
import './invoice-line-items.css'
import './invoice-product-search.css'
import './invoice-summary.css'
import './invoice-gst-banners.css'

interface CreateInvoicePageProps {
  /** Document type override — Estimate / Sale Order / Challan share this engine. */
  type?: DocumentType
}

export default function CreateInvoicePage({ type = 'SALE_INVOICE' }: CreateInvoicePageProps) {
  const nav = useNavigate()
  const { t } = useLanguage()
  const toast = useToast()
  const {
    form,
    errors,
    isSubmitting,
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
    priceListId,
    validate,
  } = useInvoiceForm(type)

  const { compositionScheme } = useGstGate()
  const gstSummary = useInvoiceGstSummary(form.lineItems, form.placeOfSupply, form.taxPricingMode)
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [partyName, setPartyName] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  // Optional sections start collapsed; charges open when the doc already has some.
  const [openSections, setOpenSections] = useState<string[]>(
    () => (form.additionalCharges.length > 0 ? ['charges'] : []),
  )

  useBillScanPrefill({ addLineItem, updateField, setProductNames })

  const handlePartyChange = useCallback((id: string, name: string) => {
    updateField('partyId', id)
    setPartyName(name) // kept for the preview's "Bill To" block
    // Picking a customer flows straight into item search — only when empty.
    if (id && form.lineItems.length === 0) setShowProductSearch(true)
  }, [updateField, form.lineItems.length])

  const handleProductSelect = useCallback((productId: string, ratePaise: number, productName: string) => {
    // Re-selecting an already-added product bumps its qty (tap the same chip
    // twice = two units); no modal confirm — it would kill the one-tap flow.
    const existing = form.lineItems.findIndex((item) => item.productId === productId)
    if (existing >= 0) {
      updateLineItem(existing, { quantity: (form.lineItems[existing]?.quantity ?? 1) + 1 })
      toast.success(t.qtyIncreased)
      return
    }

    setProductNames((prev) => ({ ...prev, [productId]: productName }))
    addLineItem({
      productId, quantity: 1, rate: ratePaise, discountType: 'PERCENTAGE',
      discountValue: 0, taxCategoryId: null, hsnCode: '',
    })
  }, [form.lineItems, addLineItem, updateLineItem, toast, t])

  const toggleProductSearch = useCallback(() => {
    setShowProductSearch((v) => !v)
  }, [])

  useInvoiceHotkeys({
    onQuickAdd: () => setShowProductSearch(true),
    onSave: handleSubmit,
    onEscape: () => setShowProductSearch(false),
  })

  const formTitle = type === 'SALE_INVOICE'
    ? t.newInvoice
    : getCreateTitle(type)

  return (
    <AppShell>
      <Header
        title={formTitle}
        backTo={getCreateBackTo(type)}
        actions={
          <Button variant="none" type="button" className="header-icon-btn" onClick={() => nav(ROUTES.BILL_SCAN)} aria-label={t.scanBillAddItems}>
            <Camera size={20} aria-hidden="true" />
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

        <InvoiceHeaderMeta
          documentDate={form.documentDate}
          onDateChange={(v) => updateField('documentDate', v)}
        />

        {gstEnabled && (
          <GstInvoiceHeader
            form={form}
            errors={errors}
            onUpdateField={updateField}
          />
        )}

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
          priceListId={priceListId}
          onPriceListChange={(id) => updateField('priceListId', id)}
          onPartyChange={handlePartyChange}
          onProductSelect={handleProductSelect}
          onUpdateLineItem={updateLineItem}
          onRemoveLineItem={removeLineItem}
          onToggleProductSearch={toggleProductSearch}
        />

        <InvoiceOptionalSections
          form={form}
          openSections={openSections}
          onOpenSectionsChange={setOpenSections}
          onUpdateField={updateField}
          onAddCharge={addCharge}
          onUpdateCharge={updateCharge}
          onRemoveCharge={removeCharge}
          hideDate
        />

        {/* GST breakdown — mounts only when GST is on with non-zero tax. */}
        {gstSummary && <InvoiceGstSummary data={gstSummary} />}

        {/* Payment-at-creation — sale invoices only. */}
        {type === 'SALE_INVOICE' && totals.grandTotal > 0 && (
          <ReceivePaymentToggle
            grandTotal={totals.grandTotal}
            payment={form.payment}
            onChange={(next) => updateField('payment', next)}
          />
        )}
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
        // Preview is the last stop before saving, so it runs the same checks the
        // save does — an empty ₹0.00 preview with a live "Save & Send" button
        // only leads to a rejected save the seller has to decode.
        onPreview={() => { if (validate()) setShowPreview(true) }}
      />

      <InvoicePreviewDrawer
        open={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={handleSubmit}
        isSubmitting={isSubmitting}
        partyName={partyName}
        documentDate={form.documentDate}
        lineItems={form.lineItems}
        productNames={productNames}
        totals={totals}
        notes={form.notes}
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
