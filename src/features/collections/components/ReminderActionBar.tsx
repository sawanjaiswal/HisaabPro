/**
 * ReminderActionBar — floating bottom bar shown when parties are selected
 * in the AgingBucketList multi-select mode.
 */

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { ReminderComposerSheet } from '../ReminderComposerSheet'
import type { PartyInBucket } from '../collections.types'

interface ReminderActionBarProps {
  selectedParties: PartyInBucket[]
  businessName: string
  onClearSelection: () => void
}

export function ReminderActionBar({
  selectedParties,
  businessName,
  onClearSelection,
}: ReminderActionBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const count = selectedParties.length

  if (count === 0) return null

  return (
    <>
      <div className="reminder-action-bar" role="toolbar" aria-label="Bulk actions">
        <span className="reminder-action-bar__count">
          {count} {count === 1 ? 'party' : 'parties'} selected
        </span>
        <div className="reminder-action-bar__buttons">
          <button
            type="button"
            className="reminder-action-bar__clear"
            onClick={onClearSelection}
          >
            Clear
          </button>
          <button
            type="button"
            className="reminder-action-bar__send"
            onClick={() => setSheetOpen(true)}
            disabled={count === 0}
          >
            <MessageCircle size={16} aria-hidden="true" />
            Send Reminder ({count})
          </button>
        </div>
      </div>

      <ReminderComposerSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          onClearSelection()
        }}
        selectedParties={selectedParties}
        businessName={businessName}
      />
    </>
  )
}
