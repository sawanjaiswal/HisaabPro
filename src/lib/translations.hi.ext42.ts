// ─── HisaabPro — Hindi Ext 42 (Epic D #128 — Commission) ─────────────────
// PR6 — Commission frontend (rules CRUD + ledger + leaderboard + staff widget).
// Mirror of translations.en.ext42.ts. All keys consumed via useLanguage().

export const hiExt42 = {
  // ── Settings hub row ────────────────────────────────────────────────────
  commissionSettingsTitle: 'कमीशन',
  commissionSettingsDescription:
    'हर बिक्री पर स्टाफ को कमीशन दें। नियम POS, इनवॉइस, या दोनों पर लागू होते हैं।',

  // ── Scope enum labels (used as commissionScope_${value}) ────────────────
  commissionScope_ALL: 'सभी बिक्री',
  commissionScope_PRODUCT: 'विशिष्ट उत्पाद',
  commissionScope_CATEGORY: 'विशिष्ट श्रेणी',

  // ── Mode enum labels (used as commissionMode_${value}) ──────────────────
  commissionMode_PERCENT_GROSS: 'सब-टोटल का %',
  commissionMode_PERCENT_NET: 'छूट के बाद सब-टोटल का %',
  commissionMode_FLAT_PER_UNIT: 'प्रति यूनिट तय राशि (रु)',

  // ── AppliesTo enum labels (used as commissionAppliesTo_${value}) ────────
  commissionAppliesTo_POS: 'केवल POS बिक्री',
  commissionAppliesTo_INVOICE: 'केवल इनवॉइस',
  commissionAppliesTo_BOTH: 'POS और इनवॉइस दोनों',

  // ── Rule form ───────────────────────────────────────────────────────────
  commissionRuleNameLabel: 'नियम का नाम',
  commissionRuleNamePlaceholder: 'जैसे: साड़ी पर सेल्सपर्सन 5%',
  commissionRuleNameInvalid: 'नाम 1 से 80 अक्षरों के बीच होना चाहिए',

  commissionRuleScopeLabel: 'किस पर लागू',
  commissionRuleProductIdLabel: 'उत्पाद ID',
  commissionRuleCategoryIdLabel: 'श्रेणी ID',
  commissionRuleScopeIdPlaceholder: 'उत्पाद या श्रेणी की ID पेस्ट करें',
  commissionRuleScopeMismatch: '"सभी बिक्री" वाले नियमों से scope ID हटाएँ',
  commissionRuleScopeRequired: 'इस scope के लिए उत्पाद या श्रेणी चुनें',

  commissionRuleModeLabel: 'गणना कैसे होगी',
  commissionRuleAppliesToLabel: 'कहाँ लागू होगा',

  commissionRateLabel: 'दर (%)',
  commissionRateHint: 'अधिकतम 100%। भारतीय रिटेल कमीशन आमतौर पर 1-10% होता है।',
  commissionRateInvalid: 'दर 0 से 100% के बीच होनी चाहिए',
  commissionRateWarnBanner:
    'दर बिक्री का {percent} या उससे अधिक है — स्टाफ को बड़ा हिस्सा मिलेगा।',
  commissionRateBlockBanner:
    'दर {percent} या अधिक नहीं हो सकती। सेव करने के लिए दर कम करें।',
  commissionRateExceedsToast:
    'सर्वर ने अस्वीकार किया: कमीशन दर 100% से अधिक नहीं हो सकती',

  commissionFlatLabel: 'प्रति यूनिट तय राशि (रु)',
  commissionFlatHint: 'प्रति यूनिट अधिकतम रु 10,000।',
  commissionFlatInvalid: 'तय राशि रु 1 और रु 10,000 प्रति यूनिट के बीच होनी चाहिए',

  commissionRuleStaffLabel: 'स्टाफ तक सीमित करें (वैकल्पिक)',
  commissionRuleStaffPlaceholder: 'staff-id-1, staff-id-2',
  commissionRuleStaffHint:
    'सभी स्टाफ पर लागू करने के लिए खाली छोड़ें। कॉमा-सेपरेटेड IDs।',

  commissionRuleActiveLabel: 'सक्रिय',

  commissionRuleCreateButton: 'नया नियम',
  commissionRuleUpdateButton: 'नियम सेव करें',
  commissionRuleSaveProgress: 'सेव हो रहा है…',
  commissionRuleCreatedToast: 'कमीशन नियम बनाया गया',
  commissionRuleUpdatedToast: 'कमीशन नियम अपडेट हुआ',
  commissionRuleQueuedToast: 'सेव हुआ — ऑनलाइन होने पर सिंक होगा',
  commissionRuleSaveFailed: 'कमीशन नियम सेव नहीं हो सका',
  commissionRuleDeletedToast: 'कमीशन नियम हटाया गया',
  commissionRuleDeleteFailed: 'कमीशन नियम हटाया नहीं जा सका',

  commissionRuleCreateDrawerTitle: 'नया कमीशन नियम',
  commissionRuleEditDrawerTitle: 'कमीशन नियम एडिट करें',

  // ── Rule list ───────────────────────────────────────────────────────────
  commissionRulesLoadFailed: 'कमीशन नियम लोड नहीं हो सके',
  commissionRulesEmptyTitle: 'अभी कोई कमीशन नियम नहीं',
  commissionRulesEmptyDesc:
    'हर बिक्री पर स्टाफ को रिवॉर्ड देना शुरू करने के लिए अपना पहला नियम बनाएँ।',
  commissionRuleInactive: 'निष्क्रिय',
  commissionRuleEdit: 'नियम एडिट करें',
  commissionRuleDelete: 'नियम हटाएँ',
  commissionRuleDeleteCancel: 'रद्द करें',
  commissionRuleDeleteConfirmTitle: 'कमीशन नियम हटाएँ?',
  commissionRuleDeleteConfirmDesc:
    'नियम "{name}" अब नई बिक्री पर लागू नहीं होगा। पिछले कमीशन सुरक्षित रहेंगे।',
  commissionRuleStaffCount: '{count} स्टाफ तक सीमित',
  commissionRuleListFlatPerUnit: 'प्रति यूनिट',

  // ── Ledger ──────────────────────────────────────────────────────────────
  commissionLedgerHeader: 'मेरा कमीशन',
  commissionLedgerHeaderOther: 'स्टाफ कमीशन',
  commissionLedgerPeriodLabel: 'अवधि',
  commissionLedgerLoadFailed: 'कमीशन लेजर लोड नहीं हो सका',
  commissionLedgerEmptyTitle: 'इस अवधि में कोई कमीशन नहीं',
  commissionLedgerEmptyDesc:
    '{period} में बिक्री ने अभी तक कोई कमीशन नहीं कमाया।',
  commissionLedgerLoadMore: 'और लोड करें',
  commissionLedgerSummaryMeta: '{count} बिक्री · {period}',
  commissionLedgerBasis: 'आधार',

  // ── Cross-tenant 404 ────────────────────────────────────────────────────
  commissionStaffNotFoundTitle: 'स्टाफ नहीं मिला',
  commissionStaffNotFoundDesc:
    'यह स्टाफ सदस्य आपके बिज़नेस का हिस्सा नहीं है।',
  commissionStaffNotFoundToast: 'इस बिज़नेस में स्टाफ नहीं मिला',

  // ── Leaderboard ─────────────────────────────────────────────────────────
  commissionLeaderboardHeader: 'लीडरबोर्ड',
  commissionLeaderboardPeriodLabel: 'अवधि',
  commissionLeaderboardLoadFailed: 'लीडरबोर्ड लोड नहीं हो सका',
  commissionLeaderboardEmptyTitle: 'इस अवधि में कोई कमीशन नहीं',
  commissionLeaderboardEmptyDesc:
    'बिक्री से कमीशन कमाने के बाद यहाँ स्टाफ रैंकिंग दिखाई देगी।',
  commissionLeaderboardSortLabel: 'सॉर्ट करें',
  commissionLeaderboardSortByAmount: 'कुल कमीशन',
  commissionLeaderboardSortByCount: 'बिक्री की संख्या',
  commissionLeaderboardSortByName: 'नाम',
  commissionLeaderboardRankHeader: '#',
  commissionLeaderboardStaffHeader: 'स्टाफ',
  commissionLeaderboardAmountHeader: 'कुल',
  commissionLeaderboardCountHeader: 'बिक्री',
  commissionLeaderboardUnknownStaff: 'अज्ञात',
  commissionLeaderboardForbiddenTitle: 'लीडरबोर्ड प्रतिबंधित है',
  commissionLeaderboardForbiddenDesc:
    'केवल "सभी कमीशन देखें" अनुमति वाले मालिक और एडमिन यह पेज देख सकते हैं।',

  // ── Dashboard staff widget ──────────────────────────────────────────────
  commissionWidgetTitle: 'मेरा कमीशन (इस माह)',
  commissionWidgetEmpty: 'इस महीने अभी कोई बिक्री नहीं',
  commissionWidgetSaleCount: 'इस महीने {count} बिक्री',

  dashboardStaffSectionHeading: 'आपका प्रदर्शन',
} as const
