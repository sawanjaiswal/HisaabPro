/** InvoiceReportGrouped — grouped invoice list with expand/collapse */

import { formatAmount } from '../report.utils'
import { ReportCardList } from './ReportCardList'
import { ReportGroupHeader } from './ReportGroupHeader'
import { InvoiceCard } from './InvoiceCard'
import type { InvoiceReportGroup } from '../report.types'
import { useLanguage } from '@/hooks/useLanguage'

interface InvoiceReportGroupedProps {
  groups: InvoiceReportGroup[]
  title: string
  expandedGroups: Set<string>
  onToggleGroup: (key: string) => void
  onInvoiceClick: (id: string) => void
}

export function InvoiceReportGrouped({
  groups,
  title,
  expandedGroups,
  onToggleGroup,
  onInvoiceClick,
}: InvoiceReportGroupedProps) {
  const { t } = useLanguage()
  return (
    <div role="list" aria-label={`${title} grouped`}>
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.key)
        const subtitle = `${group.invoiceCount} ${t.invoicesGrouped} · ${formatAmount(group.totalAmount)}`

        return (
          <div key={group.key} role="listitem">
            <ReportGroupHeader
              label={group.label}
              subtitle={subtitle}
              isExpanded={isExpanded}
              onToggle={() => onToggleGroup(group.key)}
            />

            {isExpanded && (
              <div className="report-group-items">
                <ReportCardList ariaLabel={`${t.invoicesInGroup} ${group.label}`}>
                  {group.items.map((item) => (
                    <InvoiceCard
                      key={item.id}
                      item={item}
                      onClick={onInvoiceClick}
                    />
                  ))}
                </ReportCardList>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
