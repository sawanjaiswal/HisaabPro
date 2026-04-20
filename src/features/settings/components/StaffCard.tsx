import React, { useState } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { UserCog, Ban, Trash2 } from 'lucide-react'
import type { StaffMember } from '../settings.types'
import { STAFF_STATUS_LABELS } from '../staff.constants'
import { formatTimeAgo } from '../settings.utils'
import { PartyAvatar } from '../../../components/ui/PartyAvatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import '../staff-list.css'

interface StaffCardProps {
  staff: StaffMember
  onSuspend: (id: string) => void
  onRemove: (id: string) => void
  onChangeRole: (id: string) => void
}

export const StaffCard: React.FC<StaffCardProps> = ({ staff, onSuspend, onRemove, onChangeRole }) => {
  const { t } = useLanguage()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [suspendOpen, setSuspendOpen] = useState(false)
  const isSuspended = staff.status === 'SUSPENDED'

  const handleRemove = () => setConfirmOpen(true)
  const handleConfirmRemove = () => {
    setConfirmOpen(false)
    onRemove(staff.id)
  }

  // Unsuspend doesn't need a confirm — it's a reversal.
  const handleSuspend = () => {
    if (isSuspended) onSuspend(staff.id)
    else setSuspendOpen(true)
  }
  const handleConfirmSuspend = () => {
    setSuspendOpen(false)
    onSuspend(staff.id)
  }

  return (
    <div className="staff-card">
      <PartyAvatar
        name={staff.name}
        size="md"
        className={isSuspended ? 'staff-avatar--suspended' : ''}
      />

      <span className="staff-info">
        <p className="staff-name">{staff.name}</p>
        <span className="staff-meta">
          <span className="staff-role">{staff.role.name}</span>
          <span className="staff-phone">{staff.phone}</span>
        </span>
        {staff.lastActiveAt && (
          <span className="staff-phone">{formatTimeAgo(staff.lastActiveAt)}</span>
        )}
      </span>

      <span className="staff-status">
        <span
          className={`staff-status-dot staff-status-dot--${staff.status.toLowerCase()}`}
          aria-hidden="true"
        />
        <span className="staff-status-label">{STAFF_STATUS_LABELS[staff.status]}</span>
      </span>

      <button
        className="staff-action-button"
        onClick={() => onChangeRole(staff.id)}
        aria-label={`Change role for ${staff.name}`}
      >
        <UserCog size={18} aria-hidden="true" />
      </button>

      <button
        className="staff-action-button"
        onClick={handleSuspend}
        aria-label={isSuspended ? `Unsuspend ${staff.name}` : `Suspend ${staff.name}`}
      >
        <Ban size={18} aria-hidden="true" />
      </button>

      <button
        className="staff-action-button"
        onClick={handleRemove}
        aria-label={`Remove ${staff.name} from business`}
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmRemove}
        title={`${t.remove} ${staff.name}?`}
        description={t.removeStaffConfirm}
        confirmLabel={t.remove}
      />

      <ConfirmDialog
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        onConfirm={handleConfirmSuspend}
        title={`Suspend ${staff.name}?`}
        description="They will no longer be able to log in until unsuspended."
        confirmLabel="Suspend"
      />
    </div>
  )
}
