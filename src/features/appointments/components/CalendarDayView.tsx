/** CalendarDayView — true hour-grid for one day.
 *
 *  Layout: a sticky hour-rail on the left (column header = local time);
 *  the right column is a tall block where each appointment is absolutely
 *  positioned by `blockPosition()`. Tap an empty area to open the create
 *  drawer pre-filled with that hour.
 *
 *  Mobile (320px): hour rail collapses to 48px wide, blocks stretch to fill.
 *  Horizontal scroll only inside the grid root (`overflow-x-auto`).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { Badge } from '@/components/ui/Badge'
import { CurrentTimeLine } from './CurrentTimeLine'
import {
  DAY_VIEW_END_HOUR,
  DAY_VIEW_START_HOUR,
  HOUR_ROW_PX,
  STATUS_BADGE_VARIANT,
  STATUS_LABEL_KEY,
} from '../appointment.constants'
import { formatLocalTime, sameLocalDay } from '../appointment.utils'
import {
  blockPosition,
  hourFromYPx,
  pxFromTopForDate,
  rowsOnDay,
} from '../calendar.utils'
import type { AppointmentRow } from '../appointment.types'
import type { TranslationKey } from '@/lib/translations'

interface CalendarDayViewProps {
  date: Date
  rows: AppointmentRow[]
  onSelect: (id: string) => void
  onCreateAtHour: (hour: number) => void
}

export function CalendarDayView({ date, rows, onSelect, onCreateAtHour }: CalendarDayViewProps) {
  const { t } = useLanguage()
  const dayRows = useMemo(() => rowsOnDay(rows, date), [rows, date])
  const hours = useMemo(() => {
    const out: number[] = []
    for (let h = DAY_VIEW_START_HOUR; h < DAY_VIEW_END_HOUR; h++) out.push(h)
    return out
  }, [])

  const gridRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const isToday = sameLocalDay(date, now)
  const nowPx = pxFromTopForDate(
    now,
    date,
    DAY_VIEW_START_HOUR,
    DAY_VIEW_END_HOUR,
    HOUR_ROW_PX,
  )
  const nowVisible = isToday
    && now.getHours() >= DAY_VIEW_START_HOUR
    && now.getHours() < DAY_VIEW_END_HOUR

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    // Ignore clicks that landed on an appointment block — those use their own handler.
    if (target.closest('[data-appt-block]')) return
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return
    const y = e.clientY - rect.top
    const hour = hourFromYPx(y, DAY_VIEW_START_HOUR, DAY_VIEW_END_HOUR, HOUR_ROW_PX)
    onCreateAtHour(hour)
  }

  const gridHeight = (DAY_VIEW_END_HOUR - DAY_VIEW_START_HOUR) * HOUR_ROW_PX

  return (
    <div
      className="appt-day-grid w-full overflow-x-auto"
      aria-label={t.dayView ?? 'Day view'}
    >
      <div className="flex" style={{ minHeight: `${gridHeight}px` }}>
        {/* Hour rail */}
        <div className="appt-hour-rail flex-shrink-0">
          {hours.map((h) => (
            <div
              key={h}
              className="text-[var(--fs-xs)] tabular-nums"
              style={{
                height: `${HOUR_ROW_PX}px`,
                color: 'var(--color-text-muted)',
                padding: '4px 6px',
                borderTop: '1px solid var(--color-border)',
              }}
            >
              {formatLocalTime(new Date(2026, 0, 1, h, 0))}
            </div>
          ))}
        </div>

        {/* Block area */}
        <div
          ref={gridRef}
          className="appt-day-blocks relative flex-1"
          style={{
            height: `${gridHeight}px`,
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0, transparent ' +
              `${HOUR_ROW_PX - 1}px, var(--color-border) ` +
              `${HOUR_ROW_PX - 1}px, var(--color-border) ${HOUR_ROW_PX}px)`,
          }}
          onClick={handleGridClick}
          role="grid"
          aria-rowcount={hours.length}
        >
          {dayRows.map((row) => {
            const pos = blockPosition(row, date, DAY_VIEW_START_HOUR, DAY_VIEW_END_HOUR, HOUR_ROW_PX)
            const statusKey = STATUS_LABEL_KEY[row.status] as TranslationKey
            const statusLabel = (t[statusKey] as string | undefined) ?? row.status
            return (
              <button
                key={row.id}
                type="button"
                data-appt-block
                onClick={() => onSelect(row.id)}
                aria-label={`${row.partyNameSnapshot} — ${statusLabel}`}
                className="appt-day-block text-left"
                style={{
                  position: 'absolute',
                  top: `${pos.topPx}px`,
                  height: `${pos.heightPx}px`,
                  left: '4px',
                  right: '4px',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-primary)',
                  overflow: 'hidden',
                  minHeight: '44px',
                }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-[var(--fs-sm)] truncate">
                    {row.partyNameSnapshot}
                  </span>
                  <Badge variant={STATUS_BADGE_VARIANT[row.status]}>{statusLabel}</Badge>
                </div>
                {row.employeeNameSnapshot && (
                  <div
                    className="text-[var(--fs-xs)] truncate"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {row.employeeNameSnapshot}
                  </div>
                )}
              </button>
            )
          })}

          <CurrentTimeLine topPx={nowPx} visible={nowVisible} />
        </div>
      </div>
    </div>
  )
}
