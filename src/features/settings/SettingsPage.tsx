/** Settings — Hub page (lazy loaded)
 *
 * Renders all setting sections from SETTINGS_SECTIONS.
 * toggle items update via useAppSettings.updateSetting
 * navigation items navigate to their route
 * select items (date-format, calculator-position) cycle through options on tap
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ROUTES } from '@/config/routes.config'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/context/LanguageContext'
import { useAuth } from '@/context/AuthContext'
import { useVertical } from '@/hooks/useVertical'
import { useAppSettings } from './useAppSettings'
import { SettingsSection } from './components/SettingsSection'
import { SettingsSkeleton } from './components/SettingsSkeleton'
import { SETTINGS_SECTIONS, DATE_FORMATS } from './settings.constants'
import type { SettingsItem, AppSettings, DateFormat, CalculatorPosition } from './settings.types'
import './settings.css'
import './settings-toggle.css'
import { Button } from '@/components/ui/Button'

function getNextDateFormat(current: DateFormat): DateFormat {
  const idx = DATE_FORMATS.indexOf(current)
  return DATE_FORMATS[(idx + 1) % DATE_FORMATS.length]
}

function getNextCalculatorPosition(current: CalculatorPosition): CalculatorPosition {
  return current === 'BOTTOM_RIGHT' ? 'BOTTOM_LEFT' : 'BOTTOM_RIGHT'
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { settings, status, updateSetting, refresh } = useAppSettings()
  const { theme, toggleTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const { handleLogout } = useAuth()
  const vertical = useVertical()
  const [confirmLogout, setConfirmLogout] = useState(false)

  const hasStock = vertical.defaults?.stockTracking === true

  function onLogout() {
    setConfirmLogout(true)
  }

  function doLogout() {
    setConfirmLogout(false)
    handleLogout()
    navigate(ROUTES.LOGIN, { replace: true })
  }

  function handleItemClick(item: SettingsItem) {
    if (item.type === 'navigation' && item.route) {
      navigate(item.route)
      return
    }

    if (item.type === 'toggle') {
      if (item.id === 'theme') {
        toggleTheme()
        return
      }
      if (item.id === 'pin') {
        updateSetting('pinEnabled', !settings.pinEnabled)
      } else if (item.id === 'biometric') {
        updateSetting('biometricEnabled', !settings.biometricEnabled)
      } else if (item.id === 'operation-pin') {
        updateSetting('operationPinSet', !settings.operationPinSet)
      }
      return
    }

    if (item.type === 'select') {
      if (item.id === 'date-format') {
        const next = getNextDateFormat(settings.dateFormat)
        updateSetting('dateFormat', next)
      } else if (item.id === 'calculator-position') {
        const next = getNextCalculatorPosition(settings.calculatorPosition)
        updateSetting('calculatorPosition', next)
      } else if (item.id === 'language') {
        setLanguage(language === 'en' ? 'hi' : 'en')
      }
    }
  }

  return (
    <AppShell>
      <Header title={t.settings} backTo={ROUTES.DASHBOARD} />

      <HeroPage>
        {status === 'loading' && <SettingsSkeleton />}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadSettings}
            message={t.checkConnectionRetry2}
            onRetry={refresh}
          />
        )}

        {status === 'success' && (
          <div className="settings-page stagger-enter space-y-6">
            {SETTINGS_SECTIONS.map((section) => {
              const filteredItems = section.items.filter(
                (item) => !item.requiresStock || hasStock
              )
              if (filteredItems.length === 0) return null
              return (
                <SettingsSection
                  key={section.id}
                  section={{ ...section, items: filteredItems }}
                  onItemClick={handleItemClick}
                  settings={{ ...settings, theme, language }}
                />
              )
            })}

            <Button variant="none"
              type="button"
              onClick={onLogout}
              className="settings-logout-btn"
            >
              <LogOut size={18} aria-hidden="true" />
              <span>{t.logout}</span>
            </Button>
          </div>
        )}
      </HeroPage>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={doLogout}
        title={t.logout}
        description={t.signOutConfirm}
        confirmLabel={t.logout}
        isDanger
      />
    </AppShell>
  )
}

export type { AppSettings as SettingsPageAppSettings }
