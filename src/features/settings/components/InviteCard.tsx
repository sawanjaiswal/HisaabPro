import { Text } from '@/components/ui/Text'
import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { Clock, RotateCcw } from 'lucide-react'
import type { StaffInvite } from '../settings.types'
import { formatTimeAgo } from '../settings.utils'
import '../staff-invite.css'
import { Button } from '@/components/ui/Button'

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
        <Text className="staff-invite-name">{invite.name}</Text>
        <span className="staff-phone">{invite.phone} &middot; {invite.roleName}</span>
        <Text className="staff-invite-expires">
          {isExpired ? t.expiredLabel : `${t.expiresLabel} ${formatTimeAgo(invite.expiresAt)}`}
        </Text>
      </span>

      <span className="staff-invite-actions">
        <Button variant="none"
          className="staff-action-button"
          onClick={() => onResend(invite.id)}
          aria-label={`${t.resendInviteLabel} ${invite.name}`}
        >
          <RotateCcw size={18} aria-hidden="true" />
        </Button>
      </span>
    </div>
  )
}
