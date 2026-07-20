/** Invoice list — the day-grouped body (groups + rows).
 *
 * Extracted from InvoicesPage so the page stays under the 250-line gate.
 * Purely a composition of `<InvoiceListGroup>` + `<InvoiceCard>`; no new
 * primitive and no state of its own.
 */

import React from 'react'
import { InvoiceListGroup } from './InvoiceListGroup'
import { InvoiceCard } from './InvoiceCard'
import type { InvoiceDayGroup } from '../invoice-list-group.utils'

interface InvoiceGroupedListProps {
  groups: InvoiceDayGroup[]
  isBulkMode: boolean
  isSelected: (id: string) => boolean
  onToggle: (id: string) => void
  onDocClick: (id: string) => void
  onLongPress: (id: string) => void
}

export const InvoiceGroupedList: React.FC<InvoiceGroupedListProps> = ({
  groups,
  isBulkMode,
  isSelected,
  onToggle,
  onDocClick,
  onLongPress,
}) => (
  <>
    {groups.map((group) => (
      <InvoiceListGroup key={group.key} group={group}>
        {group.documents.map((doc) => (
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
      </InvoiceListGroup>
    ))}
  </>
)
