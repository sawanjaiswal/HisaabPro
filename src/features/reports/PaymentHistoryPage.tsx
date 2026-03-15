/** Payment History — All payments filterable by mode, type, with grouping (lazy loaded) */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banknote } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { usePaymentHistoryReport } from './hooks/usePaymentHistoryReport'
import { exportReport } from './report.service'
import { formatAmount, formatReportDate, getDateRange } from './report.utils'
import {
  DATE_RANGE_PRESETS,
  DATE_RANGE_LABELS,
  PAYMENT_MODE_LABELS,
  PAYMENT_GROUP_BY_LABELS,
  SORT_BY_LABELS,
} from './report.constants'
import { ReportSummaryBar } from './components/ReportSummaryBar'
import { ReportFilterPills } from './components/ReportFilterPills'
import { ReportCardList } from './components/ReportCardList'
import { ReportGroupHeader } from './components/ReportGroupHeader'
import { ReportLoadMore } from './components/ReportLoadMore'
import { ReportExportBar } from './components/ReportExportBar'
import { ReportSkeleton } from './components/ReportSkeleton'
import type {
  ExportFormat,
  PaymentHistoryMode,
  PaymentHistoryGroupBy,
  ReportSortBy,
  DateRangePreset,
} from './report.types'
import './reports.css'

// ─── Filter option lists ───────────────────────────────────────────────────────

const DATE_RANGE_OPTIONS = DATE_RANGE_PRESETS.map((preset) => ({
  value: preset,
  label: DATE_RANGE_LABELS[preset],
}))

const PAYMENT_TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'in', label: 'Payment In' },
  { value: 'out', label: 'Payment Out' },
]

const PAYMENT_MODE_OPTIONS = [
  { value: '', label: 'All' },
  ...Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
]

const GROUP_BY_OPTIONS = Object.entries(PAYMENT_GROUP_BY_LABELS).map(
  ([value, label]) => ({ value, label }),
)

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PaymentHistoryPage() {
  const navigate = useNavigate()
  const { data, status, filters, setFilter, loadMore, refresh } =
    usePaymentHistoryReport()

  // UI-only state: tracks which group keys are expanded
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const handleExport = useCallback(
    (format: ExportFormat) => {
      exportReport({
        reportType: 'payment_history',
        format,
        filters: { ...filters },
      }).catch(() => { /* download handled internally */ })
    },
    [filters],
  )

  // Derive active date preset from current from/to (match preset whose range aligns)
  const activeDatePreset: string =
    DATE_RANGE_PRESETS.find((p) => {
      const range = getDateRange(p)
      return range.from === filters.from && range.to === filters.to
    }) ?? 'this_month'

  const isLoadingMore = status === 'loading' && data !== null
  const summary = data?.data.summary
  const items = data?.data.items ?? []
  const groups = data?.data.groups ?? []
  const hasMore = data?.meta.hasMore ?? false
  const isGrouped = filters.groupBy !== 'none'
  const hasContent = isGrouped ? groups.length > 0 : items.length > 0
  const hasFiltersApplied =
    filters.type !== undefined ||
    filters.mode !== undefined ||
    filters.partyId !== undefined

  // ─── Loading state ───────────────────────────────────────────────────────────

  if (status === 'loading' && data === null) {
    return (
      <AppShell>
        <Header title="Payment History" backTo={ROUTES.REPORTS} />
        <PageContainer>
          <ReportSkeleton rows={7} />
        </PageContainer>
      </AppShell>
    )
  }

  // ─── Error state ─────────────────────────────────────────────────────────────

  if (status === 'error' && data === null) {
    return (
      <AppShell>
        <Header title="Payment History" backTo={ROUTES.REPORTS} />
        <PageContainer>
          <div className="report-empty">
            <div className="report-empty-icon" aria-hidden="true">
              <Banknote size={28} />
            </div>
            <p className="report-empty-title">Could not load payment history</p>
            <p className="report-empty-desc">
              Check your connection and try again.
            </p>
            <button
              className="report-load-more-btn"
              onClick={refresh}
              type="button"
              aria-label="Retry loading payment history"
            >
              Retry
            </button>
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  // ─── Success + Empty states ──────────────────────────────────────────────────

  return (
    <AppShell>
      <Header title="Payment History" backTo={ROUTES.REPORTS} />

      <PageContainer>
        {/* Filter rows */}
        <div className="report-filter-bar">
          {/* Row 1 — Date range presets */}
          <ReportFilterPills
            options={DATE_RANGE_OPTIONS}
            activeValue={activeDatePreset}
            onChange={(v) => {
              const range = getDateRange(v as DateRangePreset)
              setFilter('from', range.from)
              setFilter('to', range.to)
            }}
            ariaLabel="Filter by date range"
          />

          {/* Row 2 — Payment type */}
          <ReportFilterPills
            options={PAYMENT_TYPE_OPTIONS}
            activeValue={filters.type ?? ''}
            onChange={(v) =>
              setFilter(
                'type',
                v !== '' ? (v as 'in' | 'out') : undefined,
              )
            }
            ariaLabel="Filter by payment type"
          />

          {/* Row 3 — Payment mode */}
          <ReportFilterPills
            options={PAYMENT_MODE_OPTIONS}
            activeValue={filters.mode ?? ''}
            onChange={(v) =>
              setFilter(
                'mode',
                v !== '' ? (v as PaymentHistoryMode) : undefined,
              )
            }
            ariaLabel="Filter by payment mode"
          />

          {/* Group by */}
          <ReportFilterPills
            options={GROUP_BY_OPTIONS}
            activeValue={filters.groupBy}
            onChange={(v) =>
              setFilter('groupBy', v as PaymentHistoryGroupBy)
            }
            ariaLabel="Group results by"
          />

          {/* Sort select */}
          <select
            className="report-filter-pill"
            value={filters.sortBy}
            onChange={(e) => setFilter('sortBy', e.target.value as ReportSortBy)}
            aria-label="Sort payments"
          >
            {Object.entries(SORT_BY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Summary bar */}
        {summary !== undefined && (
          <ReportSummaryBar
            items={[
              {
                label: 'Received',
                value: formatAmount(summary.totalReceived),
                color: 'var(--color-success-600)',
              },
              {
                label: 'Paid',
                value: formatAmount(summary.totalPaid),
                color: 'var(--color-error-600)',
              },
              {
                label: 'Net',
                value: formatAmount(summary.net),
                color:
                  summary.net >= 0
                    ? 'var(--color-success-600)'
                    : 'var(--color-error-600)',
              },
              {
                label: 'In',
                value: String(summary.countIn),
              },
              {
                label: 'Out',
                value: String(summary.countOut),
              },
            ]}
          />
        )}

        {/* Empty state — no payments at all */}
        {!hasContent && status === 'success' && !hasFiltersApplied && (
          <div className="report-empty">
            <div className="report-empty-icon" aria-hidden="true">
              <Banknote size={28} />
            </div>
            <p className="report-empty-title">No payments recorded yet.</p>
            <p className="report-empty-desc">
              Record your first payment to start tracking cash flow.
            </p>
            <button
              className="report-load-more-btn"
              onClick={() => navigate(ROUTES.PAYMENT_NEW)}
              type="button"
              aria-label="Record a new payment"
            >
              Record Payment
            </button>
          </div>
        )}

        {/* Empty state — filters returned nothing */}
        {!hasContent && status === 'success' && hasFiltersApplied && (
          <div className="report-empty">
            <div className="report-empty-icon" aria-hidden="true">
              <Banknote size={28} />
            </div>
            <p className="report-empty-title">
              No payments match your filters.
            </p>
            <p className="report-empty-desc">
              Try a broader date range or clear the active filters.
            </p>
            <button
              className="report-load-more-btn"
              onClick={() => {
                setFilter('type', undefined)
                setFilter('mode', undefined)
              }}
              type="button"
              aria-label="Clear filters"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Flat list — groupBy is 'none' */}
        {hasContent && !isGrouped && (
          <ReportCardList ariaLabel="Payment history">
            {items.map((item) => (
              <div key={item.id} className="report-card" role="listitem">
                <div className="report-card-header">
                  <span>{formatReportDate(item.date)}</span>
                  <span>{item.partyName}</span>
                </div>
                <div className="report-card-body">
                  <span className="report-card-mode">{item.mode}</span>
                  {item.invoiceNumber !== null && (
                    <span>→ {item.invoiceNumber}</span>
                  )}
                  {item.reference !== '' && (
                    <span className="report-card-ref">{item.reference}</span>
                  )}
                </div>
                <div className="report-card-footer">
                  <span
                    style={{
                      color:
                        item.type === 'in'
                          ? 'var(--color-success-600)'
                          : 'var(--color-error-600)',
                    }}
                  >
                    {item.type === 'in' ? '+' : '-'}
                    {formatAmount(item.amount)}
                  </span>
                </div>
                <div className="report-divider" />
              </div>
            ))}
          </ReportCardList>
        )}

        {/* Grouped list */}
        {hasContent && isGrouped && (
          <div role="list" aria-label="Payment history grouped">
            {groups.map((group) => {
              const isExpanded = expandedGroups.has(group.key)
              const subtitle = `${group.count} payment${group.count !== 1 ? 's' : ''} · +${formatAmount(group.totalReceived)} / -${formatAmount(group.totalPaid)}`

              return (
                <div key={group.key} role="listitem">
                  <ReportGroupHeader
                    label={group.label}
                    subtitle={subtitle}
                    isExpanded={isExpanded}
                    onToggle={() => toggleGroup(group.key)}
                  />
                  {isExpanded && (
                    <div className="report-group-items">
                      <ReportCardList
                        ariaLabel={`Payments in group ${group.label}`}
                      >
                        {group.items.map((item) => (
                          <div
                            key={item.id}
                            className="report-card"
                            role="listitem"
                          >
                            <div className="report-card-header">
                              <span>{formatReportDate(item.date)}</span>
                              <span>{item.partyName}</span>
                            </div>
                            <div className="report-card-body">
                              <span className="report-card-mode">
                                {item.mode}
                              </span>
                              {item.invoiceNumber !== null && (
                                <span>→ {item.invoiceNumber}</span>
                              )}
                              {item.reference !== '' && (
                                <span className="report-card-ref">
                                  {item.reference}
                                </span>
                              )}
                            </div>
                            <div className="report-card-footer">
                              <span
                                style={{
                                  color:
                                    item.type === 'in'
                                      ? 'var(--color-success-600)'
                                      : 'var(--color-error-600)',
                                }}
                              >
                                {item.type === 'in' ? '+' : '-'}
                                {formatAmount(item.amount)}
                              </span>
                            </div>
                            <div className="report-divider" />
                          </div>
                        ))}
                      </ReportCardList>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Load more */}
        <ReportLoadMore
          hasMore={hasMore}
          isLoading={isLoadingMore}
          onLoadMore={loadMore}
        />

        {/* Export */}
        <ReportExportBar onExport={handleExport} disabled={!hasContent} />
      </PageContainer>
    </AppShell>
  )
}
