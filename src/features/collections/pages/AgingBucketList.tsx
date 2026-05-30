/**
 * AgingBucketList — drill-down page for a specific aging bucket.
 *
 * Infinite scroll using cursor pagination.
 * 4 UI states: loading · error · empty · success.
 * Multi-select mode for bulk reminder dispatch.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Spinner } from '@/components/feedback/Spinner'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise, formatDate } from '@/lib/format'
import { useAgingBucketParties } from '../useAgingBucketParties'
import { ReminderActionBar } from '../components/ReminderActionBar'
import type { AgingBucketParam, PartyInBucket } from '../collections.types'
import '../styles/aging.css'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const VALID_BUCKETS: AgingBucketParam[] = ['current', '31', '61', '91']
const BUCKET_LABELS: Record<AgingBucketParam, string> = {
  current: 'Current (0-30)', '31': '31-60 Days', '61': '61-90 Days', '91': '91+ Days',
}

// Business name placeholder — replace with useCurrentBusiness() when available
const PLACEHOLDER_BUSINESS = 'Your Business'

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 ? `+91XXXXX${digits.slice(-4)}` : phone
}

function PartyCard({ party, selected, onToggle, overdueLabel, overduesLabel, lastPaymentLabel, noPaymentLabel }: {
  party: PartyInBucket
  selected: boolean
  onToggle: (id: string) => void
  overdueLabel: string
  overduesLabel: string
  lastPaymentLabel: string
  noPaymentLabel: string
}) {
  const overdueWord = party.overdueInvoiceCount === 1 ? overdueLabel : overduesLabel
  return (
    <article
      className={`bucket-party-card${selected ? ' bucket-party-card--selected' : ''}`}
      onClick={() => onToggle(party.partyId)}
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') onToggle(party.partyId) }}
    >
      <div className="bucket-party-card__select">
        <Input type="checkbox" readOnly checked={selected} tabIndex={-1} aria-hidden="true" />
      </div>
      <div className="bucket-party-card__body">
        <p className="bucket-party-card__name">{party.name}</p>
        {party.phone && <p className="bucket-party-card__phone">{maskPhone(party.phone)}</p>}
        <div className="bucket-party-card__amounts">
          <span className="bucket-party-card__bucket-amt">{formatPaise(party.bucketAmount)}</span>
          <span className="bucket-party-card__total">Total: {formatPaise(party.totalOutstanding)}</span>
        </div>
        <div className="bucket-party-card__meta">
          <span>{party.overdueInvoiceCount} {overdueWord}</span>
          <span>{lastPaymentLabel}: {party.lastPaymentDate ? formatDate(party.lastPaymentDate) : noPaymentLabel}</span>
        </div>
        {party.brokenPtpCount > 0 && (
          <div className="bucket-party-card__ptp-badge" role="img" aria-label={`${party.brokenPtpCount} broken PTP`}>
            {party.brokenPtpCount} broken PTP
          </div>
        )}
      </div>
    </article>
  )
}

export default function AgingBucketList() {
  const { bucket } = useParams<{ bucket: string }>()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const bucketParam = (VALID_BUCKETS.includes(bucket as AgingBucketParam) ? bucket : 'current') as AgingBucketParam
  const { data, status, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useAgingBucketParties(bucketParam)

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    observerRef.current = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { threshold: 0.1 }
    )
    observerRef.current.observe(sentinel)
    return () => observerRef.current?.disconnect()
  }, [loadMore])

  const toggleParty = useCallback((partyId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(partyId)) next.delete(partyId); else next.add(partyId)
      return next
    })
  }, [])

  const bucketLabel = BUCKET_LABELS[bucketParam]
  const title = `${bucketLabel} — ${t.agingDrillDown ?? 'Parties'}`
  const backAction = (
    <Button variant="none" type="button" onClick={() => navigate(-1)} aria-label="Go back"
      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 8, color: 'var(--color-gray-600)', marginLeft: -4 }}>
      <ArrowLeft size={20} />
    </Button>
  )

  if (status === 'pending') return (
    <AppShell><Header title={title} /><PageContainer><Spinner fullScreen /></PageContainer></AppShell>
  )
  if (status === 'error') return (
    <AppShell><Header title={title} /><PageContainer>
      <ErrorState title={t.agingError ?? 'Could not load aging data'} onRetry={() => refetch()} retryLabel={t.agingRetry ?? 'Retry'} />
    </PageContainer></AppShell>
  )

  const allParties = data.pages.flatMap((p) => p.data)
  if (allParties.length === 0) return (
    <AppShell><Header title={title} actions={backAction} /><PageContainer>
      <EmptyState
        icon={<CheckCircle2 size={22} aria-hidden="true" />}
        title={t.agingBucketEmpty ?? 'No parties in this bucket'}
        description={t.agingBucketEmptyDesc ?? 'No outstanding amounts in this period.'}
      />
    </PageContainer></AppShell>
  )

  const partiesWithPhone = allParties.filter((p) => p.phone)
  const allOnPageSelected = partiesWithPhone.length > 0 && partiesWithPhone.every((p) => selectedIds.has(p.partyId))
  const selectedParties = allParties.filter((p) => selectedIds.has(p.partyId))

  return (
    <AppShell>
      <Header title={title} actions={backAction} />
      <PageContainer>
        {/* Select all on page (excludes no-phone) */}
        {allParties.length > 0 && (
          <div className="bucket-select-all">
            <label className="bucket-select-all__label">
              <Input type="checkbox" checked={allOnPageSelected}
                onChange={() => {
                  setSelectedIds(allOnPageSelected
                    ? new Set()
                    : new Set(partiesWithPhone.map((p) => p.partyId)))
                }}
              />
              Select all ({partiesWithPhone.length} with phone)
            </label>
          </div>
        )}

        <div role="list" aria-label={title}>
          {allParties.map((party) => (
            <div key={party.partyId} role="listitem">
              <PartyCard party={party} selected={selectedIds.has(party.partyId)} onToggle={toggleParty}
                overdueLabel={t.overdueInvoices ?? 'overdue invoice'}
                overduesLabel={t.overdueInvoicesPlural ?? 'overdue invoices'}
                lastPaymentLabel={t.lastPayment ?? 'Last payment'}
                noPaymentLabel={t.noPaymentsYet ?? 'None'}
              />
            </div>
          ))}
        </div>
        <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
        {isFetchingNextPage && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}><Spinner /></div>
        )}
      </PageContainer>

      <ReminderActionBar
        selectedParties={selectedParties}
        businessName={PLACEHOLDER_BUSINESS}
        onClearSelection={() => setSelectedIds(new Set())}
      />
    </AppShell>
  )
}
