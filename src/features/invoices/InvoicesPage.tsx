/** Invoices — List Page (lazy loaded)
 *
 * Follows PartiesPage.tsx pattern: summary bar, filter bar,
 * card list, 4 UI states, FAB for create.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useInvoices } from './useInvoices'
import { InvoiceSummaryBar } from './components/InvoiceSummaryBar'
import { InvoiceFilterBar } from './components/InvoiceFilterBar'
import { InvoiceCard } from './components/InvoiceCard'
import { InvoiceListSkeleton } from './components/InvoiceListSkeleton'
import { ROUTES } from '@/config/routes.config'
import { DOCUMENT_TYPE_LABELS } from './invoice.constants'
import type { DocumentType, DocumentStatus } from './invoice.types'
import './invoices.css'

export default function InvoicesPage() {
  const navigate = useNavigate()
  const [activeType, setActiveType] = useState<DocumentType | 'ALL'>('ALL')
  const [activeStatus, setActiveStatus] = useState<DocumentStatus | 'ALL'>('ALL')

  const { data, status, filters, setSearch, setFilter, refresh } = useInvoices({
    type: activeType === 'ALL' ? 'SALE_INVOICE' : activeType,
  })

  const handleDocClick = (id: string) => navigate(`/invoices/${id}`)
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

  const typeLabel = activeType === 'ALL' ? 'Invoices' : DOCUMENT_TYPE_LABELS[activeType]

  return (
    <AppShell>
      <Header title={typeLabel} />

      <PageContainer>
        {status === 'success' && data && <InvoiceSummaryBar summary={data.summary} />}

        <InvoiceFilterBar
          search={filters.search ?? ''}
          onSearchChange={setSearch}
          activeType={activeType}
          onTypeChange={handleTypeChange}
          activeStatus={activeStatus}
          onStatusChange={handleStatusChange}
        />

        {status === 'loading' && <InvoiceListSkeleton />}

        {status === 'error' && (
          <ErrorState
            title="Could not load invoices"
            message="Check your connection and try again."
            onRetry={refresh}
          />
        )}

        {status === 'success' && data && data.documents.length === 0 && (
          <EmptyState
            icon={<FileText size={40} aria-hidden="true" />}
            title="No invoices yet"
            description="Create your first invoice to start billing"
            action={
              <button className="btn btn-primary btn-md" onClick={goToCreate} aria-label="Create first invoice">
                Create Invoice
              </button>
            }
          />
        )}

        {status === 'success' && data && data.documents.length > 0 && (
          <div className="invoice-list" role="list" aria-label="Invoices">
            {data.documents.map((doc) => (
              <div key={doc.id} className="invoice-list-row" role="listitem">
                <InvoiceCard document={doc} onClick={handleDocClick} />
                <div className="divider" aria-hidden="true" />
              </div>
            ))}
          </div>
        )}
      </PageContainer>

      <button className="fab" onClick={goToCreate} aria-label="Create new invoice">
        <Plus size={24} aria-hidden="true" />
      </button>
    </AppShell>
  )
}
