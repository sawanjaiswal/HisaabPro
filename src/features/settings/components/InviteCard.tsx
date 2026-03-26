import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { Clock, RotateCcw } from 'lucide-react'
import type { StaffInvite } from '../settings.types'
import { formatTimeAgo } from '../settings.utils'
import '../staff-invite.css'

interface InviteCardProps {
  invite: StaffInvite
  onResend: (id: string) => void
}

export const InviteCard: React.FC<InviteCardProps> = ({ invite, onResend }) => {
  const { t } = useLanguage()
  const isExpired = invite.status === 'EXPIRED'

  return (
    <div className="staff-invite-card">
      <span className="staff-invite-avatar" aria-hidden="true">
        <Clock size={20} />
      </span>

      <span className="staff-invite-info">
        <p className="staff-invite-name">{invite.name}</p>
        <span className="staff-phone">{invite.phone} &middot; {invite.roleName}</span>
        <p className="staff-invite-expires">
          {isExpired ? t.expiredLabel : `${t.expiresLabel} ${formatTimeAgo(invite.expiresAt)}`}
        </p>
      </span>

      <span className="staff-invite-actions">
        <button
          className="staff-action-button"
          onClick={() => onResend(invite.id)}
          aria-label={`${t.resendInviteLabel} ${invite.name}`}
        >
          <RotateCcw size={18} aria-hidden="true" />
        </button>
      </span>
    </div>
  )
}
