/** Invoice summary tiles — Total / Paid / Due row under the detail hero.
 *
 * GPT new-design pattern (design #4). Pure display; amounts are in paise and
 * come straight off the document payload (grandTotal, paidAmount, balanceDue).
 */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { SummaryTiles } from '@/components/ui/SummaryTiles'
import { formatInvoiceAmount } from '../invoice-format.utils'
import type { DocumentDetail } from '../invoice-document.types'

interface InvoiceSummaryTilesProps {
  document: Pick<DocumentDetail, 'grandTotal' | 'paidAmount' | 'balanceDue'>
}

export const InvoiceSummaryTiles: React.FC<InvoiceSummaryTilesProps> = ({ document }) => {
  const { t } = useLanguage()

  return (
    <SummaryTiles
      aria-label={t.invoiceTotalsAriaLabel}
      tiles={[
        { id: 'total', label: t.grandTotal, value: formatInvoiceAmount(document.grandTotal), tone: 'neutral' },
        { id: 'paid', label: t.paid, value: formatInvoiceAmount(document.paidAmount), tone: 'paid' },
        { id: 'due', label: t.totalDue, value: formatInvoiceAmount(document.balanceDue), tone: 'due' },
      ]}
    />
  )
}
