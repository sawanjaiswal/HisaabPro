/** DayListView — FE-1 simplification of CalendarDayView.
 *
 * Scrollable list of hour buckets (NOT a true hour grid). Each populated row
 * is an AppointmentCard; each empty row is a tap target that opens
 * CreateAppointmentDrawer pre-filled with that hour. The true hour grid +
 * current-time line + WeekView land in FE-2.
 */

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { AppointmentCard } from './AppointmentCard'
import { groupByHour, formatLocalTime } from '../appointment.utils'
import { DAY_VIEW_END_HOUR, DAY_VIEW_START_HOUR } from '../appointment.constants'
import type { AppointmentRow } from '../appointment.types'

interface DayListViewProps {
  date: Date
  rows: AppointmentRow[]
  onSelect: (id: string) => void
  onCreateAtHour: (hour: number) => void
}

export function DayListView({ date, rows, onSelect, onCreateAtHour }: DayListViewProps) {
  const { t } = useLanguage()
  const buckets = groupByHour(rows, date, DAY_VIEW_START_HOUR, DAY_VIEW_END_HOUR)

  return (
    <ul className="space-y-3" aria-label={t.dayView ?? 'Day view'}>
      {buckets.map((bucket) => (
        <li key={bucket.hour} className="space-y-2">
          <div
            className="text-[var(--fs-xs)] uppercase tabular-nums"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {formatLocalTime(bucket.startsAt)}
          </div>

          {bucket.rows.length === 0 ? (
            <Button
              variant="none"
              onClick={() => onCreateAtHour(bucket.hour)}
              aria-label={`${t.addAtHour ?? 'Add appointment at'} ${formatLocalTime(bucket.startsAt)}`}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-[var(--radius-md)] text-[var(--fs-sm)]"
              style={{
                border: '1px dashed var(--color-border)',
                color: 'var(--color-text-muted)',
                background: 'transparent',
              }}
            >
              <Plus size={14} aria-hidden="true" />
              <span>{t.addAtHour ?? 'Add'}</span>
            </Button>
          ) : (
            <div className="space-y-2">
              {bucket.rows.map((row) => (
                <AppointmentCard key={row.id} row={row} onClick={onSelect} />
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
