/** Cash Register — Summary header: Today + 7-day bars + 30-day tile */

import { formatPaise, formatPaiseCompact } from '../cashRegister.utils'
import type { CashSummaryDTO } from '../cashRegister.types'
import { useLanguage } from '@/hooks/useLanguage'

interface Props {
  summary: CashSummaryDTO | undefined
  isLoading: boolean
  isError: boolean
}

export function CashSummaryHeader({ summary, isLoading, isError }: Props) {
  const { t } = useLanguage()
  if (isLoading) {
    return (
      <div className="cr-summary cr-summary--loading" aria-busy="true">
        <div className="cr-summary__skeleton cr-summary__skeleton--today" />
        <div className="cr-summary__skeleton cr-summary__skeleton--bars" />
        <div className="cr-summary__skeleton cr-summary__skeleton--30d" />
      </div>
    )
  }

  const todayIn = isError ? 0 : (summary?.today.inPaise ?? 0)
  const todayOut = isError ? 0 : (summary?.today.outPaise ?? 0)
  const todayNet = isError ? 0 : (summary?.today.netPaise ?? 0)
  const last30 = isError ? 0 : (summary?.last30.netPaise ?? 0)
  const barDays = summary?.last7Days ?? []
  const maxBar = Math.max(...barDays.map((d) => d.inPaise + d.outPaise), 1)

  return (
    <div className="cr-summary">
      {/* Today tile */}
      <div className="cr-summary__today">
        <span className="cr-summary__today-label">{t.cashRegSummaryToday}</span>
        <span className={`cr-summary__today-net ${todayNet >= 0 ? 'cr-summary__today-net--pos' : 'cr-summary__today-net--neg'}`}>
          {isError ? '—' : formatPaiseCompact(Math.abs(todayNet))}
        </span>
        <div className="cr-summary__today-breakdown">
          <span className="cr-summary__in">{t.cashRegSummaryIn}: {isError ? '—' : formatPaiseCompact(todayIn)}</span>
          <span className="cr-summary__out">{t.cashRegSummaryOut}: {isError ? '—' : formatPaiseCompact(todayOut)}</span>
        </div>
      </div>

      {/* 7-day bars */}
      {barDays.length > 0 && (
        <div className="cr-summary__bars" aria-label={t.cashRegLast7Aria}>
          {barDays.map((day) => {
            const total = day.inPaise + day.outPaise
            const heightPct = (total / maxBar) * 100
            const dayLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })
            return (
              <div key={day.date} className="cr-summary__bar-col">
                <div className="cr-summary__bar-track">
                  <div
                    className={`cr-summary__bar-fill ${day.netPaise >= 0 ? 'cr-summary__bar-fill--pos' : 'cr-summary__bar-fill--neg'}`}
                    style={{ height: `${heightPct}%` }}
                    aria-label={`${dayLabel}: ${formatPaise(total)}`}
                  />
                </div>
                <span className="cr-summary__bar-label">{dayLabel}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* 30-day tile */}
      <div className="cr-summary__30d">
        <span className="cr-summary__30d-label">{t.cashRegSummaryLast30}</span>
        <span className={`cr-summary__30d-net ${last30 >= 0 ? 'cr-summary__30d-net--pos' : 'cr-summary__30d-net--neg'}`}>
          {isError ? '—' : formatPaiseCompact(Math.abs(last30))}
        </span>
      </div>
    </div>
  )
}
