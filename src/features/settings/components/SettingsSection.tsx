import React from 'react'
import type { SettingsSection as SettingsSectionType, SettingsItem, AppSettings } from '../settings.types'
import { SETTINGS_ICONS } from '../settings.icons'
import { SettingListRow, SettingListGroup } from '@/components/ui/SettingListRow'
import { Switch } from '@/components/ui/Switch'

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

      const control =
        item.type === 'toggle' ? (
          <Switch
            checked={getToggleValue(item, settings)}
            onCheckedChange={() => onItemClick(item)}
            ariaLabel={item.description ? `${item.label}: ${item.description}` : item.label}
          />
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
