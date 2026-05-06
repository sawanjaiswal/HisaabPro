// ─── HisaabPro — Hindi Ext 16 (BAT-07 inventory settings + i18n polish) ─────

export const hiExt16 = {
  // ── Inventory settings page ───────────────────────────────────────────────
  inventorySettings:           'इन्वेंटरी सेटिंग्स',
  inventorySettingsDesc:       'समाप्ति अलर्ट और बैच बिक्री नीति',
  expiryAlertDaysLabel:        'समाप्ति अलर्ट दिन',
  expiryAlertDaysDesc:         'बैच समाप्त होने से इतने दिन पहले अलर्ट दें (1–365)',
  expiryAlertDaysPlaceholder:  '30',
  expiredBatchPolicyLabel:     'समाप्त बैच नीति',
  expiredBatchPolicyDesc:      'समाप्त बैच बेचने पर क्या होगा',
  policyWarnOnly:              'केवल चेतावनी',
  policyWarnOnlyDesc:          'बिक्री हो जाएगी, साथ में चेतावनी आएगी। अलर्ट में समाप्त बैच देखें।',
  policyHardBlock:             'बिक्री रोकें',
  policyHardBlockDesc:         'बिक्री अस्वीकार होगी। स्टाफ को वैध बैच चुनना या नया स्टॉक जोड़ना होगा।',
  saveInventorySettings:       'सेटिंग्स सहेजें',
  inventorySettingsSaved:      'इन्वेंटरी सेटिंग्स सहेजी गईं',
  inventorySettingsSavedOffline: 'सहेजा — ऑनलाइन होने पर समन्वयित होगा',
  couldNotLoadInventorySettings: 'इन्वेंटरी सेटिंग्स लोड नहीं हो सकीं',

  // ── BatchPicker i18n polish ───────────────────────────────────────────────
  batchPickerRetry:            'पुनः प्रयास',
  batchPickerNoneAvailable:    'इस उत्पाद के लिए कोई बैच उपलब्ध नहीं है।',
  batchPickerAvail:            'उपलब्ध',
  batchPickerClose:            'बैच पिकर बंद करें',
  batchPickerExpiredInfo:      'समाप्त बैच आपकी नीति के अनुसार अवरुद्ध हैं।',

  // ── StockValueReport column headers ──────────────────────────────────────
  svrColumnBatch:              'बैच',
  svrColumnExpiry:             'समाप्ति',

  // ── StockAlertsPage expiry section skeleton ───────────────────────────────
  expiryAlertsSectionLoading:  'समाप्ति अलर्ट लोड हो रहे हैं…',
}
