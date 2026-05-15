/** Invoice Detail — Page (lazy loaded). Tabs: Overview / Items / Share. 4 UI states. */

import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { useImageExport } from '@/hooks/useImageExport'
import { useInvoiceDetail } from './useInvoiceDetail'
import { deleteDocument } from './invoice.service'
import { DETAIL_TABS } from './invoice.constants'
import { InvoiceDetailHeader } from './components/InvoiceDetailHeader'
import { InvoiceDetailHeaderActions } from './components/InvoiceDetailHeaderActions'
import { InvoiceDetailSkeleton } from './components/InvoiceDetailSkeleton'
import { InvoiceOverviewPanel } from './components/InvoiceOverviewPanel'
import { InvoiceItemsPanel } from './components/InvoiceItemsPanel'
import { InvoiceSharePanel } from './components/InvoiceSharePanel'
import { ShareInvoiceDrawer } from './components/ShareInvoiceDrawer'
import { ConvertDocumentDrawer } from './components/ConvertDocumentDrawer'
import { ALLOWED_CONVERSIONS } from './invoice.constants'
import { PaymentLinkSheet } from '@/features/collections/components/PaymentLinkSheet'
import { EComplianceSection } from '@/features/documents/components/EComplianceSection'
import { ECOMPLIANCE_DOCUMENT_TYPES } from './invoice.constants'
import type { EComplianceDocumentType } from '@/features/documents/ecompliance.types'
import { UpiPayCard } from './components/UpiPayCard'
import { useBusinessVpa } from './hooks/useBusinessVpa'
import { PipelineTimeline } from '@/features/sales/components/PipelineTimeline'
import { useDocumentLineage } from '@/features/sales/useDocumentLineage'
import './invoice-detail-items.css'
import './invoice-detail-summary.css'
import './invoice-detail-share-log.css'
import './invoice-detail-actions.css'

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const documentId = id ?? ''
  const { document, status, activeTab, setActiveTab, refresh } = useInvoiceDetail(documentId)
  const businessVpa = useBusinessVpa()
  const { steps: lineageSteps, isLoading: lineageLoading, isError: lineageError } = useDocumentLineage(documentId)

  const toast = useToast()
  const { t } = useLanguage()

  const [shareOpen, setShareOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [paymentLinkOpen, setPaymentLinkOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)

  const canConvert = !!(
    document
    && ['SAVED', 'SHARED'].includes(document.status)
    && (ALLOWED_CONVERSIONS[document.type] ?? []).length > 0
    && !document.convertedTo
  )

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
    <InvoiceDetailHeaderActions
      documentId={documentId}
      document={document}
      status={status}
      isExporting={isExporting}
      canConvert={canConvert}
      onShare={() => setShareOpen(true)}
      onPaymentLink={() => setPaymentLinkOpen(true)}
      onExportImage={handleExportImage}
      onConvert={() => setConvertOpen(true)}
      onDelete={() => setDeleteOpen(true)}
    />
  )

  return (
    <>
      <AppShell>
        <Header title={t.invoiceDetail} backTo={ROUTES.INVOICES} actions={headerActions} />

      <PageContainer variant="detail" className="space-y-6">
        {status === 'loading' && <InvoiceDetailSkeleton />}

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

            <PipelineTimeline
              steps={lineageSteps}
              isLoading={lineageLoading}
              isError={lineageError}
            />

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

            {/* UpiPayCard: outside previewRef — not captured in image export */}
            {activeTab === 'overview' && ['SAVED', 'SHARED'].includes(document.status) && (
              <UpiPayCard
                vpa={businessVpa}
                payeeName={document.party.name}
                amountPaise={document.balanceDue}
                txnRef={document.documentNumber}
                txnNote={`Invoice ${document.documentNumber}`}
              />
            )}
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

      {document && (['SAVED', 'SHARED'].includes(document.status) && document.balanceDue > 0) && (
        <PaymentLinkSheet
          open={paymentLinkOpen}
          onClose={() => setPaymentLinkOpen(false)}
          invoiceId={documentId}
          invoiceNumber={document.documentNumber ?? documentId}
          balanceDue={document.balanceDue}
          partyName={document.party.name}
          partyPhone={document.party.phone ?? undefined}
          businessName=""
        />
      )}
      {document && canConvert && (
        <ConvertDocumentDrawer
          open={convertOpen}
          onClose={() => setConvertOpen(false)}
          documentId={documentId}
          sourceType={document.type}
          onConverted={(newId) => {
            setConvertOpen(false)
            navigate(`/invoices/${newId}/edit`)
          }}
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
