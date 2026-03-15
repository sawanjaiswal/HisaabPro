/** Create Invoice — Page (lazy loaded)
 *
 * Follows CreatePartyPage.tsx pattern: pill tabs for sections,
 * sticky bottom totals bar with save actions.
 * Sections: Items · Details · Charges
 */

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { useInvoiceForm } from './useInvoiceForm'
import type { UseInvoiceFormReturn } from './useInvoiceForm'
import { LineItemEditor } from './components/LineItemEditor'
import { InvoiceTotalsBar } from './components/InvoiceTotalsBar'
import { PaymentTermsSelector } from './components/PaymentTermsSelector'
import { PartySearchInput } from './components/PartySearchInput'
import { ProductSearchInput } from './components/ProductSearchInput'
import { calculateLineTotal, calculateLineProfit } from './invoice.utils'
import type { PaymentTerms } from './invoice.types'
import './create-invoice.css'

type FormSection = 'items' | 'details' | 'charges'

const SECTIONS: { id: FormSection; label: string }[] = [
  { id: 'items', label: 'Items' },
  { id: 'details', label: 'Details' },
  { id: 'charges', label: 'Charges' },
]

export default function CreateInvoicePage() {
  const formHook: UseInvoiceFormReturn = useInvoiceForm('SALE_INVOICE')
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
    handleSubmit,
    handleSaveDraft,
  } = formHook

  // Map productId → productName for LineItemEditor display
  const [productNames, setProductNames] = useState<Record<string, string>>({})

  // Whether the inline product search panel is visible
  const [showProductSearch, setShowProductSearch] = useState(false)

  const handlePartyChange = (id: string, name: string) => {
    updateField('partyId', id)
    // If user cleared the selection, also clear the name tracking (no-op needed
    // since PartySearchInput manages its own display state)
    void name
  }

  const handleProductSelect = (productId: string, ratePaise: number, productName: string) => {
    // Guard: don't add the same product twice
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
  }

  const addedProductIds = form.lineItems.map((item) => item.productId)

  const handlePaymentTermsChange = (terms: PaymentTerms) => {
    updateField('paymentTerms', terms)
  }

  return (
    <AppShell>
      <Header title="New Invoice" backTo={ROUTES.INVOICES} />

      <PageContainer className="invoice-details-section">
        <nav className="pill-tabs" role="tablist" aria-label="Invoice form sections">
          {SECTIONS.map((section) => (
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
          aria-label={SECTIONS.find((s) => s.id === activeSection)?.label}
        >
          {/* ── Items Section ─────────────────────────────────── */}
          {activeSection === 'items' && (
            <div className="line-items-section">
              {/* Party search */}
              <PartySearchInput
                value={form.partyId}
                onChange={handlePartyChange}
                error={errors.partyId}
              />

              {/* Line items */}
              {form.lineItems.map((item, index) => {
                const { lineTotal, discountAmount } = calculateLineTotal(
                  item.quantity,
                  item.rate,
                  item.discountType,
                  item.discountValue,
                )
                const { profit, profitPercent } = calculateLineProfit(
                  item.rate,
                  0,
                  item.quantity,
                  discountAmount,
                )
                return (
                  <LineItemEditor
                    key={item.productId}
                    item={{
                      ...item,
                      productName: productNames[item.productId] ?? `Item ${index + 1}`,
                      discountAmount,
                      lineTotal,
                      profit,
                      profitPercent,
                    }}
                    index={index}
                    onUpdate={updateLineItem}
                    onRemove={removeLineItem}
                    showProfit={false}
                  />
                )
              })}

              {errors.lineItems && (
                <span className="field-error" role="alert">{errors.lineItems}</span>
              )}

              {/* Inline product search panel */}
              {showProductSearch && (
                <div className="product-search-panel">
                  <ProductSearchInput
                    onSelect={handleProductSelect}
                    addedProductIds={addedProductIds}
                  />
                </div>
              )}

              <button
                type="button"
                className="add-item-btn"
                onClick={() => setShowProductSearch((v) => !v)}
                aria-label={showProductSearch ? 'Hide product search' : 'Add line item'}
                aria-expanded={showProductSearch}
              >
                <Plus size={18} aria-hidden="true" />
                {showProductSearch ? 'Hide Search' : 'Add Item'}
              </button>
            </div>
          )}

          {/* ── Details Section ────────────────────────────────── */}
          {activeSection === 'details' && (
            <div className="line-items-section">
              <div className="line-item-field">
                <label className="label" htmlFor="invoice-date">
                  Invoice Date
                </label>
                <input
                  id="invoice-date"
                  type="date"
                  className="input"
                  value={form.documentDate}
                  onChange={(e) => updateField('documentDate', e.target.value)}
                  aria-label="Invoice date"
                  style={{ minHeight: '44px' }}
                />
              </div>

              <div className="line-item-field">
                <label className="label">Payment Terms</label>
                <PaymentTermsSelector
                  value={form.paymentTerms ?? 'COD'}
                  onChange={handlePaymentTermsChange}
                />
              </div>

              <div className="line-item-field">
                <label className="label" htmlFor="invoice-notes">
                  Notes
                </label>
                <textarea
                  id="invoice-notes"
                  className="input"
                  rows={3}
                  placeholder="Add a note for your customer..."
                  value={form.notes ?? ''}
                  onChange={(e) => updateField('notes', e.target.value)}
                  aria-label="Invoice notes"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                />
              </div>

              <div className="line-item-field">
                <label className="label" htmlFor="invoice-terms">
                  Terms &amp; Conditions
                </label>
                <textarea
                  id="invoice-terms"
                  className="input"
                  rows={3}
                  placeholder="Payment terms, return policy..."
                  value={form.termsAndConditions ?? ''}
                  onChange={(e) => updateField('termsAndConditions', e.target.value)}
                  aria-label="Terms and conditions"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                />
              </div>

              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <input
                  type="checkbox"
                  checked={form.includeSignature}
                  onChange={(e) => updateField('includeSignature', e.target.checked)}
                  aria-label="Include digital signature"
                />
                Include Digital Signature
              </label>
            </div>
          )}

          {/* ── Charges Section ───────────────────────────────── */}
          {activeSection === 'charges' && (
            <div className="charges-section">
              {form.additionalCharges.map((charge, index) => (
                <div key={`charge-${index}`} className="charge-row">
                  <input
                    type="text"
                    className="input"
                    placeholder="Charge name"
                    value={charge.name}
                    onChange={(e) => updateCharge(index, { name: e.target.value })}
                    aria-label={`Charge ${index + 1} name`}
                    style={{ minHeight: '44px', flex: 1 }}
                  />
                  <input
                    type="number"
                    className="input"
                    placeholder="Amount"
                    value={charge.value || ''}
                    onChange={(e) => updateCharge(index, { value: parseFloat(e.target.value) || 0 })}
                    aria-label={`Charge ${index + 1} value`}
                    style={{ minHeight: '44px', width: '100px' }}
                  />
                  <button
                    type="button"
                    className="charge-remove"
                    onClick={() => removeCharge(index)}
                    aria-label={`Remove charge ${charge.name || index + 1}`}
                  >
                    &times;
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="add-item-btn"
                onClick={() => addCharge({ name: '', type: 'FIXED', value: 0 })}
                aria-label="Add additional charge"
              >
                <Plus size={18} aria-hidden="true" />
                Add Charge
              </button>
            </div>
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
