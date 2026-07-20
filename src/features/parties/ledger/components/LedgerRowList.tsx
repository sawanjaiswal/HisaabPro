/** Party Ledger — row list: opening-balance bar · month groups · running-balance footer */

import { useNavigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { TransactionRow } from '@/components/ui/TransactionRow'
import { formatPaise } from '@/lib/format'
import { PAYMENT_MODE_LABELS } from '@/features/payments/payment-labels.constants'
import { ROUTES } from '@/config/routes.config'
import type { PaymentMode } from '@/features/payments/payment.types'
import { groupLedgerByMonth, rowAmountPaise, rowDirection } from '../ledger.utils'
import type { LedgerRow } from '../ledger.types'

interface LedgerRowListProps {
  rows: LedgerRow[]
  openingBalance: number
  closingBalance: number
  /** Range end date (YYYY-MM-DD) — shown as "As on …" in the footer. */
  asOn?: string
}

/** "Dr" when positive (they owe us), "Cr" when negative (we owe them), "" at zero. */
function drCrTag(paise: number): string {
  if (paise === 0) return ''
  return paise > 0 ? 'Dr' : 'Cr'
}

/** "10 May 2025" — short Indian date. */
function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Trailing digits of a voucher number: "INV-1056" → "1056". */
function trailingDigits(voucherNumber: string): string {
  return voucherNumber.match(/(\d+)$/)?.[1] ?? voucherNumber
}

/** Row title: "Invoice #1056" for sales, "Payment Received/Made", else particulars. */
function rowTitle(row: LedgerRow, t: ReturnType<typeof useLanguage>['t']): string {
  if (row.source === 'PAYMENT') {
    return row.cr > 0 ? t.paymentReceived : t.paymentMade
  }
  if (row.voucherType === 'SALE' && row.voucherNumber) {
    return `${t.invoiceLabel} #${trailingDigits(row.voucherNumber)}`
  }
  return row.particulars
}

/** Row subtitle: "2 items • INV-1056" | "UPI • PAY-1005" | voucher number. */
function rowSubtitle(row: LedgerRow, itemsWord: string): string | undefined {
  const num = row.voucherNumber || ''
  if (row.source === 'PAYMENT') {
    const mode = row.mode ? PAYMENT_MODE_LABELS[row.mode as PaymentMode] ?? row.mode : ''
    if (mode && num) return `${mode} • ${num}`
    return mode || num || undefined
  }
  if (row.itemCount && row.itemCount > 0) {
    return num ? `${row.itemCount} ${itemsWord} • ${num}` : `${row.itemCount} ${itemsWord}`
  }
  return num || undefined
}

export function LedgerRowList({ rows, openingBalance, closingBalance, asOn }: LedgerRowListProps) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const groups = groupLedgerByMonth(rows, openingBalance)
  const closingTag = drCrTag(closingBalance)
  const openingTag = drCrTag(openingBalance)

  const rowHref = (row: LedgerRow): (() => void) | undefined => {
    if (row.source === 'DOCUMENT') return () => navigate(ROUTES.INVOICE_DETAIL.replace(':id', row.id))
    if (row.source === 'PAYMENT') return () => navigate(ROUTES.PAYMENT_DETAIL.replace(':id', row.id))
    return undefined
  }

  return (
    <div className="ledger-rowlist">
      {/* Opening balance bar */}
      <div className="ledger-opening-bar">
        <span className="ledger-opening-bar__icon" aria-hidden="true">
          <Wallet className="w-4 h-4" />
        </span>
        <span className="ledger-opening-bar__label">{t.openingBalance}</span>
        <span className="ledger-opening-bar__value tabular-nums">
          {formatPaise(Math.abs(openingBalance))}
          {openingTag && <span className="ledger-total__tag">{openingTag}</span>}
        </span>
      </div>

      {groups.map((group) => (
        <section key={group.key} className="ledger-month" aria-label={group.label}>
          <header className="ledger-month__head">
            <span className="ledger-month__label">{group.label}</span>
          </header>

          <div className="ledger-month__rows">
            {group.rows.map((row) => (
              <TransactionRow
                key={row.id}
                date={row.date}
                direction={rowDirection(row)}
                title={rowTitle(row, t)}
                reference={rowSubtitle(row, t.items)}
                amountPaise={rowAmountPaise(row)}
                onClick={rowHref(row)}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Running-balance footer */}
      <footer className="ledger-total">
        <div className="ledger-total__meta">
          <span className="ledger-total__label">{t.runningBalance}</span>
          {asOn && (
            <span className="ledger-total__ason">{t.asOn} {formatShortDate(asOn)}</span>
          )}
        </div>
        <div className="ledger-total__amt">
          <span className="ledger-total__value tabular-nums">
            {formatPaise(Math.abs(closingBalance))}
            {closingTag && <span className="ledger-total__tag">{closingTag}</span>}
          </span>
          {closingBalance > 0 && (
            <span className="ledger-total__overdue">{t.overdue}</span>
          )}
        </div>
      </footer>
    </div>
  )
}
