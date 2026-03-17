import React from 'react'
import { Shield, ChevronRight } from 'lucide-react'
import type { Role } from '../settings.types'
import '../roles.css'

interface RoleCardProps {
  role: Role
  onClick: (id: string) => void
}

export const RoleCard: React.FC<RoleCardProps> = ({ role, onClick }) => {
  const priorityLabel = role.priority === 1 ? 'Highest' : role.priority === 2 ? 'High' : role.priority === 3 ? 'Medium' : 'Standard'

  return (
    <button
      className="role-card"
      onClick={() => onClick(role.id)}
      aria-label={`${role.name} role, ${role.staffCount} staff member${role.staffCount !== 1 ? 's' : ''}`}
    >
      <span className="role-card-icon" aria-hidden="true">
        <Shield size={20} />
      </span>
      <span className="role-card-body">
        <span className="role-card-header">
          <span className="role-card-name">{role.name}</span>
          {role.isSystem && (
            <span className="role-badge-system">System</span>
          )}
          {role.isDefault && (
            <span className="role-badge-default">Default</span>
          )}
        </span>
        {role.description && (
          <p className="role-card-description">{role.description}</p>
        )}
        <span className="role-card-meta">
          {role.staffCount} staff &middot; Priority: {priorityLabel}
        </span>
      </span>
      <ChevronRight className="role-card-chevron" size={16} aria-hidden="true" />
    </button>
  )
}
