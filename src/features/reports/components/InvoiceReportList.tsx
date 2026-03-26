/** InvoiceReportList — flat (ungrouped) invoice list */

import { ReportCardList } from './ReportCardList'
import { InvoiceCard } from './InvoiceCard'
import type { InvoiceReportItem } from '../report.types'

interface InvoiceReportListProps {
  items: InvoiceReportItem[]
  title: string
  onInvoiceClick: (id: string) => void
}

export function InvoiceReportList({
  items,
  title,
  onInvoiceClick,
}: InvoiceReportListProps) {
  return (
    <ReportCardList ariaLabel={`${title} invoices`}>
      {items.map((item) => (
        <InvoiceCard key={item.id} item={item} onClick={onInvoiceClick} />
      ))}
    </ReportCardList>
  )
}
