/** Party Detail — emerald hero header: back · name + status · edit/call/menu · contact row */

import React from 'react'
import { ArrowLeft, Phone, MapPin, MessageCircle } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'
import { PartyAvatar } from '@/components/ui/PartyAvatar'
import type { PartyDetail } from '../party.types'
import { PartyDetailMenu } from './PartyDetailMenu'
import '../party-detail-header.css'
import { Heading } from '@/components/ui/Heading'

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
  const addr = party.addresses?.find((a) => a.isDefault) ?? party.addresses?.[0]
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
  const typeLabel = party.type === 'CUSTOMER' ? t.customer : party.type === 'SUPPLIER' ? t.supplier : t.both

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
          <PartyAvatar name={party.name} phone={party.phone} size="sm" className="pdh-avatar" />
          <div className="pdh-title-group">
            <div className="pdh-name-row">
              <Heading level={1} className="pdh-name">{party.name}</Heading>
              <span className="pdh-type-badge">{typeLabel}</span>
            </div>
            {(party.phone || location) && (
              <div className="pdh-meta">
                {party.phone && (
                  <span className="pdh-meta-item">
                    <Phone size={11} aria-hidden="true" />
                    {party.phone}
                  </span>
                )}
                {party.phone && location && <span className="pdh-meta-sep">•</span>}
                {location && (
                  <span className="pdh-meta-item">
                    <MapPin size={11} aria-hidden="true" />
                    {location}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="pdh-actions">
          {party.phone && (
            <Button
              variant="none"
              className="pdh-icon-btn"
              onClick={handleCall}
              aria-label={t.callParty}
            >
              <Phone size={18} aria-hidden="true" />
            </Button>
          )}
          {party.phone && (
            <Button
              variant="none"
              className="pdh-icon-btn"
              onClick={handleWhatsapp}
              aria-label={t.whatsapp}
            >
              <MessageCircle size={18} aria-hidden="true" />
            </Button>
          )}
          <PartyDetailMenu
            onEdit={onEdit}
            onInvoice={onInvoice}
            onShare={onShare}
            onStatement={onStatement}
            onInvite={onInvite}
            onDelete={onDelete}
            onWhatsapp={party.phone ? handleWhatsapp : undefined}
            showInvite={showInvite}
          />
        </div>
      </div>
    </header>
  )
}

