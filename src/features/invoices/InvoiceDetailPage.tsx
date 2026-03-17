/** Invoice Detail — Page (lazy loaded)
 *
 * Thin composition layer: hero header card,
 * pill tabs (Overview / Items / Share), 4 UI states.
 * All tab content lives in sub-components.
 */

import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2, Share2, FileText, ImageDown } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/hooks/useToast'
import { useImageExport } from '@/hooks/useImageExport'
import { useInvoiceDetail } from './useInvoiceDetail'
import { deleteDocument } from './invoice.service'
import { DETAIL_TABS } from './invoice.constants'
import { InvoiceDetailHeader } from './components/InvoiceDetailHeader'
import { InvoiceOverviewPanel } from './components/InvoiceOverviewPanel'
import { InvoiceItemsPanel } from './components/InvoiceItemsPanel'
import { InvoiceSharePanel } from './components/InvoiceSharePanel'
import { ShareInvoiceDrawer } from './components/ShareInvoiceDrawer'
import './invoice-detail-items.css'
import './invoice-detail-summary.css'
import './invoice-detail-share-log.css'
import './invoice-detail-actions.css'

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const documentId = id ?? ''
  const { document, status, activeTab, setActiveTab, refresh } = useInvoiceDetail(documentId)

  const toast = useToast()

  const [shareOpen, setShareOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = () => {
    setIsDeleting(true)
    deleteDocument(documentId)
      .then(() => {
        toast.success('Invoice moved to trash. Restored within 30 days.')
        navigate(ROUTES.INVOICES)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to delete invoice'
        toast.error(message)
        setIsDeleting(false)
        setDeleteOpen(false)
      })
  }

  const previewRef = useRef<HTMLDivElement>(null)
  const { exportAsImage, isExporting } = useImageExport(previewRef)

  const handleExportImage = () => {
    const fileName = document ? document.documentNumber : 'invoice'
    void exportAsImage(fileName)
  }

  const headerActions = (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/invoices/${documentId}/edit`)} aria-label="Edit invoice">
        <Pencil size={18} aria-hidden="true" />
      </button>
      <button
        className="btn btn-ghost btn-sm"
        aria-label="Share invoice"
        onClick={() => setShareOpen(true)}
        disabled={status !== 'success' || !document}
      >
        <Share2 size={18} aria-hidden="true" />
      </button>
      <button
        className="btn btn-ghost btn-sm"
        aria-label={isExporting ? 'Exporting image...' : 'Export as image'}
        onClick={handleExportImage}
        disabled={isExporting || status !== 'success' || !document}
      >
        {isExporting ? (
          <span className="export-spinner" aria-hidden="true" />
        ) : (
          <ImageDown size={18} aria-hidden="true" />
        )}
      </button>
      <button
        className="btn btn-ghost btn-sm"
        aria-label="Delete invoice"
        onClick={() => setDeleteOpen(true)}
        disabled={status !== 'success' || !document}
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </>
  )

  return (
    <>
      <AppShell>
        <Header title="Invoice Detail" backTo={ROUTES.INVOICES} actions={headerActions} />

      <PageContainer>
        {status === 'loading' && (
          <>
            <div className="card-primary" style={{ marginBottom: 'var(--space-4)', minHeight: 160 }}>
              <Skeleton height="1.5rem" width="60%" />
              <div style={{ marginTop: 'var(--space-3)' }}>
                <Skeleton height="1rem" width="40%" />
              </div>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Skeleton height="2.5rem" width="50%" />
              </div>
            </div>
            <Skeleton height="2.5rem" borderRadius="var(--radius-full)" />
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Skeleton height="5rem" borderRadius="var(--radius-lg)" count={3} />
            </div>
          </>
        )}

        {status === 'error' && (
          <ErrorState
            title="Could not load invoice"
            message="Check your connection and try again."
            onRetry={refresh}
          />
        )}

        {status === 'success' && !document && (
          <EmptyState
            icon={<FileText size={40} aria-hidden="true" />}
            title="Invoice not found"
            description="This invoice may have been deleted."
            action={
              <button
                className="btn btn-primary btn-md"
                onClick={() => navigate(ROUTES.INVOICES)}
                aria-label="Go back to invoices list"
              >
                Back to Invoices
              </button>
            }
          />
        )}

        {status === 'success' && document && (
          <>
            <div ref={previewRef} className="invoice-export-capture">
            <InvoiceDetailHeader document={document} />

            <div className="pill-tabs invoice-detail-tabs" role="tablist" aria-label="Invoice detail sections">
              {DETAIL_TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  className={`pill-tab${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div id={`panel-${activeTab}`} role="tabpanel" aria-label={`${activeTab} tab content`}>
              {activeTab === 'overview' && <InvoiceOverviewPanel document={document} />}
              {activeTab === 'items' && <InvoiceItemsPanel lineItems={document.lineItems} />}
              {activeTab === 'share' && <InvoiceSharePanel shareLogs={document.shareLogs} onShare={() => setShareOpen(true)} />}
            </div>
            </div>{/* /invoice-export-capture */}
          </>
        )}
      </PageContainer>

      {document && (
        <ShareInvoiceDrawer
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          documentId={documentId}
          documentNumber={document.documentNumber}
          partyName={document.party.name}
          partyPhone={document.party.phone ?? undefined}
          grandTotal={document.grandTotal}
        />
      )}
      </AppShell>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Invoice?"
        description="This invoice will be moved to trash. Any payment allocations linked to it will be reversed. You can restore it within 30 days."
        isLoading={isDeleting}
      />
    </>
  )
}
