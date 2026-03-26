import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { Shield, ChevronRight } from 'lucide-react'
import type { Role } from '../settings.types'
import '../roles.css'

interface RoleCardProps {
  role: Role
  onClick: (id: string) => void
}

export const RoleCard: React.FC<RoleCardProps> = ({ role, onClick }) => {
  const { t } = useLanguage()
  const priorityLabel = role.priority === 1 ? t.highestPriority : role.priority === 2 ? t.highPriority : role.priority === 3 ? t.mediumPriority : t.standardPriority

  return (
    <button
      className="role-card"
      onClick={() => onClick(role.id)}
      aria-label={`${role.name}, ${role.staffCount} ${t.staffCountLabel}`}
    >
      <span className="role-card-icon" aria-hidden="true">
        <Shield size={20} />
      </span>
      <span className="role-card-body">
        <span className="role-card-header">
          <span className="role-card-name">{role.name}</span>
          {role.isSystem && (
            <span className="role-badge-system">{t.systemBadge}</span>
          )}
          {role.isDefault && (
            <span className="role-badge-default">{t.defaultBadge}</span>
          )}
        </span>
        {role.description && (
          <p className="role-card-description">{role.description}</p>
        )}
        <span className="role-card-meta">
          {role.staffCount} {t.staffCountLabel} &middot; {t.priorityPrefix}: {priorityLabel}
        </span>
      </span>
      <ChevronRight className="role-card-chevron" size={16} aria-hidden="true" />
    </button>
  )
}
