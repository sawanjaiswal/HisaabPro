/** Invoices — List Page (lazy loaded)
 *
 * Follows PartiesPage.tsx pattern: summary bar, filter bar,
 * card list, 4 UI states, FAB for create, bulk select.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Camera } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { BulkActionBar } from '@/components/ui/BulkActionBar'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { useInvoices } from './useInvoices'
import { InvoiceSummaryBar } from './components/InvoiceSummaryBar'
import { InvoiceFilterBar } from './components/InvoiceFilterBar'
import { InvoiceCard } from './components/InvoiceCard'
import { InvoiceListSkeleton } from './components/InvoiceListSkeleton'
import { deleteDocument } from './invoice.service'
import { ROUTES } from '@/config/routes.config'
import { DOCUMENT_TYPE_LABELS } from './invoice.constants'
import type { DocumentType, DocumentStatus } from './invoice.types'
import type { BulkAction } from '@/components/ui/BulkActionBar'
import './invoice-filter-bar.css'
import './invoice-list-items.css'
import './invoice-doc-badges.css'

export default function InvoicesPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const toast = useToast()
  const [activeType, setActiveType] = useState<DocumentType | 'ALL'>('ALL')
  const [activeStatus, setActiveStatus] = useState<DocumentStatus | 'ALL'>('ALL')
  const bulk = useBulkSelect()
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  const { data, status, filters, setSearch, setFilter, refresh } = useInvoices({
    type: activeType === 'ALL' ? 'SALE_INVOICE' : activeType,
  })

  const handleDocClick = (id: string) => {
    if (bulk.isActive) {
      bulk.toggle(id)
    } else {
      navigate(`/invoices/${id}`)
    }
  }

  const handleLongPress = (id: string) => {
    if (!bulk.isActive) {
      bulk.toggle(id)
    }
  }

  const goToCreate = () => navigate(ROUTES.INVOICE_CREATE)

  const handleTypeChange = (type: DocumentType | 'ALL') => {
    setActiveType(type)
    if (type !== 'ALL') {
      setFilter('type', type)
    }
  }

  const handleStatusChange = (statusVal: DocumentStatus | 'ALL') => {
    setActiveStatus(statusVal)
    if (statusVal === 'ALL') {
      setFilter('status', 'SAVED,SHARED')
    } else {
      setFilter('status', statusVal)
    }
  }

  const handleBulkDelete = async () => {
    const count = bulk.selectedCount
    setIsBulkDeleting(true)
    try {
      const ids = Array.from(bulk.selectedIds)
      await Promise.all(ids.map((id) => deleteDocument(id)))
      toast.success(`${count} ${count === 1 ? t.invoiceDeletedSingular : t.invoiceDeletedPlural}`)
      bulk.clear()
      refresh()
    } catch {
      toast.error(t.failedDeleteInvoices)
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const allDocIds = data?.documents.map((d) => d.id) ?? []

  const bulkActions: BulkAction[] = [
    {
      id: 'delete',
      label: t.delete,
      icon: 'delete',
      isDanger: true,
      onClick: handleBulkDelete,
    },
    {
      id: 'export',
      label: t.export,
      icon: 'export',
      onClick: () => toast.info(t.exportComingSoon),
    },
  ]

  const typeLabel = activeType === 'ALL' ? t.invoices : DOCUMENT_TYPE_LABELS[activeType]

  return (
    <AppShell>
      <Header
        title={bulk.isActive ? `${bulk.selectedCount} ${t.nSelected}` : typeLabel}
        actions={
          !bulk.isActive ? (
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(ROUTES.BILL_SCAN)} aria-label={t.scanBillAriaLabel}>
              <Camera size={18} aria-hidden="true" />
              <span>{t.scan}</span>
            </button>
          ) : undefined
        }
      />

      {status === 'success' && data && !bulk.isActive && (
        <div className="page-hero">
          <InvoiceSummaryBar summary={data.summary} />
        </div>
      )}

      <PageContainer className="space-y-6">
        {!bulk.isActive && (
          <InvoiceFilterBar
            search={filters.search ?? ''}
            onSearchChange={setSearch}
            activeType={activeType}
            onTypeChange={handleTypeChange}
            activeStatus={activeStatus}
            onStatusChange={handleStatusChange}
          />
        )}

        {status === 'loading' && <InvoiceListSkeleton />}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadInvoices}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        )}

        {status === 'success' && data && data.documents.length === 0 && (
          <EmptyState
            icon={<FileText size={40} aria-hidden="true" />}
            title={t.noInvoicesYet}
            description={t.createFirstInvoiceBilling}
            action={
              <button className="btn btn-primary btn-md" onClick={goToCreate} aria-label={t.createFirstInvoiceAriaLabel}>
                {t.createInvoice}
              </button>
            }
          />
        )}

        {status === 'success' && data && (
          <div role="status" aria-live="polite" className="sr-only">
            {data.documents.length} {data.documents.length === 1 ? t.invoiceFoundSingular : t.invoiceFoundPlural}
          </div>
        )}

        {status === 'success' && data && data.documents.length > 0 && (
          <>
          <h2 className="sr-only">{t.invoiceListHeading}</h2>
          <div className="invoice-list stagger-list" role="list" aria-label={t.invoices}>
            {data.documents.map((doc) => (
              <div
                key={doc.id}
                className={`invoice-list-row${bulk.isSelected(doc.id) ? ' bulk-selected' : ''}`}
                role="listitem"
                onClick={(e) => {
                  if (bulk.isActive) {
                    e.stopPropagation()
                    bulk.toggle(doc.id)
                  }
                }}
              >
                <InvoiceCard
                  document={doc}
                  onClick={handleDocClick}
                  onLongPress={handleLongPress}
                  isSelected={bulk.isSelected(doc.id)}
                  isBulkMode={bulk.isActive}
                />
                <div className="divider" aria-hidden="true" />
              </div>
            ))}
          </div>
          </>
        )}
      </PageContainer>

      {!bulk.isActive && (
        <button className="fab" onClick={goToCreate} aria-label={t.createNewInvoiceAriaLabel}>
          <Plus size={24} aria-hidden="true" />
        </button>
      )}

      <BulkActionBar
        selectedCount={bulk.selectedCount}
        totalCount={allDocIds.length}
        onSelectAll={() => bulk.selectAll(allDocIds)}
        onClear={bulk.clear}
        actions={bulkActions}
        isProcessing={isBulkDeleting}
      />
    </AppShell>
  )
}
