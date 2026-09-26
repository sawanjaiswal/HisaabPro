/** Invoice Detail — Page (lazy loaded). Tabs: Overview / Items / Share. 4 UI states. */

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useNavigate, useParams } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { useImageExport } from '@/hooks/useImageExport'
import { useDocumentLineage } from '@/features/sales/useDocumentLineage'
import { useInvoiceDetail } from './useInvoiceDetail'
import { deleteDocument } from './invoice.service'
import { DETAIL_TABS } from './invoice.constants'
import { InvoiceDetailHeader } from './components/InvoiceDetailHeader'
import { InvoiceSummaryTiles } from './components/InvoiceSummaryTiles'
import { InvoiceDetailHeaderActions } from './components/InvoiceDetailHeaderActions'
import { InvoiceDetailSkeleton } from './components/InvoiceDetailSkeleton'
import { InvoiceOverviewPanel } from './components/InvoiceOverviewPanel'
import { InvoiceItemsPanel } from './components/InvoiceItemsPanel'
import { InvoiceSharePanel } from './components/InvoiceSharePanel'
import { ALLOWED_CONVERSIONS } from './invoice.constants'
import { EComplianceSection } from '@/features/documents/components/EComplianceSection'
import { ECOMPLIANCE_DOCUMENT_TYPES } from './invoice.constants'
import type { EComplianceDocumentType } from '@/features/documents/ecompliance.types'
import { UpiPayCard } from './components/UpiPayCard'
import { useBusinessVpa } from './hooks/useBusinessVpa'
import { PipelineTimeline } from '@/features/sales/components/PipelineTimeline'
import { InvoicePaymentHistory } from './components/InvoicePaymentHistory'
import { InvoiceDetailOverlays } from './components/InvoiceDetailOverlays'
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
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
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
      onRecordPayment={() => setRecordPaymentOpen(true)}
      onExportImage={handleExportImage}
      onConvert={() => setConvertOpen(true)}
      onDelete={() => setDeleteOpen(true)}
    />
  )

  return (
    <>
      <AppShell>
        <Header variant="emerald" title={t.invoiceDetail} backTo={ROUTES.INVOICES} actions={headerActions} />

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
              <Button
                variant="primary" size="md"
                onClick={() => navigate(ROUTES.INVOICES)}
                aria-label={t.goBackToInvoices}
              >
                {t.backToInvoices}
              </Button>
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
            <InvoiceSummaryTiles document={document} />

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList variant="line" aria-label={t.invoiceDetailSections}>
                {DETAIL_TABS.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div id={`panel-${activeTab}`} role="tabpanel" aria-label={`${activeTab} ${t.tabContent}`}>
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <InvoicePaymentHistory document={document} />
                  <InvoiceOverviewPanel document={document} />
                </div>
              )}
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

      <InvoiceDetailOverlays
        document={document}
        documentId={documentId}
        shareOpen={shareOpen}
        onCloseShare={() => setShareOpen(false)}
        recordPaymentOpen={recordPaymentOpen}
        onCloseRecordPayment={() => setRecordPaymentOpen(false)}
        paymentLinkOpen={paymentLinkOpen}
        onClosePaymentLink={() => setPaymentLinkOpen(false)}
        convertOpen={convertOpen}
        onCloseConvert={() => setConvertOpen(false)}
        onConverted={(newId) => {
          setConvertOpen(false)
          navigate(`/invoices/${newId}/edit`)
        }}
        canConvert={canConvert}
        deleteOpen={deleteOpen}
        onCloseDelete={() => setDeleteOpen(false)}
        onConfirmDelete={handleDelete}
        isDeleting={isDeleting}
        onRefresh={refresh}
      />
      </AppShell>
    </>
  )
}
