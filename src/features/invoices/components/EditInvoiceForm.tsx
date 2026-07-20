/** Edit Invoice Form — inner form component for EditInvoicePage
 * GST Phase 2 PR 6: adds GstInvoiceHeader + composition/RCM banners.
 */

import { useState, useCallback } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { useGstGate } from '@/features/gst/useGstGate'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { useInvoiceForm } from '../useInvoiceForm'
import { InvoiceTotalsBar } from './InvoiceTotalsBar'
import { InvoiceItemsSection } from './InvoiceItemsSection'
import { InvoiceDetailsSection } from './InvoiceDetailsSection'
import { InvoiceCustomFieldsSection } from './InvoiceCustomFieldsSection'
import { InvoiceChargesSection } from './InvoiceChargesSection'
import { GstInvoiceHeader } from './GstInvoiceHeader'
import { StockShortageBanner } from './StockShortageBanner'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { usePresence } from '@/features/collaboration/usePresence'
import { PresenceAvatars } from '@/features/collaboration/PresenceAvatars'
import { ConflictDialog } from '@/features/collaboration/ConflictDialog'
import type { DocumentFormData } from '../invoice.types'

interface EditInvoiceFormProps {
  invoiceId: string
  initialData: DocumentFormData
  initialProductNames: Record<string, string>
  version?: number
}

export function EditInvoiceForm({
  invoiceId,
  initialData,
  initialProductNames,
  version,
}: EditInvoiceFormProps) {
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
    stockShortageItems,
    clearStockShortage,
    priceListId,
    conflictReconcile,
  } = useInvoiceForm(initialData.type, 'NONE', { editId: invoiceId, initialData, version })
  const { peers } = usePresence('document', invoiceId, 'editing')

  const { gstEnabled, compositionScheme } = useGstGate()
  const [productNames, setProductNames] = useState<Record<string, string>>(initialProductNames)
  const [showProductSearch, setShowProductSearch] = useState(false)
  /** An existing invoice usually already has charges — open that section when
   *  it does, so editing does not require hunting for it. */
  const [openSections, setOpenSections] = useState<string[]>(
    () => (initialData.additionalCharges.length > 0 ? ['charges'] : []),
  )

  const handlePartyChange = useCallback((_partyId: string, _name: string) => {
    updateField('partyId', _partyId)
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

  return (
    <AppShell>
      <Header title={t.editInvoice} backTo={`/invoices/${invoiceId}`} actions={<PresenceAvatars peers={peers} />} />

      <PageContainer className="invoice-details-section py-0 space-y-6">
        {stockShortageItems.length > 0 && (
          <StockShortageBanner items={stockShortageItems} onDismiss={clearStockShortage} />
        )}

        {gstEnabled && (
          <GstInvoiceHeader
            form={form}
            errors={errors}
            onUpdateField={updateField}
          />
        )}

        {/* Same single-scroll structure as CreateInvoicePage (mockup #2) so the
            two forms do not diverge. */}
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
          isEditMode={true}
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

      <ConflictDialog
        conflict={conflictReconcile.conflict}
        overwriting={conflictReconcile.overwriting}
        onReload={conflictReconcile.reload}
        onOverwrite={conflictReconcile.overwrite}
        onDismiss={conflictReconcile.dismiss}
      />
    </AppShell>
  )
}
