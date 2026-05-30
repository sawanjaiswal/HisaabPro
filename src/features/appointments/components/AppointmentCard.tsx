/** AppointmentCard — single row in DayListView.
 *
 * Uses `partyNameSnapshot` / `employeeNameSnapshot` so it remains legible
 * even when the underlying FK has been soft-deleted (drives the "(former)"
 * Badge). 44px+ tap target.
 */

import { Clock, User } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { formatLocalTime, isFormerEmployee, isFormerParty } from '../appointment.utils'
import { STATUS_BADGE_VARIANT, STATUS_LABEL_KEY } from '../appointment.constants'
import type { AppointmentRow } from '../appointment.types'
import type { TranslationKey } from '@/lib/translations'

interface AppointmentCardProps {
  row: AppointmentRow
  onClick: (id: string) => void
}

export function AppointmentCard({ row, onClick }: AppointmentCardProps) {
  const { t } = useLanguage()
  const start = new Date(row.startAt)
  const end = new Date(row.endAt)
  const statusKey = STATUS_LABEL_KEY[row.status] as TranslationKey
  const statusLabel = (t[statusKey] as string | undefined) ?? row.status
  const badgeVariant = STATUS_BADGE_VARIANT[row.status]
  const partyFormer = isFormerParty(row)
  const employeeFormer = isFormerEmployee(row)
  const formerLabel = t.former ?? 'former'

  return (
    <Button
      variant="none"
      onClick={() => onClick(row.id)}
      aria-label={`${row.partyNameSnapshot} — ${statusLabel}`}
      className="appt-card w-full text-left min-h-[64px] flex items-start gap-3 p-3 rounded-[var(--radius-md)]"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div
        className="appt-card__time flex flex-col items-center justify-center min-w-[64px] py-1 rounded-[var(--radius-sm)]"
        style={{ background: 'var(--color-surface-muted)' }}
        aria-hidden="true"
      >
        <Clock size={14} aria-hidden="true" />
        <span className="text-[var(--fs-sm)] tabular-nums">{formatLocalTime(start)}</span>
        <span className="text-[var(--fs-xs)] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
          → {formatLocalTime(end)}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-[var(--fs-base)] truncate">{row.partyNameSnapshot}</span>
          {partyFormer && <Badge variant="overdue">{formerLabel}</Badge>}
          <Badge variant={badgeVariant}>{statusLabel}</Badge>
        </div>
        {row.employeeNameSnapshot && (
          <div
            className="text-[var(--fs-sm)] flex items-center gap-1 mt-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <User size={14} aria-hidden="true" />
            <span className="truncate">{row.employeeNameSnapshot}</span>
            {employeeFormer && <Badge variant="overdue">{formerLabel}</Badge>}
          </div>
        )}
      </div>
    </Button>
  )
}
