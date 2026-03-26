/** Payment History — Grouped list rendering (groupBy !== 'none') */

import { ReportCardList } from './ReportCardList'
import { ReportGroupHeader } from './ReportGroupHeader'
import { PaymentCard } from './PaymentHistoryList'
import { formatAmount } from '../report.utils'
import type { PaymentHistoryGroup } from '../report.types'
import { useLanguage } from '@/hooks/useLanguage'

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
  const { t } = useLanguage()
    return (
    <div role="list" aria-label={t.paymentHistoryGrouped}>
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.key)
        const subtitle = `${group.count} ${t.payments} \u00b7 +${formatAmount(group.totalReceived)} / -${formatAmount(group.totalPaid)}`

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
                  ariaLabel={`${t.paymentsInGroup} ${group.label}`}
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
