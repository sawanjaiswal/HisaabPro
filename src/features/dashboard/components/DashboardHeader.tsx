/** Dashboard header — composes the unified <Header /> with the dashboard's
 *  centered-title + multi-icon layout. No bespoke styles — just props. */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Calculator, Settings as SettingsIcon, Sun, Moon } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { BusinessAvatar } from '@/features/business/BusinessAvatar'

interface DashboardHeaderProps {
  onNotificationsClick?: () => void
  onCalculatorClick?: () => void
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onNotificationsClick,
  onCalculatorClick,
}) => {
  const { theme, toggleTheme } = useTheme()
  const { t } = useLanguage()
  const navigate = useNavigate()

  return (
    <Header
      centerTitle
      scrollCondense
      leading={
        <>
          <BusinessAvatar />
          <button
            type="button"
            className="header-icon-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t.switchToLight : t.switchToDark}
          >
            {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
        </>
      }
      actions={
        <>
          <button
            type="button"
            className="header-icon-btn"
            onClick={onCalculatorClick}
            aria-label={t.calculator}
          >
            <Calculator size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="header-icon-btn"
            onClick={onNotificationsClick}
            aria-label={t.notifications}
          >
            <Bell size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="header-icon-btn"
            onClick={() => navigate(ROUTES.SETTINGS)}
            aria-label={t.settings}
          >
            <SettingsIcon size={20} aria-hidden="true" />
          </button>
        </>
      }
    />
  )
}
