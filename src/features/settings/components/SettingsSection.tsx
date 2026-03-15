import React from 'react'
import { ChevronRight } from 'lucide-react'
import type { SettingsSection as SettingsSectionType, SettingsItem, AppSettings } from '../settings.types'
import '../settings.css'

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
  return typeof item.value === 'boolean' ? item.value : false
}

function getSelectValue(item: SettingsItem, settings?: AppSettings): string {
  if (!settings) return typeof item.value === 'string' ? item.value : ''
  if (item.id === 'date-format') return settings.dateFormat
  if (item.id === 'calculator-position') return settings.calculatorPosition
  return typeof item.value === 'string' ? item.value : ''
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ section, onItemClick, settings }) => {
  return (
    <div className="settings-section">
      <p className="settings-section-title">{section.title}</p>
      <div className="settings-group">
        {section.items.map((item) => (
          <button
            key={item.id}
            className="settings-item"
            onClick={() => onItemClick(item)}
            aria-label={item.description ? `${item.label}: ${item.description}` : item.label}
          >
            <span className="settings-item-icon settings-item-icon--primary" aria-hidden="true">
            </span>
            <span className="settings-item-content">
              <span className="settings-item-label">{item.label}</span>
              {item.description && (
                <span className="settings-item-description">{item.description}</span>
              )}
            </span>
            <span className="settings-item-action">
              {item.type === 'toggle' && (
                <label className="settings-toggle" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={getToggleValue(item, settings)}
                    onChange={() => onItemClick(item)}
                    aria-label={item.label}
                  />
                  <span className="settings-toggle-track" />
                </label>
              )}
              {item.type === 'select' && (
                <span className="settings-item-value">{getSelectValue(item, settings)}</span>
              )}
              {item.type === 'navigation' && (
                <ChevronRight className="settings-item-chevron" aria-hidden="true" />
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
