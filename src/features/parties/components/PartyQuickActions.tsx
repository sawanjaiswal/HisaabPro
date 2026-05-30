/** Party Detail — Quick action buttons row */

import { FileText, Wallet, MessageSquare, Share2, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'

interface PartyQuickActionsProps {
  partyId:        string
  onStatement:    () => void
  onShare:        () => void
  /** Shown only when party.userId is null (portal not yet claimed) */
  onInvite?:      () => void
  showInvite?:    boolean
}

export function PartyQuickActions({ partyId, onStatement, onShare, onInvite, showInvite }: PartyQuickActionsProps) {
  const navigate = useNavigate()
  const { t } = useLanguage()

  return (
    <div className="party-quick-actions" role="group" aria-label={t.quickActions}>
      <Button variant="none"
        className="party-quick-action-btn"
        onClick={() => navigate(`/invoices/new?partyId=${partyId}`)}
        aria-label={t.createInvoiceLabel}
      >
        <FileText size={18} aria-hidden="true" />
        <span>{t.invoice}</span>
      </Button>
      <Button variant="none"
        className="party-quick-action-btn"
        onClick={() => navigate(`/payments/new?partyId=${partyId}`)}
        aria-label={t.recordPaymentLabel}
      >
        <Wallet size={18} aria-hidden="true" />
        <span>{t.paymentWord}</span>
      </Button>
      <Button variant="none"
        className="party-quick-action-btn"
        onClick={onStatement}
        aria-label={t.viewStatementLabel}
      >
        <MessageSquare size={18} aria-hidden="true" />
        <span>{t.statement}</span>
      </Button>
      <Button variant="none"
        className="party-quick-action-btn"
        onClick={onShare}
        aria-label={t.shareLedgerLabel}
      >
        <Share2 size={18} aria-hidden="true" />
        <span>{t.share}</span>
      </Button>
      {showInvite && onInvite && (
        <Button variant="none"
          className="party-quick-action-btn"
          onClick={onInvite}
          aria-label={t.inviteToPortalButton}
        >
          <UserPlus size={18} aria-hidden="true" />
          <span>{t.inviteToPortalButton}</span>
        </Button>
      )}
    </div>
  )
}
