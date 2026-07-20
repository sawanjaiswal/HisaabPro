/** Invoice list — the period-grouped body (groups + rows).
 *
 * Extracted from InvoicesPage so the page stays under the 250-line gate.
 * Purely a composition of `<PeriodGroup>` + `<InvoiceCard>`; no new
 * primitive and no state of its own.
 */

import React from 'react'
import { PeriodGroup } from '@/components/ui/PeriodGroup'
import { ListTotalsFooter } from '@/components/ui/ListTotalsFooter'
import { useLanguage } from '@/hooks/useLanguage'
import { InvoiceCard } from './InvoiceCard'
import type { PeriodGroup as PeriodGroupModel } from '@/lib/period-groups.utils'
import type { DocumentSummary, DocumentListResponse } from '../invoice.types'

interface InvoiceGroupedListProps {
  groups: PeriodGroupModel<DocumentSummary>[]
  isBulkMode: boolean
  isSelected: (id: string) => boolean
  onToggle: (id: string) => void
  onDocClick: (id: string) => void
  onLongPress: (id: string) => void
  /** Omitted in bulk mode — the totals card is not actionable there. */
  summary?: DocumentListResponse['summary']
  /** Per-day totals in PAISE, oldest → newest. */
  series: number[]
}

export const InvoiceGroupedList: React.FC<InvoiceGroupedListProps> = ({
  groups,
  isBulkMode,
  isSelected,
  onToggle,
  onDocClick,
  onLongPress,
  summary,
  series,
}) => {
  const { t } = useLanguage()
  return (
  <>
    {groups.map((group) => (
      <PeriodGroup key={group.key} group={group}>
        {group.items.map((doc) => (
          <div
            key={doc.id}
            className={`invoice-list-row${isSelected(doc.id) ? ' bulk-selected' : ''}`}
            role="listitem"
            onClick={(e) => {
              if (isBulkMode) {
                e.stopPropagation()
                onToggle(doc.id)
              }
            }}
          >
            <InvoiceCard
              document={doc}
              onClick={onDocClick}
              onLongPress={onLongPress}
              isSelected={isSelected(doc.id)}
              isBulkMode={isBulkMode}
            />
            <div className="divider" aria-hidden="true" />
          </div>
        ))}
      </PeriodGroup>
    ))}

    {summary && (
      <ListTotalsFooter
        label={t.totalSales}
        totalPaise={summary.totalAmount}
        series={series}
        splits={[
          { label: t.receivedLabel, paise: summary.totalPaid, tone: 'positive' },
          { label: t.dueLabel, paise: summary.totalDue, tone: 'negative' },
        ]}
      />
    )}
  </>
  )
}
