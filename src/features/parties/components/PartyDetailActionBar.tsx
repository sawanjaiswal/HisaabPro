/**
 * Party Detail — primary action row: Receive Payment · New Invoice · ⋯
 *
 * One primary per view: the money action carries the emerald fill, the invoice
 * action is second-tier, and everything else collapses into the overflow menu
 * rather than growing a fourth button that would not survive 320px.
 * Layout is mobile-first — see party-action-bar.css.
 */

import { FileText, PlusCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'
import { PartyDetailMenu } from './PartyDetailMenu'
import './party-action-bar.css'

interface PartyDetailActionBarProps {
  partyId: string
  onStatement: () => void
  onEdit: () => void
  onShare: () => void
  onInvite: () => void
  onDelete: () => void
  /** Invite shown only when the portal is not yet claimed */
  showInvite: boolean
}

export function PartyDetailActionBar({
  partyId,
  onStatement,
  onEdit,
  onShare,
  onInvite,
  onDelete,
  showInvite,
}: PartyDetailActionBarProps) {
  const navigate = useNavigate()
  const { t } = useLanguage()

  const goToInvoice = () => navigate(`/invoices/new?partyId=${partyId}`)

  return (
    <div className="pd-actions" role="group" aria-label={t.quickActions}>
      <div className="pd-actions__cta">
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate(`/payments/new?partyId=${partyId}`)}
          aria-label={t.receivePayment}
        >
          <PlusCircle size={18} aria-hidden="true" />
          <span className="pd-actions__label">{t.receivePayment}</span>
        </Button>
      </div>

      <div className="pd-actions__cta">
        <Button
          variant="secondary"
          size="md"
          onClick={goToInvoice}
          aria-label={t.newInvoice}
        >
          <FileText size={18} aria-hidden="true" />
          <span className="pd-actions__label">{t.newInvoice}</span>
        </Button>
      </div>

      <PartyDetailMenu
        appearance="inline"
        onEdit={onEdit}
        onInvoice={goToInvoice}
        onShare={onShare}
        onStatement={onStatement}
        onInvite={onInvite}
        onDelete={onDelete}
        showInvite={showInvite}
      />
    </div>
  )
}
