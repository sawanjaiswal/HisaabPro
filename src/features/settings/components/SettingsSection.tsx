import React from 'react'
import type { SettingsSection as SettingsSectionType, SettingsItem, AppSettings } from '../settings.types'
import { SETTINGS_ICONS } from '../settings.icons'
import { SettingListRow, SettingListGroup } from '@/components/ui/SettingListRow'
import { Input } from '@/components/ui/Input'
import '../settings-toggle.css'

interface SettingsSectionProps {
  section: SettingsSectionType
  onItemClick: (item: SettingsItem) => void
  settings?: AppSettings
}

function getToggleValue(item: SettingsItem, settings?: AppSettings): boolean {
  if (!settings) return false
  if (item.id === 'pin') return settings.pinEnabled
  if (item.id === 'biometric') return settings.biometricEnabled
  if (item.id === 'operation-pin') return settings.operationPinSet
  if (item.id === 'theme') return settings.theme === 'dark'
  return typeof item.value === 'boolean' ? item.value : false
}

function getSelectValue(item: SettingsItem, settings?: AppSettings): string {
  if (!settings) return typeof item.value === 'string' ? item.value : ''
  if (item.id === 'date-format') return settings.dateFormat
  if (item.id === 'calculator-position') return settings.calculatorPosition
  if (item.id === 'language') return settings.language === 'hi' ? 'हिंदी' : 'English'
  return typeof item.value === 'string' ? item.value : ''
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ section, onItemClick, settings }) => (
  <SettingListGroup title={section.title}>
    {section.items.map((item) => {
      const Icon = SETTINGS_ICONS[item.icon]
      const icon = Icon ? <Icon size={18} strokeWidth={1.8} /> : null

      // Toggle rows hand the primitive a `control`, which makes it render a
      // <label> instead of a button — a focusable input must not nest inside
      // one (WCAG 4.1.2).
      const control =
        item.type === 'toggle' ? (
          <span className="settings-toggle">
            <Input
              type="checkbox"
              checked={getToggleValue(item, settings)}
              onChange={() => onItemClick(item)}
              aria-label={item.description ? `${item.label}: ${item.description}` : item.label}
            />
            <span className="settings-toggle-track" />
          </span>
        ) : undefined

      return (
        <SettingListRow
          key={item.id}
          icon={icon}
          label={item.label}
          description={item.description}
          value={item.type === 'select' ? getSelectValue(item, settings) : undefined}
          control={control}
          chevron={item.type === 'navigation'}
          onClick={() => onItemClick(item)}
        />
      )
    })}
  </SettingListGroup>
)
