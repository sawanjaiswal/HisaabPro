/** CalendarWeekView — 7-column day grid.
 *
 *  Each column is a thinner CalendarDayView (no hour-rail per column — the
 *  rail is shared on the left). Day-header tap → switches to day view for
 *  that date (handled by parent via `onPickDay`).
 *
 *  Mobile (320px): horizontal scroll inside the grid; day columns shrink to
 *  a minimum of 88px so all 7 are reachable on a swipe.
 */

import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
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
  pxFromTopForDate,
  rowsOnDay,
  weekDates,
} from '../calendar.utils'
import type { AppointmentRow } from '../appointment.types'
import type { TranslationKey } from '@/lib/translations'

interface CalendarWeekViewProps {
  anchorDate: Date
  rows: AppointmentRow[]
  onSelect: (id: string) => void
  onPickDay: (date: Date) => void
}

export function CalendarWeekView({
  anchorDate,
  rows,
  onSelect,
  onPickDay,
}: CalendarWeekViewProps) {
  const { t } = useLanguage()
  const days = useMemo(() => weekDates(anchorDate), [anchorDate])
  const hours = useMemo(() => {
    const out: number[] = []
    for (let h = DAY_VIEW_START_HOUR; h < DAY_VIEW_END_HOUR; h++) out.push(h)
    return out
  }, [])

  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const todayIdx = days.findIndex((d) => sameLocalDay(d, now))
  const nowPx = pxFromTopForDate(now, days[0]!, DAY_VIEW_START_HOUR, DAY_VIEW_END_HOUR, HOUR_ROW_PX)
  const nowVisible = todayIdx >= 0
    && now.getHours() >= DAY_VIEW_START_HOUR
    && now.getHours() < DAY_VIEW_END_HOUR

  const gridHeight = (DAY_VIEW_END_HOUR - DAY_VIEW_START_HOUR) * HOUR_ROW_PX

  return (
    <div className="appt-week-grid w-full overflow-x-auto" aria-label={t.weekView ?? 'Week view'}>
      <div className="flex" style={{ minWidth: '672px' }}>
        {/* Hour rail */}
        <div className="appt-hour-rail flex-shrink-0 pt-10">
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

        {days.map((d, idx) => {
          const dayRows = rowsOnDay(rows, d)
          const isToday = sameLocalDay(d, now)
          return (
            <div key={idx} className="flex-1 flex flex-col" style={{ minWidth: '88px' }}>
              <Button
                variant="none"
                type="button"
                onClick={() => onPickDay(d)}
                className="appt-week-dayheader min-h-[40px] text-[var(--fs-xs)] font-medium tabular-nums"
                style={{
                  borderBottom: '1px solid var(--color-border)',
                  background: isToday ? 'var(--color-surface-muted)' : 'transparent',
                  color: isToday ? 'var(--color-primary)' : 'var(--color-text)',
                }}
                aria-label={`${t.dayView ?? 'Day view'}: ${d.toDateString()}`}
              >
                {d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
              </Button>
              <div
                className="relative flex-1"
                style={{
                  height: `${gridHeight}px`,
                  backgroundImage:
                    'repeating-linear-gradient(to bottom, transparent 0, transparent ' +
                    `${HOUR_ROW_PX - 1}px, var(--color-border) ${HOUR_ROW_PX - 1}px, ` +
                    `var(--color-border) ${HOUR_ROW_PX}px)`,
                }}
              >
                {dayRows.map((row) => {
                  const pos = blockPosition(row, d, DAY_VIEW_START_HOUR, DAY_VIEW_END_HOUR, HOUR_ROW_PX)
                  const statusKey = STATUS_LABEL_KEY[row.status] as TranslationKey
                  const statusLabel = (t[statusKey] as string | undefined) ?? row.status
                  return (
                    <Button
                      variant="none"
                      key={row.id}
                      type="button"
                      data-appt-block
                      onClick={() => onSelect(row.id)}
                      aria-label={`${row.partyNameSnapshot} — ${statusLabel}`}
                      className="text-left"
                      style={{
                        position: 'absolute',
                        top: `${pos.topPx}px`,
                        height: `${pos.heightPx}px`,
                        left: '2px',
                        right: '2px',
                        padding: '4px 6px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-primary)',
                        overflow: 'hidden',
                        minHeight: '32px',
                      }}
                    >
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-medium text-[var(--fs-xs)] truncate">
                          {row.partyNameSnapshot}
                        </span>
                        <Badge variant={STATUS_BADGE_VARIANT[row.status]}>{statusLabel}</Badge>
                      </div>
                    </Button>
                  )
                })}
                {isToday && <CurrentTimeLine topPx={nowPx} visible={nowVisible} />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
