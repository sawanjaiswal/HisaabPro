// Phase 7 #149 — Data Import 7.1C (FE invoice entity)
//
// Adds invoice entity picker tile, InvoiceRowCard copy, CommitBlockedBanner
// copy, product-summary back-CTA, and the 11 InvoiceIssueCode chip strings.

export const enExt44 = {
  // ── Entity picker — invoice tile ─────────────────────────────────────
  importEntityInvoices: 'Invoices',
  importEntityInvoicesDesc: 'Sales and purchase invoices with line items',

  // ── Commit-blocked banner (409 COMMIT_BLOCKED_PRODUCT_NOT_FOUND) ─────
  importInvoiceBlockedTitle: 'Product catalogue is missing some items',
  importInvoiceBlockedDesc:
    'These invoices reference SKUs that are not in your products list. Import those products first, then come back to finish this invoice import.',
  importInvoiceBlockedCta: 'Import products first',
  importInvoiceBlockedCancel: 'Cancel import',
  importInvoiceBlockedMissingSkusLabel: 'Missing SKUs',

  // ── Invoice row card ─────────────────────────────────────────────────
  importInvoiceLineMore: '+{count} more',
  importInvoiceTotals: 'Totals',
  importInvoiceSubtotal: 'Subtotal',
  importInvoiceTax: 'Tax (CGST + SGST + IGST)',
  importInvoiceGrandTotal: 'Grand total',
  importInvoiceNoLines: 'No line items on this invoice',
  importInvoiceNumberLabel: 'Invoice #',
  importInvoiceDateLabel: 'Date',
  importInvoicePartyLabel: 'Party',

  // Party-resolution chips on the header
  importInvoicePartyExact: 'Existing',
  importInvoicePartyFlyCreate: 'New — auto-create',
  importInvoicePartyNameOnly: 'Name only',
  importInvoicePartyNotFound: 'Not in your list',

  // Per-line product match chip
  importInvoiceProductMatched: 'Matched',
  importInvoiceProductByName: 'By name',
  importInvoiceProductMissing: 'SKU not found',

  // ── Invoice issue chip copy (severity → chip color picked by UI) ─────
  importInvoiceIssue_PARTY_AUTO_CREATED: 'Party will be auto-created',
  importInvoiceIssue_PARTY_NAME_ONLY_MATCH:
    'Matched by name only — verify phone',
  importInvoiceIssue_PARTY_NOT_FOUND: 'Party not in your list',
  importInvoiceIssue_PRODUCT_NOT_FOUND: 'Product SKU not found',
  importInvoiceIssue_PRODUCT_AMBIGUOUS: 'Multiple products match this SKU',
  importInvoiceIssue_AMOUNT_OUT_OF_RANGE:
    'Amount exceeds the per-invoice maximum',
  importInvoiceIssue_AMOUNT_NEGATIVE:
    'Negative total — use the credit-note flow',
  importInvoiceIssue_INVALID_DATE: 'Invoice date is invalid',
  importInvoiceIssue_TAX_MATH_MISMATCH:
    'Tax total does not match the sum of lines',
  importInvoiceIssue_HEADER_MISMATCH_WITHIN_INVOICE:
    "Header fields differ across this invoice's rows",
  importInvoiceIssue_LINES_PER_INVOICE_EXCEEDED:
    'Too many line items on this invoice',
  importInvoiceIssue_INTRA_FILE_DUPLICATE: 'Duplicate invoice within this file',
  importInvoiceIssue_DUPLICATE_INVOICE_NUMBER:
    'Invoice number already exists in your books',
  importInvoiceIssue_INVOICE_NUMBER_REQUIRED: 'Invoice number missing',
  importInvoiceIssue_NO_LINES: 'Invoice has no line items',
  importInvoiceIssue_DUPLICATE_EXACT: 'Exact duplicate of an existing invoice',

  // ── Product-summary back-CTA (deep-link round-trip) ──────────────────
  backToInvoiceImport: 'Back to invoice import',
  backToInvoiceImportDesc:
    'Return to the invoice import you started — your staged rows are still waiting.',

  // ── Hook-level toasts ────────────────────────────────────────────────
  importClientVersionUpgradeRequired:
    'Please update the app to import invoices.',
} as const
