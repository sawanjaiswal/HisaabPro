/**
 * GST Settings — API service layer
 *
 * Route: GET/PATCH /api/gst/settings
 * All calls go through api() — never raw fetch.
 * Mutations pass entityType + entityLabel for queue UI.
 */

import { api } from '@/lib/api'
import type { GstSettings, PatchGstSettingsInput } from './gst.types'

/**
 * The route answers `{ settings: {...} }` inside the envelope, so the unwrapped
 * body is one level above the settings themselves. Declaring that body AS
 * `GstSettings` type-checked fine and handed every caller an object whose
 * `gstEnabled` was `undefined` — GST read as off across the whole app. The
 * service is where the wire shape becomes the app's type; it unwraps here.
 */
export async function getGstSettings(): Promise<GstSettings> {
  const body = await api<{ settings: GstSettings }>('/gst/settings', { cacheReads: true })
  return body.settings
}

export async function updateGstSettings(patch: PatchGstSettingsInput): Promise<GstSettings> {
  // `?? {}` covers the offline queue's optimistic empty return — callers already
  // check for a real field before trusting the result.
  const body = await api<{ settings?: GstSettings }>('/gst/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
    headers: { 'Content-Type': 'application/json' },
    entityType: 'gst-settings',
    entityLabel: 'GST settings',
  })
  return body?.settings ?? ({} as GstSettings)
}
