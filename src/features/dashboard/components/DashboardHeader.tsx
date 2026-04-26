import React from 'react'
import { Bell, Calculator, Menu, Sun, Moon } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { SyncStatusBadge } from '@/components/feedback/SyncStatusBadge'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/hooks/useLanguage'
import { APP_NAME } from '@/config/app.config'
import './DashboardHeader.css'

interface DashboardHeaderProps {
  onNotificationsClick?: () => void
  onCalculatorClick?: () => void
  onMenuClick?: () => void
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onNotificationsClick,
  onCalculatorClick,
  onMenuClick,
}) => {
  const { theme, toggleTheme } = useTheme()
  const { t } = useLanguage()

  return (
    <Header
      scrollCondense
      leading={
        <div className="dashboard-header-brand">
          <img
            src="/favicon.svg"
            alt=""
            className="dashboard-header-logo"
            aria-hidden="true"
            width={28}
            height={28}
          />
          <div className="dashboard-header-brand-text">
            <span className="dashboard-header-appname">{APP_NAME}</span>
            <SyncStatusBadge />
          </div>
        </div>
      }
      actions={
        <>
          <button
            type="button"
            className="header-icon-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t.switchToLight : t.switchToDark}
          >
            {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
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
            onClick={onMenuClick}
            aria-label={t.openMenu}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
        </>
      }
    />
  )
}
