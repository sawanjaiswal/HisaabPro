/** Create Invoice — Page (lazy loaded)
 *
 * Follows CreatePartyPage.tsx pattern: pill tabs for sections,
 * sticky bottom totals bar with save actions.
 * Sections: Items · Details · Charges
 */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useGstGate } from '@/features/gst/useGstGate'
import { useInvoiceForm } from './useInvoiceForm'
import { useBillScanPrefill } from './useBillScanPrefill'
import { getCreateTitle } from '@/features/sales/sales.utils'
import type { DocumentType } from './invoice.types'
import { InvoiceTotalsBar } from './components/InvoiceTotalsBar'
import { InvoiceItemsSection } from './components/InvoiceItemsSection'
import { InvoiceDetailsSection } from './components/InvoiceDetailsSection'
import { InvoiceCustomFieldsSection } from './components/InvoiceCustomFieldsSection'
import { InvoiceChargesSection } from './components/InvoiceChargesSection'
import { GstInvoiceHeader } from './components/GstInvoiceHeader'
import { UntaggedTaxDialog } from './components/UntaggedTaxDialog'
import { StockShortageBanner } from './components/StockShortageBanner'
import { ExpiredBatchBanner } from '@/features/inventory/components/ExpiredBatchBanner'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import './invoice-party-search.css'
import './invoice-line-items.css'
import './invoice-product-search.css'
import './invoice-summary.css'
import './invoice-gst-banners.css'

interface CreateInvoicePageProps {
  /** Document type override — defaults to SALE_INVOICE.
   * Used by Estimate / Sale Order / Delivery Challan create routes
   * which share this same form engine (architect Q3 decision). */
  type?: DocumentType
}

export default function CreateInvoicePage({ type = 'SALE_INVOICE' }: CreateInvoicePageProps) {
  const nav = useNavigate()
  const { t } = useLanguage()
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
  } = useInvoiceForm(type)

  const { compositionScheme } = useGstGate()
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [showProductSearch, setShowProductSearch] = useState(false)
  /** Optional sections start collapsed to match the mockup's clean scroll, but
   *  charges open on their own when the document already carries some. */
  const [openSections, setOpenSections] = useState<string[]>(
    () => (form.additionalCharges.length > 0 ? ['charges'] : []),
  )

  useBillScanPrefill({ addLineItem, updateField, setProductNames })

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

  const formTitle = type === 'SALE_INVOICE'
    ? t.newInvoice
    : getCreateTitle(type)

  return (
    <AppShell>
      <Header
        title={formTitle}
        backTo={
          type === 'ESTIMATE'         ? '/sales/estimates'
          : type === 'SALE_ORDER'     ? '/sales/orders'
          : type === 'DELIVERY_CHALLAN' ? '/sales/challans'
          : ROUTES.INVOICES
        }
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

        {gstEnabled && (
          <GstInvoiceHeader
            form={form}
            errors={errors}
            onUpdateField={updateField}
          />
        )}

        {/* Mockup #2 is one continuous scroll — Customer and Items are always
            visible; the optional sections collapse rather than hiding behind
            tabs, so nothing that used to be reachable stops being reachable. */}
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

        <Accordion
          type="multiple"
          className="form-accordion"
          value={openSections}
          onValueChange={setOpenSections}
        >
          <AccordionItem value="details">
            <AccordionTrigger>{t.sectionDetails}</AccordionTrigger>
            <AccordionContent className="space-y-6">
              <InvoiceDetailsSection
                documentDate={form.documentDate}
                paymentTerms={form.paymentTerms}
                vehicleNumber={form.vehicleNumber ?? ''}
                notes={form.notes ?? ''}
                termsAndConditions={form.termsAndConditions ?? ''}
                includeSignature={form.includeSignature}
                onUpdateField={updateField}
              />
              <InvoiceCustomFieldsSection
                documentType={form.type}
                values={(form.customFieldValues ?? {}) as Record<string, unknown>}
                errors={{}}
                onChange={(v) => updateField('customFieldValues', v)}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="charges">
            <AccordionTrigger>{t.chargesLabel}</AccordionTrigger>
            <AccordionContent>
              <InvoiceChargesSection
                charges={form.additionalCharges}
                onUpdateCharge={updateCharge}
                onRemoveCharge={removeCharge}
                onAddCharge={addCharge}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
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
