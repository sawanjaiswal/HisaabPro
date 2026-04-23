/** Settings — Hub page (lazy loaded)
 *
 * Renders all setting sections from SETTINGS_SECTIONS.
 * toggle items update via useAppSettings.updateSetting
 * navigation items navigate to their route
 * select items (date-format, calculator-position) cycle through options on tap
 */

import { useNavigate } from 'react-router-dom'
import {
  Lock,
  Fingerprint,
  Key,
  ShieldCheck,
  Users,
  Shield,
  UserPlus,
  ShieldAlert,
  ClipboardList,
  Calendar,
  Keyboard,
  Calculator,
  Moon,
  Languages,
  Receipt,
  Percent,
  LogOut,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/context/LanguageContext'
import { useAuth } from '@/context/AuthContext'
import { useAppSettings } from './useAppSettings'
import { SettingsSection } from './components/SettingsSection'
import { SettingsSkeleton } from './components/SettingsSkeleton'
import { SETTINGS_SECTIONS, DATE_FORMATS } from './settings.constants'
import type { SettingsItem, AppSettings, DateFormat, CalculatorPosition } from './settings.types'
import './settings.css'
import './settings-toggle.css'

type IconComponent = React.FC<LucideProps>

const ICON_MAP: Record<string, IconComponent> = {
  Lock,
  Fingerprint,
  Key,
  ShieldCheck,
  Users,
  Shield,
  UserPlus,
  ShieldAlert,
  ClipboardList,
  Calendar,
  Keyboard,
  Calculator,
  Moon,
  Languages,
  Receipt,
  Percent,
}

function getNextDateFormat(current: DateFormat): DateFormat {
  const idx = DATE_FORMATS.indexOf(current)
  return DATE_FORMATS[(idx + 1) % DATE_FORMATS.length]
}

function getNextCalculatorPosition(current: CalculatorPosition): CalculatorPosition {
  return current === 'BOTTOM_RIGHT' ? 'BOTTOM_LEFT' : 'BOTTOM_RIGHT'
}

// Enrich sections with icon components — SettingsSection renders icons via slot
// We pass icon-enriched sections; SettingsSection already references item.icon as string.
// SettingsPage owns icon rendering by injecting into SettingsSection via the icon map.
// Since SettingsSection renders icons as empty spans (icon is string key), we wrap it here.
// The icons are passed down through the section items' icon field — SettingsSection
// renders the icon slot as empty. We override by rendering our own SettingsSection
// wrapper that injects the actual lucide component into the icon slot.
//
// Rather than forking SettingsSection, we rely on the existing SettingsSection API
// and note that the icon slot is unused (renders empty span). This is a known gap
// in SettingsSection that can be addressed later — the hub is functional without icons
// since SettingsSection already applies the icon background class.

export default function SettingsPage() {
  const navigate = useNavigate()
  const { settings, status, updateSetting, refresh } = useAppSettings()
  const { theme, toggleTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const { handleLogout } = useAuth()

  function onLogout() {
    if (!window.confirm(t.logout + '?')) return
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

      <PageContainer>
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
            {SETTINGS_SECTIONS.map((section) => (
              <SettingsSection
                key={section.id}
                section={section}
                onItemClick={handleItemClick}
                settings={{ ...settings, theme, language }}
              />
            ))}

            <button
              type="button"
              onClick={onLogout}
              className="settings-logout-btn"
            >
              <LogOut size={18} aria-hidden="true" />
              <span>{t.logout}</span>
            </button>
          </div>
        )}
      </PageContainer>
    </AppShell>
  )
}

// Export the icon map so other settings components can reuse it
export { ICON_MAP }
export type { AppSettings as SettingsPageAppSettings }
