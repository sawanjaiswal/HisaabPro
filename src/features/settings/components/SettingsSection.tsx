import React from 'react'
import {
  ChevronRight,
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
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import type { SettingsSection as SettingsSectionType, SettingsItem, AppSettings } from '../settings.types'
import '../settings.css'
import '../settings-toggle.css'

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
}

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

export const SettingsSection: React.FC<SettingsSectionProps> = ({ section, onItemClick, settings }) => {
  return (
    <div className="settings-section">
      <p className="settings-section-title">{section.title}</p>
      <div className="settings-group">
        {section.items.map((item) => {
          const iconEl = (
            <span className="settings-item-icon settings-item-icon--primary" aria-hidden="true">
              {ICON_MAP[item.icon] && React.createElement(ICON_MAP[item.icon], { size: 18, strokeWidth: 1.8 })}
            </span>
          )
          const contentEl = (
            <span className="settings-item-content">
              <span className="settings-item-label">{item.label}</span>
              {item.description && (
                <span className="settings-item-description">{item.description}</span>
              )}
            </span>
          )

          // Toggle rows render as a <label> wrapping the input — avoids nesting
          // a focusable control inside a <button> (WCAG 4.1.2).
          if (item.type === 'toggle') {
            return (
              <label key={item.id} className="settings-item settings-item--toggle">
                {iconEl}
                {contentEl}
                <span className="settings-item-action">
                  <span className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={getToggleValue(item, settings)}
                      onChange={() => onItemClick(item)}
                      aria-label={item.description ? `${item.label}: ${item.description}` : item.label}
                    />
                    <span className="settings-toggle-track" />
                  </span>
                </span>
              </label>
            )
          }

          return (
            <button
              key={item.id}
              className="settings-item"
              onClick={() => onItemClick(item)}
              aria-label={item.description ? `${item.label}: ${item.description}` : item.label}
            >
              {iconEl}
              {contentEl}
              <span className="settings-item-action">
                {item.type === 'select' && (
                  <span className="settings-item-value">{getSelectValue(item, settings)}</span>
                )}
                {item.type === 'navigation' && (
                  <ChevronRight className="settings-item-chevron" aria-hidden="true" />
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
