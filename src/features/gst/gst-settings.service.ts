/**
 * GST Settings — API service layer
 *
 * Route: GET/PATCH /api/gst/settings
 * All calls go through api() — never raw fetch.
 * Mutations pass entityType + entityLabel for queue UI.
 */

import { api } from '@/lib/api'
import type { GstSettings, PatchGstSettingsInput } from './gst.types'

export async function getGstSettings(): Promise<GstSettings> {
  return api<GstSettings>('/gst/settings', { cacheReads: true })
}

export async function updateGstSettings(patch: PatchGstSettingsInput): Promise<GstSettings> {
  return api<GstSettings>('/gst/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
    headers: { 'Content-Type': 'application/json' },
    entityType: 'gst-settings',
    entityLabel: 'GST settings',
  })
}
