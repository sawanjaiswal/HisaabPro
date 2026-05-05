/** Aging breakdown — horizontal stacked-bar chart for outstanding balances */

import { useLanguage } from '@/hooks/useLanguage'
import { AGING_BUCKET_LABELS } from '../payment.constants'
import { getAgingPercentages, calculateAgingTotal } from '../payment.utils'
import type { OutstandingAging } from '../payment.types'

const AGING_BUCKET_CSS: Record<string, string> = {
  current:    'current',
  days1to30:  '30',
  days31to60: '60',
  days61to90: '90',
  days90plus: '90plus',
}

export function AgingChart({ aging }: { aging: OutstandingAging }) {
  const { t } = useLanguage()
  const total = calculateAgingTotal(aging)
  if (total === 0) return null

  const percentages = getAgingPercentages(aging)
  const buckets = Object.keys(AGING_BUCKET_LABELS) as Array<keyof typeof AGING_BUCKET_LABELS>

  return (
    <div className="outstanding-aging-chart" aria-label={t.agingBreakdown}>
      <h2 className="outstanding-aging-title">{t.agingBreakdown}</h2>
      <div className="outstanding-aging-bar" role="img" aria-label={t.agingBarChart}>
        {buckets.map((bucket) => {
          const pct = percentages[bucket]
          if (pct <= 0) return null
          return (
            <div
              key={bucket}
              className={`outstanding-aging-segment outstanding-aging-segment--${AGING_BUCKET_CSS[bucket]}`}
              style={{ width: `${pct}%` }}
              title={`${AGING_BUCKET_LABELS[bucket]}: ${pct}%`}
            />
          )
        })}
      </div>
      <div className="outstanding-aging-legend">
        {buckets.map((bucket) => (
          <div key={bucket} className="outstanding-aging-legend-item">
            <span
              className={`outstanding-aging-dot outstanding-aging-legend-dot--${AGING_BUCKET_CSS[bucket]}`}
              aria-hidden="true"
            />
            <span className="outstanding-aging-label">{AGING_BUCKET_LABELS[bucket]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
