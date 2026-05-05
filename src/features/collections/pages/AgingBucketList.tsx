/**
 * AgingBucketList — drill-down page for a specific aging bucket.
 *
 * Infinite scroll using cursor pagination.
 * 4 UI states: loading · error · empty · success.
 */

import { useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Spinner } from '@/components/feedback/Spinner'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise, formatDate } from '@/lib/format'
import { useAgingBucketParties } from '../useAgingBucketParties'
import type { AgingBucketParam, PartyInBucket } from '../collections.types'
import '../styles/aging.css'

const VALID_BUCKETS: AgingBucketParam[] = ['current', '31', '61', '91']

const BUCKET_LABELS: Record<AgingBucketParam, string> = {
  current: 'Current (0-30)',
  '31': '31-60 Days',
  '61': '61-90 Days',
  '91': '91+ Days',
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 10) {
    return `+91XXXXX${digits.slice(-4)}`
  }
  return phone
}

function PartyCard({ party, overdueLabel, overduesLabel, lastPaymentLabel, noPaymentLabel }: {
  party: PartyInBucket
  overdueLabel: string
  overduesLabel: string
  lastPaymentLabel: string
  noPaymentLabel: string
}) {
  const overdueWord = party.overdueInvoiceCount === 1 ? overdueLabel : overduesLabel

  return (
    <article className="bucket-party-card">
      <p className="bucket-party-card__name">{party.name}</p>
      {party.phone && (
        <p className="bucket-party-card__phone">{maskPhone(party.phone)}</p>
      )}
      <div className="bucket-party-card__amounts">
        <span className="bucket-party-card__bucket-amt">
          {formatPaise(party.bucketAmount)}
        </span>
        <span className="bucket-party-card__total">
          Total: {formatPaise(party.totalOutstanding)}
        </span>
      </div>
      <div className="bucket-party-card__meta">
        <span>{party.overdueInvoiceCount} {overdueWord}</span>
        <span>
          {lastPaymentLabel}:{' '}
          {party.lastPaymentDate ? formatDate(party.lastPaymentDate) : noPaymentLabel}
        </span>
      </div>
      {party.brokenPtpCount > 0 && (
        <div className="bucket-party-card__ptp-badge" role="img" aria-label={`${party.brokenPtpCount} broken PTP`}>
          {party.brokenPtpCount} broken PTP
        </div>
      )}
    </article>
  )
}

export default function AgingBucketList() {
  const { bucket } = useParams<{ bucket: string }>()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const bucketParam = (VALID_BUCKETS.includes(bucket as AgingBucketParam)
    ? bucket
    : 'current') as AgingBucketParam

  const {
    data,
    status,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useAgingBucketParties(bucketParam)

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
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

  const bucketLabel = BUCKET_LABELS[bucketParam]
  const title = `${bucketLabel} — ${t.agingDrillDown ?? 'Parties'}`

  const backAction = (
    <button
      type="button"
      onClick={() => navigate(-1)}
      aria-label="Go back"
      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 8, color: 'var(--color-gray-600)', marginLeft: -4 }}
    >
      <ArrowLeft size={20} />
    </button>
  )

  if (status === 'pending') {
    return (
      <AppShell>
        <Header title={title} />
        <PageContainer>
          <Spinner fullScreen />
        </PageContainer>
      </AppShell>
    )
  }

  if (status === 'error') {
    return (
      <AppShell>
        <Header title={title} />
        <PageContainer>
          <ErrorState
            title={t.agingError ?? 'Could not load aging data'}
            onRetry={() => refetch()}
            retryLabel={t.agingRetry ?? 'Retry'}
          />
        </PageContainer>
      </AppShell>
    )
  }

  const allParties = data.pages.flatMap((p) => p.data)

  if (allParties.length === 0) {
    return (
      <AppShell>
        <Header title={title} actions={backAction} />
        <PageContainer>
          <div className="aging-empty">
            <h2 className="aging-empty__title">{t.agingBucketEmpty ?? 'No parties in this bucket'}</h2>
            <p className="aging-empty__desc">{t.agingBucketEmptyDesc ?? 'No outstanding amounts in this period.'}</p>
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title={title} actions={backAction} />
      <PageContainer>
        <div role="list" aria-label={title}>
          {allParties.map((party) => (
            <div key={party.partyId} role="listitem">
              <PartyCard
                party={party}
                overdueLabel={t.overdueInvoices ?? 'overdue invoice'}
                overduesLabel={t.overdueInvoicesPlural ?? 'overdue invoices'}
                lastPaymentLabel={t.lastPayment ?? 'Last payment'}
                noPaymentLabel={t.noPaymentsYet ?? 'None'}
              />
            </div>
          ))}
        </div>

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />

        {isFetchingNextPage && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
            <Spinner />
          </div>
        )}
      </PageContainer>
    </AppShell>
  )
}
