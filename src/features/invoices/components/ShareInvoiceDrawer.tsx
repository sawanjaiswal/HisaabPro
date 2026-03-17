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

import { useState, useCallback } from 'react'
import { MessageCircle, Download, Link, Printer } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/hooks/useToast'
import { shareViaWhatsApp, exportDocument, getShareableLink } from '../invoice.service'
import { formatInvoiceAmount } from '../invoice-format.utils'
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
  const [loading, setLoading] = useState<LoadingKey>(null)

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
        format: 'IMAGE',
        recipientPhone: phone ?? '',
        message,
      })

      // Open the server-generated WhatsApp deep link
      window.open(result.whatsappDeepLink, '_blank', 'noopener,noreferrer')
      toast.success('Opening WhatsApp…')
      onClose()
    } catch {
      toast.error('Could not prepare WhatsApp share. Try again.')
    } finally {
      setLoading(null)
    }
  }, [loading, partyPhone, grandTotal, partyName, documentNumber, documentId, toast, onClose])

  // ── PDF download ──────────────────────────────────────────────────────────

  const handlePdfDownload = useCallback(async () => {
    if (loading !== null) return
    setLoading('pdf')

    try {
      const blob = await exportDocument(documentId, 'PDF')
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${documentNumber}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success('PDF downloaded')
      onClose()
    } catch {
      toast.error('Could not download PDF. Try again.')
    } finally {
      setLoading(null)
    }
  }, [loading, documentId, documentNumber, toast, onClose])

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

      toast.success('Link copied to clipboard!')
    } catch {
      toast.error('Could not copy link. Try again.')
    } finally {
      setLoading(null)
    }
  }, [loading, documentId, toast])

  // ── Print ─────────────────────────────────────────────────────────────────

  const handlePrint = useCallback(async () => {
    if (loading !== null) return
    setLoading('pdf') // reuse pdf spinner for print since we fetch a PDF

    try {
      const blob = await exportDocument(documentId, 'PDF')
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
        toast.info('Open the PDF and use your browser\'s print option.')
      }
      onClose()
    } catch {
      toast.error('Could not prepare print. Try again.')
    } finally {
      setLoading(null)
    }
  }, [loading, documentId, toast, onClose])

  // ── Render ────────────────────────────────────────────────────────────────

  const isDisabled = loading !== null

  return (
    <Drawer open={open} onClose={onClose} title="Share Invoice" size="sm">
      <ul className="share-action-list" role="list" aria-label="Share options">
        <ShareActionRow
          icon={<MessageCircle size={22} aria-hidden="true" />}
          label="Share via WhatsApp"
          subLabel={partyPhone}
          onClick={() => { void handleWhatsApp() }}
          isLoading={loading === 'whatsapp'}
          disabled={isDisabled}
          ariaLabel="Share invoice via WhatsApp"
          iconModifier="whatsapp"
        />
        <ShareActionRow
          icon={<Download size={22} aria-hidden="true" />}
          label="Download PDF"
          subLabel="Save as PDF file"
          onClick={() => { void handlePdfDownload() }}
          isLoading={loading === 'pdf'}
          disabled={isDisabled}
          ariaLabel="Download invoice as PDF"
          iconModifier="pdf"
        />
        <ShareActionRow
          icon={<Link size={22} aria-hidden="true" />}
          label="Copy Shareable Link"
          subLabel="Anyone with the link can view"
          onClick={() => { void handleCopyLink() }}
          isLoading={loading === 'link'}
          disabled={isDisabled}
          ariaLabel="Copy shareable link to clipboard"
          iconModifier="link"
        />
        <ShareActionRow
          icon={<Printer size={22} aria-hidden="true" />}
          label="Print Invoice"
          subLabel="Open print dialog"
          onClick={() => { void handlePrint() }}
          isLoading={false}
          disabled={isDisabled}
          ariaLabel="Print invoice"
          iconModifier="print"
          isLast
        />
      </ul>
    </Drawer>
  )
}
