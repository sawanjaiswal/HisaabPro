// ─── HisaabPro — English Ext 43 (Phase 7 #149 — Data Import 7.1A) ──────────
// FE.1 — Upload page (format picker + dropzone). FE.2+ extends.
// All keys consumed via useLanguage(); no hardcoded EN/HI in JSX (Rule A).

export const enExt43 = {
  // ── Page header / intro ────────────────────────────────────────────────
  importPageTitle: 'Import data',
  importParties: 'Import parties',
  importIntro:
    'Bring parties in from Tally, Vyapar, Busy, or a generic CSV — preview before anything is saved.',

  // ── Steps ──────────────────────────────────────────────────────────────
  importStepFormat: '1. Choose source',
  importStepFile: '2. Pick file',

  // ── Format options (label + description) ───────────────────────────────
  importPickFormatLabel: 'Source format',
  importFormatTallyXmlLabel: 'Tally',
  importFormatTallyXmlDesc: 'Tally XML export',
  importFormatVyaparCsvLabel: 'Vyapar',
  importFormatVyaparCsvDesc: 'Vyapar CSV export',
  importFormatBusyXlsLabel: 'Busy',
  importFormatBusyXlsDesc: 'Busy Excel export',
  importFormatGenericCsvLabel: 'CSV',
  importFormatGenericCsvDesc: 'Any CSV (map columns)',

  // ── Dropzone ───────────────────────────────────────────────────────────
  importDropzoneAriaLabel: 'Choose a file to import',
  importDropzoneTitle: 'Drop file here or tap to browse',
  importDropzoneHint: 'XML, CSV, or XLSX up to 10 MB',
  importRemoveFile: 'Remove',

  // ── Submit + state ─────────────────────────────────────────────────────
  importSubmit: 'Upload and preview',
  importUploading: 'Uploading...',
  importUploadSuccess: 'Upload received — preparing preview.',
  importUploadFailed: 'Upload failed. Please try again.',

  // ── Validation codes (importValidation_<CODE>) ─────────────────────────
  importValidation_NO_FORMAT: 'Pick a source format first.',
  importValidation_NO_FILE: 'Choose a file to upload.',
  importValidation_FILE_TOO_LARGE: 'File is larger than 10 MB. Split it and try again.',
  importValidation_EXTENSION_MISMATCH: 'This file type doesn’t match the chosen source.',
  importValidationGeneric: 'Please pick a valid file.',

  // ── Disabled-feature stub ──────────────────────────────────────────────
  importFeatureDisabled: 'Data import isn’t available yet for this business.',

  // ── Job-detail stub (replaced by FE.2) ─────────────────────────────────
  importJobStubTitle: 'Import job created',
  importJobStubBody: 'The preview page is on the way. Job ID:',

  // ── Entry point from Parties page ──────────────────────────────────────
  importEntryFromParties: 'Import',
} as const
