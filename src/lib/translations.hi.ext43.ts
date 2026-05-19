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

  // ── Job-detail stub (replaced by FE.2) ─────────────────────────────────
  importJobStubTitle: 'इम्पोर्ट जॉब बन गई',
  importJobStubBody: 'प्रीव्यू पेज जल्द आ रहा है। Job ID:',

  // ── Entry point from Parties page ──────────────────────────────────────
  importEntryFromParties: 'इम्पोर्ट',
} as const
