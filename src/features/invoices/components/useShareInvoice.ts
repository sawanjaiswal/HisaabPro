/** Share-invoice handlers — WhatsApp / PDF / Copy Link / Print.
 *  Extracted from ShareInvoiceDrawer to keep that file under the 250-line cap.
 */

import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { shareViaWhatsApp, exportDocument, getShareableLink } from '../invoice.service'
import { formatInvoiceAmount } from '../invoice-format.utils'

export type ShareLoadingKey = 'whatsapp' | 'pdf' | 'link' | null

/** Normalise an Indian phone number to a bare 10-digit string. */
function normaliseIndianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0'))  return digits.slice(1)
  if (digits.length === 10) return digits
  return null
}

interface Args {
  documentId: string
  documentNumber: string
  partyName: string
  partyPhone?: string
  grandTotal: number
  activeTemplateId: string
  onClose: () => void
}

export function useShareInvoice(args: Args) {
  const { documentId, documentNumber, partyName, partyPhone, grandTotal, activeTemplateId, onClose } = args
  const toast = useToast()
  const { t } = useLanguage()
  const [loading, setLoading] = useState<ShareLoadingKey>(null)

  const handleWhatsApp = useCallback(async () => {
    if (loading !== null) return
    setLoading('whatsapp')
    const phone = partyPhone ? normaliseIndianPhone(partyPhone) : null
    const message = `Hi ${partyName}, here's your invoice #${documentNumber} for ${formatInvoiceAmount(grandTotal)}.`
    try {
      const result = await shareViaWhatsApp(documentId, {
        format: 'PDF',
        recipientPhone: phone ?? '',
        message,
        templateId: activeTemplateId || undefined,
      })
      window.open(result.whatsappDeepLink, '_blank', 'noopener,noreferrer')
      toast.success(t.openingWhatsApp)
      onClose()
    } catch {
      toast.error(t.couldNotWhatsApp)
    } finally {
      setLoading(null)
    }
  }, [loading, partyPhone, grandTotal, partyName, documentNumber, documentId, activeTemplateId, toast, onClose, t])

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
  }, [loading, documentId, documentNumber, activeTemplateId, toast, onClose, t])

  const handleCopyLink = useCallback(async () => {
    if (loading !== null) return
    setLoading('link')
    try {
      const { url } = await getShareableLink(documentId)
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      } else {
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
  }, [loading, documentId, toast, t])

  const handlePrint = useCallback(async () => {
    if (loading !== null) return
    setLoading('pdf')
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
        URL.revokeObjectURL(url)
        toast.info(t.openPdfPrint)
      }
      onClose()
    } catch {
      toast.error(t.couldNotPrint)
    } finally {
      setLoading(null)
    }
  }, [loading, documentId, activeTemplateId, toast, onClose, t])

  return { loading, handleWhatsApp, handlePdfDownload, handleCopyLink, handlePrint }
}
