import React from 'react'
import { Clock, RotateCcw } from 'lucide-react'
import type { StaffInvite } from '../settings.types'
import { formatTimeAgo } from '../settings.utils'
import '../settings.css'

interface InviteCardProps {
  invite: StaffInvite
  onResend: (id: string) => void
}

export const InviteCard: React.FC<InviteCardProps> = ({ invite, onResend }) => {
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
          {isExpired ? 'Expired' : `Expires ${formatTimeAgo(invite.expiresAt)}`}
        </p>
      </span>

      <span className="staff-invite-actions">
        <button
          className="staff-action-button"
          onClick={() => onResend(invite.id)}
          aria-label={`Resend invite to ${invite.name}`}
        >
          <RotateCcw size={18} aria-hidden="true" />
        </button>
      </span>
    </div>
  )
}
