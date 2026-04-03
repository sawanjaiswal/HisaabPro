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
import { useLanguage } from '@/hooks/useLanguage'
import { useImageExport } from '@/hooks/useImageExport'
import { useInvoiceDetail } from './useInvoiceDetail'
import { deleteDocument } from './invoice.service'
import { DETAIL_TABS } from './invoice.constants'
import { InvoiceDetailHeader } from './components/InvoiceDetailHeader'
import { InvoiceOverviewPanel } from './components/InvoiceOverviewPanel'
import { InvoiceItemsPanel } from './components/InvoiceItemsPanel'
import { InvoiceSharePanel } from './components/InvoiceSharePanel'
import { ShareInvoiceDrawer } from './components/ShareInvoiceDrawer'
import { EComplianceSection } from '@/features/documents/components/EComplianceSection'
import { ECOMPLIANCE_DOCUMENT_TYPES } from './invoice.constants'
import type { EComplianceDocumentType } from '@/features/documents/ecompliance.types'
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
  const { t } = useLanguage()

  const [shareOpen, setShareOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = () => {
    setIsDeleting(true)
    deleteDocument(documentId)
      .then(() => {
        toast.success(t.invoiceMovedToTrash)
        navigate(ROUTES.INVOICES)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : t.failedDeleteInvoice
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
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/invoices/${documentId}/edit`)} aria-label={t.editInvoice}>
        <Pencil size={18} aria-hidden="true" />
      </button>
      <button
        className="btn btn-ghost btn-sm"
        aria-label={t.shareInvoice}
        onClick={() => setShareOpen(true)}
        disabled={status !== 'success' || !document}
      >
        <Share2 size={18} aria-hidden="true" />
      </button>
      <button
        className="btn btn-ghost btn-sm"
        aria-label={isExporting ? t.exportingImage : t.exportAsImage}
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
        aria-label={t.deleteInvoice}
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
        <Header title={t.invoiceDetail} backTo={ROUTES.INVOICES} actions={headerActions} />

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
            title={t.couldNotLoadInvoice}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        )}

        {status === 'success' && !document && (
          <EmptyState
            icon={<FileText size={40} aria-hidden="true" />}
            title={t.invoiceNotFound}
            description={t.invoiceNotFoundDesc}
            action={
              <button
                className="btn btn-primary btn-md"
                onClick={() => navigate(ROUTES.INVOICES)}
                aria-label={t.goBackToInvoices}
              >
                {t.backToInvoices}
              </button>
            }
          />
        )}

        {status === 'success' && document && (
          <>
            <div role="status" aria-live="polite" className="sr-only">
              {t.invoice} {document.documentNumber} {t.invoiceLoadedSr}
            </div>
            <div ref={previewRef} className="invoice-export-capture stagger-enter">
            <InvoiceDetailHeader document={document} />

            <div className="pill-tabs invoice-detail-tabs" role="tablist" aria-label={t.invoiceDetailSections}>
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

            <div id={`panel-${activeTab}`} role="tabpanel" aria-label={`${activeTab} ${t.tabContent}`}>
              {activeTab === 'overview' && <InvoiceOverviewPanel document={document} />}
              {activeTab === 'items' && <InvoiceItemsPanel lineItems={document.lineItems} />}
              {activeTab === 'share' && <InvoiceSharePanel shareLogs={document.shareLogs} onShare={() => setShareOpen(true)} />}
              {activeTab === 'compliance' && ECOMPLIANCE_DOCUMENT_TYPES.has(document.type) && (
                <EComplianceSection
                  documentId={documentId}
                  documentType={document.type as EComplianceDocumentType}
                  totalAmountPaise={document.grandTotal}
                />
              )}
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
        title={t.deleteInvoiceConfirmTitle}
        description={t.deleteInvoiceConfirmDesc}
        isLoading={isDeleting}
      />
    </>
  )
}
