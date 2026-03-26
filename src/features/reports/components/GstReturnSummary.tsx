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
import { useLanguage } from '@/hooks/useLanguage'

interface GstReturnSummaryProps {
  returnType: GstReturnType
  data: Gstr1Data | Gstr3bData | Gstr9Data
}

interface TaxRowProps {
  label: string
  totals: TaxTotals
}

const TaxRow: React.FC<TaxRowProps> = ({ label, totals }) => {
  const { t } = useLanguage()
  return (
  <div className="gst-return__row">
    <div className="gst-return__row-header">
      <span className="gst-return__row-label">{label}</span>
      <span className="gst-return__row-count">{totals.count} {t.invoices}</span>
    </div>
    <div className="gst-return__row-amounts">
      <span>{t.taxable}: {formatAmount(totals.taxableValue)}</span>
      {totals.cgst > 0 && <span>CGST: {formatAmount(totals.cgst)}</span>}
      {totals.sgst > 0 && <span>SGST: {formatAmount(totals.sgst)}</span>}
      {totals.igst > 0 && <span>IGST: {formatAmount(totals.igst)}</span>}
      <span className="gst-return__row-total">{t.tax}: {formatAmount(totals.total)}</span>
    </div>
  </div>
  )
}

function Gstr1Section({ data }: { data: Gstr1Data }) {
  const { t } = useLanguage()
  return (
    <>
      <TaxRow label={t.b2bRegistered} totals={data.b2b} />
      <TaxRow label={t.b2clLargeUnregistered} totals={data.b2cl} />
      <TaxRow label={t.b2csSmallUnregistered} totals={data.b2cs} />
      <TaxRow label={t.cdnrRegistered} totals={data.cdnr} />
      <TaxRow label={t.cdnurUnregistered} totals={data.cdnur} />
    </>
  )
}

function Gstr3bSection({ data }: { data: Gstr3bData }) {
  const { t } = useLanguage()
  return (
    <>
      <TaxRow label={t.outwardSupplies} totals={data.outwardSupplies} />
      <TaxRow label={t.inputTaxCredit} totals={data.inputTaxCredit} />
      <TaxRow label={t.creditNoteAdjustment} totals={data.creditNoteAdjustment} />
      <div className="gst-return__net-tax">
        <span className="gst-return__net-tax-label">{t.netTaxPayable}</span>
        <span className="gst-return__net-tax-value">
          {formatAmount(data.netTaxPayable)}
        </span>
      </div>
    </>
  )
}

function Gstr9Section({ data }: { data: Gstr9Data }) {
  const { t } = useLanguage()
  return (
    <>
      <p className="gst-return__fy-label">{t.financialYear}: {data.financialYear}</p>
      <TaxRow label={t.sales} totals={data.sales} />
      <TaxRow label={t.purchases} totals={data.purchases} />
      <TaxRow label={t.creditNotes} totals={data.creditNotes} />
      <TaxRow label={t.debitNotes} totals={data.debitNotes} />
    </>
  )
}

export const GstReturnSummary: React.FC<GstReturnSummaryProps> = ({ returnType, data }) => {
  return (
    <div className="gst-return" role="region" aria-label={`${returnType} summary`}>
      {returnType === 'GSTR1' && <Gstr1Section data={data as Gstr1Data} />}
      {returnType === 'GSTR3B' && <Gstr3bSection data={data as Gstr3bData} />}
      {returnType === 'GSTR9' && <Gstr9Section data={data as Gstr9Data} />}
    </div>
  )
}
