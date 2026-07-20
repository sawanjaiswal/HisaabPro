/** One period group on an archetype-A list page: header + rows on a sheet.
 *
 * Presentational only — grouping maths lives in `@/lib/period-groups.utils`.
 * Resolves the relative period label to a translation and renders the rows it
 * is handed, so invoices / payments / expenses all read identically.
 */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import type { PeriodGroup as PeriodGroupModel } from '@/lib/period-groups.utils'
import './period-group.css'

interface PeriodGroupProps<T> {
  group: PeriodGroupModel<T>
  children: React.ReactNode
}

export function PeriodGroup<T>({ group, children }: PeriodGroupProps<T>) {
  const { t } = useLanguage()

  const isMonth = group.granularity === 'month'
  const label = group.isCurrent
    ? isMonth
      ? t.thisMonth
      : t.dateToday
    : group.isPrevious
      ? isMonth
        ? t.lastMonth
        : t.dateYesterday
      : group.label

  return (
    <section className="period-group py-0" aria-label={label}>
      <div className="period-group-header">
        <span className="period-group-label">{label}</span>
        <span className="period-group-total tabular-nums">{formatPaise(group.totalPaise)}</span>
      </div>
      <div className="period-group-rows">{children}</div>
    </section>
  )
}
