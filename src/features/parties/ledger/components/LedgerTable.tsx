/** Ledger — Data table: Date | Particulars | Type | DR | CR | Running Balance */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import { formatDate } from '@/lib/format'
import type { LedgerRow, LedgerVoucherType } from '../ledger.types'

interface LedgerTableProps {
  rows: LedgerRow[]
  openingBalance: number
  closingBalance: number
}

const TYPE_BADGE: Record<LedgerVoucherType, string> = {
  SALE:        'ledger-type ledger-type--sale',
  PURCHASE:    'ledger-type ledger-type--purchase',
  PAYMENT:     'ledger-type ledger-type--payment',
  RECEIPT:     'ledger-type ledger-type--receipt',
  CREDIT_NOTE: 'ledger-type ledger-type--credit',
  DEBIT_NOTE:  'ledger-type ledger-type--debit',
  JOURNAL:     'ledger-type ledger-type--journal',
  OPENING:     'ledger-type ledger-type--opening',
}

const TYPE_LABEL: Record<LedgerVoucherType, string> = {
  SALE:        'Sale',
  PURCHASE:    'Purchase',
  PAYMENT:     'Payment',
  RECEIPT:     'Receipt',
  CREDIT_NOTE: 'Cr. Note',
  DEBIT_NOTE:  'Dr. Note',
  JOURNAL:     'Journal',
  OPENING:     'Opening',
}

function balanceLabel(paise: number): string {
  if (paise === 0) return `${formatPaise(0)} Nil`
  return paise > 0
    ? `${formatPaise(Math.abs(paise))} Dr`
    : `${formatPaise(Math.abs(paise))} Cr`
}

export const LedgerTable: React.FC<LedgerTableProps> = ({
  rows,
  openingBalance,
  closingBalance,
}) => {
  const { t } = useLanguage()

  return (
    <div className="ledger-table-wrap" role="region" aria-label={t.ledgerTable}>
      <table className="ledger-table" aria-label={t.ledgerTableAriaLabel}>
        <thead>
          <tr>
            <th scope="col" className="ledger-th ledger-th--date">{t.date}</th>
            <th scope="col" className="ledger-th ledger-th--particulars">{t.particulars}</th>
            <th scope="col" className="ledger-th ledger-th--type">{t.voucherType}</th>
            <th scope="col" className="ledger-th ledger-th--amount">{t.drLabel}</th>
            <th scope="col" className="ledger-th ledger-th--amount">{t.crLabel}</th>
            <th scope="col" className="ledger-th ledger-th--balance">{t.balance}</th>
          </tr>
        </thead>
        <tbody>
          {/* Opening balance row */}
          <tr className="ledger-tr ledger-tr--summary">
            <td className="ledger-td ledger-td--date">—</td>
            <td className="ledger-td ledger-td--particulars ledger-opening">{t.openingBalance}</td>
            <td className="ledger-td" />
            <td className="ledger-td" />
            <td className="ledger-td" />
            <td className="ledger-td ledger-td--balance ledger-opening">
              {balanceLabel(openingBalance)}
            </td>
          </tr>

          {rows.map((row) => (
            <tr key={row.id} className="ledger-tr">
              <td className="ledger-td ledger-td--date">
                {formatDate(row.date)}
              </td>
              <td className="ledger-td ledger-td--particulars">
                <span className="ledger-particulars">{row.particulars}</span>
                {row.voucherNumber && (
                  <span className="ledger-voucher-num">{row.voucherNumber}</span>
                )}
              </td>
              <td className="ledger-td ledger-td--type">
                <span className={TYPE_BADGE[row.voucherType] ?? 'ledger-type'}>
                  {TYPE_LABEL[row.voucherType] ?? row.voucherType}
                </span>
              </td>
              <td className="ledger-td ledger-td--amount ledger-dr">
                {row.dr > 0 ? formatPaise(row.dr) : '—'}
              </td>
              <td className="ledger-td ledger-td--amount ledger-cr">
                {row.cr > 0 ? formatPaise(row.cr) : '—'}
              </td>
              <td className="ledger-td ledger-td--balance">
                {balanceLabel(row.runningBalance)}
              </td>
            </tr>
          ))}

          {/* Closing balance row */}
          <tr className="ledger-tr ledger-tr--summary ledger-tr--closing">
            <td className="ledger-td" />
            <td className="ledger-td ledger-td--particulars ledger-closing">{t.closingBalance}</td>
            <td className="ledger-td" />
            <td className="ledger-td" />
            <td className="ledger-td" />
            <td className="ledger-td ledger-td--balance ledger-closing">
              {balanceLabel(closingBalance)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
