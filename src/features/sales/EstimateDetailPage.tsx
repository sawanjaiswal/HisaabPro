/** Estimate Details — Page, mockup #46.
 *
 * Single scroll: pipeline → identity + amount + info rows → items → the two
 * actions the mockup ends on (Convert to Invoice, Download / Share).
 *
 * Convert is shown disabled-by-absence rather than greyed: an estimate that is
 * already converted, or still a draft, has nothing to convert, and the pipeline
 * strip above already says so.
 */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { useInvoiceDetail } from '../invoices/useInvoiceDetail'
import { InvoiceItemsPanel } from '../invoices/components/InvoiceItemsPanel'
import { ConvertDocumentDrawer } from '../invoices/components/ConvertDocumentDrawer'
import { ShareInvoiceDrawer } from '../invoices/components/ShareInvoiceDrawer'
import { PipelineTimeline } from './components/PipelineTimeline'
import { EstimateDetailHero } from './components/EstimateDetailHero'
import { useDocumentLineage } from './useDocumentLineage'
import { ALLOWED_CONVERSIONS } from '../invoices/invoice.constants'
import type { DocumentViewStatus } from './sales-status.utils'
import './estimate-detail.css'

export default function EstimateDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const toast = useToast()
  const documentId = id ?? ''

  const { document, status, refresh } = useInvoiceDetail(documentId)
  const { steps, isLoading: lineageLoading, isError: lineageError } = useDocumentLineage(documentId)

  const [convertOpen, setConvertOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const statusLabels: Record<DocumentViewStatus, string> = {
    DRAFT: t.draftStatus,
    SENT: t.sentStatus,
    ACCEPTED: t.acceptedStatus,
    EXPIRED: t.expiredStatus,
  }

  const canConvert = !!(
    document
    && ['SAVED', 'SHARED'].includes(document.status)
    && (ALLOWED_CONVERSIONS[document.type] ?? []).length > 0
    && !document.convertedTo
  )

  const handleConverted = (newDocId: string) => {
    setConvertOpen(false)
    toast.success(t.convertedToDraft)
    navigate(`/sales/estimates/${newDocId}`)
  }

  return (
    <AppShell>
      <Header title={document?.documentNumber ?? t.estimateDetail} backTo="/sales/estimates" />

      <PageContainer variant="detail" className="space-y-6">
        {/* Loading */}
        {status === 'loading' && (
          <>
            <Skeleton height="10rem" borderRadius="var(--radius-xl)" />
            <Skeleton height="5rem" borderRadius="var(--radius-xl)" count={2} />
          </>
        )}

        {/* Error */}
        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadEstimates}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        )}

        {/* Not found */}
        {status === 'success' && !document && (
          <EmptyState
            icon={<FileText size={40} aria-hidden="true" />}
            title={t.invoiceNotFound}
            description={t.invoiceNotFoundDesc}
            action={
              <Button variant="primary" size="md" onClick={() => navigate('/sales/estimates')}>
                {t.backToList}
              </Button>
            }
          />
        )}

        {/* Success */}
        {status === 'success' && document && (
          <>
            <PipelineTimeline steps={steps} isLoading={lineageLoading} isError={lineageError} />

            <EstimateDetailHero
              document={document}
              statusLabels={statusLabels}
              amountLabel={t.estimateAmountLabel}
            />

            <InvoiceItemsPanel lineItems={document.lineItems} />

            <div className="estimate-detail-actions">
              {canConvert && (
                <Button
                  variant="primary" size="md"
                  className="w-full"
                  onClick={() => setConvertOpen(true)}
                >
                  {t.convertToInvoice}
                </Button>
              )}

              <Button
                variant="outline" size="md"
                className="w-full"
                onClick={() => setShareOpen(true)}
              >
                <Share2 size={18} aria-hidden="true" />
                {t.downloadShare}
              </Button>
            </div>
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

      {shareOpen && document && (
        <ShareInvoiceDrawer
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          documentId={documentId}
          documentNumber={document.documentNumber}
          partyName={document.party.name}
          partyPhone={document.party.phone ?? undefined}
          grandTotal={document.grandTotal}
          document={document}
        />
      )}
    </AppShell>
  )
}
