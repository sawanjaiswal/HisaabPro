/** Dashboard — Custom header (Figma design)
 *
 * Profile photo (left) with "+" badge + truly centered app name +
 * calculator & bell icons (right).
 */

import React, { useState, useEffect } from 'react'
import { Bell, Calculator } from 'lucide-react'

interface DashboardHeaderProps {
  userName?: string | null
  profilePhoto?: string | null
  onNotificationsClick?: () => void
  onCalculatorClick?: () => void
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
  profilePhoto,
  onNotificationsClick,
  onCalculatorClick,
}) => {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 16)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className={`dashboard-header${isScrolled ? ' is-scrolled' : ''}`}>
      {/* Left: profile avatar with + badge */}
      <div className="dashboard-header-side">
        <div className="dashboard-header-avatar" aria-label="Profile">
          <div className="dashboard-header-avatar-inner">
            {profilePhoto ? (
              <img
                src={profilePhoto}
                alt={userName ?? 'Profile'}
                className="dashboard-header-avatar-img"
                width={40}
                height={40}
              />
            ) : (
              <span className="dashboard-header-avatar-text">
                {getInitials(userName)}
              </span>
            )}
          </div>
          <div className="dashboard-header-badge" aria-hidden="true">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M4 1v6M1 4h6" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Center: truly centered title */}
      <h1 className="dashboard-header-title">HisaabPro</h1>

      {/* Right: calculator + bell */}
      <div className="dashboard-header-side dashboard-header-side--right">
        <button
          className="dashboard-header-icon-btn"
          onClick={onCalculatorClick}
          aria-label="Calculator"
        >
          <Calculator size={20} aria-hidden="true" />
        </button>
        <button
          className="dashboard-header-icon-btn"
          onClick={onNotificationsClick}
          aria-label="Notifications"
        >
          <Bell size={20} aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
