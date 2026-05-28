/** Translations — ext48: smart GST filing assistant / readiness check (#144). */

export const enExt48 = {
  // Page / nav
  gstReadinessTitle: 'GST filing check',
  gstReadinessNavDesc: 'Pre-filing validation for GSTR-1 / 3B',
  gstReadinessPeriod: 'Return period',
  gstReadinessReturnType: 'Return type',
  gstReadinessGstr1: 'GSTR-1',
  gstReadinessGstr3b: 'GSTR-3B',

  // Verdict / summary
  gstReadinessReady: 'Ready to file',
  gstReadinessBlocked: 'Fix issues before filing',
  gstReadinessBlockers: 'blockers',
  gstReadinessWarnings: 'warnings',
  gstReadinessScanned: 'documents scanned',
  gstReadinessDocsAffected: 'documents affected',

  // States
  gstReadinessErrorTitle: "Couldn't run the filing check",
  gstReadinessNoIssues: 'No issues found',
  gstReadinessNoIssuesDesc: 'Every document in this period looks ready to file.',

  // Severity labels
  gstSevBlocker: 'Blocker',
  gstSevWarning: 'Warning',

  // Checks
  gstChkB2bGstinTitle: 'B2B invoice missing GSTIN',
  gstChkB2bGstinDesc: 'B2B invoices must carry the buyer GSTIN to appear in GSTR-1.',
  gstChkBadGstinTitle: 'Invalid GSTIN format',
  gstChkBadGstinDesc: "The buyer GSTIN doesn't match the standard 15-character format.",
  gstChkPosTitle: 'Missing place of supply',
  gstChkPosDesc: 'Place of supply decides the CGST/SGST vs IGST split — it cannot be blank.',
  gstChkHsnTitle: 'Missing HSN / SAC code',
  gstChkHsnDesc: 'Taxable line items need an HSN (goods) or SAC (services) code for the HSN summary.',
  gstChkSplitTitle: 'Wrong tax split for supply',
  gstChkSplitDesc: 'Inter-state supplies must use IGST; intra-state must use CGST + SGST.',
  gstChkCompTitle: 'Composition dealer charged GST',
  gstChkCompDesc: 'Businesses under the composition scheme must not collect GST on invoices.',
  gstChkZeroTitle: 'Zero tax on a taxable item',
  gstChkZeroDesc: 'A taxable line has 0% tax — confirm it is genuinely exempt or nil-rated.',
} as const
