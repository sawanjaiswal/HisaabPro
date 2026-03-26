/** Dashboard — Custom header (Figma design)
 *
 * Profile photo (left) with "+" badge + truly centered app name +
 * theme toggle, calculator & bell icons (right).
 */

import React, { useState, useEffect } from 'react'
import { Bell, Calculator, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/hooks/useLanguage'
import { APP_NAME } from '@/config/app.config'
import { BusinessAvatar } from '@/features/business/BusinessAvatar'

interface DashboardHeaderProps {
  onNotificationsClick?: () => void
  onCalculatorClick?: () => void
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onNotificationsClick,
  onCalculatorClick,
}) => {
  const [isScrolled, setIsScrolled] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { t } = useLanguage()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 16)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className={`dashboard-header${isScrolled ? ' is-scrolled' : ''}`}>
      {/* Left: business avatar + theme toggle */}
      <div className="dashboard-header-side">
        <BusinessAvatar />
        <button
          className="dashboard-header-icon-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? t.switchToLight : t.switchToDark}
        >
          {theme === 'dark' ? (
            <Sun size={18} aria-hidden="true" />
          ) : (
            <Moon size={18} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Center: absolutely centered title */}
      <h1 className="dashboard-header-title">{APP_NAME}</h1>

      {/* Right: calculator + bell */}
      <div className="dashboard-header-side dashboard-header-side--right">
        <button
          className="dashboard-header-icon-btn"
          onClick={onCalculatorClick}
          aria-label={t.calculator}
        >
          <Calculator size={20} aria-hidden="true" />
        </button>
        <button
          className="dashboard-header-icon-btn"
          onClick={onNotificationsClick}
          aria-label={t.notifications}
        >
          <Bell size={20} aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
