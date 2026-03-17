/** Payment History — Grouped list rendering (groupBy !== 'none') */

import { ReportCardList } from './ReportCardList'
import { ReportGroupHeader } from './ReportGroupHeader'
import { PaymentCard } from './PaymentHistoryList'
import { formatAmount } from '../report.utils'
import type { PaymentHistoryGroup } from '../report.types'

interface PaymentHistoryGroupedProps {
  groups: PaymentHistoryGroup[]
  expandedGroups: Set<string>
  onToggleGroup: (key: string) => void
}

export function PaymentHistoryGrouped({
  groups,
  expandedGroups,
  onToggleGroup,
}: PaymentHistoryGroupedProps) {
  return (
    <div role="list" aria-label="Payment history grouped">
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.key)
        const subtitle = `${group.count} payment${group.count !== 1 ? 's' : ''} \u00b7 +${formatAmount(group.totalReceived)} / -${formatAmount(group.totalPaid)}`

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
                <ReportCardList
                  ariaLabel={`Payments in group ${group.label}`}
                >
                  {group.items.map((item) => (
                    <PaymentCard key={item.id} item={item} />
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
