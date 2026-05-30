/** CashflowTrendCard — Inline SVG bar chart for last 6 months total expenses */

import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, BarChart2 } from 'lucide-react'
import { queryKeys } from '@/lib/query-keys'
import { getExpenseTrend } from '../services/trend.service'
import { formatPaise } from '@/lib/format'
import type { TrendPoint } from '../expense.types'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { Button } from '@/components/ui/Button'

const CHART_H = 80
const BAR_GAP = 6

function monthLabel(ymd: string): string {
  const d = new Date(ymd)
  return d.toLocaleDateString('en-IN', { month: 'short' })
}

interface BarsProps {
  points: TrendPoint[]
  onBarClick: (p: TrendPoint) => void
}

function Bars({ points, onBarClick }: BarsProps) {
  const max = Math.max(...points.map((p) => p.totalPaise), 1)
  const barW = Math.floor((100 - BAR_GAP * (points.length - 1)) / points.length)

  return (
    <svg
      width="100%"
      viewBox={`0 0 100 ${CHART_H + 20}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Monthly expense bar chart"
      className="trend-chart__svg"
    >
      {points.map((p, i) => {
        const barH = Math.max(4, Math.round((p.totalPaise / max) * CHART_H))
        const x = i * (barW + BAR_GAP)
        const y = CHART_H - barH
        const label = monthLabel(p.monthYmd)
        return (
          <g key={p.monthYmd} onClick={() => onBarClick(p)} style={{ cursor: 'pointer' }}>
            <rect
              x={`${x}%`}
              y={y}
              width={`${barW}%`}
              height={barH}
              className="trend-chart__bar"
              rx="2"
              aria-label={`${label}: ${formatPaise(p.totalPaise)}`}
            />
            <text
              x={`${x + barW / 2}%`}
              y={CHART_H + 14}
              textAnchor="middle"
              className="trend-chart__label"
              fontSize="7"
            >
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function CashflowTrendCard() {
  const { t } = useLanguage()
  const navigate = useNavigate()

  const query = useQuery({
    queryKey: queryKeys.expenses.trend(6),
    queryFn: ({ signal }) => getExpenseTrend(6, signal),
  })

  function handleBarClick(p: TrendPoint) {
    // Navigate to expenses filtered to that month
    const from = p.monthYmd.slice(0, 7) + '-01'
    const lastDay = new Date(new Date(from).getFullYear(), new Date(from).getMonth() + 1, 0).getDate()
    const to = p.monthYmd.slice(0, 7) + '-' + String(lastDay).padStart(2, '0')
    navigate(`${ROUTES.EXPENSES}?from=${from}&to=${to}`)
  }

  const title = t.expensesTrendTitle ?? 'Expense Trend'

  if (query.isPending) {
    return (
      <div className="trend-card trend-card--loading" aria-busy="true">
        <div className="trend-card__header">
          <span className="trend-card__title">{title}</span>
        </div>
        <div className="trend-card__skeleton" />
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="trend-card trend-card--error">
        <div className="trend-card__header">
          <span className="trend-card__title">{title}</span>
        </div>
        <div className="trend-card__error-body">
          <BarChart2 size={24} aria-hidden="true" />
          <p>Could not load</p>
          <Button variant="none" type="button" className="trend-card__retry" onClick={() => query.refetch()}>
            <RefreshCw size={12} aria-hidden="true" /> Retry
          </Button>
        </div>
      </div>
    )
  }

  const points = query.data ?? []

  if (points.length === 0) {
    return (
      <div className="trend-card trend-card--empty">
        <div className="trend-card__header">
          <span className="trend-card__title">{title}</span>
        </div>
        <p className="trend-card__empty-msg">No expenses recorded</p>
      </div>
    )
  }

  const latestTotal = points[points.length - 1]?.totalPaise ?? 0

  return (
    <div className="trend-card" role="region" aria-label="Expense trend chart">
      <div className="trend-card__header">
        <span className="trend-card__title">{title}</span>
        <span className="trend-card__total">{formatPaise(latestTotal)} this month</span>
      </div>
      <div className="trend-card__chart">
        <Bars points={points} onBarClick={handleBarClick} />
      </div>
    </div>
  )
}
