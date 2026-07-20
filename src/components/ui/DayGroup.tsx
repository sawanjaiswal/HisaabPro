/** One day group on an archetype-A list page: header + rows on a single sheet.
 *
 * Presentational only — grouping maths lives in `@/lib/day-groups.utils`.
 * Resolves the relative day label to a translation and renders the rows it is
 * handed, so invoices / payments / expenses all read identically.
 */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import type { DayGroup as DayGroupModel } from '@/lib/day-groups.utils'
import './day-group.css'

interface DayGroupProps<T> {
  group: DayGroupModel<T>
  children: React.ReactNode
}

export function DayGroup<T>({ group, children }: DayGroupProps<T>) {
  const { t } = useLanguage()

  const label = group.isToday
    ? t.dateToday
    : group.isYesterday
      ? t.dateYesterday
      : group.label

  return (
    <section className="day-group py-0" aria-label={label}>
      <div className="day-group-header">
        <span className="day-group-label">{label}</span>
        <span className="day-group-total tabular-nums">{formatPaise(group.totalPaise)}</span>
      </div>
      <div className="day-group-rows">{children}</div>
    </section>
  )
}
