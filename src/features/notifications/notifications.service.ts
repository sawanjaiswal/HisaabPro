/** Notifications — API service layer */

import { api } from '@/lib/api'
import type {
  Notification,
  NotificationInboxPage,
  UnreadCountResponse,
  NotificationPreferenceRow,
  PreferencePatch,
  NotificationSettings,
  SettingsPatch,
} from './notifications.types'

const BASE = '/notifications'

// ─── Inbox ───────────────────────────────────────────────────────────────────

export async function getInbox(
  cursor?: string | null,
  limit = 20,
  signal?: AbortSignal,
): Promise<NotificationInboxPage> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor) params.set('cursor', cursor)
  return api<NotificationInboxPage>(`${BASE}?${params}`, {
    signal,
    cacheReads: true,
  })
}

// ─── Mark read ────────────────────────────────────────────────────────────────

export async function markRead(
  id: string,
  titleEn: string,
  signal?: AbortSignal,
): Promise<void> {
  return api<void>(`${BASE}/${id}/read`, {
    method: 'POST',
    signal,
    entityType: 'notification',
    entityLabel: titleEn,
  })
}

export async function markAllRead(signal?: AbortSignal): Promise<void> {
  return api<void>(`${BASE}/read-all`, {
    method: 'POST',
    signal,
    entityType: 'notification',
    entityLabel: 'Mark all notifications read',
  })
}

// ─── Unread count ─────────────────────────────────────────────────────────────

export async function getUnreadCount(
  signal?: AbortSignal,
): Promise<UnreadCountResponse> {
  return api<UnreadCountResponse>(`${BASE}/unread-count`, {
    signal,
    cacheReads: true,
  })
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export async function getPreferences(
  signal?: AbortSignal,
): Promise<NotificationPreferenceRow[]> {
  return api<NotificationPreferenceRow[]>(`${BASE}/preferences`, {
    signal,
    cacheReads: true,
  })
}

export async function updatePreferences(
  patch: PreferencePatch,
  signal?: AbortSignal,
): Promise<NotificationPreferenceRow> {
  return api<NotificationPreferenceRow>(`${BASE}/preferences`, {
    method: 'PUT',
    body: JSON.stringify(patch),
    signal,
    entityType: 'notification',
    entityLabel: `Update ${patch.eventKey} preferences`,
  })
}

// ─── Settings (quiet hours) ───────────────────────────────────────────────────

export async function getSettings(
  signal?: AbortSignal,
): Promise<NotificationSettings> {
  return api<NotificationSettings>(`${BASE}/settings`, {
    signal,
    cacheReads: true,
  })
}

export async function updateSettings(
  patch: SettingsPatch,
  signal?: AbortSignal,
): Promise<NotificationSettings> {
  return api<NotificationSettings>(`${BASE}/settings`, {
    method: 'PUT',
    body: JSON.stringify(patch),
    signal,
    entityType: 'notification',
    entityLabel: 'Update notification settings',
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Return the SSE stream URL (not called via api() — EventSource handles auth cookies) */
export function getStreamUrl(): string {
  const base = import.meta.env.VITE_API_URL ?? ''
  return `${base}/api/notifications/stream`
}

/** Pick localised title/body from a notification row */
export function localiseNotification(
  n: Notification,
  lang: 'en' | 'hi',
): { title: string; body: string } {
  return {
    title: lang === 'hi' && n.titleHi ? n.titleHi : n.titleEn,
    body:  lang === 'hi' && n.bodyHi  ? n.bodyHi  : n.bodyEn,
  }
}
