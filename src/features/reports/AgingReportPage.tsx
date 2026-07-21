/** Aging Report — mockup #66 "Customer Balance Summary".
 *
 * Emerald hero (dataset toggle + search) over a white sheet: bucket chips,
 * party rows on phone, the full five-bucket grid from md up, and a total
 * footer that reflects whatever the filters left on screen.
 *
 * Filtering is client-side over rows already in hand, so it keeps working
 * offline; only the receivable ↔ payable switch refetches.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, RefreshCw, Search } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Button } from '@/components/ui/Button'
import { FilterChips } from '@/components/ui/FilterChips'
import { Input } from '@/components/ui/Input'
import { OutstandingTotalCard } from '@/components/ui/OutstandingTotalCard'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import type { AgingType } from './finance.types'
import { AgingRow } from './aging/components/AgingRow'
import { AgingSkeleton } from './aging/components/AgingSkeleton'
import { AgingTable } from './aging/components/AgingTable'
import type { AgingBucket, RealAgingBucket } from './aging/aging.types'
import { bucketCounts, filterAgingRows, sumRows } from './aging/aging.utils'
import { useAgingReport } from './aging/useAgingReport'
import './aging/aging.css'

export default function AgingReportPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [agingType, setAgingType] = useState<AgingType>('RECEIVABLE')
  const [bucket, setBucket] = useState<AgingBucket>('ALL')
  const [query, setQuery] = useState('')
  const { data, status, refresh } = useAgingReport(agingType)

  const rows = data?.rows ?? []
  const visibleRows = useMemo(() => filterAgingRows(rows, bucket, query), [rows, bucket, query])
  const counts = useMemo(() => bucketCounts(rows), [rows])
  const visibleTotal = useMemo(() => sumRows(visibleRows).total, [visibleRows])

  const bucketLabels: Record<RealAgingBucket, string> = {
    CURRENT: t.current,
    D31_60: t.days31to60,
    D61_90: t.days61to90,
    OVER_90: t.over90,
  }

  const isReceivable = agingType === 'RECEIVABLE'
  const openParty = (partyId: string) =>
    navigate(ROUTES.PARTY_DETAIL.replace(':id', partyId))

  const hero = (
    <div className="aging-hero">
      <FilterChips
        options={[
          { value: 'RECEIVABLE', label: t.receivable },
          { value: 'PAYABLE', label: t.payable },
        ]}
        value={agingType}
        onChange={(next) => setAgingType(next)}
        label={t.reportType}
      />
      <Input
        type="search"
        className="aging-search"
        icon={<Search size={16} />}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t.searchParties}
        aria-label={t.searchParties}
      />
    </div>
  )

  return (
    <AppShell>
      <Header title={t.agingReport} backTo={ROUTES.REPORTS} />
      <HeroPage hero={hero} className="aging-sheet space-y-6">
        {status === 'loading' && <AgingSkeleton />}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadAging}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        )}

        {status === 'success' && (
          <>
            <div className="aging-controls">
              <FilterChips
                options={[
                  { value: 'ALL', label: t.all, count: counts.ALL },
                  { value: 'CURRENT', label: t.current, count: counts.CURRENT },
                  { value: 'D31_60', label: t.days31to60, count: counts.D31_60 },
                  { value: 'D61_90', label: t.days61to90, count: counts.D61_90 },
                  { value: 'OVER_90', label: t.over90, count: counts.OVER_90 },
                ]}
                value={bucket}
                onChange={(next) => setBucket(next)}
                label={t.filterByAge}
              />
              <Button
                variant="none"
                type="button"
                className="aging-refresh"
                onClick={refresh}
                aria-label={t.refreshAgingReport}
              >
                <RefreshCw size={14} aria-hidden="true" />
              </Button>
            </div>

            {rows.length === 0 && (
              <EmptyState
                icon={<Clock size={22} aria-hidden="true" />}
                title={isReceivable ? t.noOutstandingReceivables : t.noOutstandingPayables}
                description={t.allBalancesSettled}
              />
            )}

            {rows.length > 0 && visibleRows.length === 0 && (
              <EmptyState
                icon={<Search size={22} aria-hidden="true" />}
                title={t.noMatchingParties}
                description={t.tryDifferentSearch}
                action={
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => {
                      setQuery('')
                      setBucket('ALL')
                    }}
                  >
                    {t.clearSearch}
                  </Button>
                }
              />
            )}

            {visibleRows.length > 0 && (
              <>
                <div className="aging-rowlist">
                  {visibleRows.map((row) => (
                    <AgingRow
                      key={row.partyId}
                      row={row}
                      bucketLabels={bucketLabels}
                      onClick={() => openParty(row.partyId)}
                    />
                  ))}
                </div>

                <AgingTable
                  rows={visibleRows}
                  label={isReceivable ? t.receivablesAging : t.payablesAging}
                  onRowClick={(row) => openParty(row.partyId)}
                />

                <OutstandingTotalCard
                  label={t.totalOutstandingLabel}
                  totalPaise={visibleTotal}
                  caption={`${t.from} ${visibleRows.length} ${
                    visibleRows.length === 1 ? t.party : t.parties
                  }`}
                />
              </>
            )}
          </>
        )}
      </HeroPage>
    </AppShell>
  )
}
