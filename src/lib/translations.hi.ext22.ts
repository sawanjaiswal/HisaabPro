// ─── HisaabPro — Hindi Ext 22 (Notifications Engine — PR12+PR13) ─────────────

export const hiExt22 = {
  // ─── Bell ──────────────────────────────────────────────────────────────────
  notifBellTooltip:          'सूचनाएं',
  notifBellAriaEmpty:        'सूचनाएं',
  notifBellAriaUnread:       'सूचनाएं — %d अपठित',

  // ─── Inbox page ────────────────────────────────────────────────────────────
  notifPageTitle:            'सूचनाएं',
  notifUnreadCount:          '%d अपठित',
  notifAllRead:              'सब पढ़ लिया',
  notifMarkAllRead:          'सभी पढ़ा हुआ मार्क करें',
  notifMarkAllReadSuccess:   'सभी सूचनाएं पढ़ी हुई मार्क की गईं',
  notifMarkAllReadError:     'सभी को पढ़ा हुआ मार्क नहीं कर सके',
  notifLoadMore:             'और लोड करें',

  // ─── Empty state ───────────────────────────────────────────────────────────
  notifEmptyTitle:           'सब अपडेट हैं!',
  notifEmptyBody:            'अभी कोई सूचना नहीं है। कुछ होने पर हम बताएंगे।',

  // ─── Error state ───────────────────────────────────────────────────────────
  notifLoadError:            'सूचनाएं लोड नहीं हो सकीं। पुनः प्रयास करें।',

  // ─── Preferences page ─────────────────────────────────────────────────────
  notifPrefsTitle:           'सूचना प्राथमिकताएं',
  notifPrefsEventLabel:      'घटना',
  notifPrefsEmpty:           'कोई प्राथमिकता नहीं मिली।',
  notifPrefSaved:            'प्राथमिकताएं सहेजी गईं',
  notifPrefSaveError:        'प्राथमिकताएं सहेज नहीं सकें',

  // ─── Channel labels ────────────────────────────────────────────────────────
  notifChannelInApp:         'ऐप',
  notifChannelPush:          'पुश',
  notifChannelEmail:         'ईमेल',
  notifChannelWhatsApp:      'व्हाट्सएप',
  notifComingSoon:           'जल्द आएगा',

  // ─── Quiet hours ───────────────────────────────────────────────────────────
  notifQuietHoursTitle:      'शांत घंटे',
  notifQuietHoursToggle:     'शांत घंटे सक्षम करें',
  notifQuietHoursStart:      'शुरू (HH:MM)',
  notifQuietHoursEnd:        'समाप्त (HH:MM)',
  notifQuietHoursSave:       'शांत घंटे सहेजें',
  notifSettingsSaved:        'सेटिंग्स सहेजी गईं',
  notifSettingsSaveError:    'सेटिंग्स सहेज नहीं सकें',
  notifSaving:               'सहेज रहे हैं…',
} as const
