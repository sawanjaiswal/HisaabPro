/** PublicInvoiceView — Renders public invoice data (no auth dependency)
 *
 * Pure display component. Receives a PublicInvoiceDto and a lang toggle.
 * Includes: party blocks, line items table, totals, notes, terms, UPI CTA.
 */

import { Smartphone } from 'lucide-react'
import type { PublicInvoiceDto } from '@/features/invoices/share-links.service'
import type { PublicLang } from '../hooks/usePublicLang'

// ─── Inline strings (no auth translation context on public pages) ─────────────

const STRINGS = {
  en: {
    from:        'From',
    to:          'To',
    date:        'Date',
    due:         'Due',
    item:        'Item',
    qty:         'Qty',
    rate:        'Rate',
    amount:      'Amount',
    subtotal:    'Subtotal',
    discount:    'Discount',
    charges:     'Additional Charges',
    roundOff:    'Round Off',
    total:       'Total',
    balanceDue:  'Balance Due',
    notes:       'Notes',
    terms:       'Terms & Conditions',
    payUpi:      'Pay via UPI',
    na:          '—',
  },
  hi: {
    from:        'से',
    to:          'को',
    date:        'तारीख',
    due:         'देय तिथि',
    item:        'वस्तु',
    qty:         'मात्रा',
    rate:        'दर',
    amount:      'राशि',
    subtotal:    'उप-कुल',
    discount:    'छूट',
    charges:     'अतिरिक्त शुल्क',
    roundOff:    'राउंड ऑफ',
    total:       'कुल',
    balanceDue:  'बकाया राशि',
    notes:       'नोट',
    terms:       'नियम और शर्तें',
    payUpi:      'UPI से भुगतान करें',
    na:          '—',
  },
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtAmount = (p: number) =>
  (p / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

const buildAddress = (addr: { street: string; city: string; state: string; pincode: string } | null) =>
  addr ? [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') : ''

function buildUpiLink(vpa: string, amount: number, name: string, ref: string): string {
  const params = new URLSearchParams({ pa: vpa, pn: name, am: String(amount / 100), cu: 'INR', tn: `Payment for ${ref}`, tr: ref })
  return `upi://pay?${params.toString()}`
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PublicInvoiceViewProps {
  invoice: PublicInvoiceDto
  lang: PublicLang
}

export function PublicInvoiceView({ invoice, lang }: PublicInvoiceViewProps) {
  const s = STRINGS[lang]

  const showUpi =
    !!invoice.business.upiVpa &&
    invoice.balanceDue > 0

  const upiLink = showUpi
    ? buildUpiLink(
        invoice.business.upiVpa!,
        invoice.balanceDue,
        invoice.business.name,
        invoice.documentNumber
      )
    : null

  return (
    <article className="pub-invoice" aria-label={`Invoice ${invoice.documentNumber}`}>
      {/* ── Header ── */}
      <header className="pub-invoice__header">
        <p className="pub-invoice__number">{invoice.documentNumber}</p>
        <div className="pub-invoice__dates">
          <span className="pub-invoice__date-item">
            <span className="pub-invoice__date-label">{s.date}:</span>
            {fmtDate(invoice.documentDate)}
          </span>
          {invoice.dueDate && (
            <span className="pub-invoice__date-item">
              <span className="pub-invoice__date-label">{s.due}:</span>
              {fmtDate(invoice.dueDate)}
            </span>
          )}
        </div>
      </header>

      {/* ── Party blocks ── */}
      <div className="pub-invoice__parties">
        <div className="pub-invoice__party-block">
          <p className="pub-invoice__party-label">{s.from}</p>
          <p className="pub-invoice__party-name">{invoice.business.name}</p>
          {invoice.business.address && (
            <p className="pub-invoice__party-detail">{invoice.business.address}</p>
          )}
        </div>
        <div className="pub-invoice__party-block">
          <p className="pub-invoice__party-label">{s.to}</p>
          <p className="pub-invoice__party-name">{invoice.party.name}</p>
          {invoice.party.phone && (
            <p className="pub-invoice__party-detail">{invoice.party.phone}</p>
          )}
          {invoice.party.billingAddress && (
            <p className="pub-invoice__party-detail">
              {buildAddress(invoice.party.billingAddress)}
            </p>
          )}
        </div>
      </div>

      <hr className="pub-invoice__divider" />

      {/* ── Line items ── */}
      <p className="pub-invoice__items-title">{s.item}s</p>
      <table className="pub-invoice__table" aria-label="Line items">
        <thead>
          <tr>
            <th scope="col">{s.item}</th>
            <th scope="col">{s.qty}</th>
            <th scope="col">{s.rate}</th>
            <th scope="col">{s.amount}</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((item) => (
            <tr key={item.id}>
              <td>
                <span className="pub-invoice__item-name">{item.product.name}</span>
                {item.product.unit && (
                  <span className="pub-invoice__item-unit"> / {item.product.unit}</span>
                )}
              </td>
              <td>{item.quantity}</td>
              <td>{fmtAmount(item.rate)}</td>
              <td>{fmtAmount(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr className="pub-invoice__divider" />

      {/* ── Totals ── */}
      <div className="pub-invoice__totals">
        <div className="pub-invoice__total-row">
          <span>{s.subtotal}</span>
          <span className="pub-invoice__total-amount">{fmtAmount(invoice.subtotal)}</span>
        </div>
        {invoice.totalDiscount > 0 && (
          <div className="pub-invoice__total-row">
            <span>{s.discount}</span>
            <span className="pub-invoice__total-amount">-{fmtAmount(invoice.totalDiscount)}</span>
          </div>
        )}
        {invoice.totalAdditionalCharges > 0 && (
          <div className="pub-invoice__total-row">
            <span>{s.charges}</span>
            <span className="pub-invoice__total-amount">+{fmtAmount(invoice.totalAdditionalCharges)}</span>
          </div>
        )}
        {invoice.roundOff !== 0 && (
          <div className="pub-invoice__total-row">
            <span>{s.roundOff}</span>
            <span className="pub-invoice__total-amount">{fmtAmount(invoice.roundOff)}</span>
          </div>
        )}
        <div className="pub-invoice__total-row pub-invoice__total-row--grand">
          <span>{s.total}</span>
          <span className="pub-invoice__total-amount">{fmtAmount(invoice.grandTotal)}</span>
        </div>
        {invoice.balanceDue !== invoice.grandTotal && (
          <div className="pub-invoice__total-row pub-invoice__total-row--balance">
            <span>{s.balanceDue}</span>
            <span className="pub-invoice__total-amount">{fmtAmount(invoice.balanceDue)}</span>
          </div>
        )}
      </div>

      {/* ── Notes ── */}
      {invoice.notes && (
        <div className="pub-invoice__notes-block">
          <p className="pub-invoice__notes-label">{s.notes}</p>
          <p className="pub-invoice__notes-text">{invoice.notes}</p>
        </div>
      )}

      {/* ── Terms ── */}
      {invoice.termsAndConditions && (
        <div className="pub-invoice__notes-block" style={{ marginTop: 'var(--space-3)' }}>
          <p className="pub-invoice__notes-label">{s.terms}</p>
          <p className="pub-invoice__notes-text">{invoice.termsAndConditions}</p>
        </div>
      )}

      {/* ── UPI CTA ── */}
      {showUpi && upiLink && (
        <div className="pub-invoice__upi">
          <a
            href={upiLink}
            className="pub-invoice__upi-btn"
            aria-label={s.payUpi}
          >
            <Smartphone size={18} aria-hidden="true" />
            {s.payUpi}
          </a>
        </div>
      )}
    </article>
  )
}
