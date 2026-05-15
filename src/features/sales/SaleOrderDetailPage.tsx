/** Sale Order Detail — document detail + PipelineTimeline + ConvertDocumentDrawer. */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { useInvoiceDetail } from '../invoices/useInvoiceDetail'
import { InvoiceDetailHeader } from '../invoices/components/InvoiceDetailHeader'
import { InvoiceOverviewPanel } from '../invoices/components/InvoiceOverviewPanel'
import { InvoiceItemsPanel } from '../invoices/components/InvoiceItemsPanel'
import { ConvertDocumentDrawer } from '../invoices/components/ConvertDocumentDrawer'
import { PipelineTimeline } from './components/PipelineTimeline'
import { useDocumentLineage } from './useDocumentLineage'
import { ALLOWED_CONVERSIONS, DETAIL_TABS } from '../invoices/invoice.constants'
import '../invoices/invoice-detail-items.css'
import '../invoices/invoice-detail-summary.css'
import '../invoices/invoice-detail-actions.css'

export default function SaleOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const toast = useToast()
  const documentId = id ?? ''

  const { document, status, activeTab, setActiveTab, refresh } = useInvoiceDetail(documentId)
  const { steps, isLoading: lineageLoading, isError: lineageError } = useDocumentLineage(documentId)

  const [convertOpen, setConvertOpen] = useState(false)

  const canConvert = !!(
    document
    && ['SAVED', 'SHARED'].includes(document.status)
    && (ALLOWED_CONVERSIONS[document.type] ?? []).length > 0
    && !document.convertedTo
  )

  const handleConverted = (newDocId: string) => {
    setConvertOpen(false)
    toast.success(t.convertedToDraft ?? 'Converted successfully')
    navigate(`/invoices/${newDocId}`)
  }

  return (
    <AppShell>
      <Header
        title={t.saleOrderDetail ?? 'Sale Order'}
        backTo="/sales/orders"
        actions={
          canConvert ? (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setConvertOpen(true)}
              aria-label={t.convertDocument ?? 'Convert'}
            >
              {t.convertCta ?? 'Convert'}
            </button>
          ) : undefined
        }
      />

      <PageContainer variant="detail" className="space-y-6">
        {status === 'loading' && (
          <>
            <div className="card-primary" style={{ minHeight: 160 }}>
              <Skeleton height="1.5rem" width="60%" />
              <div style={{ marginTop: 'var(--space-3)' }}>
                <Skeleton height="1rem" width="40%" />
              </div>
            </div>
            <Skeleton height="2.5rem" borderRadius="var(--radius-full)" />
            <Skeleton height="5rem" borderRadius="var(--radius-lg)" count={3} />
          </>
        )}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadInvoice ?? 'Could not load sale order'}
            message={t.checkConnectionRetry ?? 'Check connection and retry.'}
            onRetry={refresh}
          />
        )}

        {status === 'success' && !document && (
          <EmptyState
            icon={<FileText size={40} aria-hidden="true" />}
            title={t.invoiceNotFound ?? 'Sale order not found'}
            description={t.invoiceNotFoundDesc ?? 'This sale order may have been deleted.'}
            action={
              <button className="btn btn-primary btn-md" onClick={() => navigate('/sales/orders')}>
                {t.backToList ?? 'Back to sale orders'}
              </button>
            }
          />
        )}

        {status === 'success' && document && (
          <>
            <PipelineTimeline
              steps={steps}
              isLoading={lineageLoading}
              isError={lineageError}
            />

            <InvoiceDetailHeader document={document} />

            <nav className="pill-tabs" role="tablist">
              {DETAIL_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className={`pill-tab${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  aria-selected={activeTab === tab.id}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {activeTab === 'overview' && <InvoiceOverviewPanel document={document} />}
            {activeTab === 'items'    && <InvoiceItemsPanel lineItems={document.lineItems} />}
          </>
        )}
      </PageContainer>

      {convertOpen && document && (
        <ConvertDocumentDrawer
          open={convertOpen}
          onClose={() => setConvertOpen(false)}
          documentId={documentId}
          sourceType={document.type}
          onConverted={handleConverted}
        />
      )}
    </AppShell>
  )
}
