/** GST Return Summary
 *
 * Renders GSTR-1, GSTR-3B, or GSTR-9 summary data based on returnType.
 * All amounts in paise via formatAmount().
 */

import React from 'react'
import { formatAmount } from '../report.utils'
import type {
  GstReturnType,
  Gstr1Data,
  Gstr3bData,
  Gstr9Data,
  TaxTotals,
} from '../report-tax.types'

interface GstReturnSummaryProps {
  returnType: GstReturnType
  data: Gstr1Data | Gstr3bData | Gstr9Data
}

interface TaxRowProps {
  label: string
  totals: TaxTotals
}

const TaxRow: React.FC<TaxRowProps> = ({ label, totals }) => (
  <div className="gst-return__row">
    <div className="gst-return__row-header">
      <span className="gst-return__row-label">{label}</span>
      <span className="gst-return__row-count">{totals.count} invoices</span>
    </div>
    <div className="gst-return__row-amounts">
      <span>Taxable: {formatAmount(totals.taxableValue)}</span>
      {totals.cgst > 0 && <span>CGST: {formatAmount(totals.cgst)}</span>}
      {totals.sgst > 0 && <span>SGST: {formatAmount(totals.sgst)}</span>}
      {totals.igst > 0 && <span>IGST: {formatAmount(totals.igst)}</span>}
      <span className="gst-return__row-total">Tax: {formatAmount(totals.total)}</span>
    </div>
  </div>
)

function renderGstr1(data: Gstr1Data) {
  return (
    <>
      <TaxRow label="B2B — Registered Buyers" totals={data.b2b} />
      <TaxRow label="B2CL — Large Unregistered" totals={data.b2cl} />
      <TaxRow label="B2CS — Small Unregistered" totals={data.b2cs} />
      <TaxRow label="CDNR — Credit/Debit (Registered)" totals={data.cdnr} />
      <TaxRow label="CDNUR — Credit/Debit (Unregistered)" totals={data.cdnur} />
    </>
  )
}

function renderGstr3b(data: Gstr3bData) {
  return (
    <>
      <TaxRow label="Outward Supplies" totals={data.outwardSupplies} />
      <TaxRow label="Input Tax Credit" totals={data.inputTaxCredit} />
      <TaxRow label="Credit Note Adjustment" totals={data.creditNoteAdjustment} />
      <div className="gst-return__net-tax">
        <span className="gst-return__net-tax-label">Net Tax Payable</span>
        <span className="gst-return__net-tax-value">
          {formatAmount(data.netTaxPayable)}
        </span>
      </div>
    </>
  )
}

function renderGstr9(data: Gstr9Data) {
  return (
    <>
      <p className="gst-return__fy-label">Financial Year: {data.financialYear}</p>
      <TaxRow label="Sales" totals={data.sales} />
      <TaxRow label="Purchases" totals={data.purchases} />
      <TaxRow label="Credit Notes" totals={data.creditNotes} />
      <TaxRow label="Debit Notes" totals={data.debitNotes} />
    </>
  )
}

export const GstReturnSummary: React.FC<GstReturnSummaryProps> = ({ returnType, data }) => {
  return (
    <div className="gst-return" role="region" aria-label={`${returnType} summary`}>
      {returnType === 'GSTR1' && renderGstr1(data as Gstr1Data)}
      {returnType === 'GSTR3B' && renderGstr3b(data as Gstr3bData)}
      {returnType === 'GSTR9' && renderGstr9(data as Gstr9Data)}
    </div>
  )
}
