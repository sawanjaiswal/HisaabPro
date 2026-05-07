/** useNotifications — TanStack Query hooks for the notifications feature */

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import {
  getInbox,
  markRead,
  markAllRead,
  getUnreadCount,
  getPreferences,
  updatePreferences,
  getSettings,
  updateSettings,
} from './notifications.service'
import type { NotificationInboxPage, PreferencePatch, SettingsPatch } from './notifications.types'

// ─── Query keys ───────────────────────────────────────────────────────────────

export const notifKeys = {
  all:         () => ['notifications'] as const,
  inbox:       () => ['notifications', 'inbox'] as const,
  unreadCount: () => ['notifications', 'unread-count'] as const,
  preferences: () => ['notifications', 'preferences'] as const,
  settings:    () => ['notifications', 'settings'] as const,
}

// ─── Inbox (infinite) ─────────────────────────────────────────────────────────

export function useNotificationInbox() {
  return useInfiniteQuery<NotificationInboxPage, Error>({
    queryKey: notifKeys.inbox(),
    queryFn: ({ pageParam, signal }) =>
      getInbox(pageParam as string | null | undefined, 20, signal),
    initialPageParam: null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

// ─── Unread count ─────────────────────────────────────────────────────────────

export function useUnreadCount() {
  return useQuery({
    queryKey: notifKeys.unreadCount(),
    queryFn: ({ signal }) => getUnreadCount(signal),
    staleTime: 30_000,
  })
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export function useNotificationPreferences() {
  const { t } = useLanguage()
  const toast = useToast()
  return useQuery({
    queryKey: notifKeys.preferences(),
    queryFn: ({ signal }) => getPreferences(signal),
    meta: {
      onError: () => toast.error(t.notifLoadError ?? 'Could not load preferences'),
    },
  })
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function useNotificationSettings() {
  return useQuery({
    queryKey: notifKeys.settings(),
    queryFn: ({ signal }) => getSettings(signal),
  })
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, titleEn }: { id: string; titleEn: string }) =>
      markRead(id, titleEn),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifKeys.inbox() })
      qc.invalidateQueries({ queryKey: notifKeys.unreadCount() })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  const { t } = useLanguage()
  const toast = useToast()
  return useMutation({
    mutationFn: () => markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifKeys.inbox() })
      qc.invalidateQueries({ queryKey: notifKeys.unreadCount() })
      toast.success(t.notifMarkAllReadSuccess ?? 'All notifications marked as read')
    },
    onError: () => {
      toast.error(t.notifMarkAllReadError ?? 'Could not mark all as read')
    },
  })
}

export function useUpdatePreferences() {
  const qc = useQueryClient()
  const { t } = useLanguage()
  const toast = useToast()
  return useMutation({
    mutationFn: (patch: PreferencePatch) => updatePreferences(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifKeys.preferences() })
      toast.success(t.notifPrefSaved ?? 'Preferences saved')
    },
    onError: () => {
      toast.error(t.notifPrefSaveError ?? 'Could not save preferences')
    },
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  const { t } = useLanguage()
  const toast = useToast()
  return useMutation({
    mutationFn: (patch: SettingsPatch) => updateSettings(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifKeys.settings() })
      toast.success(t.notifSettingsSaved ?? 'Settings saved')
    },
    onError: () => {
      toast.error(t.notifSettingsSaveError ?? 'Could not save settings')
    },
  })
}
