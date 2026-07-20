/** Invoice Preview (mockup #3) — the document as the customer will receive it.
 *
 * Renders from live form state, so it is a true "before you send it" check
 * rather than a re-fetch of something already saved. Edit closes back to the
 * form; Save & Send runs the same submit the totals bar does.
 */

import React from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { APP_NAME } from '@/config/app.config'
import { amountToWords } from '@/lib/amount-words'
import { formatInvoiceAmount } from '../invoice-format.utils'
import { calculateLineTotal } from '../invoice-calc.utils'
import type { InvoiceTotals } from '../invoice-calc.utils'
import type { LineItemFormData } from '../invoice.types'
import '../invoice-preview.css'

interface InvoicePreviewDrawerProps {
  open: boolean
  onClose: () => void
  /** Runs the real submit — same handler the totals bar's Save uses. */
  onConfirm: () => void
  isSubmitting: boolean
  partyName: string
  /** ISO date string "YYYY-MM-DD" */
  documentDate: string
  lineItems: LineItemFormData[]
  /** productId → display name, resolved by the form as products are picked. */
  productNames: Record<string, string>
  totals: InvoiceTotals
  notes?: string
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const InvoicePreviewDrawer: React.FC<InvoicePreviewDrawerProps> = ({
  open,
  onClose,
  onConfirm,
  isSubmitting,
  partyName,
  documentDate,
  lineItems,
  productNames,
  totals,
  notes,
}) => {
  const { t } = useLanguage()
  const { activeBusiness } = useAuth()
  const businessName = activeBusiness?.name ?? APP_NAME

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t.invoicePreview}
      size="lg"
      footer={
        <div className="invoice-preview-actions">
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            {t.edit}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? t.saving : t.saveAndSend}
          </Button>
        </div>
      }
    >
      <article className="invoice-preview-doc">
        <header className="invoice-preview-brand">
          <span className="invoice-preview-business">{businessName}</span>
          <span className="invoice-preview-doctype">{t.taxInvoice}</span>
        </header>

        <div className="invoice-preview-meta">
          <span className="invoice-preview-date">
            {t.dateInfoLabel}: {formatDate(documentDate)}
          </span>
        </div>

        <section className="invoice-preview-billto py-0">
          <span className="invoice-preview-billto-label">{t.billTo}</span>
          <span className="invoice-preview-billto-name">{partyName || '—'}</span>
        </section>

        <section className="invoice-preview-items py-0" role="table" aria-label={t.itemsLabel}>
          <div className="invoice-preview-row invoice-preview-row--head" role="row">
            <span role="columnheader">{t.itemLabel}</span>
            <span role="columnheader" className="text-right">{t.qty}</span>
            <span role="columnheader" className="text-right">{t.rate}</span>
            <span role="columnheader" className="text-right">{t.amount}</span>
          </div>

          {lineItems.map((item, i) => {
            const { lineTotal } = calculateLineTotal(
              item.quantity, item.rate, item.discountType, item.discountValue,
            )
            return (
              <div className="invoice-preview-row" role="row" key={`${item.productId}-${i}`}>
                <span role="cell" className="invoice-preview-item-name">
                  {productNames[item.productId] ?? item.productId}
                </span>
                <span role="cell" className="text-right tabular-nums">{item.quantity}</span>
                <span role="cell" className="text-right tabular-nums">
                  {formatInvoiceAmount(item.rate)}
                </span>
                <span role="cell" className="text-right tabular-nums">
                  {formatInvoiceAmount(item.isFreeItem ? 0 : lineTotal)}
                </span>
              </div>
            )
          })}
        </section>

        <section className="invoice-preview-totals py-0">
          <div className="invoice-preview-total-row">
            <span>{t.subtotal}</span>
            <span className="tabular-nums">{formatInvoiceAmount(totals.subtotal)}</span>
          </div>
          {totals.totalDiscount > 0 && (
            <div className="invoice-preview-total-row">
              <span>{t.discount}</span>
              <span className="tabular-nums">−{formatInvoiceAmount(totals.totalDiscount)}</span>
            </div>
          )}
          {totals.totalCharges > 0 && (
            <div className="invoice-preview-total-row">
              <span>{t.chargesLabel}</span>
              <span className="tabular-nums">+{formatInvoiceAmount(totals.totalCharges)}</span>
            </div>
          )}
          {totals.roundOff !== 0 && (
            <div className="invoice-preview-total-row">
              <span>{t.roundOff}</span>
              <span className="tabular-nums">
                {totals.roundOff > 0 ? '+' : '−'}{formatInvoiceAmount(Math.abs(totals.roundOff))}
              </span>
            </div>
          )}
          <div className="invoice-preview-total-row invoice-preview-total-row--grand">
            <span>{t.totalAmount}</span>
            <span className="tabular-nums">{formatInvoiceAmount(totals.grandTotal)}</span>
          </div>
        </section>

        <p className="invoice-preview-words">
          <span className="invoice-preview-words-label">{t.amountInWordsLabel}</span>
          {amountToWords(totals.grandTotal)}
        </p>

        {notes && <p className="invoice-preview-notes">{notes}</p>}
      </article>
    </Drawer>
  )
}
