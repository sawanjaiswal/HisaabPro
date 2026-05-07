/** Notifications — TypeScript contracts */

// ─── Domain ──────────────────────────────────────────────────────────────────

export interface Notification {
  id: string
  businessId: string
  userId: string
  eventKey: string
  titleEn: string
  titleHi: string
  bodyEn: string
  bodyHi: string
  isRead: boolean
  deepLinkUrl: string | null
  entityType: string | null
  entityId: string | null
  createdAt: string
}

export interface NotificationInboxPage {
  data: Notification[]
  nextCursor: string | null
  unreadCount: number
}

export interface UnreadCountResponse {
  unreadCount: number
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export type NotificationChannel = 'IN_APP' | 'PUSH' | 'EMAIL' | 'WHATSAPP'

export interface NotificationPreferenceRow {
  id: string
  userId: string
  businessId: string
  eventKey: string
  inApp: boolean
  push: boolean
  email: boolean
  whatsapp: boolean
  updatedAt: string
}

export type PreferencePatch = {
  eventKey: string
  inApp?: boolean
  push?: boolean
  email?: boolean
  whatsapp?: boolean
}

// ─── Settings (quiet hours) ───────────────────────────────────────────────────

export interface NotificationSettings {
  quietHoursEnabled: boolean
  quietHoursStart: string   // HH:MM
  quietHoursEnd: string     // HH:MM
}

export type SettingsPatch = Partial<NotificationSettings>

// ─── SSE event shape ─────────────────────────────────────────────────────────

export interface SseNotificationEvent {
  type: 'notification:new' | 'notification:read' | 'ping'
  unreadCount: number
}
