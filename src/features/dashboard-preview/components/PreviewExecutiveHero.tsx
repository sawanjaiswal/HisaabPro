import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ArrowDownRight, TrendingUp, ChevronRight } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { Button } from '@/components/ui/Button'
import type { HomeDashboardData } from '../../dashboard/dashboard.types'
import type { TimeFilter } from '../dashboard-preview.types'

interface PreviewExecutiveHeroProps {
  data: HomeDashboardData
}

function formatPaiseToRupees(paise: number): string {
  const rupees = Math.round(paise / 100)
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(rupees)
}

export function PreviewExecutiveHero({ data }: PreviewExecutiveHeroProps) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<TimeFilter>('today')

  const getHeroAmount = () => {
    if (filter === 'today') return data.today.salesAmount
    if (filter === '7d') return data.trend.sales.total
    return data.trend.sales.total * 4 // mock 30d
  }

  const salesPaise = getHeroAmount()
  const deltaPct = data.trend.sales.deltaPct ?? 12.4
  const isPositive = deltaPct >= 0

  return (
    <section className="exec-hero" aria-label="Business overview">
      <div className="exec-hero__glow" aria-hidden="true" />

      {/* Top Bar / Time Filter */}
      <div className="exec-hero__header">
        <div>
          <span className="exec-hero__sub">TOTAL SALES</span>
          <div className="exec-hero__status">
            <span className="exec-hero__status-dot" />
            <span>Live Pulse</span>
          </div>
        </div>

        <div className="exec-hero__pills" role="tablist" aria-label="Time period">
          {(['today', '7d', '30d'] as const).map((period) => (
            <Button
              key={period}
              variant="none"
              role="tab"
              aria-selected={filter === period}
              className={`exec-hero__pill${filter === period ? ' exec-hero__pill--active' : ''}`}
              onClick={() => setFilter(period)}
            >
              {period === 'today' ? 'Today' : period === '7d' ? '7 Days' : '30 Days'}
            </Button>
          ))}
        </div>
      </div>

      {/* Hero Metric */}
      <div className="exec-hero__amount-row">
        <div className="exec-hero__amount">
          <span className="exec-hero__currency">₹</span>
          <span className="exec-hero__num">{formatPaiseToRupees(salesPaise)}</span>
        </div>
        <div className={`exec-hero__delta${isPositive ? ' exec-hero__delta--up' : ' exec-hero__delta--down'}`}>
          <TrendingUp size={14} aria-hidden="true" />
          <span>{isPositive ? `+${deltaPct}%` : `${deltaPct}%`}</span>
        </div>
      </div>

      {/* Dual Cash Capsules */}
      <div className="exec-hero__capsules">
        <Button
          variant="none"
          className="exec-capsule exec-capsule--collect"
          onClick={() => navigate(ROUTES.OUTSTANDING)}
        >
          <div className="exec-capsule__icon">
            <ArrowUpRight size={16} aria-hidden="true" />
          </div>
          <div className="exec-capsule__info">
            <span className="exec-capsule__label">To Collect</span>
            <span className="exec-capsule__val">
              ₹{formatPaiseToRupees(data.outstanding.receivable.total)}
            </span>
          </div>
          <ChevronRight size={14} className="exec-capsule__chevron" aria-hidden="true" />
        </Button>

        <Button
          variant="none"
          className="exec-capsule exec-capsule--pay"
          onClick={() => navigate(ROUTES.OUTSTANDING)}
        >
          <div className="exec-capsule__icon">
            <ArrowDownRight size={16} aria-hidden="true" />
          </div>
          <div className="exec-capsule__info">
            <span className="exec-capsule__label">To Pay</span>
            <span className="exec-capsule__val">
              ₹{formatPaiseToRupees(data.outstanding.payable.total)}
            </span>
          </div>
          <ChevronRight size={14} className="exec-capsule__chevron" aria-hidden="true" />
        </Button>
      </div>
    </section>
  )
}
