// ─── HisaabPro — Hindi Ext 12 (Recurring Invoices — PR4 detail + runs) ──────

export const hiExt12 = {
  // ── List page ────────────────────────────────────────────────────────────
  recurringTitle:             'आवर्ती इनवॉइस',
  recurringEmpty:             'कोई आवर्ती शेड्यूल नहीं',
  recurringEmptyCta:          'आवर्ती शेड्यूल से अपनी बिलिंग स्वचालित करें',
  recurringFilterAll:         'सभी',
  recurringFilterActive:      'सक्रिय',
  recurringFilterPaused:      'रुका हुआ',
  recurringFilterCompleted:   'पूर्ण',

  // ── Status labels ─────────────────────────────────────────────────────────
  recurringStatusActive:      'सक्रिय',
  recurringStatusPaused:      'रुका हुआ',
  recurringStatusCompleted:   'पूर्ण',

  // ── Run status labels ─────────────────────────────────────────────────────
  recurringRunSuccess:        'सफल',
  recurringRunFailed:         'विफल',
  recurringRunSkipped:        'छोड़ा गया',
  recurringRunPartial:        'आंशिक',

  // ── Actions ───────────────────────────────────────────────────────────────
  recurringPause:             'रोकें',
  recurringPausing:           'रुक रहा है...',
  recurringPauseConfirm:      'रोकें',
  recurringPauseDesc:         'रोकने की अवधि में चलने वाले रन छोड़ दिए जाएंगे।',
  recurringResume:            'फिर शुरू करें',
  recurringResuming:          'शुरू हो रहा है...',
  recurringGenerateNow:       'अभी बनाएं',
  recurringGenerating:        'बन रहा है...',
  recurringGenerateConfirm:   'अभी इनवॉइस बनाएं',
  recurringNextAutoRun:       'अगला स्वचालित रन',
  recurringDelete:            'हटाएं',
  recurringDeleting:          'हटाया जा रहा है...',
  recurringDeleteConfirm:     'यह शेड्यूल हटाएं? इसे पूर्ववत नहीं किया जा सकता।',
  recurringEdit:              'संपादित करें',

  // ── Detail page ───────────────────────────────────────────────────────────
  recurringNextRun:           'अगला रन',
  recurringFrequency:         'आवृत्ति',
  recurringRunHistory:        'रन इतिहास',
  recurringNoRuns:            'अभी तक कोई रन नहीं। निर्धारित तारीख पर पहला इनवॉइस बनेगा।',

  // ── Offline guard ─────────────────────────────────────────────────────────
  recurringMustBeOnline:      'अभी बनाने के लिए इंटरनेट कनेक्शन आवश्यक है।',

  // ── Toast messages ────────────────────────────────────────────────────────
  recurringPaused:            'शेड्यूल रोका गया।',
  recurringResumed:           'शेड्यूल फिर शुरू हुआ।',
  recurringGenerated:         'इनवॉइस बना दिया गया।',
  recurringGeneratedOffline:  'कतार में — ऑनलाइन होने पर बनेगा।',
  recurringDeleted:           'शेड्यूल हटा दिया गया।',
  recurringCreated:           'शेड्यूल बना दिया गया।',

  // ── Form — PR5 ────────────────────────────────────────────────────────────
  recurringFormCreateTitle:         'नया शेड्यूल',
  recurringFormEditTitle:           'शेड्यूल संपादित करें',
  recurringFieldName:               'शेड्यूल का नाम',
  recurringFieldNamePlaceholder:    'जैसे: मासिक किराया इनवॉइस',
  recurringFieldParty:              'पार्टी',
  recurringFieldFrequency:          'आवृत्ति',
  recurringFieldInterval:           'हर बार दोहराएं',
  recurringFieldAnchorDay:          'महीने का दिन',
  recurringFieldAnchorDayWeekly:    'सप्ताह का दिन',
  recurringFieldAnchorDayMax:       'अधिकतम: 28वां',
  recurringFieldStartDate:          'शुरू तारीख',
  recurringFieldEndDate:            'अंत तारीख (वैकल्पिक)',
  recurringFieldAutoPaymentLink:    'स्वचालित भुगतान लिंक बनाएं',
  recurringFieldAutoReminder:       'स्वचालित रिमाइंडर भेजें',
  recurringFormSave:                'शेड्यूल सहेजें',
  recurringFormCancel:              'रद्द करें',
  recurringFormItemsTitle:          'इनवॉइस आइटम',
  recurringFormItemAdd:             'आइटम जोड़ें',
  recurringFormItemRemove:          'हटाएं',
  recurringFormValidationRequired:  'यह फ़ील्ड आवश्यक है।',
  recurringFormValidationEndDate:   'अंत तारीख शुरू तारीख के बाद होनी चाहिए।',
  recurringFromInvoiceCta:          'आवर्ती बनाएं',
  recurringTemplatePickerTitle:     'टेम्पलेट इनवॉइस चुनें',
  recurringTemplatePickerEmpty:     'अभी कोई सेव इनवॉइस नहीं। पहले एक SAVED इनवॉइस बनाएं।',
  recurringTemplatePickerSearch:    'इनवॉइस खोजें...',
  recurringTemplatePickerSelected:  'टेम्पलेट चुना गया',
  recurringFormSaving:              'सहेजा जा रहा है...',
  recurringFormOfflineToast:        'ऑफ़लाइन सहेजा — कनेक्ट होने पर बन जाएगा।',
  recurringFormSuccessCreate:       'शेड्यूल बना। पहला इनवॉइस ',
  recurringFormSuccessEdit:         'शेड्यूल अपडेट हो गया।',
  recurringAutoGenBadge:            'स्वतः बना',
  recurringFilterAutoGen:           'स्वतः बना',
} as const
