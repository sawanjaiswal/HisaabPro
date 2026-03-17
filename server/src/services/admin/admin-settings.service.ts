/**
 * Admin Settings Service
 * Platform configuration — maintenance mode, feature flags
 *
 * Settings are stored in-memory for now (no DB table needed for MVP).
 * A PlatformSetting model can be added in Phase 2 for persistence.
 */

import { validationError } from '../../lib/errors.js'
import logger from '../../lib/logger.js'

// --------------------------------------------------------------------------
// In-memory settings store (persists for process lifetime)
// --------------------------------------------------------------------------

const ALLOWED_KEYS = [
  'maintenance_mode',
  'registration_enabled',
  'max_businesses_per_user',
  'max_staff_per_business',
] as const

type SettingKey = (typeof ALLOWED_KEYS)[number]

type SettingsStore = Record<SettingKey, string>

const _settings: SettingsStore = {
  maintenance_mode: 'false',
  registration_enabled: 'true',
  max_businesses_per_user: '5',
  max_staff_per_business: '20',
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export function getAllSettings(): Record<string, string> {
  return { ..._settings }
}

export function getSetting(key: string): string | null {
  if (!ALLOWED_KEYS.includes(key as SettingKey)) return null
  return _settings[key as SettingKey]
}

export function updateSetting(key: string, value: string, adminEmail: string): { key: string; value: string } {
  if (!ALLOWED_KEYS.includes(key as SettingKey)) {
    throw validationError(`Unknown setting key: ${key}. Allowed: ${ALLOWED_KEYS.join(', ')}`)
  }

  const old = _settings[key as SettingKey]
  _settings[key as SettingKey] = value

  logger.info('Platform setting updated', { key, old, new: value, by: adminEmail })

  return { key, value }
}

export function isMaintenanceMode(): boolean {
  return _settings.maintenance_mode === 'true'
}
