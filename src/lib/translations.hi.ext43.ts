// ─── HisaabPro — Hindi Ext 43 (Phase 7 #149 — Data Import 7.1A) ────────────
// FE.1 — Upload page (format picker + dropzone). Mirror of enExt43.

export const hiExt43 = {
  // ── Page header / intro ────────────────────────────────────────────────
  importPageTitle: 'डेटा इम्पोर्ट करें',
  importParties: 'पार्टियाँ इम्पोर्ट करें',
  importIntro:
    'Tally, Vyapar, Busy, या किसी भी CSV से अपनी पार्टियाँ लाएँ — सेव करने से पहले प्रीव्यू देखें।',

  // ── Steps ──────────────────────────────────────────────────────────────
  importStepFormat: '1. सोर्स चुनें',
  importStepFile: '2. फ़ाइल चुनें',

  // ── Format options ─────────────────────────────────────────────────────
  importPickFormatLabel: 'सोर्स फ़ॉर्मेट',
  importFormatTallyXmlLabel: 'Tally',
  importFormatTallyXmlDesc: 'Tally XML एक्सपोर्ट',
  importFormatVyaparCsvLabel: 'Vyapar',
  importFormatVyaparCsvDesc: 'Vyapar CSV एक्सपोर्ट',
  importFormatBusyXlsLabel: 'Busy',
  importFormatBusyXlsDesc: 'Busy Excel एक्सपोर्ट',
  importFormatGenericCsvLabel: 'CSV',
  importFormatGenericCsvDesc: 'कोई भी CSV (कॉलम मैप करें)',

  // ── Dropzone ───────────────────────────────────────────────────────────
  importDropzoneAriaLabel: 'इम्पोर्ट के लिए फ़ाइल चुनें',
  importDropzoneTitle: 'फ़ाइल यहाँ छोड़ें या ब्राउज़ करें',
  importDropzoneHint: 'XML, CSV, या XLSX — 10 MB तक',
  importRemoveFile: 'हटाएँ',

  // ── Submit + state ─────────────────────────────────────────────────────
  importSubmit: 'अपलोड करें और प्रीव्यू देखें',
  importUploading: 'अपलोड हो रहा है...',
  importUploadSuccess: 'अपलोड हो गया — प्रीव्यू तैयार हो रहा है।',
  importUploadFailed: 'अपलोड नहीं हो सका। फिर से कोशिश करें।',

  // ── Validation codes ───────────────────────────────────────────────────
  importValidation_NO_FORMAT: 'पहले सोर्स फ़ॉर्मेट चुनें।',
  importValidation_NO_FILE: 'अपलोड करने के लिए फ़ाइल चुनें।',
  importValidation_FILE_TOO_LARGE: 'फ़ाइल 10 MB से बड़ी है। इसे बाँटकर फिर से कोशिश करें।',
  importValidation_EXTENSION_MISMATCH: 'यह फ़ाइल टाइप चुने हुए सोर्स से मेल नहीं खाता।',
  importValidationGeneric: 'कृपया सही फ़ाइल चुनें।',

  // ── Disabled-feature stub ──────────────────────────────────────────────
  importFeatureDisabled: 'इस बिज़नेस के लिए डेटा इम्पोर्ट अभी उपलब्ध नहीं है।',

  // ── Job-detail stub (legacy) ───────────────────────────────────────────
  importJobStubTitle: 'इम्पोर्ट जॉब बन गई',
  importJobStubBody: 'प्रीव्यू पेज जल्द आ रहा है। Job ID:',

  // ── FE.2 — Job page header + state branches ────────────────────────────
  importJobHeader: 'इम्पोर्ट चल रहा है',
  importJobMissingIdTitle: 'इम्पोर्ट नहीं मिला',
  importJobMissingIdBody: 'URL में जॉब आईडी नहीं है।',
  importJobLoadErrorTitle: 'इम्पोर्ट लोड नहीं हो सका',
  importJobLoadErrorBody: 'कृपया फिर से कोशिश करें।',
  importJobRetry: 'फिर कोशिश करें',

  importFormat_TALLY_XML_short: 'Tally XML',
  importFormat_VYAPAR_CSV_short: 'Vyapar CSV',
  importFormat_BUSY_XLSX_short: 'Busy Excel',
  importFormat_GENERIC_CSV_short: 'CSV',

  // ── FE.2 — Parsing state ───────────────────────────────────────────────
  importParseProgressTitle: 'आपकी फ़ाइल पढ़ी जा रही है…',
  importParseProgressBody:
    'इसमें कुछ ही सेकंड लगते हैं। इस स्क्रीन पर बने रहें — प्रीव्यू तैयार होते ही दिख जाएगा।',
  importParseProgressUnknownFile: 'अपलोड की गई फ़ाइल',

  // ── FE.2 — Failed state ────────────────────────────────────────────────
  importParseFailedTitle: 'इस फ़ाइल को पढ़ा नहीं जा सका',
  importParseFailedBody:
    'फ़ाइल का फ़ॉर्मेट चुने हुए सोर्स से अलग हो सकता है, या फ़ाइल खराब हो सकती है। इसे रद्द करें और नई एक्सपोर्ट से दोबारा कोशिश करें।',
  importParseFailedErrorCount: 'गलती वाली पंक्तियाँ:',
  importParseFailedCancelAction: 'रद्द करें और फिर से करें',
  importParseFailedCancelled: 'इम्पोर्ट रद्द कर दिया गया। आप फिर से कोशिश कर सकते हैं।',
  importParseFailedCancelError: 'रद्द नहीं हो सका — कृपया फिर से कोशिश करें।',

  // ── FE.3 / FE.4 / FE.5 stubs ──────────────────────────────────────────
  importJobPreviewStubTitle: 'प्रीव्यू तैयार है',
  importJobPreviewStubBody: 'डुप्लीकेट रिव्यू स्क्रीन जल्द आ रही है।',
  importJobCommittingStubTitle: 'इम्पोर्ट कमिट हो रहा है…',
  importJobCommittingStubBody: 'पंक्तियाँ आपके बिज़नेस में सेव हो रही हैं।',
  importJobCommittedStubTitle: 'इम्पोर्ट कमिट हो गया',
  importJobCommittedStubBody: 'विस्तृत रिज़ल्ट स्क्रीन जल्द आ रही है।',
  importJobCancelledStubTitle: 'इम्पोर्ट रद्द कर दिया गया',
  importJobCancelledStubBody: 'कोई पंक्ति सेव नहीं हुई।',
  importJobUnknownTitle: 'अज्ञात इम्पोर्ट स्थिति',

  // ── Entry point from Parties page ──────────────────────────────────────
  importEntryFromParties: 'इम्पोर्ट',

  // ── FE.3 — Preview summary ─────────────────────────────────────────────
  importPreviewSummaryTitle: 'प्रीव्यू सारांश',
  importPreviewSummaryBody: 'अभी कुछ भी सेव नहीं हुआ है। कमिट से पहले हर पंक्ति देखें।',
  importPreviewSummaryTotal: 'कुल पंक्तियाँ',
  importPreviewSummaryValid: 'सही',
  importPreviewSummaryErrors: 'गलतियाँ',
  importPreviewSummaryDuplicates: 'डुप्लीकेट',

  // ── FE.3 — Filter chips ────────────────────────────────────────────────
  importPreviewFiltersAriaLabel: 'प्रीव्यू पंक्तियाँ फ़िल्टर करें',
  importPreviewFilterAll: 'सभी',
  importPreviewFilterValid: 'सही',
  importPreviewFilterErrors: 'गलतियाँ',
  importPreviewFilterDuplicates: 'डुप्लीकेट',

  // ── FE.3 — Table columns ───────────────────────────────────────────────
  importPreviewColRow: 'पंक्ति',
  importPreviewColName: 'नाम',
  importPreviewColPhone: 'फ़ोन',
  importPreviewColBalance: 'बैलेंस',
  importPreviewColStatus: 'स्थिति',
  importPreviewColReason: 'कारण',
  importPreviewMissingName: '—',
  importPreviewMissingPhone: '—',

  // ── FE.3 — Row status badges ──────────────────────────────────────────
  importPreviewStatus_STAGED: 'सही',
  importPreviewStatus_WARNING: 'चेतावनी',
  importPreviewStatus_ERROR: 'गलती',
  importPreviewStatus_DUPLICATE_EXACT: 'डुप्लीकेट',
  importPreviewStatus_DUPLICATE_NEAR: 'मिलता-जुलता',
  importPreviewStatus_COMMITTED: 'कमिट हो गया',
  importPreviewStatus_SKIPPED: 'छोड़ दिया',

  // ── FE.3 — Pagination + actions ───────────────────────────────────────
  importPreviewLoadMore: 'और पंक्तियाँ लोड करें',
  importPreviewEmptyTitle: 'इस फ़िल्टर में कोई पंक्ति नहीं',
  importPreviewEmptyBody: 'दूसरा फ़िल्टर आज़माएँ, या सर्वर से और पंक्तियाँ लोड करें।',
  importPreviewCancel: 'इम्पोर्ट रद्द करें',
  importPreviewCancelled: 'इम्पोर्ट रद्द कर दिया गया। कुछ भी सेव नहीं हुआ।',
  importPreviewCancelError: 'रद्द नहीं हो सका — कृपया फिर से कोशिश करें।',
  importPreviewContinueDedup: 'डुप्लीकेट रिव्यू पर जाएँ',
  importPreviewContinueCommit: 'कमिट पर जाएँ',
  importPreviewContinueComingSoon: 'अगला स्टेप FE.4 में आ रहा है।',

  // ── FE.4 — Dedup resolution ───────────────────────────────────────────
  importDedupTitle: 'डुप्लीकेट की समीक्षा करें',
  importDedupIntro:
    'ये पंक्तियाँ शायद उन पार्टियों से मेल खाती हैं जो पहले से मौजूद हैं। कमिट करने से पहले हर पंक्ति के लिए कार्रवाई चुनें।',
  importDedupBulkAriaLabel: 'सभी डुप्लीकेट पर लागू करें',
  importDedupBulkSkipAll: 'सभी छोड़ें',
  importDedupBulkOverwriteAll: 'सभी को ओवरराइट करें',
  importDedupBulkCreateAll: 'सभी को नई पार्टी बनाएँ',
  importDedupCountsLine: '{skip} छोड़ें · {overwrite} ओवरराइट · {createNew} नई बनाएँ',
  importDedupMatchExact: 'पूरा मेल',
  importDedupMatchNear: 'मिलता-जुलता',
  importDedupIncoming: 'नई पंक्ति',
  importDedupExisting: 'मौजूदा पार्टी',
  importDedupExistingFallback: 'मौजूदा पार्टी',
  importDedupExistingPhoneUnknown: '—',
  importDedupChooseAriaLabel: 'इस पंक्ति के लिए कार्रवाई चुनें',
  importDedupDecision_SKIP: 'छोड़ें — मौजूदा पार्टी बनी रहे',
  importDedupDecision_OVERWRITE: 'इस पंक्ति से मौजूदा पार्टी को बदलें',
  importDedupDecision_CREATE_NEW: 'फिर भी नई पार्टी के रूप में बनाएँ',
  importDedupBack: 'प्रीव्यू पर वापस',
  importDedupEmptyTitle: 'समीक्षा के लिए कोई डुप्लीकेट नहीं',
  importDedupEmptyBody: 'आप सीधे कमिट पर जा सकते हैं।',

  // ── FE.4 — Lift-state stub (commit ready, before FE.5 lands) ──────────
  importJobCommitReadyStubTitle: 'कमिट के लिए तैयार',
  importJobCommitReadyStubBody:
    'FE.5 इन {n} डुप्लीकेट निर्णयों को सर्वर पर भेजेगा।',

  // ── FE.5 — Commit confirm ─────────────────────────────────────────────
  importCommitTitle: 'कमिट के लिए तैयार',
  importCommitBody:
    'अपने बिज़नेस में सेव करने से पहले सारांश देखें।',
  importCommitCountCreate: 'नई पार्टियाँ बनेंगी',
  importCommitCountOverwrite: 'ओवरराइट होंगी',
  importCommitCountSkip: 'डुप्लीकेट छोड़ी जाएँगी',
  importCommitBack: 'वापस',
  importCommitAction: 'इम्पोर्ट कमिट करें',
  importCommitting: 'आपका डेटा सेव हो रहा है…',
  importCommitSuccessToast: 'इम्पोर्ट कमिट हो गया — रिफ़्रेश हो रहा है…',
  importCommitFailed: 'कमिट नहीं हो सका। फिर से कोशिश करें।',
  importCommitMissingToken:
    'यह इम्पोर्ट सेशन समाप्त हो गया है। कृपया फ़ाइल फिर से अपलोड करें।',

  // ── FE.5 — Committing panel ───────────────────────────────────────────
  importCommittingTitle: 'आपका डेटा सेव हो रहा है…',
  importCommittingBody:
    'पंक्तियाँ आपके बिज़नेस में सेव हो रही हैं। बड़े इम्पोर्ट में कुछ समय लग सकता है।',

  // ── FE.5 — Result view ────────────────────────────────────────────────
  importResultTitle: 'इम्पोर्ट पूरा हुआ',
  importResultBody: 'आपकी पार्टियाँ अब बिज़नेस में जुड़ गई हैं।',
  importResultPartialTitle: 'इम्पोर्ट आंशिक रूप से सेव हुआ',
  importResultPartialBody:
    'कुछ पंक्तियाँ सेव नहीं हो सकीं। गलतियाँ देखने के लिए एरर CSV डाउनलोड करें।',
  importResultCountSaved: 'सेव हुई पार्टियाँ',
  importResultCountSkipped: 'छोड़ी गई डुप्लीकेट',
  importResultCountErrors: 'गलती वाली पंक्तियाँ',
  importResultDownloadCsv: 'एरर CSV डाउनलोड करें',
  importResultImportAnother: 'और फ़ाइल इम्पोर्ट करें',
  importResultViewParties: 'पार्टियाँ देखें',

  // ── 7.1B — एंटिटी पिकर + प्रोडक्ट कॉपी ──────────────────────────────
  importStepEntity: '1. आप क्या इम्पोर्ट कर रहे हैं?',
  importEntityPickAriaLabel: 'आप क्या इम्पोर्ट कर रहे हैं',
  importEntityParties: 'पार्टियाँ',
  importEntityPartiesDesc: 'आपकी किताबों के ग्राहक और सप्लायर',
  importEntityProducts: 'प्रोडक्ट्स',
  importEntityProductsDesc: 'दाम, SKU और स्टॉक के साथ आइटम मास्टर',

  importProducts: 'प्रोडक्ट्स इम्पोर्ट करें',
  importIntroProduct:
    'Tally, Vyapar, Busy, या किसी भी CSV से अपना प्रोडक्ट कैटलॉग लाएँ — सेव करने से पहले प्रीव्यू देखें।',

  // Product field labels
  productName: 'नाम',
  productSku: 'SKU',
  productHsn: 'HSN',
  productMrp: 'MRP',
  productSalePrice: 'विक्रय मूल्य',
  productPurchasePrice: 'खरीद मूल्य',
  productGstRate: 'GST',
  productUnit: 'इकाई',
  productOpeningStock: 'शुरुआती स्टॉक',
  productDescription: 'विवरण',

  // Dedup product copy
  importDedupTitleProduct: 'डुप्लीकेट प्रोडक्ट्स की समीक्षा करें',
  importDedupIntroProduct:
    'ये पंक्तियाँ आपके पहले से मौजूद प्रोडक्ट्स जैसी लगती हैं। कमिट करने से पहले हर एक के लिए चुनें कि क्या करना है।',

  // Commit product copy
  importCommitCountCreateProduct: 'नए बनाए जाने वाले प्रोडक्ट्स',
  importCommitCountOverwriteProduct: 'ओवरराइट होने वाले प्रोडक्ट्स',

  // Result product copy
  importResultBodyProduct: 'आपके प्रोडक्ट्स अब बिज़नेस में जुड़ गए हैं।',
  importResultCountSavedProduct: 'सेव हुए प्रोडक्ट्स',
  importResultViewProducts: 'प्रोडक्ट्स देखें',

  // Product issue chips
  importIssue_PRICE_PRECISION_LOST: 'दाम 2 दशमलव तक राउंड किया गया',
  importIssue_TAX_RATE_FALLBACK: 'GST रेट नहीं मिला — बिज़नेस डिफ़ॉल्ट इस्तेमाल हो रहा है',
  importIssue_UNIT_NOT_FOUND: 'इकाई पहचानी नहीं गई',
  importIssue_PLACEHOLDER_NAME: 'यह नाम प्लेसहोल्डर लगता है',
} as const
