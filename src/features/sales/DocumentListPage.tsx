/** Sales pipeline — shared chassis for EST / SO / DC list pages (mockup #45).
 *
 * Archetype A: search → view-status chips → tinted-icon rows → totals footer.
 * Thin wrapper pages hard-code the type. 4 UI states.
 *
 * Chips read Sent / Accepted / Expired per the mockup; the translation from
 * stored statuses lives in sales-status.utils so nothing here invents state.
 * "Expired" cannot be filtered server-side (it is derived from dueDate), so
 * that one chip narrows the fetched page in memory.
 */

import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FilterChips, type FilterChipOption } from '@/components/ui/FilterChips'
import { ListTotalsFooter } from '@/components/ui/ListTotalsFooter'
import { useLanguage } from '@/hooks/useLanguage'
import { groupByPeriod, toPeriodTotalsSeries } from '@/lib/period-groups.utils'
import { useDocumentList } from './useDocumentList'
import { DocumentListSkeleton } from './components/DocumentListSkeleton'
import { DocumentEmptyState } from './components/DocumentEmptyState'
import { DocumentListCard } from './components/DocumentListCard'
import { SALES_CREATE_LABELS, SALES_CREATE_ROUTES, SALES_DETAIL_ROUTES } from './sales.constants'
import {
  VIEW_FILTER_TO_STATUS,
  isExpired,
  acceptedLabelFor,
  type DocumentViewFilter,
  type DocumentViewStatus,
} from './sales-status.utils'
import type { SalesDocumentType } from './sales.types'
import './sales-doc-list.css'

interface DocumentListPageProps {
  type: SalesDocumentType
  backTo?: string
  pageTitle: string
  /** When rendered as tab content inside SalesHubPage, the parent already
   * owns AppShell + Header — rendering our own would double the chrome. */
  embedded?: boolean
}

export const DocumentListPage: React.FC<DocumentListPageProps> = ({
  type,
  backTo = '/sales',
  pageTitle,
  embedded = false,
}) => {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { data, status, filterState, setSearch, setStatusFilter, refresh } = useDocumentList({ type })
  const [view, setView] = useState<DocumentViewFilter>('ALL')

  const createRoute = SALES_CREATE_ROUTES[type]
  const acceptedLabel = acceptedLabelFor(type, { accepted: t.acceptedStatus, converted: t.convertedStatus })

  const statusLabels: Record<DocumentViewStatus, string> = {
    DRAFT: t.draftStatus,
    SENT: t.sentStatus,
    ACCEPTED: acceptedLabel,
    EXPIRED: t.expiredStatus,
  }

  const chips: FilterChipOption<DocumentViewFilter>[] = [
    { value: 'ALL', label: t.all },
    { value: 'SENT', label: t.sentStatus },
    { value: 'ACCEPTED', label: acceptedLabel },
    { value: 'EXPIRED', label: t.expiredStatus },
  ]

  const handleViewChange = (next: DocumentViewFilter) => {
    setView(next)
    setStatusFilter(VIEW_FILTER_TO_STATUS[next] ?? 'ALL')
  }

  const documents = useMemo(() => {
    const all = data?.documents ?? []
    return view === 'EXPIRED' ? all.filter((doc) => isExpired(doc)) : all
  }, [data, view])

  const groups = useMemo(
    () => groupByPeriod(documents, (d) => d.documentDate, (d) => d.grandTotal, 'month'),
    [documents],
  )
  const series = useMemo(() => toPeriodTotalsSeries(groups), [groups])
  const pageTotal = useMemo(
    () => documents.reduce((sum, doc) => sum + doc.grandTotal, 0),
    [documents],
  )

  const content = (
    <>
      {!embedded && (
        <Header
          title={pageTitle}
          backTo={backTo}
          actions={
            <Button
              variant="ghost" size="sm"
              onClick={() => navigate(createRoute)}
              aria-label={SALES_CREATE_LABELS[type]}
            >
              <Plus size={20} aria-hidden="true" />
            </Button>
          }
        />
      )}

      <PageContainer variant="list" className="space-y-6">
        <div className="search-bar">
          <Search size={18} aria-hidden="true" />
          <Input
            type="search"
            value={filterState.search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchEstimatesPlaceholder}
            aria-label={pageTitle}
          />
        </div>

        <FilterChips options={chips} value={view} onChange={handleViewChange} label={pageTitle} />

        {status === 'loading' && <DocumentListSkeleton />}

        {status === 'error' && (
          <ErrorState
            title={
              type === 'ESTIMATE'
                ? t.couldNotLoadEstimates
                : type === 'SALE_ORDER'
                  ? t.couldNotLoadSaleOrders
                  : t.couldNotLoadChallans
            }
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        )}

        {status === 'success' && documents.length === 0 && (
          <DocumentEmptyState type={type} onCreateClick={() => navigate(createRoute)} />
        )}

        {status === 'success' && documents.length > 0 && (
          <>
            <div className="sales-doc-list" role="list" aria-label={pageTitle}>
              {documents.map((doc) => (
                <div key={doc.id} role="listitem">
                  <DocumentListCard
                    document={doc}
                    onClick={(id) => navigate(SALES_DETAIL_ROUTES[type](id))}
                    statusLabels={statusLabels}
                  />
                </div>
              ))}
            </div>

            <ListTotalsFooter label={pageTitle} totalPaise={pageTotal} series={series} />
          </>
        )}
      </PageContainer>
    </>
  )

  return embedded ? content : <AppShell>{content}</AppShell>
}
