/** HSN Summary Table
 *
 * Renders HSN-wise tax breakup as a scrollable card list on mobile
 * and a table on tablet+. All amounts in paise via formatAmount().
 */

import React from 'react'
import { formatAmount } from '../report.utils'
import type { HsnSummaryItem } from '../report-tax.types'
import { useLanguage } from '@/hooks/useLanguage'

interface HsnSummaryTableProps {
  items: HsnSummaryItem[]
}

export const HsnSummaryTable: React.FC<HsnSummaryTableProps> = ({
  items }) => {
  const { t } = useLanguage()
    return (
    <div className="hsn-summary" role="region" aria-label={t.hsnWiseTaxSummary}>
      <h2 className="hsn-summary__heading">{t.hsnSacSummary}</h2>

      {/* Mobile: card list */}
      <div className="hsn-summary__cards" aria-hidden="false">
        {items.map((item) => (
          <div key={item.hsnCode} className="hsn-summary__card">
            <div className="hsn-summary__card-header">
              <span className="hsn-summary__code">{item.hsnCode}</span>
              <span className="hsn-summary__qty">Qty: {item.quantity}</span>
            </div>
            <div className="hsn-summary__card-row">
              <span className="hsn-summary__field-label">{t.taxableValue}</span>
              <span className="hsn-summary__field-value">{formatAmount(item.taxableValue)}</span>
            </div>
            {item.cgst > 0 && (
              <div className="hsn-summary__card-row">
                <span className="hsn-summary__field-label">CGST</span>
                <span className="hsn-summary__field-value">{formatAmount(item.cgst)}</span>
              </div>
            )}
            {item.sgst > 0 && (
              <div className="hsn-summary__card-row">
                <span className="hsn-summary__field-label">SGST</span>
                <span className="hsn-summary__field-value">{formatAmount(item.sgst)}</span>
              </div>
            )}
            {item.igst > 0 && (
              <div className="hsn-summary__card-row">
                <span className="hsn-summary__field-label">IGST</span>
                <span className="hsn-summary__field-value">{formatAmount(item.igst)}</span>
              </div>
            )}
            <div className="hsn-summary__card-row hsn-summary__card-row--total">
              <span className="hsn-summary__field-label">{t.totalValue}</span>
              <span className="hsn-summary__field-value hsn-summary__field-value--strong">
                {formatAmount(item.totalValue)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
