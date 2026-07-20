/** Archetype-A list page — totals + sparkline footer (mockups #1, #41).
 *
 * Arranges the existing <AreaChart> and the shared money formatter in a card.
 * The caller supplies real numbers only: the mockups show a "vs last month"
 * delta, but no list API returns a prior-period figure, so no delta is
 * rendered rather than a fabricated one.
 */

import React from 'react'
import { AreaChart } from '@/components/charts/AreaChart'
import { formatPaise } from '@/lib/format'
import './period-group.css'

export interface ListTotalsSplit {
  label: string
  paise: number
  /** Colours the value. Omit for neutral. */
  tone?: 'positive' | 'negative'
}

interface ListTotalsFooterProps {
  label: string
  totalPaise: number
  /** Per-day totals in PAISE, oldest → newest. Fewer than 2 hides the chart. */
  series: number[]
  splits?: ListTotalsSplit[]
}

export const ListTotalsFooter: React.FC<ListTotalsFooterProps> = ({
  label,
  totalPaise,
  series,
  splits,
}) => (
  <section className="list-totals-footer py-0" aria-label={label}>
    <div className="list-totals-card">
      <div className="list-totals-head">
        <span className="list-totals-label">{label}</span>
        <span className="list-totals-value tabular-nums">{formatPaise(totalPaise)}</span>
      </div>

      {series.length >= 2 && (
        <AreaChart
          data={series}
          color="var(--color-primary-500)"
          height={64}
          className="list-totals-spark"
        />
      )}

      {splits && splits.length > 0 && (
        <div className="list-totals-split">
          {splits.map((split) => (
            <div key={split.label} className="list-totals-split-item">
              <span className="list-totals-split-label">{split.label}</span>
              <span
                className={`list-totals-split-value tabular-nums${
                  split.tone ? ` list-totals-split-value--${split.tone}` : ''
                }`}
              >
                {formatPaise(split.paise)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  </section>
)
