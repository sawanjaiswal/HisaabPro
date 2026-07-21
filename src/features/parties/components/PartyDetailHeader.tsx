/** Party Detail — emerald hero header: back · name + status · edit/call/menu · contact row */

import React from 'react'
import { ArrowLeft, Pencil, Phone, MapPin, MessageCircle } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'
import type { PartyDetail } from '../party.types'
import { formatPhone } from '../party.utils'
import { PartyDetailMenu } from './PartyDetailMenu'
import '../party-detail-header.css'

interface PartyDetailHeaderProps {
  party: PartyDetail
  onBack: () => void
  onEdit: () => void
  onInvoice: () => void
  onShare: () => void
  onStatement: () => void
  onInvite: () => void
  onDelete: () => void
  /** Invite shown only when the portal is not yet claimed */
  showInvite: boolean
}

/** Default address (or first) → "City, State" display string. */
function partyLocation(party: PartyDetail): string | null {
  const addr = party.addresses.find((a) => a.isDefault) ?? party.addresses[0]
  if (!addr) return null
  const parts = [addr.city, addr.state].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

export const PartyDetailHeader: React.FC<PartyDetailHeaderProps> = ({
  party,
  onBack,
  onEdit,
  onInvoice,
  onShare,
  onStatement,
  onInvite,
  onDelete,
  showInvite,
}) => {
  const { t } = useLanguage()
  const location = partyLocation(party)

  const handleCall = () => {
    if (party.phone) window.location.href = `tel:${party.phone}`
  }

  // wa.me wants the bare number — strip spaces/dashes and assume the Indian
  // country code when the party was saved as a plain 10-digit mobile.
  const handleWhatsapp = () => {
    if (!party.phone) return
    const digits = party.phone.replace(/\D/g, '')
    const withCc = digits.length === 10 ? `91${digits}` : digits
    window.open(`https://wa.me/${withCc}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <header
      className="header header--emerald header--party-detail"
      role="banner"
      aria-label={t.partyOverview}
    >
      <div className="pdh-top">
        <Button
          variant="ghost"
          className="pdh-back"
          onClick={onBack}
          aria-label={t.goBack}
        >
          <ArrowLeft size={22} aria-hidden="true" />
        </Button>

        <div className="pdh-identity">
          <h1 className="pdh-name">{party.name}</h1>
          <span className={`pdh-status${party.isActive ? ' is-active' : ''}`}>
            <span className="pdh-status-dot" aria-hidden="true" />
            {party.isActive ? t.active : t.inactive}
          </span>
        </div>

        {/* Labelled cluster — an unlabelled icon row on the hero was the single
            most-missed affordance in the mockup review; the caption costs one
            line of --fs-xs and removes the guesswork. */}
        <div className="pdh-actions">
          <Button
            variant="none"
            className="pdh-icon-btn"
            onClick={onEdit}
            aria-label={t.editParty}
          >
            <Pencil size={20} aria-hidden="true" />
            <span className="pdh-icon-label">{t.edit}</span>
          </Button>
          {party.phone && (
            <Button
              variant="none"
              className="pdh-icon-btn"
              onClick={handleCall}
              aria-label={t.callParty}
            >
              <Phone size={20} aria-hidden="true" />
              <span className="pdh-icon-label">{t.call}</span>
            </Button>
          )}
          {party.phone && (
            <Button
              variant="none"
              className="pdh-icon-btn"
              onClick={handleWhatsapp}
              aria-label={t.whatsapp}
            >
              <MessageCircle size={20} aria-hidden="true" />
              <span className="pdh-icon-label">{t.whatsapp}</span>
            </Button>
          )}
          <PartyDetailMenu
            onEdit={onEdit}
            onInvoice={onInvoice}
            onShare={onShare}
            onStatement={onStatement}
            onInvite={onInvite}
            onDelete={onDelete}
            showInvite={showInvite}
          />
        </div>
      </div>

      {(party.phone || location) && (
        <div className="pdh-contact">
          {party.phone && (
            <span className="pdh-contact-item">
              <Phone size={15} aria-hidden="true" />
              {formatPhone(party.phone)}
            </span>
          )}
          {party.phone && location && <span className="pdh-contact-sep" aria-hidden="true">•</span>}
          {location && (
            <span className="pdh-contact-item">
              <MapPin size={15} aria-hidden="true" />
              {location}
            </span>
          )}
        </div>
      )}
    </header>
  )
}
