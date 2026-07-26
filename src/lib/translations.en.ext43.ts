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
  importStepFormat: 'Choose source',
  importStepFile: 'Pick file',

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
  importFormat_TALLY_XML_short: 'Tally XML',
  importFormat_VYAPAR_CSV_short: 'Vyapar CSV',
  importFormat_BUSY_XLSX_short: 'Busy Excel',
  importFormat_GENERIC_CSV_short: 'CSV',

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

  // ── FE.3 — Preview summary ─────────────────────────────────────────────
  importPreviewSummaryTitle: 'Preview summary',
  importPreviewSummaryBody: 'Nothing is saved yet. Review each row before committing.',
  importPreviewSummaryTotal: 'Total rows',
  importPreviewSummaryValid: 'Valid',
  importPreviewSummaryErrors: 'Errors',
  importPreviewSummaryDuplicates: 'Duplicates',

  // ── FE.3 — Filter chips ────────────────────────────────────────────────
  importPreviewFiltersAriaLabel: 'Filter preview rows',
  importPreviewFilterAll: 'All',
  importPreviewFilterValid: 'Valid',
  importPreviewFilterErrors: 'Errors',
  importPreviewFilterDuplicates: 'Duplicates',

  // ── FE.3 — Table columns ───────────────────────────────────────────────
  importPreviewColRow: 'Row',
  importPreviewColName: 'Name',
  importPreviewColPhone: 'Phone',
  importPreviewColBalance: 'Balance',
  importPreviewColStatus: 'Status',
  importPreviewColReason: 'Reason',
  importPreviewMissingName: '—',
  importPreviewMissingPhone: '—',

  // ── FE.3 — Row status badges ──────────────────────────────────────────
  importPreviewStatus_STAGED: 'Valid',
  importPreviewStatus_WARNING: 'Warning',
  importPreviewStatus_ERROR: 'Error',
  importPreviewStatus_DUPLICATE_EXACT: 'Duplicate',
  importPreviewStatus_DUPLICATE_NEAR: 'Near duplicate',
  importPreviewStatus_COMMITTED: 'Committed',
  importPreviewStatus_SKIPPED: 'Skipped',

  // ── FE.3 — Pagination + actions ───────────────────────────────────────
  importPreviewLoadMore: 'Load more rows',
  importPreviewEmptyTitle: 'No rows in this filter',
  importPreviewEmptyBody: 'Try a different filter, or load more rows from the server.',
  importPreviewCancel: 'Cancel import',
  importPreviewCancelled: 'Import cancelled. Nothing was saved.',
  importPreviewCancelError: 'Could not cancel — please retry.',
  importPreviewContinueDedup: 'Continue to dedup',
  importPreviewContinueCommit: 'Continue to commit',
  importPreviewContinueComingSoon: 'Next step lands in FE.4 — coming soon.',

  // ── FE.4 — Dedup resolution ───────────────────────────────────────────
  importDedupTitle: 'Review duplicates',
  importDedupIntro:
    'These rows look like parties you already have. Pick what should happen for each one before committing.',
  importDedupBulkAriaLabel: 'Apply to all duplicates',
  importDedupBulkSkipAll: 'Skip all',
  importDedupBulkOverwriteAll: 'Overwrite all',
  importDedupBulkCreateAll: 'Create new for all',
  importDedupCountsLine: '{skip} skip · {overwrite} overwrite · {createNew} create new',
  importDedupMatchExact: 'Exact match',
  importDedupMatchNear: 'Near match',
  importDedupIncoming: 'Incoming row',
  importDedupExisting: 'Existing party',
  importDedupExistingFallback: 'Existing party',
  importDedupExistingPhoneUnknown: '—',
  importDedupChooseAriaLabel: 'Choose action for this row',
  importDedupDecision_SKIP: 'Skip — keep existing party',
  importDedupDecision_OVERWRITE: 'Overwrite existing party with this row',
  importDedupDecision_CREATE_NEW: 'Create as a new party anyway',
  importDedupBack: 'Back to preview',
  importDedupEmptyTitle: 'No duplicates to review',
  importDedupEmptyBody: 'You can continue straight to commit.',

  // ── FE.4 — Lift-state stub (commit ready, before FE.5 lands) ──────────
  importJobCommitReadyStubTitle: 'Ready to commit',
  importJobCommitReadyStubBody:
    'FE.5 will send these {n} duplicate resolutions to the server.',

  // ── FE.5 — Commit confirm ─────────────────────────────────────────────
  importCommitTitle: 'Ready to commit',
  importCommitBody: 'Review the summary before we save these rows to your business.',
  importCommitCountCreate: 'Parties to create',
  importCommitCountOverwrite: 'Parties to overwrite',
  importCommitCountSkip: 'Duplicates to skip',
  importCommitBack: 'Back',
  importCommitAction: 'Commit import',
  importCommitting: 'Committing your data…',
  importCommitSuccessToast: 'Import committed — refreshing…',
  importCommitFailed: 'Commit failed. Please try again.',
  importCommitMissingToken:
    'This import session expired. Please upload the file again.',

  // ── FE.5 — Committing panel ───────────────────────────────────────────
  importCommittingTitle: 'Committing your data…',
  importCommittingBody: 'Saving rows to your business. This may take a moment for large imports.',

  // ── FE.5 — Result view ────────────────────────────────────────────────
  importResultTitle: 'Import complete',
  importResultBody: 'Your parties are now part of your business.',
  importResultPartialTitle: 'Import partially saved',
  importResultPartialBody:
    'Some rows could not be saved. Download the error CSV to see what went wrong.',
  importResultCountSaved: 'Parties saved',
  importResultCountSkipped: 'Duplicates skipped',
  importResultCountErrors: 'Rows with errors',
  importResultDownloadCsv: 'Download error CSV',
  importResultImportAnother: 'Import another file',
  importResultViewParties: 'View parties',

  // ── 7.1B — Entity picker + product copy ──────────────────────────────
  importStepEntity: 'What are you importing?',
  importEntityPickAriaLabel: 'What are you importing',
  importEntityParties: 'Parties',
  importEntityPartiesDesc: 'Customers and suppliers from your books',
  importEntityProducts: 'Products',
  importEntityProductsDesc: 'Item master with prices, SKUs, and stock',

  importProducts: 'Import products',
  importIntroProduct:
    'Bring your product catalogue in from Tally, Vyapar, Busy, or a generic CSV — preview before anything is saved.',

  // Product field labels (preview, dedup, row card)
  productName: 'Name',
  productSku: 'SKU',
  productHsn: 'HSN',
  productMrp: 'MRP',
  productSalePrice: 'Sale price',
  productPurchasePrice: 'Purchase price',
  productGstRate: 'GST',
  productUnit: 'Unit',
  productOpeningStock: 'Opening stock',
  productDescription: 'Description',

  // Dedup product copy
  importDedupTitleProduct: 'Review duplicate products',
  importDedupIntroProduct:
    'These rows look like products you already have. Pick what should happen for each one before committing.',

  // Commit product copy
  importCommitCountCreateProduct: 'Products to create',
  importCommitCountOverwriteProduct: 'Products to overwrite',

  // Result product copy
  importResultBodyProduct: 'Your products are now part of your business.',
  importResultCountSavedProduct: 'Products saved',
  importResultViewProducts: 'View products',

  // Product issue chips (shown via firstIssueMessage or future chip layer)
  importIssue_PRICE_PRECISION_LOST: 'Price rounded to 2 decimal places',
  importIssue_TAX_RATE_FALLBACK: 'GST rate not matched — using business default',
  importIssue_UNIT_NOT_FOUND: 'Unit not recognised',
  importIssue_PLACEHOLDER_NAME: 'Looks like a placeholder name',

  // Dashboard trend window (the hero chart and the overview carousel)
  last30Days: 'Last 30 days',
} as const
