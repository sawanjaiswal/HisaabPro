---
status: approved
task: GPT Redesign Wave 5 · #31 GST / Tax Summary Report
feature: gpt-redesign-wave5-tax-summary
createdAt: 2026-07-21T10:10:00Z
approvedAt: 2026-07-21T10:10:00Z
approver: Sawan (standing authorization — "continue")
---

# #31 GST report — rebuild to mockup

## Route correction

`docs/GPT_REDESIGN_PLAN.md` maps #31 to `/reports/gst-returns`. That page is a
GSTR-1/3B/9 returns viewer/exporter. Mockup #31 shows taxable sales/purchases
with a CGST/SGST/IGST split and a "View Detailed Report" CTA — that is
`TaxSummaryPage.tsx` at `/reports/tax-summary`. The doc row is corrected in the
same commit; the GSTR viewer becomes the CTA target.

## Inventory (Phase 0.5)

Reused, not rebuilt:
- `AppShell`, `Header`, `HeroPage`, `PageContainer`, `Button`, `Input`
- `ErrorState`, `EmptyState`, `ReportSkeleton`
- `ReportPeriodSelect` + `report-period.css` (shared with #15/#16/#69)
- `TaxSummaryCards`, `HsnSummaryTable` — existing functionality, kept
- `formatPaise` from `@/lib/format`, `getDateRange` from `report.utils`

New (variant-first answered): `TaxTotalsCard` and `TaxNetLiabilityCard` are
feature-local compositions in `src/features/reports/components/`. No existing
primitive renders a headline amount plus a fixed GST component split;
`SummaryTiles` is a 3-up equal-weight stat row, which is the wrong hierarchy.

## Files

- [x] src/features/reports/report-tax.types.ts — `NetTaxLiability` + `period`
- [x] src/features/reports/components/ReportPeriodSelect.tsx — `onRangeChange`
- [x] src/features/reports/report-period.css — `.report-period__custom`
- [x] src/features/reports/components/TaxTotalsCard.tsx (new, ~54L)
- [x] src/features/reports/components/TaxNetLiabilityCard.tsx (new, ~44L)
- [ ] src/features/reports/report-tax-summary.css — `.tax-card*`, `.tax-liability*`
- [ ] src/features/reports/TaxSummaryPage.tsx — rewrite (≤160L)
- [ ] src/lib/translations.{en,hi}.ts — cgst/sgst/igst/taxableSales/
      taxablePurchases/viewDetailedReport

## Contract fix (root cause)

`TaxSummaryData.netTaxLiability` was typed `number`; the server returns
`{cgst,sgst,igst,cess}`. The page passed the object to `formatAmount()`,
which rendered `NaN`. Third instance of the hand-written report types
drifting from the server (see `.claude/fix-trace-pl-contract.md`).

## Tokens

Colors `var(--color-{primary,gray,success,error}-*)`; radius `--radius-xl` cards
/ `--radius-sm` button; `--fs-*`; `--shadow-card`; `--space-*`.

## 4 UI states

- Loading: `<ReportSkeleton rows={4} />`
- Error: `<ErrorState title message onRetry />`
- Empty: `<EmptyState>` when `summary` is null
- Success: totals cards + liability + category cards + HSN table + CTA
