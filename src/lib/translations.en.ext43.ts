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

  // ── Job-detail stub (legacy — kept for any unmigrated callers) ────────
  importJobStubTitle: 'Import job created',
  importJobStubBody: 'The preview page is on the way. Job ID:',

  // ── FE.2 — Job page header + state branches ────────────────────────────
  importJobHeader: 'Import in progress',
  importJobMissingIdTitle: 'Import not found',
  importJobMissingIdBody: 'No job id in the URL.',
  importJobLoadErrorTitle: 'Could not load this import',
  importJobLoadErrorBody: 'Please try again.',
  importJobRetry: 'Try again',

  // Format short labels used inside ParseProgress (compact line).
  importFormat_tally_xml_short: 'Tally XML',
  importFormat_vyapar_csv_short: 'Vyapar CSV',
  importFormat_busy_xls_short: 'Busy Excel',
  importFormat_generic_csv_short: 'CSV',

  // ── FE.2 — Parsing state ───────────────────────────────────────────────
  importParseProgressTitle: 'Parsing your file…',
  importParseProgressBody:
    'This usually takes a few seconds. Stay on this screen — we will show the preview as soon as it is ready.',
  importParseProgressUnknownFile: 'Uploaded file',

  // ── FE.2 — Failed state ────────────────────────────────────────────────
  importParseFailedTitle: 'We could not read this file',
  importParseFailedBody:
    'The file format may be different from what was selected, or the file may be corrupt. Cancel this import and try again with a fresh export.',
  importParseFailedErrorCount: 'Rows with errors:',
  importParseFailedCancelAction: 'Cancel and retry',
  importParseFailedCancelled: 'Import cancelled. You can try again.',
  importParseFailedCancelError: 'Could not cancel — please retry.',

  // ── FE.3 / FE.4 / FE.5 stubs ──────────────────────────────────────────
  importJobPreviewStubTitle: 'Preview ready',
  importJobPreviewStubBody: 'The dedup review screen is on the way.',
  importJobCommittingStubTitle: 'Committing import…',
  importJobCommittingStubBody: 'Saving rows to your business.',
  importJobCommittedStubTitle: 'Import committed',
  importJobCommittedStubBody: 'A detailed result screen is on the way.',
  importJobCancelledStubTitle: 'Import cancelled',
  importJobCancelledStubBody: 'No rows were saved.',
  importJobUnknownTitle: 'Unknown import state',

  // ── Entry point from Parties page ──────────────────────────────────────
  importEntryFromParties: 'Import',
} as const
