/** Party Detail — Quick action buttons row */

import { FileText, Wallet, MessageSquare, Share2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'

interface PartyQuickActionsProps {
  partyId: string
  onStatement: () => void
  onShare: () => void
}

export function PartyQuickActions({ partyId, onStatement, onShare }: PartyQuickActionsProps) {
  const navigate = useNavigate()
  const { t } = useLanguage()

  return (
    <div className="party-quick-actions" role="group" aria-label={t.quickActions}>
      <button
        className="party-quick-action-btn"
        onClick={() => navigate(`/invoices/new?partyId=${partyId}`)}
        aria-label={t.createInvoiceLabel}
      >
        <FileText size={18} aria-hidden="true" />
        <span>{t.invoice}</span>
      </button>
      <button
        className="party-quick-action-btn"
        onClick={() => navigate(`/payments/new?partyId=${partyId}`)}
        aria-label={t.recordPaymentLabel}
      >
        <Wallet size={18} aria-hidden="true" />
        <span>{t.paymentWord}</span>
      </button>
      <button
        className="party-quick-action-btn"
        onClick={onStatement}
        aria-label={t.viewStatementLabel}
      >
        <MessageSquare size={18} aria-hidden="true" />
        <span>{t.statement}</span>
      </button>
      <button
        className="party-quick-action-btn"
        onClick={onShare}
        aria-label={t.shareLedgerLabel}
      >
        <Share2 size={18} aria-hidden="true" />
        <span>{t.share}</span>
      </button>
    </div>
  )
}
