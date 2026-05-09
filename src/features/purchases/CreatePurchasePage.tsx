/** Create Purchase Invoice — Page (lazy loaded)
 *
 * Wraps the existing invoice form with type=PURCHASE_INVOICE.
 * Shows "Stock will be added on save" hint.
 * Follows CreateInvoicePage pattern exactly.
 */

import { useCallback, useState } from 'react'
import { Package } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { useLanguage } from '@/hooks/useLanguage'
import { useInvoiceForm } from '@/features/invoices/useInvoiceForm'
import { InvoiceTotalsBar } from '@/features/invoices/components/InvoiceTotalsBar'
import { InvoiceItemsSection } from '@/features/invoices/components/InvoiceItemsSection'
import { InvoiceDetailsSection } from '@/features/invoices/components/InvoiceDetailsSection'
import { InvoiceChargesSection } from '@/features/invoices/components/InvoiceChargesSection'
import { FORM_SECTIONS } from '@/features/invoices/invoice.constants'
import { ROUTES } from '@/config/routes.config'
import '@/features/invoices/invoice-party-search.css'
import '@/features/invoices/invoice-line-items.css'
import '@/features/invoices/invoice-product-search.css'
import '@/features/invoices/invoice-summary.css'

export default function CreatePurchasePage() {
  const { t } = useLanguage()
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [showProductSearch, setShowProductSearch] = useState(false)

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
  } = useInvoiceForm('PURCHASE_INVOICE')

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

  return (
    <AppShell>
      <Header title={t.newPurchase} backTo={ROUTES.PURCHASES} />

      {/* "Stock will be added on save" hint */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-4)',
          background: 'var(--color-surface-secondary)',
          borderBottom: '1px solid var(--color-border)',
          fontSize: 'var(--fs-xs)',
          color: 'var(--color-text-muted)',
        }}
        role="status"
        aria-live="polite"
      >
        <Package size={14} aria-hidden="true" />
        <span>{t.stockWillBeAdded}</span>
      </div>

      <PageContainer className="invoice-details-section stagger-enter py-0 space-y-6">
        <nav className="pill-tabs" role="tablist" aria-label={t.purchaseFormSections}>
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
              gstEnabled={false}
              compositionScheme={false}
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
    </AppShell>
  )
}
