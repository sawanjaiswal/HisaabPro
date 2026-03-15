/** Dashboard — Custom header (Figma design)
 *
 * Profile avatar (left) + centered app name + bell icon (right).
 * Matches the Figma design: teal gradient avatar ring,
 * lime notification badge, white bell button.
 */

import React from 'react'
import { Bell } from 'lucide-react'
import { APP_NAME } from '@/config/app.config'

interface DashboardHeaderProps {
  /** User's name for initials (falls back to "U") */
  userName?: string | null
  onNotificationsClick?: () => void
}

function getInitials(name?: string | null): string {
  if (!name) return 'U'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userName,
  onNotificationsClick,
}) => {
  return (
    <header className="dashboard-header">
      {/* Profile avatar */}
      <div className="dashboard-header-avatar" aria-label="Profile">
        <div className="dashboard-header-avatar-inner">
          <span className="dashboard-header-avatar-text">
            {getInitials(userName)}
          </span>
        </div>
        <div className="dashboard-header-badge" aria-hidden="true" />
      </div>

      {/* Centered title */}
      <h1 className="dashboard-header-title">{APP_NAME}</h1>

      {/* Bell icon */}
      <button
        className="dashboard-header-bell"
        onClick={onNotificationsClick}
        aria-label="Notifications"
      >
        <Bell size={24} aria-hidden="true" />
      </button>
    </header>
  )
}
