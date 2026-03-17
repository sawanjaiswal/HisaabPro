/** Tax Summary Cards
 *
 * Displays sales, purchases, credit notes, and debit notes tax totals
 * in a scrollable row of metric cards. All amounts in paise via formatAmount().
 */

import React from 'react'
import { formatAmount } from '../report.utils'
import type { TaxSummaryData } from '../report-tax.types'

interface TaxSummaryCardsProps {
  summary: TaxSummaryData
}

interface TaxCardProps {
  label: string
  count: number
  taxableValue: number
  cgst: number
  sgst: number
  igst: number
  total: number
  colorClass?: string
}

const TaxCard: React.FC<TaxCardProps> = ({
  label, count, taxableValue, cgst, sgst, igst, total, colorClass,
}) => (
  <div className="tax-summary-card">
    <div className="tax-summary-card__header">
      <span className="tax-summary-card__label">{label}</span>
      <span className="tax-summary-card__count">{count} invoices</span>
    </div>
    <div className={`tax-summary-card__total ${colorClass ?? ''}`}>
      {formatAmount(total)}
    </div>
    <div className="tax-summary-card__breakdown">
      <span>Taxable: {formatAmount(taxableValue)}</span>
      {cgst > 0 && <span>CGST: {formatAmount(cgst)}</span>}
      {sgst > 0 && <span>SGST: {formatAmount(sgst)}</span>}
      {igst > 0 && <span>IGST: {formatAmount(igst)}</span>}
    </div>
  </div>
)

export const TaxSummaryCards: React.FC<TaxSummaryCardsProps> = ({ summary }) => {
  return (
    <div className="tax-summary-cards" role="region" aria-label="Tax summary by category">
      <TaxCard
        label="Sales Tax"
        count={summary.sales.count}
        taxableValue={summary.sales.taxableValue}
        cgst={summary.sales.cgst}
        sgst={summary.sales.sgst}
        igst={summary.sales.igst}
        total={summary.sales.total}
        colorClass="tax-summary-card__total--positive"
      />
      <TaxCard
        label="Purchase ITC"
        count={summary.purchases.count}
        taxableValue={summary.purchases.taxableValue}
        cgst={summary.purchases.cgst}
        sgst={summary.purchases.sgst}
        igst={summary.purchases.igst}
        total={summary.purchases.total}
        colorClass="tax-summary-card__total--info"
      />
      <TaxCard
        label="Credit Notes"
        count={summary.creditNotes.count}
        taxableValue={summary.creditNotes.taxableValue}
        cgst={summary.creditNotes.cgst}
        sgst={summary.creditNotes.sgst}
        igst={summary.creditNotes.igst}
        total={summary.creditNotes.total}
      />
      <TaxCard
        label="Debit Notes"
        count={summary.debitNotes.count}
        taxableValue={summary.debitNotes.taxableValue}
        cgst={summary.debitNotes.cgst}
        sgst={summary.debitNotes.sgst}
        igst={summary.debitNotes.igst}
        total={summary.debitNotes.total}
      />
    </div>
  )
}
