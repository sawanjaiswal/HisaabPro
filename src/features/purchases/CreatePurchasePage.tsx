/** Create Purchase Invoice — Page (lazy loaded), mockup #12.
 *
 * The same form engine as Create Invoice (#2), locked to PURCHASE_INVOICE:
 * one continuous scroll — supplier and items always visible, the optional
 * blocks collapse instead of hiding behind tabs. Details opens by default
 * because the mockup shows purchase date and supplier invoice no. up front.
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
import { InvoiceOptionalSections } from '@/features/invoices/components/InvoiceOptionalSections'
import { ROUTES } from '@/config/routes.config'
import '@/features/invoices/invoice-party-search.css'
import '@/features/invoices/invoice-line-items.css'
import '@/features/invoices/invoice-product-search.css'
import '@/features/invoices/invoice-summary.css'
import './purchase-form.css'
import type { ProductPick } from '@/features/invoices/invoice.types'

export default function CreatePurchasePage() {
  const { t } = useLanguage()
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [showProductSearch, setShowProductSearch] = useState(false)

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
  } = useInvoiceForm('PURCHASE_INVOICE')

  /** Details is open from the start — a purchase without its date and the
   *  supplier's bill number is not a usable record. */
  const [openSections, setOpenSections] = useState<string[]>(
    () => (form.additionalCharges.length > 0 ? ['details', 'charges'] : ['details']),
  )

  const handlePartyChange = useCallback((id: string, _name: string) => {
    updateField('partyId', id)
  }, [updateField])

  const handleProductSelect = useCallback((pick: ProductPick) => {
    const { productId, salePrice: ratePaise, name: productName } = pick
    const alreadyAdded = form.lineItems.some((item) => item.productId === productId)
    if (alreadyAdded) return
    setProductNames((prev) => ({ ...prev, [productId]: productName }))
    addLineItem({
      productId,
      quantity: 1,
      rate: ratePaise,
      discountType: 'PERCENTAGE',
      discountValue: 0,
      taxCategoryId: pick.taxCategoryId,
      hsnCode: '',
    })
  }, [form.lineItems, addLineItem])

  const toggleProductSearch = useCallback(() => {
    setShowProductSearch((v) => !v)
  }, [])

  return (
    <AppShell>
      <Header title={t.newPurchase} backTo={ROUTES.PURCHASES} />

      <PageContainer className="invoice-details-section stagger-enter py-0 space-y-6">
        <div className="purchase-stock-hint" role="status" aria-live="polite">
          <Package size={16} aria-hidden="true" />
          <span>{t.stockWillBeAdded}</span>
        </div>

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

        <InvoiceOptionalSections
          form={form}
          openSections={openSections}
          onOpenSectionsChange={setOpenSections}
          onUpdateField={updateField}
          onAddCharge={addCharge}
          onUpdateCharge={updateCharge}
          onRemoveCharge={removeCharge}
        />
      </PageContainer>

      <InvoiceTotalsBar
        subtotal={totals.subtotal}
        totalDiscount={totals.totalDiscount}
        totalCharges={totals.totalCharges}
        totalTax={totals.totalTax}
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
