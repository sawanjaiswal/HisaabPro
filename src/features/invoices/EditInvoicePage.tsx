/** Edit Invoice — Page (lazy loaded) */
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useInvoiceForm } from './useInvoiceForm'
import { InvoiceTotalsBar } from './components/InvoiceTotalsBar'
import { InvoiceItemsSection } from './components/InvoiceItemsSection'
import { InvoiceDetailsSection } from './components/InvoiceDetailsSection'
import { InvoiceChargesSection } from './components/InvoiceChargesSection'
import { FORM_SECTIONS } from './invoice.constants'
import { getDocument } from './invoice.service'
import type { DocumentFormData, DocumentDetail, PaymentTerms } from './invoice.types'
import './invoice-party-search.css'
import './invoice-line-items.css'
import './invoice-product-search.css'
import './invoice-summary.css'

function detailToFormData(detail: DocumentDetail): DocumentFormData {
  return {
    type: detail.type,
    status: detail.status === 'DRAFT' ? 'DRAFT' : 'SAVED',
    partyId: detail.party.id,
    documentDate: detail.documentDate.slice(0, 10),
    paymentTerms: detail.paymentTerms as PaymentTerms | undefined,
    dueDate: detail.dueDate?.slice(0, 10),
    shippingAddressId: null,
    notes: detail.notes ?? '',
    termsAndConditions: detail.termsAndConditions ?? '',
    vehicleNumber: detail.vehicleNumber ?? '',
    includeSignature: detail.includeSignature,
    lineItems: detail.lineItems.map((li) => ({
      productId: li.product.id,
      quantity: li.quantity,
      rate: li.rate,
      discountType: li.discountType,
      discountValue: li.discountValue,
    })),
    additionalCharges: detail.additionalCharges.map((ch) => ({
      name: ch.name,
      type: ch.type,
      value: ch.value,
    })),
    transportDetails: detail.transportDetails ?? null,
  }
}

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>()
  const invoiceId = id ?? ''
  const [loadStatus, setLoadStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [initialData, setInitialData] = useState<DocumentFormData | undefined>()
  const [productNameMap, setProductNameMap] = useState<Record<string, string>>({})

  useEffect(() => {
    const controller = new AbortController()
    setLoadStatus('loading')

    getDocument(invoiceId, controller.signal)
      .then((detail) => {
        setInitialData(detailToFormData(detail))
        const nameMap: Record<string, string> = {}
        for (const li of detail.lineItems) {
          nameMap[li.product.id] = li.product.name
        }
        setProductNameMap(nameMap)
        setLoadStatus('ready')
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setLoadStatus('error')
      })

    return () => controller.abort()
  }, [invoiceId])

  if (loadStatus === 'loading') {
    return (
      <AppShell>
        <Header title="Edit Invoice" backTo={`/invoices/${invoiceId}`} />
        <PageContainer>
          <Skeleton height="2.5rem" borderRadius="var(--radius-full)" />
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Skeleton height="5rem" borderRadius="var(--radius-md)" count={3} />
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (loadStatus === 'error' || !initialData) {
    return (
      <AppShell>
        <Header title="Edit Invoice" backTo={`/invoices/${invoiceId}`} />
        <PageContainer>
          <ErrorState
            title="Could not load invoice"
            message="Check your connection and try again."
            onRetry={() => window.location.reload()}
          />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <EditInvoiceForm
      invoiceId={invoiceId}
      initialData={initialData}
      initialProductNames={productNameMap}
    />
  )
}

function EditInvoiceForm({
  invoiceId,
  initialData,
  initialProductNames,
}: {
  invoiceId: string
  initialData: DocumentFormData
  initialProductNames: Record<string, string>
}) {
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
  } = useInvoiceForm(initialData.type, 'NONE', { editId: invoiceId, initialData })

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
    })
  }, [form.lineItems, addLineItem])

  const toggleProductSearch = useCallback(() => {
    setShowProductSearch((v) => !v)
  }, [])

  return (
    <AppShell>
      <Header title="Edit Invoice" backTo={`/invoices/${invoiceId}`} />

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
