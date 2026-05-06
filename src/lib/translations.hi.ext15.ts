// ─── HisaabPro — Hindi Ext 15 (BAT-05 batch picker + expiry UI) ──────────────

export const hiExt15 = {
  // ── Batch picker ──────────────────────────────────────────────────────────
  pickBatch:               'बैच चुनें',
  pickAnotherBatch:        'दूसरा बैच चुनें',
  noBatchSelected:         'कोई बैच नहीं चुना',
  selectBatch:             'बैच चुनें',
  batchAutoFefo:           'स्वतः चयनित (पहले समाप्त होने वाला)',
  batchNoExpiry:           '(कोई समाप्ति तिथि नहीं — मैन्युअल चुनें)',

  // ── Expiry status badges ──────────────────────────────────────────────────
  expired:                 'समाप्त',
  expiringSoon:            'जल्द समाप्त होगा',
  expiryNear:              'समाप्ति निकट',
  expiryPassed:            'समाप्त',

  // ── Inline 409 banner messages ────────────────────────────────────────────
  expiredBatchBlocked:     'समाप्त बैच — बेचना संभव नहीं',
  expiredBatchHint:        'इस बैच की समाप्ति तिथि बीत चुकी है। जारी रखने के लिए वैध बैच चुनें।',
  allBatchesExpired:       'सभी बैच समाप्त हो गए',
  allBatchesExpiredHint:   'इस उत्पाद के सभी बैच समाप्त हो चुके हैं। बिक्री से पहले नया स्टॉक जोड़ें।',
  insufficientBatchStock:  'बैच में पर्याप्त स्टॉक नहीं',
  insufficientBatchHint:   'चुने हुए बैच में पर्याप्त स्टॉक नहीं है। दूसरा बैच चुनें।',

  // ── Expiry alerts page ────────────────────────────────────────────────────
  expiryAlertsTitle:       'समाप्ति अलर्ट',
  expiryAlertsEmpty:       'कोई समाप्ति अलर्ट नहीं',
  expiryAlertsEmptyDesc:   'जल्द समाप्त होने वाले बैच यहाँ दिखेंगे',
  expiryNearAlert:         'जल्द समाप्त होगा',
  expiryPassedAlert:       'समाप्त',
  expiryDaysLeft:          '{n} दिन बाकी',
  expiryDaysAgo:           '{n} दिन पहले समाप्त',
  expiryToday:             'आज समाप्त होगा',
  expiryBatchLabel:        'बैच:',
  expiryDateLabel:         'समाप्ति तिथि:',
  expiryStockLabel:        'स्टॉक:',
  couldNotLoadExpiryAlerts: 'समाप्ति अलर्ट लोड नहीं हो सके',

  // ── WARN_ONLY toast ───────────────────────────────────────────────────────
  warnOnlyBatchToast:      'समाप्त बैच के साथ बिक्री दर्ज की — /alerts पर देखें',
}
