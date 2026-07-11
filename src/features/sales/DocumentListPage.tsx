/** Sales pipeline — shared chassis for EST / SO / DC list pages.
 *
 * Receives `type` prop; thin wrapper pages hard-code the type.
 * 4 UI states: loading / empty / error / success.
 */

import React from 'react'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useLanguage } from '@/hooks/useLanguage'
import { useDocumentList } from './useDocumentList'
import { DocumentListSkeleton } from './components/DocumentListSkeleton'
import { DocumentEmptyState } from './components/DocumentEmptyState'
import { DocumentListCard } from './components/DocumentListCard'
import { DocumentListFilterBar } from './components/DocumentListFilterBar'
import { SALES_CREATE_LABELS, SALES_DETAIL_ROUTES } from './sales.constants'
import type { SalesDocumentType } from './sales.types'
import '../invoices/invoice-filter-bar.css'
import '../invoices/invoice-list-items.css'
import '../invoices/invoice-doc-badges.css'

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

  const {
    data,
    status,
    filterState,
    setSearch,
    setStatusFilter,
    refresh,
  } = useDocumentList({ type })

  const createRoute = (() => {
    switch (type) {
      case 'ESTIMATE':         return '/sales/estimates/new'
      case 'SALE_ORDER':       return '/sales/orders/new'
      case 'DELIVERY_CHALLAN': return '/sales/challans/new'
    }
  })()

  const handleCardClick = (id: string) => {
    navigate(SALES_DETAIL_ROUTES[type](id))
  }

  const documents = data?.documents ?? []

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
              <Plus size={18} aria-hidden="true" />
              <span className="hidden sm:inline">{SALES_CREATE_LABELS[type]}</span>
            </Button>
          }
        />
      )}

      <PageContainer variant="list" className="space-y-4">
        <DocumentListFilterBar
          search={filterState.search}
          activeStatus={filterState.status}
          onSearchChange={setSearch}
          onStatusChange={setStatusFilter}
        />

        {status === 'loading' && <DocumentListSkeleton />}

        {status === 'error' && (
          <ErrorState
            title={
              type === 'ESTIMATE'
                ? t.couldNotLoadEstimates ?? 'Could not load estimates'
                : type === 'SALE_ORDER'
                  ? t.couldNotLoadSaleOrders ?? 'Could not load sale orders'
                  : t.couldNotLoadChallans ?? 'Could not load delivery challans'
            }
            message={t.checkConnectionRetry ?? 'Check your connection and try again.'}
            onRetry={refresh}
          />
        )}

        {status === 'success' && documents.length === 0 && (
          <DocumentEmptyState
            type={type}
            onCreateClick={() => navigate(createRoute)}
          />
        )}

        {status === 'success' && documents.length > 0 && (
          <>
            <div
              role="status"
              aria-live="polite"
              className="sr-only"
            >
              {documents.length} {documents.length === 1 ? 'document' : 'documents'}
            </div>
            <div className="invoice-list stagger-list" role="list" aria-label={pageTitle}>
              {documents.map((doc) => (
                <div key={doc.id} className="invoice-list-row" role="listitem">
                  <DocumentListCard document={doc} onClick={handleCardClick} />
                  <div className="divider" aria-hidden="true" />
                </div>
              ))}
            </div>
          </>
        )}
      </PageContainer>

      {status === 'success' && documents.length > 0 && (
        <Button variant="none"
          className="fab"
          onClick={() => navigate(createRoute)}
          aria-label={SALES_CREATE_LABELS[type]}
        >
          <Plus size={24} aria-hidden="true" />
        </Button>
      )}
    </>
  )

  return embedded ? content : <AppShell>{content}</AppShell>
}
