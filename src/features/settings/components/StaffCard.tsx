import React from 'react'
import { UserCog, Ban, Trash2 } from 'lucide-react'
import type { StaffMember } from '../settings.types'
import { STAFF_STATUS_LABELS } from '../staff.constants'
import { formatTimeAgo } from '../settings.utils'
import '../staff-list.css'

interface StaffCardProps {
  staff: StaffMember
  onSuspend: (id: string) => void
  onRemove: (id: string) => void
  onChangeRole: (id: string) => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export const StaffCard: React.FC<StaffCardProps> = ({ staff, onSuspend, onRemove, onChangeRole }) => {
  const isSuspended = staff.status === 'SUSPENDED'

  const handleRemove = () => {
    if (window.confirm(`Remove ${staff.name} from your business? This cannot be undone.`)) {
      onRemove(staff.id)
    }
  }

  return (
    <div className="staff-card">
      <span
        className={`staff-avatar${isSuspended ? ' staff-avatar--suspended' : ''}`}
        aria-hidden="true"
      >
        {getInitials(staff.name)}
      </span>

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
        onClick={() => onSuspend(staff.id)}
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
    </div>
  )
}
