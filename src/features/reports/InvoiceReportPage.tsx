/** Invoice Report — Sales or Purchase (lazy loaded)
 *
 * Determines report type from the current pathname:
 *   /reports/sales     → type = 'sale'
 *   /reports/purchases → type = 'purchase'
 */

import { useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import {
  DATE_RANGE_PRESETS,
  DATE_RANGE_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  GROUP_BY_LABELS,
  SORT_BY_LABELS,
} from './report.constants'
import { formatAmount, formatReportDate } from './report.utils'
import { useInvoiceReport } from './hooks/useInvoiceReport'
import { ReportFilterPills } from './components/ReportFilterPills'
import { ReportSummaryBar } from './components/ReportSummaryBar'
import { ReportCardList } from './components/ReportCardList'
import { ReportGroupHeader } from './components/ReportGroupHeader'
import { ReportLoadMore } from './components/ReportLoadMore'
import { ReportExportBar } from './components/ReportExportBar'
import { ReportSkeleton } from './components/ReportSkeleton'
import { ReportStatusBadge } from './components/ReportStatusBadge'
import type {
  InvoiceReportType,
  InvoiceReportStatus,
  InvoiceReportItem,
  DateRangePreset,
  ReportGroupBy,
  ReportSortBy,
  ExportFormat,
} from './report.types'
import './reports.css'

// ─── Status filter options (including "All" sentinel) ────────────────────────

const STATUS_ALL = 'all' as const
type StatusFilterValue = InvoiceReportStatus | typeof STATUS_ALL

const STATUS_OPTIONS: Array<{ value: StatusFilterValue; label: string }> = [
  { value: STATUS_ALL, label: 'All' },
  { value: 'paid', label: INVOICE_STATUS_LABELS.paid },
  { value: 'unpaid', label: INVOICE_STATUS_LABELS.unpaid },
  { value: 'partial', label: INVOICE_STATUS_LABELS.partial },
]

// ─── Group-by options ─────────────────────────────────────────────────────────

const GROUP_BY_OPTIONS = (
  Object.keys(GROUP_BY_LABELS) as ReportGroupBy[]
).map((key) => ({ value: key, label: GROUP_BY_LABELS[key] }))

// ─── Sort-by options ──────────────────────────────────────────────────────────

const SORT_BY_OPTIONS = (
  Object.keys(SORT_BY_LABELS) as ReportSortBy[]
).map((key) => ({ value: key, label: SORT_BY_LABELS[key] }))

// ─── Date range pill options ──────────────────────────────────────────────────

const DATE_RANGE_OPTIONS = DATE_RANGE_PRESETS.map((preset) => ({
  value: preset,
  label: DATE_RANGE_LABELS[preset],
}))

// ─── Invoice card ─────────────────────────────────────────────────────────────

interface InvoiceCardProps {
  item: InvoiceReportItem
  onClick: (id: string) => void
}

function InvoiceCard({ item, onClick }: InvoiceCardProps) {
  return (
    <div
      className="report-card"
      role="listitem"
      onClick={() => onClick(item.id)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick(item.id)
      }}
      aria-label={`Invoice ${item.number} — ${item.partyName}`}
    >
      <div className="report-card-header">
        <span className="report-card-number">{item.number}</span>
        <span className="report-card-date">{formatReportDate(item.date)}</span>
      </div>

      <div className="report-card-body">
        <span className="report-card-party">{item.partyName}</span>
        <span className="report-card-items">{item.itemCount} items</span>
      </div>

      <div className="report-card-footer">
        <div className="report-card-amounts">
          <span className="report-card-amount">{formatAmount(item.amount)}</span>
          {item.balance > 0 && (
            <span className="report-card-balance">Due: {formatAmount(item.balance)}</span>
          )}
        </div>
        <ReportStatusBadge
          status={item.status}
          label={INVOICE_STATUS_LABELS[item.status]}
          color={INVOICE_STATUS_COLORS[item.status]}
        />
      </div>
      <div className="report-divider" aria-hidden="true" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvoiceReportPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const type: InvoiceReportType = location.pathname.includes('purchases')
    ? 'purchase'
    : 'sale'

  const title = type === 'sale' ? 'Sales Report' : 'Purchase Report'

  const { data, status, filters, setFilter, loadMore, refresh } = useInvoiceReport({ type })

  // Active filter values for controlled pills
  const [activeDatePreset, setActiveDatePreset] = useState<DateRangePreset>('this_month')
  const [activeStatus, setActiveStatus] = useState<StatusFilterValue>(STATUS_ALL)

  // Collapse state for grouped view — set of expanded group keys
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const handleDatePresetChange = useCallback(
    (value: string) => {
      const preset = value as DateRangePreset
      setActiveDatePreset(preset)
      if (preset !== 'custom') {
        const { from, to } = (() => {
          // Re-derive range inline (getDateRange is pure, avoids an import cycle)
          const today = new Date()
          const toISO = (d: Date) => d.toISOString().slice(0, 10)

          if (preset === 'today') return { from: toISO(today), to: toISO(today) }
          if (preset === 'this_week') {
            const day = today.getDay()
            const monday = new Date(today)
            monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
            return { from: toISO(monday), to: toISO(today) }
          }
          if (preset === 'this_month') {
            const first = new Date(today.getFullYear(), today.getMonth(), 1)
            return { from: toISO(first), to: toISO(today) }
          }
          if (preset === 'last_month') {
            const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
            const last = new Date(today.getFullYear(), today.getMonth(), 0)
            return { from: toISO(first), to: toISO(last) }
          }
          // this_fy
          const fyYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
          return { from: `${fyYear}-04-01`, to: toISO(today) }
        })()
        setFilter('from', from)
        setFilter('to', to)
      }
    },
    [setFilter],
  )

  const handleStatusChange = useCallback(
    (value: string) => {
      const v = value as StatusFilterValue
      setActiveStatus(v)
      setFilter(
        'status',
        v === STATUS_ALL ? (undefined as unknown as InvoiceReportStatus) : v,
      )
    },
    [setFilter],
  )

  const handleGroupByChange = useCallback(
    (value: string) => {
      setFilter('groupBy', value as ReportGroupBy)
      setExpandedGroups(new Set())
    },
    [setFilter],
  )

  const handleSortByChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setFilter('sortBy', e.target.value as ReportSortBy)
    },
    [setFilter],
  )

  const handleToggleGroup = useCallback((key: string) => {
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

  const handleInvoiceClick = useCallback(
    (id: string) => {
      navigate(ROUTES.INVOICE_DETAIL.replace(':id', id))
    },
    [navigate],
  )

  const handleExport = useCallback((_format: ExportFormat) => {
    // Export is handled by the service layer in a future implementation
  }, [])

  const isGrouped = filters.groupBy !== 'none'
  const hasData =
    data !== null &&
    (isGrouped
      ? (data.data.groups?.length ?? 0) > 0
      : (data.data.items?.length ?? 0) > 0)

  const summaryItems = data
    ? [
        { label: 'Total Invoices', value: String(data.data.summary.totalInvoices) },
        {
          label: 'Total Amount',
          value: formatAmount(data.data.summary.totalAmount),
          color: 'var(--color-primary-600)',
        },
        {
          label: 'Paid',
          value: formatAmount(data.data.summary.totalPaid),
          color: 'var(--color-success-600)',
        },
        {
          label: 'Outstanding',
          value: formatAmount(data.data.summary.totalOutstanding),
          color: 'var(--color-error-600)',
        },
      ]
    : []

  return (
    <AppShell>
      <Header title={title} backTo={ROUTES.REPORTS} />

      <PageContainer>
        {/* ── Filter bar ──────────────────────────────────────────────── */}
        <div className="report-filter-bar">
          <ReportFilterPills
            options={DATE_RANGE_OPTIONS}
            activeValue={activeDatePreset}
            onChange={handleDatePresetChange}
            ariaLabel="Date range filter"
          />

          <ReportFilterPills
            options={STATUS_OPTIONS}
            activeValue={activeStatus}
            onChange={handleStatusChange}
            ariaLabel="Payment status filter"
          />

          <ReportFilterPills
            options={GROUP_BY_OPTIONS}
            activeValue={filters.groupBy}
            onChange={handleGroupByChange}
            ariaLabel="Group by"
          />

          <div className="report-filter-pills">
            <select
              className="report-filter-pill"
              value={filters.sortBy}
              onChange={handleSortByChange}
              aria-label="Sort order"
            >
              {SORT_BY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Summary bar ─────────────────────────────────────────────── */}
        {status === 'success' && data && (
          <ReportSummaryBar items={summaryItems} />
        )}

        {/* ── Loading state ────────────────────────────────────────────── */}
        {status === 'loading' && <ReportSkeleton rows={6} />}

        {/* ── Error state ──────────────────────────────────────────────── */}
        {status === 'error' && (
          <ErrorState
            title={`Could not load ${title.toLowerCase()}`}
            message="Check your connection and try again."
            onRetry={refresh}
          />
        )}

        {/* ── Empty state ──────────────────────────────────────────────── */}
        {status === 'success' && !hasData && (
          <div className="report-empty">
            <div className="report-empty-icon" aria-hidden="true">
              <FileText size={28} />
            </div>
            <p className="report-empty-title">No invoices found</p>
            <p className="report-empty-desc">
              Try adjusting the date range or filters above.
            </p>
          </div>
        )}

        {/* ── Success — flat list ─────────────────────────────────────── */}
        {status === 'success' && hasData && !isGrouped && (
          <ReportCardList ariaLabel={`${title} invoices`}>
            {(data?.data.items ?? []).map((item) => (
              <InvoiceCard key={item.id} item={item} onClick={handleInvoiceClick} />
            ))}
          </ReportCardList>
        )}

        {/* ── Success — grouped list ──────────────────────────────────── */}
        {status === 'success' && hasData && isGrouped && (
          <div role="list" aria-label={`${title} grouped`}>
            {(data?.data.groups ?? []).map((group) => {
              const isExpanded = expandedGroups.has(group.key)
              const subtitle = `${group.invoiceCount} invoices · ${formatAmount(group.totalAmount)}`

              return (
                <div key={group.key} role="listitem">
                  <ReportGroupHeader
                    label={group.label}
                    subtitle={subtitle}
                    isExpanded={isExpanded}
                    onToggle={() => handleToggleGroup(group.key)}
                  />

                  {isExpanded && (
                    <div className="report-group-items">
                      <ReportCardList ariaLabel={`Invoices in ${group.label}`}>
                        {group.items.map((item) => (
                          <InvoiceCard
                            key={item.id}
                            item={item}
                            onClick={handleInvoiceClick}
                          />
                        ))}
                      </ReportCardList>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Load more ───────────────────────────────────────────────── */}
        {status === 'success' && (
          <ReportLoadMore
            hasMore={data?.meta.hasMore ?? false}
            isLoading={false}
            onLoadMore={loadMore}
          />
        )}

        {/* ── Export bar ──────────────────────────────────────────────── */}
        {status === 'success' && hasData && (
          <ReportExportBar onExport={handleExport} disabled={false} />
        )}
      </PageContainer>
    </AppShell>
  )
}
