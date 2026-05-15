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
import { FORM_SECTIONS } from '../invoice.constants'
import type { DocumentFormData } from '../invoice.types'

interface EditInvoiceFormProps {
  invoiceId: string
  initialData: DocumentFormData
  initialProductNames: Record<string, string>
}

export function EditInvoiceForm({
  invoiceId,
  initialData,
  initialProductNames,
}: EditInvoiceFormProps) {
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
    stockShortageItems,
    clearStockShortage,
    priceListId,
  } = useInvoiceForm(initialData.type, 'NONE', { editId: invoiceId, initialData })

  const { gstEnabled, compositionScheme } = useGstGate()
  const [productNames, setProductNames] = useState<Record<string, string>>(initialProductNames)
  const [showProductSearch, setShowProductSearch] = useState(false)

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
      <Header title={t.editInvoice} backTo={`/invoices/${invoiceId}`} />

      <PageContainer className="invoice-details-section py-0">
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
              isEditMode={true}
              priceListId={priceListId}
              onPriceListChange={(id) => updateField('priceListId', id)}
              onPartyChange={handlePartyChange}
              onProductSelect={handleProductSelect}
              onUpdateLineItem={updateLineItem}
              onRemoveLineItem={removeLineItem}
              onToggleProductSearch={toggleProductSearch}
            />
          )}

          {activeSection === 'details' && (
            <>
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
            </>
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
