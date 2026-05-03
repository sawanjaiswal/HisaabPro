/** Share Invoice Drawer
 *
 * Bottom sheet with 4 share actions: WhatsApp · PDF Download · Copy Link · Print.
 * WhatsApp flow: calls API to generate file → opens returned deep link.
 * PDF flow: calls exportDocument → triggers browser download.
 * Copy Link flow: calls getShareableLink → writes to clipboard.
 * Print flow: opens PDF in new tab for browser print dialog.
 *
 * All monetary values in PAISE — display via formatInvoiceAmount.
 */

import { useState, useCallback, useMemo } from 'react'
import { MessageCircle, Download, Link, Printer, FileText } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { shareViaWhatsApp, exportDocument, getShareableLink } from '../invoice.service'
import { formatInvoiceAmount } from '../invoice-format.utils'
import { useTemplates } from '@/features/templates/useTemplates'
import { ShareActionRow } from './ShareActionRow'
import '../invoice-detail-share-drawer.css'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ShareInvoiceDrawerProps {
  open: boolean
  onClose: () => void
  documentId: string
  documentNumber: string
  partyName: string
  /** Party's phone number (raw — may be +91XXXXXXXXXX or 0XXXXXXXXXX or 10 digits) */
  partyPhone?: string
  /** Grand total in PAISE */
  grandTotal: number
}

// ─── Phone normalisation ──────────────────────────────────────────────────────

/**
 * Normalise an Indian phone number to a bare 10-digit string.
 * Strips leading +91, 91, or 0. Returns null if not a valid 10-digit result.
 */
function normaliseIndianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0'))  return digits.slice(1)
  if (digits.length === 10) return digits
  return null
}

// ─── Component ───────────────────────────────────────────────────────────────

type LoadingKey = 'whatsapp' | 'pdf' | 'link' | null

export function ShareInvoiceDrawer({
  open,
  onClose,
  documentId,
  documentNumber,
  partyName,
  partyPhone,
  grandTotal,
}: ShareInvoiceDrawerProps) {
  const toast = useToast()
  const { t } = useLanguage()
  const [loading, setLoading] = useState<LoadingKey>(null)
  const { templates } = useTemplates()
  const defaultTemplateId = useMemo(
    () =>
      templates.find((tpl) => tpl.defaultForTypes.includes('SALE_INVOICE'))?.id ??
      templates.find((tpl) => tpl.isDefault)?.id ??
      templates[0]?.id ??
      '',
    [templates]
  )
  const [templateId, setTemplateId] = useState<string>('')
  const activeTemplateId = templateId || defaultTemplateId

  // ── WhatsApp ──────────────────────────────────────────────────────────────

  const handleWhatsApp = useCallback(async () => {
    if (loading !== null) return
    setLoading('whatsapp')

    const phone = partyPhone ? normaliseIndianPhone(partyPhone) : null
    const amountStr = formatInvoiceAmount(grandTotal)
    const message =
      `Hi ${partyName}, here's your invoice #${documentNumber} for ${amountStr}.`

    try {
      const result = await shareViaWhatsApp(documentId, {
        format: 'PDF',
        recipientPhone: phone ?? '',
        message,
        templateId: activeTemplateId || undefined,
      })

      // Open the server-generated WhatsApp deep link
      window.open(result.whatsappDeepLink, '_blank', 'noopener,noreferrer')
      toast.success(t.openingWhatsApp)
      onClose()
    } catch {
      toast.error(t.couldNotWhatsApp)
    } finally {
      setLoading(null)
    }
  }, [loading, partyPhone, grandTotal, partyName, documentNumber, documentId, activeTemplateId, toast, onClose])

  // ── PDF download ──────────────────────────────────────────────────────────

  const handlePdfDownload = useCallback(async () => {
    if (loading !== null) return
    setLoading('pdf')

    try {
      const blob = await exportDocument(documentId, 'PDF', activeTemplateId || undefined)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${documentNumber}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success(t.pdfDownloaded)
      onClose()
    } catch {
      toast.error(t.couldNotDownloadPdf)
    } finally {
      setLoading(null)
    }
  }, [loading, documentId, documentNumber, activeTemplateId, toast, onClose])

  // ── Copy link ─────────────────────────────────────────────────────────────

  const handleCopyLink = useCallback(async () => {
    if (loading !== null) return
    setLoading('link')

    try {
      const { url } = await getShareableLink(documentId)

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      } else {
        // Fallback for older browsers / WebViews
        const textarea = document.createElement('textarea')
        textarea.value = url
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }

      toast.success(t.linkCopiedClipboard)
    } catch {
      toast.error(t.couldNotCopyLink)
    } finally {
      setLoading(null)
    }
  }, [loading, documentId, toast])

  // ── Print ─────────────────────────────────────────────────────────────────

  const handlePrint = useCallback(async () => {
    if (loading !== null) return
    setLoading('pdf') // reuse pdf spinner for print since we fetch a PDF

    try {
      const blob = await exportDocument(documentId, 'PDF', activeTemplateId || undefined)
      const url = URL.createObjectURL(blob)
      const printWindow = window.open(url, '_blank', 'noopener,noreferrer')
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print()
          URL.revokeObjectURL(url)
        })
      } else {
        // Pop-up blocked — fall back to opening the PDF
        URL.revokeObjectURL(url)
        toast.info(t.openPdfPrint)
      }
      onClose()
    } catch {
      toast.error(t.couldNotPrint)
    } finally {
      setLoading(null)
    }
  }, [loading, documentId, activeTemplateId, toast, onClose])

  // ── Render ────────────────────────────────────────────────────────────────

  const isDisabled = loading !== null

  return (
    <Drawer open={open} onClose={onClose} title={t.shareInvoice} size="sm">
      {templates.length > 1 && (
        <div className="share-template-picker">
          <label htmlFor="share-template-select" className="share-template-picker-label">
            <FileText size={16} aria-hidden="true" />
            {t.template}
          </label>
          <select
            id="share-template-select"
            className="share-template-picker-select"
            value={activeTemplateId}
            onChange={(e) => setTemplateId(e.target.value)}
            disabled={isDisabled}
            aria-label={t.chooseTemplate}
          >
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
                {tpl.defaultForTypes.includes('SALE_INVOICE') ? ` · ${t.defaultLabel}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      <ul className="share-action-list" role="list" aria-label={t.shareOptionsAriaLabel}>
        <ShareActionRow
          icon={<MessageCircle size={22} aria-hidden="true" />}
          label={t.shareViaWhatsAppLabel}
          subLabel={partyPhone}
          onClick={() => { void handleWhatsApp() }}
          isLoading={loading === 'whatsapp'}
          disabled={isDisabled}
          ariaLabel={t.shareInvoiceViaWhatsApp}
          iconModifier="whatsapp"
        />
        <ShareActionRow
          icon={<Download size={22} aria-hidden="true" />}
          label={t.downloadPdfLabel}
          subLabel={t.savePdfFile}
          onClick={() => { void handlePdfDownload() }}
          isLoading={loading === 'pdf'}
          disabled={isDisabled}
          ariaLabel={t.downloadInvoicePdf}
          iconModifier="pdf"
        />
        <ShareActionRow
          icon={<Link size={22} aria-hidden="true" />}
          label={t.copySharLink}
          subLabel={t.anyoneCanView}
          onClick={() => { void handleCopyLink() }}
          isLoading={loading === 'link'}
          disabled={isDisabled}
          ariaLabel={t.copyLinkClipboard}
          iconModifier="link"
        />
        <ShareActionRow
          icon={<Printer size={22} aria-hidden="true" />}
          label={t.printInvoice}
          subLabel={t.openPrintDialog}
          onClick={() => { void handlePrint() }}
          isLoading={false}
          disabled={isDisabled}
          ariaLabel={t.printInvoiceAriaLabel}
          iconModifier="print"
          isLast
        />
      </ul>
    </Drawer>
  )
}
