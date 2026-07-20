/** Invoice list — one day group: sticky-free header + its rows.
 *
 * Presentational only. The grouping maths lives in
 * `invoice-list-group.utils.ts`; this resolves the relative day label to a
 * translation and renders the rows it is handed.
 */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatInvoiceAmount } from '../invoice-format.utils'
import type { InvoiceDayGroup } from '../invoice-list-group.utils'

interface InvoiceListGroupProps {
  group: InvoiceDayGroup
  children: React.ReactNode
}

export const InvoiceListGroup: React.FC<InvoiceListGroupProps> = ({ group, children }) => {
  const { t } = useLanguage()

  const label = group.isToday
    ? t.dateToday
    : group.isYesterday
      ? t.dateYesterday
      : group.label

  return (
    <section className="invoice-day-group py-0" aria-label={label}>
      <div className="invoice-day-header">
        <span className="invoice-day-label">{label}</span>
        <span className="invoice-day-total tabular-nums">
          {formatInvoiceAmount(group.totalPaise)}
        </span>
      </div>
      <div className="invoice-day-rows">{children}</div>
    </section>
  )
}
