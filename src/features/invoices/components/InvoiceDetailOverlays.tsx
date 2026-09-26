/** Invoice Detail Overlays — All drawers and modals for Invoice Detail
 *
 * Keeps InvoiceDetailPage clean and within the 250-LOC Level 6 budget.
 */

import { ShareInvoiceDrawer } from './ShareInvoiceDrawer'
import { RecordDocumentPaymentSheet } from '@/features/payments/components/RecordDocumentPaymentSheet'
import { PaymentLinkSheet } from '@/features/collections/components/PaymentLinkSheet'
import { ConvertDocumentDrawer } from './ConvertDocumentDrawer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useLanguage } from '@/hooks/useLanguage'
import type { DocumentDetail } from '../invoice-document.types'

interface Props {
  document: DocumentDetail | null
  documentId: string
  shareOpen: boolean
  onCloseShare: () => void
  recordPaymentOpen: boolean
  onCloseRecordPayment: () => void
  paymentLinkOpen: boolean
  onClosePaymentLink: () => void
  convertOpen: boolean
  onCloseConvert: () => void
  onConverted: (newId: string) => void
  canConvert: boolean
  deleteOpen: boolean
  onCloseDelete: () => void
  onConfirmDelete: () => void
  isDeleting: boolean
  onRefresh: () => void
}

export function InvoiceDetailOverlays({
  document,
  documentId,
  shareOpen,
  onCloseShare,
  recordPaymentOpen,
  onCloseRecordPayment,
  paymentLinkOpen,
  onClosePaymentLink,
  convertOpen,
  onCloseConvert,
  onConverted,
  canConvert,
  deleteOpen,
  onCloseDelete,
  onConfirmDelete,
  isDeleting,
  onRefresh,
}: Props) {
  const { t } = useLanguage()

  if (!document) {
    return (
      <ConfirmDialog
        open={deleteOpen}
        onClose={onCloseDelete}
        onConfirm={onConfirmDelete}
        title={t.deleteInvoiceConfirmTitle}
        description={t.deleteInvoiceConfirmDesc}
        isLoading={isDeleting}
      />
    )
  }

  const isPurchase = document.type.startsWith('PURCHASE')

  return (
    <>
      <ShareInvoiceDrawer
        open={shareOpen}
        onClose={onCloseShare}
        documentId={documentId}
        documentNumber={document.documentNumber}
        partyName={document.party.name}
        partyPhone={document.party.phone ?? undefined}
        grandTotal={document.grandTotal}
        document={document}
      />

      <RecordDocumentPaymentSheet
        open={recordPaymentOpen}
        onClose={onCloseRecordPayment}
        documentId={documentId}
        documentNumber={document.documentNumber}
        party={document.party}
        balanceDue={document.balanceDue}
        grandTotal={document.grandTotal}
        type={isPurchase ? 'PAYMENT_OUT' : 'PAYMENT_IN'}
        onSuccess={onRefresh}
      />

      {['SAVED', 'SHARED'].includes(document.status) && document.balanceDue > 0 && (
        <PaymentLinkSheet
          open={paymentLinkOpen}
          onClose={onClosePaymentLink}
          invoiceId={documentId}
          invoiceNumber={document.documentNumber ?? documentId}
          balanceDue={document.balanceDue}
          partyName={document.party.name}
          partyPhone={document.party.phone ?? undefined}
          businessName=""
        />
      )}

      {canConvert && (
        <ConvertDocumentDrawer
          open={convertOpen}
          onClose={onCloseConvert}
          documentId={documentId}
          sourceType={document.type}
          onConverted={onConverted}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onClose={onCloseDelete}
        onConfirm={onConfirmDelete}
        title={t.deleteInvoiceConfirmTitle}
        description={t.deleteInvoiceConfirmDesc}
        isLoading={isDeleting}
      />
    </>
  )
}
