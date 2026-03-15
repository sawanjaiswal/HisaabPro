/** Outstanding — Dashboard Page (lazy loaded)
 *
 * Shows receivable/payable summary, aging chart, and party list.
 * Follows PartiesPage.tsx pattern: summary bar, filter bar,
 * card list, 4 UI states.
 */

import { useNavigate } from 'react-router-dom'
import { Banknote } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useOutstanding } from './useOutstanding'
import { OutstandingSummaryBar } from './components/OutstandingSummaryBar'
import { OutstandingFilterBar } from './components/OutstandingFilterBar'
import { OutstandingCard } from './components/OutstandingCard'
import { OutstandingSkeleton } from './components/OutstandingSkeleton'
import { AGING_BUCKET_LABELS, AGING_BUCKET_COLORS } from './payment.constants'
import { getAgingPercentages, calculateAgingTotal } from './payment.utils'
import type { OutstandingType, OutstandingSortBy, OutstandingAging } from './payment.types'
import './outstanding.css'

export default function OutstandingPage() {
  const navigate = useNavigate()
  const { data, status, filters, setSearch, setFilter, refresh } = useOutstanding()

  const handleTypeChange = (type: OutstandingType) => {
    setFilter('type', type)
  }

  const handleOverdueToggle = (value: boolean) => {
    setFilter('overdue', value)
  }

  const handleSortChange = (sortBy: OutstandingSortBy) => {
    setFilter('sortBy', sortBy)
  }

  const handleRemind = (partyId: string) => {
    // TODO: Open reminder bottom sheet / modal
    void partyId
  }

  const handleRecordPayment = (partyId: string) => {
    navigate(`${ROUTES.PAYMENT_NEW}?type=PAYMENT_IN&partyId=${partyId}`)
  }

  return (
    <AppShell>
      <Header title="Outstanding" backTo={ROUTES.DASHBOARD} />

      <PageContainer>
        {/* Summary cards */}
        {status === 'success' && data && <OutstandingSummaryBar totals={data.totals} />}

        {/* Aging chart */}
        {status === 'success' && data && data.aging && (
          <AgingChart aging={data.aging} />
        )}

        {/* Filter bar */}
        <OutstandingFilterBar
          search={filters.search}
          onSearchChange={setSearch}
          activeType={filters.type}
          onTypeChange={handleTypeChange}
          overdueOnly={filters.overdue}
          onOverdueToggle={handleOverdueToggle}
          sortBy={filters.sortBy}
          onSortChange={handleSortChange}
        />

        {/* Loading */}
        {status === 'loading' && <OutstandingSkeleton />}

        {/* Error */}
        {status === 'error' && (
          <ErrorState
            title="Could not load outstanding"
            message="Check your connection and try again."
            onRetry={refresh}
          />
        )}

        {/* Empty */}
        {status === 'success' && data && data.parties.length === 0 && (
          <EmptyState
            icon={<Banknote size={40} aria-hidden="true" />}
            title="All clear! No outstanding."
            description="When you create invoices, outstanding will show here."
          />
        )}

        {/* Party list */}
        {status === 'success' && data && data.parties.length > 0 && (
          <div className="outstanding-list" role="list" aria-label="Outstanding parties">
            {data.parties.map((party) => (
              <div key={party.partyId} role="listitem">
                <OutstandingCard
                  party={party}
                  onRemind={handleRemind}
                  onRecordPayment={handleRecordPayment}
                />
              </div>
            ))}
          </div>
        )}
      </PageContainer>
    </AppShell>
  )
}

/** Aging bar chart — horizontal stacked bars */
function AgingChart({ aging }: { aging: OutstandingAging }) {
  const total = calculateAgingTotal(aging)
  if (total === 0) return null

  const percentages = getAgingPercentages(aging)
  const buckets = Object.keys(AGING_BUCKET_LABELS) as Array<keyof typeof AGING_BUCKET_LABELS>

  return (
    <div className="outstanding-aging-chart" aria-label="Aging breakdown">
      <h3 className="outstanding-aging-title">Aging Breakdown</h3>
      <div className="outstanding-aging-bar" role="img" aria-label="Aging bar chart">
        {buckets.map((bucket) => {
          const pct = percentages[bucket]
          if (pct <= 0) return null
          return (
            <div
              key={bucket}
              className="outstanding-aging-segment"
              style={{
                width: `${pct}%`,
                backgroundColor: AGING_BUCKET_COLORS[bucket],
              }}
              title={`${AGING_BUCKET_LABELS[bucket]}: ${pct}%`}
            />
          )
        })}
      </div>
      <div className="outstanding-aging-legend">
        {buckets.map((bucket) => (
          <div key={bucket} className="outstanding-aging-legend-item">
            <span
              className="outstanding-aging-dot"
              style={{ backgroundColor: AGING_BUCKET_COLORS[bucket] }}
              aria-hidden="true"
            />
            <span className="outstanding-aging-label">{AGING_BUCKET_LABELS[bucket]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
