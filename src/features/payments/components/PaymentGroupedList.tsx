/** Payment History — the month-grouped body (groups + rows + totals footer).
 *
 * Mockup #41 groups payments by calendar month ("This Month", "May 2025") with
 * the month's net movement on the group header and a single totals card at the
 * bottom. Composition only — the grouping maths is `@/lib/period-groups.utils`
 * and the chrome is `<PeriodGroup>` / `<ListTotalsFooter>`.
 */

import React from 'react'
import { PeriodGroup } from '@/components/ui/PeriodGroup'
import { ListTotalsFooter } from '@/components/ui/ListTotalsFooter'
import { useLanguage } from '@/hooks/useLanguage'
import { PaymentCard } from './PaymentCard'
import type { PeriodGroup as PeriodGroupModel } from '@/lib/period-groups.utils'
import type { PaymentSummary, PaymentListResponse } from '../payment.types'

interface PaymentGroupedListProps {
  groups: PeriodGroupModel<PaymentSummary>[]
  isBulkMode: boolean
  isSelected: (id: string) => boolean
  onToggle: (id: string) => void
  onPaymentClick: (id: string) => void
  onLongPress: (id: string) => void
  /** Omitted in bulk mode — the totals card is not actionable there. */
  summary?: PaymentListResponse['summary']
  /** Per-month net totals in PAISE, oldest → newest. */
  series: number[]
}

export const PaymentGroupedList: React.FC<PaymentGroupedListProps> = ({
  groups,
  isBulkMode,
  isSelected,
  onToggle,
  onPaymentClick,
  onLongPress,
  summary,
  series,
}) => {
  const { t } = useLanguage()

  return (
    <>
      {groups.map((group) => (
        <PeriodGroup key={group.key} group={group}>
          {group.items.map((payment) => (
            <div
              key={payment.id}
              className={`payment-list-row${isSelected(payment.id) ? ' bulk-selected' : ''}`}
              role="listitem"
              onClick={(e) => {
                if (isBulkMode) {
                  e.stopPropagation()
                  onToggle(payment.id)
                }
              }}
            >
              <PaymentCard
                payment={payment}
                onClick={onPaymentClick}
                onLongPress={onLongPress}
                isSelected={isSelected(payment.id)}
                isBulkMode={isBulkMode}
              />
              <div className="divider" aria-hidden="true" />
            </div>
          ))}
        </PeriodGroup>
      ))}

      {summary && (
        <ListTotalsFooter
          label={t.totalReceived}
          totalPaise={summary.totalIn}
          series={series}
          splits={[
            { label: t.moneyOut, paise: summary.totalOut, tone: 'negative' },
            { label: t.net, paise: summary.net, tone: summary.net >= 0 ? 'positive' : 'negative' },
          ]}
        />
      )}
    </>
  )
}
