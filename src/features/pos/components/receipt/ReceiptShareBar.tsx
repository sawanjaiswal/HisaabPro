/** POS — Share bar: WhatsApp, Email, Print/Download */

import { useState } from 'react'
import { MessageCircle, Mail, Printer, Download, Loader2 } from 'lucide-react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { shareReceipt } from '../../api/pos.service'
import type { PosSaleDTO } from '../../types/pos.types'
import type { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import { Button } from '@/components/ui/Button'

interface ReceiptShareBarProps {
  sale:         PosSaleDTO
  pdfDocument:  ReactElement<DocumentProps>
  fileName:     string
}

export function ReceiptShareBar({ sale, pdfDocument, fileName }: ReceiptShareBarProps) {
  const { t }   = useLanguage()
  const toast   = useToast()
  const [sharing, setSharing] = useState<'WHATSAPP' | 'EMAIL' | null>(null)

  const handleShare = async (channel: 'WHATSAPP' | 'EMAIL') => {
    setSharing(channel)
    try {
      const res = await shareReceipt(sale.id, channel, sale.receiptNumber)
      if (channel === 'WHATSAPP') {
        window.open(res.link, '_blank', 'noopener,noreferrer')
      } else {
        window.location.href = res.link
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (t.posShareFailed ?? 'Share failed'))
    } finally {
      setSharing(null)
    }
  }

  return (
    <div className="pos-share-bar" role="group" aria-label={t.posShareReceipt ?? 'Share receipt'}>
      {/* WhatsApp */}
      <Button variant="none"
        type="button"
        className="pos-share-btn pos-share-btn--whatsapp"
        onClick={() => void handleShare('WHATSAPP')}
        disabled={sharing !== null}
        aria-label={t.posShareWhatsApp ?? 'Share via WhatsApp'}
        aria-busy={sharing === 'WHATSAPP'}
      >
        {sharing === 'WHATSAPP' ? (
          <Loader2 size={16} className="pos-share-btn__spin" aria-hidden="true" />
        ) : (
          <MessageCircle size={16} aria-hidden="true" />
        )}
        <span>{t.posShareWhatsApp ?? 'WhatsApp'}</span>
      </Button>

      {/* Email */}
      <Button variant="none"
        type="button"
        className="pos-share-btn pos-share-btn--email"
        onClick={() => void handleShare('EMAIL')}
        disabled={sharing !== null}
        aria-label={t.posShareEmail ?? 'Share via Email'}
        aria-busy={sharing === 'EMAIL'}
      >
        {sharing === 'EMAIL' ? (
          <Loader2 size={16} className="pos-share-btn__spin" aria-hidden="true" />
        ) : (
          <Mail size={16} aria-hidden="true" />
        )}
        <span>{t.posShareEmail ?? 'Email'}</span>
      </Button>

      {/* Download PDF */}
      <PDFDownloadLink
        document={pdfDocument}
        fileName={fileName}
        className="pos-share-btn pos-share-btn--download"
        aria-label={t.posDownloadPdf ?? 'Download PDF'}
      >
        {({ loading }) =>
          loading ? (
            <>
              <Loader2 size={16} className="pos-share-btn__spin" aria-hidden="true" />
              <span>{t.loading ?? 'Loading…'}</span>
            </>
          ) : (
            <>
              <Download size={16} aria-hidden="true" />
              <span>{t.posDownloadPdf ?? 'Download'}</span>
            </>
          )
        }
      </PDFDownloadLink>

      {/* Print */}
      <Button variant="none"
        type="button"
        className="pos-share-btn pos-share-btn--print"
        onClick={() => window.print()}
        aria-label={t.posPrint ?? 'Print'}
      >
        <Printer size={16} aria-hidden="true" />
        <span>{t.posPrint ?? 'Print'}</span>
      </Button>
    </div>
  )
}
