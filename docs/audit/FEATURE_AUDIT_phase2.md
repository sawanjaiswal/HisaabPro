phase: 2 GST (features 63-82)

Adversarial verification of every "Done" row in the Phase 2 — GST & Compliance
matrix (`docs/HISAABPRO.md` lines 964–987). Each evidence file was located and
opened; verdicts reflect real code behavior, not the doc's claim.

| # | feature | verdict | evidence checked | notes |
|---|---------|---------|------------------|-------|
| 63 | GST Invoice Engine | VERIFIED | `services/tax-calc.ts`, `services/document-calc.ts` | Pure functions, paise integers + basis points (`PAISE_BASIS_POINTS`). `document-calc` delegates to `tax-calc.calculateLineTax` — single source, no duplication. |
| 64 | Tax categories | VERIFIED | `services/tax-category.service.ts` (`DEFAULT_CATEGORIES`), `routes/tax-categories.ts`, `TaxCategory` model | Real seed defaults (Exempt/0/5/12/18/28%) as basis points. Matrix says "5 seeded"; code actually seeds 6 — harmless under-count. |
| 65 | Place of Supply | VERIFIED | `tax-calc.ts` `isInterState()` + `calculateLineTax()` | Real POS branch: interstate → IGST full rate; intra → CGST=floor(rate/2), SGST=rate−CGST. Null POS defaults to intra. |
| 66 | GSTR-1 Export | VERIFIED | `routes/gst-returns.ts`, `services/gst-returns/gstr1.service.ts` + `builders/{b2b,b2cl,b2cs,cdnr,cdnur}.builder.ts`, `gstr1-csv.ts`, `GstReturn` model | All five sections (B2B/B2CL/B2CS/CDNR/CDNUR) built in dedicated builders; JSON + CSV export. Section logic lives in `builders/`, not inline — evidence path slightly under-specified but accurate. |
| 67 | GSTR-1 Reconciliation | VERIFIED | `routes/reconciliation.ts`, `services/reconciliation/matching.engine.ts`, `GstReconciliation`/`GstReconciliationEntry` models, `ReconciliationListPage.tsx` | Real 4-way match: MATCHED / MISMATCHED / MISSING_IN_GSTR / EXTRA_IN_GSTR, 1-paisa tolerance. |
| 68 | GSTR-3B | VERIFIED | `Gstr3bPage.tsx`, `gst-return.service.ts` (shim → `services/gst-return/gstr3b.ts`) | Aggregates outward non-RCM (3.1a), outward RCM (3.1b), ITC, credit notes. `gst-return.service.ts` is a 2-line re-export shim to `gst-return/` — real impl exists. |
| 69 | GSTR-9 | VERIFIED | `routes/gst-returns.ts` gstr9 endpoint → `services/gst-return/gstr9.ts` `generateGstr9()` | Endpoint wired, real annual aggregation function. |
| 70 | Tax reports | VERIFIED | `routes/tax-reports.ts`, `services/tax-report.service.ts` (137L) | Summary + HSN + Ledger report service present, real logic. |
| 71 | E-Invoice | VERIFIED | `services/einvoice/*` (service/envelope/nic-client/token-store/errors), `EInvoice` model, `src/features/e-invoice/` | Real `generateIrn()` with NIC quota gating, envelope builder, IRN/QR via NIC client. |
| 72 | E-Way Bill | VERIFIED | `services/ewaybill/*` (service/doc-loader/envelope/nic-client/token-store), `EWayBill` model, `src/features/e-way-bill/` | Real threshold gate in `ewaybill.doc-loader.ts` (`getEwbThreshold`/`assertThreshold`), Part-A/Part-B vehicle details. |
| 73 | Reverse Charge | VERIFIED | `Document.isReverseCharge` field, `tax-calc.ts` `applyRcmFlag()`, `gst-return/gstr3b.ts` 3.1(b) | RCM zeroes doc-level GST/cess; 3B splits RCM vs non-RCM outward. |
| 74 | Composite Scheme | VERIFIED | `services/composition.service.ts` (100L), `composition.constants.ts`, `tax-calc.ts` `calculateCompositionTotals()` | Flat-rate liability on turnover, `taxEnabled=!isComposite` in document-calc; Bill of Supply path. |
| 75 | Additional Cess | VERIFIED | `DocumentLineItem.cessRate`/`cessAmount` (paise/bp), `tax-calc.ts` cess branch (PERCENTAGE + FIXED_PER_UNIT) | Per-line cess computed in line tax. |
| 76 | HSN Auto-fill | DRIFT | `HsnCode` model, `routes/hsn.ts` `/search` | Model + search route exist BUT: (a) NO 12K seed — no HSN data file and no `hsnCode.create/createMany/upsert` anywhere (`seed.gst.uqc.ts` only patches `uqc` on pre-existing rows); (b) NO trgm GIN index on HsnCode in any migration; search uses `startsWith` + `contains` (plain LIKE), not trigram. Both matrix claims unbacked. |
| 77 | TDS/TCS | VERIFIED | `services/tds-tcs.service.ts` (141L), `TdsTcsReportPage.tsx` | Real `calculateTds`/`calculateTcs` (paise × bp / 10000), summary report. |
| 78 | GSTIN verification | PARTIAL | `routes/gstin.ts`, `services/gstin.utils.ts` | Local Mod-36 checksum validation is real and correct. But `POST /api/gstin/verify` (the claimed "External API check") is a STUB — returns hardcoded mock (`verified:true`, `legalName:'Verified Business'`, `status:'Active'`) with a TODO to integrate the real GSP API. No external call exists. |
| 79 | Credit/Debit Notes | VERIFIED | `Document(type=CREDIT_NOTE/DEBIT_NOTE)`, `services/document/{create,helpers,selects}.ts` | `originalDocumentId` linking, stock increase on CN, outstanding adj (CN −, DN +). |
| 80 | Multi-currency | VERIFIED | `services/currency.service.ts` (206L), `ExchangeRate` model | 11 `SUPPORTED_CURRENCIES`, rate stored as ×10000 integer, conversion math documented. |
| 81 | Recurring Invoices | VERIFIED | `services/recurring/*`, `jobs/run-recurring-generator.ts`, `routes/recurring/*`, `RecurringInvoice`/`RecurringInvoiceRun` models, `src/features/recurring/` | Frequency anchors + `initialNextRunDate`, cron generator job, claim service for parallel pods. |
| 82 | GST Returns viewer | VERIFIED | `src/features/reports/GstReturnsPage.tsx` | Page exists, wired in `App.tsx`. |

## SSOT violations

none found — tax math is centralized in `services/tax-calc.ts`; `document-calc.ts`
calls `calculateLineTax`/`isInterState` rather than re-implementing. Money is paise
integers and rates are basis points consistently across the GST services.

## Non-standard code

- none found in Phase-2 source files. No `as any`, `@ts-ignore`, or `@ts-expect-error`
  in the GST services/routes; no raw `fetch()` in GST/tax/recurring/e-invoice/e-way-bill
  FE features; no Phase-2 source file exceeds 250 lines (only `__tests__/*.ts` files
  do, which are exempt).
- (Not non-standard code, but flagged for the doc): `server/src/routes/gstin.ts:64`
  `POST /verify` returns mock GSP data — see feature #78 PARTIAL above.
