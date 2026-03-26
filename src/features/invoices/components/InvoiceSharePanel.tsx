/** Invoice Detail — Share tab panel
 *
 * Shows timeline of past share events (WhatsApp, Email, Print)
 * with a CTA to share again, or an empty state if never shared.
 */

import { Share2, MessageCircle, Mail, Printer } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLanguage } from '@/hooks/useLanguage'
import { formatInvoiceDate } from '../invoice-format.utils'
import { SHARE_CHANNEL_LABELS } from '../invoice.constants'
import type { DocumentShareLog } from '../invoice.types'

interface InvoiceSharePanelProps {
  shareLogs: DocumentShareLog[]
  onShare: () => void
}

export function InvoiceSharePanel({ shareLogs, onShare }: InvoiceSharePanelProps) {
  const { t } = useLanguage()
  if (shareLogs.length === 0) {
    return (
      <div className="invoice-share-tab">
        <EmptyState
          icon={<Share2 size={32} aria-hidden="true" />}
          title={t.notSharedYet}
          description={t.notSharedYetDesc}
          action={
            <button
              className="btn btn-primary btn-md"
              aria-label={t.shareInvoiceNow}
              onClick={onShare}
            >
              {t.shareInvoice}
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="invoice-share-tab">
      <ul className="share-timeline card" role="list" aria-label={t.shareHistoryAriaLabel}>
        {shareLogs.map((log) => (
          <li key={log.id} className="share-timeline-item">
            <span
              className={`share-timeline-icon share-timeline-icon--${log.channel.toLowerCase()}`}
              aria-hidden="true"
            >
              {log.channel === 'WHATSAPP' && <MessageCircle size={18} aria-hidden="true" />}
              {log.channel === 'EMAIL' && <Mail size={18} aria-hidden="true" />}
              {log.channel === 'PRINT' && <Printer size={18} aria-hidden="true" />}
            </span>
            <div className="share-timeline-info">
              <div className="share-timeline-channel">
                {SHARE_CHANNEL_LABELS[log.channel]}
              </div>
              {log.recipientPhone && (
                <div className="share-timeline-recipient">{log.recipientPhone}</div>
              )}
              {log.recipientEmail && (
                <div className="share-timeline-recipient">{log.recipientEmail}</div>
              )}
              <div className="share-timeline-date">{formatInvoiceDate(log.sentAt)}</div>
            </div>
            <span className="share-timeline-format" aria-label={`${t.formatLabel} ${log.format}`}>
              {log.format}
            </span>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'center' }}>
        <button
          className="btn btn-primary btn-md"
          aria-label={t.shareAgain}
          onClick={onShare}
        >
          {t.shareAgain}
        </button>
      </div>
    </div>
  )
}
