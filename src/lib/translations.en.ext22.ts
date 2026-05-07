// ─── HisaabPro — English Ext 22 (Notifications Engine — PR12+PR13) ───────────

export const enExt22 = {
  // ─── Bell ──────────────────────────────────────────────────────────────────
  notifBellTooltip:          'Notifications',
  notifBellAriaEmpty:        'Notifications',
  notifBellAriaUnread:       'Notifications — %d unread',

  // ─── Inbox page ────────────────────────────────────────────────────────────
  notifPageTitle:            'Notifications',
  notifUnreadCount:          '%d unread',
  notifAllRead:              'All caught up',
  notifMarkAllRead:          'Mark all read',
  notifMarkAllReadSuccess:   'All notifications marked as read',
  notifMarkAllReadError:     'Could not mark all as read',
  notifLoadMore:             'Load more',

  // ─── Empty state ───────────────────────────────────────────────────────────
  notifEmptyTitle:           "You're all caught up!",
  notifEmptyBody:            "No notifications yet. We'll let you know when something happens.",

  // ─── Error state ───────────────────────────────────────────────────────────
  notifLoadError:            'Could not load notifications. Tap to retry.',

  // ─── Preferences page ─────────────────────────────────────────────────────
  notifPrefsTitle:           'Notification Preferences',
  notifPrefsEventLabel:      'Event',
  notifPrefsEmpty:           'No preferences found.',
  notifPrefSaved:            'Preferences saved',
  notifPrefSaveError:        'Could not save preferences',

  // ─── Channel labels ────────────────────────────────────────────────────────
  notifChannelInApp:         'In-app',
  notifChannelPush:          'Push',
  notifChannelEmail:         'Email',
  notifChannelWhatsApp:      'WhatsApp',
  notifComingSoon:           'Coming soon',

  // ─── Quiet hours ───────────────────────────────────────────────────────────
  notifQuietHoursTitle:      'Quiet Hours',
  notifQuietHoursToggle:     'Enable quiet hours',
  notifQuietHoursStart:      'Start (HH:MM)',
  notifQuietHoursEnd:        'End (HH:MM)',
  notifQuietHoursSave:       'Save Quiet Hours',
  notifSettingsSaved:        'Notification settings saved',
  notifSettingsSaveError:    'Could not save settings',
  notifSaving:               'Saving…',
} as const
