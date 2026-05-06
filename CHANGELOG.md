# Changelog

All notable changes to HisaabPro are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### GST Phase 2 — v7

Full GST coverage shipped across 11 PRs on the `hisaabpro` branch.
PR 8 (NIC e-invoice) and PR 9 (NIC e-way bill) are merged but pending
NIC credential provisioning — see `docs/GST_v7_DEPLOYMENT.md §8`.

| PR | Title | Summary |
|----|-------|---------|
| 1 | Schema migration | Added 6 GST fields (`gstEnabled`, `taxPricingMode`, `gstDeclarationText`, `Document.taxPricingMode`, `DocumentSettings.taxPricingMode`, `HsnCode.uqc`); UQC seed |
| 2 | GST settings opt-in | `PATCH /api/gst/settings` — per-business GST enable/disable; GSTIN auto-activates flag; AuditLog with masked GSTIN |
| 3 | Tax engine extensions | Inclusive/exclusive pricing modes; RCM flag; composition scheme (0% tax, Bill of Supply label); CGST+SGST vs IGST split via `isInterState()` |
| 4 | Invoice form UI | HSN typeahead, place-of-supply selector, tax rate picker, per-line HSN/SAC, inclusive pricing chip, RCM toggle on invoice form |
| 5 | Template engine | `gstTaxSummary` flag (CGST/SGST/IGST subtotals table); `gstDeclaration` flag (editable declaration text block); `einvoiceQr` flag; all 4 paper sizes |
| 6 | Composition scheme + RCM polish | Composition invoices suppress tax columns; RCM header added; Bill of Supply label; end-to-end party GSTIN display |
| 7 | Backfill wizard | 5-step UI wizard to re-compute GST on historical invoices; preview/execute/status endpoints; idempotency key required; 1/hr rate limit; AuditLog per document |
| 8 | NIC e-invoice *(Phase 2.1)* | IRN generation via NIC IRP API; cancel endpoint; circuit breaker; deduplication; quota tracking — **requires NIC credentials, not yet active** |
| 9 | NIC e-way bill *(Phase 2.1)* | EWB Part A + Part B generation via NIC EWB API; cancel; auto-prompt on eligible invoices — **requires NIC credentials, not yet active** |
| 10 | GSTR-1 export | NIC v3.0 format; 8 builders (B2B, B2CL, B2CS, CDNR, CDNUR, HSN, Nil, Exports); JSON + CSV output; 5/min rate limit |
| 11 | GSTR-3B summary | 11-section aggregator; JSON + CSV export; covers outward supply, ITC, inter-state breakdown, tax payment rows; 5/min rate limit |
| 12 | Polish + docs | tsc clean, enforce.js clean, no console.log leaks; deployment guide; changelog; visual QA deferred to manual pass |

---

## Earlier releases

*(History predates this changelog — see git log for details.)*
