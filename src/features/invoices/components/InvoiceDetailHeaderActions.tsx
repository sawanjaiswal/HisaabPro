/** Invoice Detail — Header action buttons */

import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Pencil, Trash2, Share2, ImageDown, Link, RefreshCw, ArrowRightLeft } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { DocumentDetail } from '../invoice.types'

interface Props {
  documentId: string
  document: DocumentDetail | null
  status: 'loading' | 'success' | 'error'
  isExporting: boolean
  canConvert: boolean
  onShare: () => void
  onPaymentLink: () => void
  onExportImage: () => void
  onConvert: () => void
  onDelete: () => void
}

export function InvoiceDetailHeaderActions({
  documentId,
  document,
  status,
  isExporting,
  canConvert,
  onShare,
  onPaymentLink,
  onExportImage,
  onConvert,
  onDelete,
}: Props) {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const disabled = status !== 'success' || !document
  const isActive = document && ['SAVED', 'SHARED'].includes(document.status)

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate(`/invoices/${documentId}/edit`)} aria-label={t.editInvoice}>
        <Pencil size={18} aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="sm" aria-label={t.shareInvoice} onClick={onShare} disabled={disabled}>
        <Share2 size={18} aria-hidden="true" />
      </Button>
      {isActive && document!.balanceDue > 0 && (
        <Button variant="ghost" size="sm" aria-label="Get Payment Link" onClick={onPaymentLink}>
          <Link size={18} aria-hidden="true" />
        </Button>
      )}
      <Button
        variant="ghost" size="sm"
        aria-label={isExporting ? t.exportingImage : t.exportAsImage}
        onClick={onExportImage}
        disabled={isExporting || disabled}
      >
        {isExporting ? <span className="export-spinner" aria-hidden="true" /> : <ImageDown size={18} aria-hidden="true" />}
      </Button>
      {isActive && (
        <Button
          variant="ghost" size="sm"
          aria-label={t.recurringFromInvoiceCta ?? 'Set as Recurring'}
          onClick={() => navigate(`/recurring/new?fromInvoiceId=${documentId}`)}
        >
          <RefreshCw size={18} aria-hidden="true" />
        </Button>
      )}
      {canConvert && (
        <Button variant="ghost" size="sm" aria-label={t.convertDocument} onClick={onConvert}>
          <ArrowRightLeft size={18} aria-hidden="true" />
        </Button>
      )}
      <Button variant="ghost" size="sm" aria-label={t.deleteInvoice} onClick={onDelete} disabled={disabled}>
        <Trash2 size={18} aria-hidden="true" />
      </Button>
    </>
  )
}
