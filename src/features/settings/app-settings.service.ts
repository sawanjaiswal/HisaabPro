/** App Settings — API service layer
 *
 * All service functions accept an optional AbortSignal for cleanup in useEffect.
 * The `api()` helper already prepends API_URL, so paths begin with /.
 *
 * These are user-scoped settings (not business-scoped).
 * Each staff member has their own preferences.
 */

import { api } from '@/lib/api'
import type { AppSettings, AppSettingsResponse } from './settings.types'

// ─── App Settings ─────────────────────────────────────────────────────────────

/**
 * Fetch per-user app settings (date format, theme, language, calculator position, PIN status).
 * These are user-scoped — not business-scoped. Each staff member has their own preferences.
 */
export async function getAppSettings(
  userId: string,
  signal?: AbortSignal
): Promise<AppSettingsResponse> {
  return api<AppSettingsResponse>(
    `/users/${userId}/settings`,
    { signal }
  )
}

/**
 * Update per-user app settings.
 * Pass a partial object — only provided fields are updated.
 * Returns the full updated settings object.
 */
export async function updateAppSettings(
  userId: string,
  data: Partial<AppSettings>,
  signal?: AbortSignal
): Promise<AppSettingsResponse> {
  return api<AppSettingsResponse>(
    `/users/${userId}/settings`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
      signal,
      entityType: 'app-settings',
      entityLabel: 'App settings',
    }
  )
}
