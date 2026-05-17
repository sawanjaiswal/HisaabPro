/**
 * Commission #128 — Per-staff ledger page (route: /commission/ledger).
 *
 * Self-view by default — server resolves staffUserId from the session
 * cookie. Admins with `?staffUserId=<id>` view another staff member's
 * ledger (server enforces tenant membership).
 *
 * M4 cross-tenant handling: when the query string carries a foreign
 * staffUserId, the server returns 404 STAFF_NOT_FOUND. We map that to a
 * toast (`commissionStaffNotFoundToast`) + a graceful empty state via
 * the hook's `status: 'not-found'` channel.
 *
 * 4 UI states (Rule G):
 *   loading  → skeleton stack
 *   error    → ErrorState onRetry
 *   not-found → empty with link back to the leaderboard
 *   empty    → EmptyState (no rows this period)
 *   success  → row list + period summary
 */

import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ListChecks, IndianRupee, Calendar } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/feedback/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { formatDate, formatPaise } from '@/lib/format'
import { useCommissionLedger } from '../hooks/useCommissionLedger'
import { currentPeriodYearMonth, formatPeriodLabel } from '../commission.utils'
import type { CommissionLedgerRowDTO } from '../commission.types'
import '@/styles/components.commission.css'

function describeBasis(row: CommissionLedgerRowDTO): string {
  if (row.commissionPaise < 0) return `${formatPaise(row.basisPaise)}`
  return `${formatPaise(row.basisPaise)}`
}

export default function CommissionLedgerPage() {
  const { t } = useLanguage()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const staffUserId = searchParams.get('staffUserId') ?? undefined
  const [period, setPeriod] = useState<string>(currentPeriodYearMonth())

  const onStaffNotFound = useCallback(() => {
    toast.error(t.commissionStaffNotFoundToast)
  }, [toast, t])

  const { rows, summary, status, hasNextPage, isFetchingNextPage, fetchNextPage, refresh } =
    useCommissionLedger({ periodYearMonth: period, staffUserId, onStaffNotFound })

  const headerTitle = useMemo(
    () => (staffUserId ? t.commissionLedgerHeaderOther : t.commissionLedgerHeader),
    [staffUserId, t],
  )

  return (
    <AppShell>
      <Header title={headerTitle} backTo={ROUTES.DASHBOARD} />

      <PageContainer variant="list">
        <div className="commission-ledger__period-row">
          <label
            htmlFor="commission-period"
            className="commission-ledger__period-label"
          >
            <Calendar size={14} aria-hidden="true" />
            {t.commissionLedgerPeriodLabel}
          </label>
          <input
            id="commission-period"
            type="month"
            className="commission-ledger__period-input"
            value={period}
            onChange={(e) => setPeriod(e.target.value || currentPeriodYearMonth())}
            aria-label={t.commissionLedgerPeriodLabel}
          />
        </div>

        {status === 'loading' && (
          <div className="commission-ledger" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height="72px" borderRadius="var(--radius-md)" />
            ))}
          </div>
        )}

        {status === 'error' && (
          <ErrorState message={t.commissionLedgerLoadFailed} onRetry={refresh} />
        )}

        {status === 'not-found' && (
          <EmptyState
            icon={<ListChecks size={22} aria-hidden="true" />}
            title={t.commissionStaffNotFoundTitle}
            description={t.commissionStaffNotFoundDesc}
          />
        )}

        {status === 'success' && rows.length === 0 && (
          <EmptyState
            icon={<ListChecks size={22} aria-hidden="true" />}
            title={t.commissionLedgerEmptyTitle}
            description={t.commissionLedgerEmptyDesc.replace(
              '{period}',
              formatPeriodLabel(period),
            )}
          />
        )}

        {status === 'success' && rows.length > 0 && (
          <>
            <Card className="commission-ledger__summary">
              <div className="commission-ledger__summary-amount">
                <IndianRupee size={16} aria-hidden="true" />
                <span className="tabular-nums">
                  {formatPaise(summary?.totalCommissionPaise ?? 0)}
                </span>
              </div>
              <div className="commission-ledger__summary-meta">
                {t.commissionLedgerSummaryMeta
                  .replace('{count}', String(summary?.rowCount ?? rows.length))
                  .replace('{period}', formatPeriodLabel(period))}
              </div>
            </Card>

            <div className="commission-ledger">
              {rows.map((row) => (
                <Card key={row.id} className="commission-ledger__row">
                  <div className="commission-ledger__row-top">
                    <span
                      className={`commission-ledger__row-amount ${
                        row.commissionPaise < 0
                          ? 'commission-ledger__row-amount--negative'
                          : 'commission-ledger__row-amount--positive'
                      }`}
                    >
                      {row.commissionPaise < 0 ? '-' : '+'}
                      {formatPaise(Math.abs(row.commissionPaise))}
                    </span>
                    <span className="commission-ledger__row-date">
                      {formatDate(row.createdAt)}
                    </span>
                  </div>
                  <div className="commission-ledger__row-meta">
                    {t.commissionLedgerBasis}: {describeBasis(row)}
                  </div>
                </Card>
              ))}
            </div>

            {hasNextPage && (
              <Button
                className="commission-ledger__load-more"
                variant="secondary"
                size="sm"
                loading={isFetchingNextPage}
                onClick={fetchNextPage}
              >
                {t.commissionLedgerLoadMore}
              </Button>
            )}
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
