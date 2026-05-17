/**
 * CRM (#127) — FollowUpRow.
 *
 * Renders a single party in the follow-up queue. Tapping the row navigates
 * to the party detail page where the user can update the follow-up. We
 * intentionally do NOT inline-patch here — quick actions on this list
 * would create messy mid-row state and a separate Detail visit is the
 * right cadence for a CRM touch.
 *
 * Status pill colours:
 *   daysOverdue > 0  → overdue (warning token)
 *   daysOverdue = 0  → today (info token)
 *   daysOverdue < 0  → upcoming (neutral token)
 *
 * 44px tap target enforced via min-h on the button.
 */

import { useNavigate } from 'react-router-dom'
import { Phone } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { PartyAvatar } from '@/components/ui/PartyAvatar'
import { formatDate, formatRelativeTime } from '@/lib/format'
import type { FollowUpRow as FollowUpRowData } from '../crm.types'

interface FollowUpRowProps {
  row: FollowUpRowData
}

function statusLabel(t: ReturnType<typeof useLanguage>['t'], daysOverdue: number): string {
  if (daysOverdue > 0) return t.crmDaysOverdue.replace('{n}', String(daysOverdue))
  if (daysOverdue === 0) return t.crmDueToday
  return t.crmDueInDays.replace('{n}', String(Math.abs(daysOverdue)))
}

function statusModifier(daysOverdue: number): string {
  if (daysOverdue > 0) return 'follow-up-row__status--overdue'
  if (daysOverdue === 0) return 'follow-up-row__status--today'
  return 'follow-up-row__status--upcoming'
}

export function FollowUpRow({ row }: FollowUpRowProps) {
  const navigate = useNavigate()
  const { t } = useLanguage()

  const dueDateText = row.followUpAt ? formatDate(row.followUpAt) : '—'
  const lastTouchText = row.lastContactedAt
    ? formatRelativeTime(row.lastContactedAt)
    : t.crmNeverContacted

  return (
    <button
      type="button"
      className="follow-up-row"
      onClick={() => navigate(`/parties/${row.id}`)}
      aria-label={`${row.name} — ${statusLabel(t, row.daysOverdue)}`}
    >
      <PartyAvatar name={row.name} size="md" />
      <div className="follow-up-row__body">
        <div className="follow-up-row__name-line">
          <span className="follow-up-row__name">{row.name}</span>
          <span className={`follow-up-row__status ${statusModifier(row.daysOverdue)}`}>
            {statusLabel(t, row.daysOverdue)}
          </span>
        </div>
        <div className="follow-up-row__meta">
          <span className="follow-up-row__meta-item">
            {t.crmFollowUpAt}: <span className="follow-up-row__meta-value">{dueDateText}</span>
          </span>
          <span className="follow-up-row__meta-separator" aria-hidden="true">·</span>
          <span className="follow-up-row__meta-item">
            {t.crmLastContacted}: <span className="follow-up-row__meta-value">{lastTouchText}</span>
          </span>
        </div>
        {row.phone && (
          <div className="follow-up-row__phone">
            <Phone size={14} aria-hidden="true" />
            <span className="follow-up-row__phone-value">{row.phone}</span>
          </div>
        )}
      </div>
    </button>
  )
}
