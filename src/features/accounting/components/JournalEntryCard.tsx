/** JournalEntryCard — Single row card for journal entries list */

import { formatPaise, formatEntryDate } from '../accounting.utils'
import {
  JOURNAL_TYPE_LABELS,
  JOURNAL_TYPE_COLORS,
  ENTRY_STATUS_LABELS,
  ENTRY_STATUS_COLORS,
  ENTRY_STATUS_BG,
} from '../accounting.constants'
import type { JournalEntry } from '../accounting.types'
import { useLanguage } from '@/hooks/useLanguage'

interface JournalEntryCardProps {
  entry: JournalEntry
}

export function JournalEntryCard({ entry }: JournalEntryCardProps) {
  const { t } = useLanguage()
  const typeColor = JOURNAL_TYPE_COLORS[entry.type]
  const statusColor = ENTRY_STATUS_COLORS[entry.status]
  const statusBg = ENTRY_STATUS_BG[entry.status]

  return (
    <li className="je-card" role="listitem">
      <div className="je-card-top">
        <div className="je-card-meta">
          <span
            className="je-type-badge"
            style={{ color: typeColor, borderColor: typeColor }}
          >
            {JOURNAL_TYPE_LABELS[entry.type]}
          </span>
          <span className="je-entry-num">{entry.entryNumber}</span>
        </div>
        <span
          className="je-status-badge"
          style={{ color: statusColor, background: statusBg }}
        >
          {ENTRY_STATUS_LABELS[entry.status]}
        </span>
      </div>

      <div className="je-card-body">
        <div className="je-card-info">
          <span className="je-date">{formatEntryDate(entry.date)}</span>
          {entry.narration && (
            <span className="je-narration">{entry.narration}</span>
          )}
        </div>
        <div className="je-card-amounts">
          <div className="je-amount-row">
            <span className="je-amount-label">{t.dr}</span>
            <span className="je-amount-value">{formatPaise(entry.totalDebit)}</span>
          </div>
          <div className="je-amount-row">
            <span className="je-amount-label">{t.cr}</span>
            <span className="je-amount-value">{formatPaise(entry.totalCredit)}</span>
          </div>
        </div>
      </div>
    </li>
  )
}
