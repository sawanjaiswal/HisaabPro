# Health Report -- 2026-03-27 (App Only)

> Excludes: landing/marketing components, translation files

## Summary
| Metric | Value |
|--------|-------|
| TypeScript errors | **0** |
| App files over 250 | **1** |
| App files at 200-250 (warning) | **39** |
| App hotspots (30d churn) | 14 |
| Hardcoded strings (app only) | **10** |
| App source files | 701 |
| Main bundle | 623KB |

## Over-Limit (app only)
| File | Lines | Notes |
|------|-------|-------|
| recurring/RecurringCreateDrawer.tsx | 251 | 1 line over |

## Warning Zone (200-250) — 39 files
| File | Lines | % |
|------|-------|---|
| invoices/invoice.constants.ts | 249 | 99% |
| templates/template-gallery-modern.configs.ts | 242 | 97% |
| templates/template-gallery-industry.configs.ts | 239 | 96% |
| dashboard/RecentActivityFeed.tsx | 239 | 96% |
| lib/offline.ts | 233 | 93% |
| invoices/useInvoiceForm.ts | 231 | 92% |
| parties/PartyDetailPage.tsx | 230 | 92% |
| feedback/useFeedbackWidget.ts | 230 | 92% |
| invoices/ShareInvoiceDrawer.tsx | 229 | 92% |
| admin/coupons/CouponForm.tsx | 227 | 91% |
| settings/settings.constants.ts | 226 | 90% |
| invoices/invoice-api.types.ts | 224 | 90% |
| ui/Drawer.tsx | 224 | 90% |
| settings/calculator.reducer.ts | 223 | 89% |
| invoices/invoice-crud.service.ts | 223 | 89% |
| invoices/invoice-calc.utils.ts | 222 | 89% |
| invoices/InvoicesPage.tsx | 222 | 89% |
| invoices/InvoiceDetailPage.tsx | 222 | 89% |
| templates/useTemplateForm.ts | 221 | 88% |
| units/UnitsPage.tsx | 220 | 88% |
| lib/api.ts | 218 | 87% |
| products/ProductDetailPage.tsx | 218 | 87% |
| payments/PaymentsPage.tsx | 216 | 86% |
| settings/useRoleBuilder.ts | 215 | 86% |
| hooks/useBiometric.ts | 214 | 86% |
| settings/useCalculator.ts | 213 | 85% |
| products/product-crud.service.ts | 212 | 85% |
| products/StockAdjustModal.tsx | 212 | 85% |
| products/ProductsPage.tsx | 209 | 84% |
| settings/security.service.ts | 208 | 83% |
| reports/InvoiceReportPage.tsx | 208 | 83% |
| payments/payment-calculation.utils.ts | 208 | 83% |
| parties/PartyTransactionsTab.tsx | 208 | 83% |
| settings/AuditLogPage.tsx | 207 | 83% |
| parties/usePartyForm.ts | 207 | 83% |
| products/ProductFormBasic.tsx | 206 | 82% |
| invoices/PartySearchInput.tsx | 205 | 82% |
| ui/PartySearch/PartySearchInput.tsx | 203 | 81% |
| invoices/LineItemEditor.tsx | 200 | 80% |

## App Hotspots (30d churn)
| Rank | File | Churn |
|------|------|-------|
| 1 | config/routes.config.ts | 9 |
| 2 | dashboard/DashboardPage.tsx | 8 |
| 3 | layout/BottomNav.tsx | 8 |
| 4 | dashboard/dashboard.utils.ts | 7 |
| 5 | dashboard/RecentActivityFeed.tsx | 7 |
| 6 | products/ProductsPage.tsx | 6 |
| 7 | invoices/CreateInvoicePage.tsx | 6 |
| 8 | dashboard/DashboardHeader.tsx | 6 |
| 9 | lib/api.ts | 5 |
| 10 | reports/ReportsHubPage.tsx | 5 |

## i18n Gaps (app only)
10 hardcoded strings across app components. Mostly in admin/coupons and feedback.

## Recommendations
1. **invoice.constants.ts (249)** — about to breach. Split by document type or section.
2. **Invoices feature has 10 files in warning zone** — heaviest feature. Consider extracting shared invoice utils.
3. **RecurringCreateDrawer (251)** — extract validation or form section.
4. **Dashboard cluster** — 4 files with high churn. Stabilize before they grow.
5. **Duplicate PartySearchInput** — exists in both `components/ui/` and `invoices/components/`. Consolidate.
