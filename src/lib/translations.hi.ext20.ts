// ─── HisaabPro — Hindi Ext 20 (Cash Register — PR 4) ────────────────────────

export const hiExt20 = {
  // ─── Page / tabs ─────────────────────────────────────────────────────────
  cashRegTitle:                 'नकद रजिस्टर',
  cashRegNavLabel:              'नकद',
  cashRegTabCalculator:         'कैलकुलेटर',
  cashRegTabHistory:            'इतिहास',

  // ─── Calculator panel ────────────────────────────────────────────────────
  cashRegPlaceholderEnterAmount: 'राशि दर्ज करें',
  cashRegButtonCashIn:          'नकद प्राप्त',
  cashRegButtonCashOut:         'नकद भुगतान',
  cashRegLabelNote:             'नोट जोड़ें (वैकल्पिक)',
  cashRegPlaceholderNote:       'जैसे डिलीवरी, किराया, विविध',

  // ─── Toasts ──────────────────────────────────────────────────────────────
  cashRegToastCashInSaved:      'नकद प्राप्त सहेजा गया',
  cashRegToastCashOutSaved:     'नकद भुगतान सहेजा गया',
  cashRegToastErrorSave:        'सहेजा नहीं जा सका। पुनः प्रयास करें।',
  cashRegToastEntryUpdated:     'प्रविष्टि अपडेट की गई',
  cashRegToastEntryVoided:      'प्रविष्टि रद्द की गई',
  cashRegToastEntryRestored:    'प्रविष्टि पुनः स्थापित की गई',
  cashRegToastEntryDeleted:     'प्रविष्टि हटाई गई',

  // ─── Edit drawer ─────────────────────────────────────────────────────────
  cashRegDrawerTitle:           'प्रविष्टि संपादित करें',
  cashRegDrawerSaveButton:      'परिवर्तन सहेजें',

  // ─── Void dialog ─────────────────────────────────────────────────────────
  cashRegVoidDialogTitle:       'इस प्रविष्टि को रद्द करें?',
  cashRegVoidDialogDescription: 'यह प्रविष्टि रद्द के रूप में चिह्नित होगी। आप इसे बाद में पुनर्स्थापित कर सकते हैं।',
  cashRegLabelVoidReason:       'कारण (वैकल्पिक)',
  cashRegVoidDialogButton:      'प्रविष्टि रद्द करें',

  // ─── Delete dialog ───────────────────────────────────────────────────────
  cashRegDeleteDialogTitle:     'स्थायी रूप से हटाएं?',
  cashRegDeleteDialogDescription: 'यह पूर्ववत नहीं किया जा सकता। केवल रद्द प्रविष्टियां हटाई जा सकती हैं।',
  cashRegDeleteDialogButton:    'हटाएं',

  // ─── Large amount dialog ─────────────────────────────────────────────────
  cashRegLargeAmountDescription: 'यह सामान्य से अधिक है। जारी रखने की पुष्टि करें।',

  // ─── History empty states ────────────────────────────────────────────────
  cashRegEmptyAllEntries:       'अभी तक कोई नकद प्रविष्टि नहीं',
  cashRegEmptyOnlyIn:           'कोई नकद प्राप्त प्रविष्टि नहीं',
  cashRegEmptyOnlyOut:          'कोई नकद भुगतान प्रविष्टि नहीं',

  // ─── Summary header ──────────────────────────────────────────────────────
  cashRegSummaryToday:          'आज',
  cashRegSummaryLast7Days:      'पिछले 7 दिन',
  cashRegSummaryLast30Days:     'पिछले 30 दिन',
  cashRegSummaryIn:             'प्राप्त',
  cashRegSummaryOut:            'भुगतान',
  cashRegSummaryNet:            'शुद्ध',

  // ─── Expression errors ───────────────────────────────────────────────────
  cashRegErrorInvalidExpression: 'अमान्य गणना',
  cashRegErrorDivideByZero:     'शून्य से भाग नहीं दे सकते',
  cashRegErrorAmountHigh:       'बड़ी राशि — कृपया पुष्टि करें',
  cashRegErrorNoInternet:       'इंटरनेट कनेक्शन नहीं। पुनः प्रयास करें।',
  cashRegErrorRestoreBeforeEdit: 'संपादित करने से पहले प्रविष्टि पुनर्स्थापित करें',
  cashRegErrorAlreadyVoided:    'प्रविष्टि पहले से रद्द है',
  cashRegErrorNotVoided:        'प्रविष्टि वर्तमान में रद्द नहीं है',

  // ─── Filters / sort ──────────────────────────────────────────────────────
  cashRegFilterAll:             'सभी',
  cashRegSortLabel:             'क्रमबद्ध',
  cashRegSortNewest:            'नवीनतम',
  cashRegSortOldest:            'पुराना',
  cashRegSortHighest:           'सर्वाधिक',
  cashRegSortLowest:            'न्यूनतम',

  // ─── Badges ──────────────────────────────────────────────────────────────
  cashRegBadgeVoided:           'रद्द',
  cashRegBadgeEdited:           'संपादित',

  // ─── History controls ────────────────────────────────────────────────────
  cashRegShowVoided:            'रद्द दिखाएं',
  cashRegHideVoided:            'रद्द छुपाएं',

  // ─── History error ───────────────────────────────────────────────────────
  cashRegHistoryError:          'इतिहास लोड नहीं हो सका।',
  cashRegHistoryRetry:          'पुनः प्रयास के लिए टैप करें',

  // ─── i18n wiring sweep (2026-07-24): keys the components still hardcoded ──
  cashRegToastErrorRestore:     'प्रविष्टि पुनर्स्थापित नहीं हो सकी।',
  cashRegToastErrorVoid:        'प्रविष्टि रद्द नहीं हो सकी।',
  cashRegToastErrorDelete:      'प्रविष्टि हटाई नहीं जा सकी।',
  cashRegTabsAria:              'कैश रजिस्टर टैब',
  cashRegCommitAria:            'नकद प्रविष्टि सहेजें',
  cashRegDisplayAria:           'कैलकुलेटर डिस्प्ले',
  cashRegKeypadAria:            'कैलकुलेटर कीपैड',
  cashRegFilterDirAria:         'दिशा के अनुसार फ़िल्टर करें',
  cashRegSortAria:              'प्रविष्टियां क्रमबद्ध करें',
  cashRegEntryActionsAria:      'प्रविष्टि क्रियाएं',
  cashRegLast7Aria:             'पिछले 7 दिनों का नकद प्रवाह',
  cashRegLoadingEntries:        'नकद प्रविष्टियां लोड हो रही हैं',
  cashRegLoadingMore:           'और प्रविष्टियां लोड हो रही हैं',
  cashRegSummaryLast30:         'पिछले 30 दिन',
  cashRegErrorTooLong:          'अभिव्यक्ति बहुत लंबी है',
  cashRegErrorInvalidChar:      'अमान्य वर्ण',
  cashRegErrorInvalidResult:    'राशि 0 से अधिक होनी चाहिए',
  cashRegErrorOverflow:         'राशि ₹10 करोड़ की सीमा से अधिक है',
  cashRegMenuVoid:              'रद्द करें',
  cashRegMenuRestore:           'पुनर्स्थापित करें',
  cashRegKeyClear:              'साफ़ करें',
  cashRegKeyBackspace:          'बैकस्पेस',
  cashRegKeyAdd:                'जोड़ें',
  cashRegKeySubtract:           'घटाएं',
  cashRegKeyMultiply:           'गुणा करें',
  cashRegKeyDivide:             'भाग करें',
  cashRegKeyDecimal:            'दशमलव बिंदु',
  cashRegCharsLeft:             'वर्ण शेष',
  cashRegVoiding:               'रद्द किया जा रहा है…',
  cashRegVoidReasonPlaceholder: 'जैसे गलती से दर्ज',
  cashRegLargeAmountPrefix:     'राशि है',
  cashRegConfirmQuestion:       'पुष्टि करें?',
}
