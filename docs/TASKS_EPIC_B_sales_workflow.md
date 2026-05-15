---
epic: phase-5-epic-b-sales-workflow
status: in-progress
created: 2026-05-14T19:57:00Z
verifier_gates: [backend-curl-proofs, frontend-screenshots, tsc-clean, enforce-offline]
---

# TASKS — Phase 5 Epic B: Sales Workflow

Workflow enforced: Backend → Frontend → Verifier → QA per PR. Security audit findings integrated as must-fix items.

**Cross-cutting prerequisites (one-time, before PR1):**
- Confirm `prisma generate` clean (no schema changes in earlier work) ✓ CLEAN
- `.claude/design-plan-active.md` is approved ✓ APPROVED (status: approved)

---

## PR1 — Sales Pipeline FE + Lineage API

**Scope:** New `GET /api/documents/:id/lineage` endpoint. Routes + list/detail pages for Estimates, Sale Orders, Delivery Challans. Shared form engine + PipelineTimeline widget.

**Must-fix from Security:** 1.1 (every hop scoped by businessId), 1.3 (depth cap 6 with counter).

### Backend Tasks

#### B-PR1-T1: Lineage Service
- **ID:** B-PR1-T1
- **Owner:** backend
- **Files:** `server/src/services/document/lineage.ts`, `server/src/services/document/__tests__/lineage.test.ts`
- **Acceptance proof:**
  - `curl -H "Authorization: Bearer $TOKEN" GET /api/documents/{estimate_id}/lineage` → `{ source: null, self: {...}, convertedTo: { type: 'SALE_ORDER' }, chain: [...] }`
  - Test: cross-tenant boundary walk — walk stops at businessId mismatch
  - Hop counter: `for (let i = 0; i < 6)`, NOT `while`
- **Blocker chain:** blocks FE-PR1-T5
- **Time:** M

#### B-PR1-T2: Extend Document Routes + Schema
- **ID:** B-PR1-T2
- **Owner:** backend
- **Files:** `server/src/routes/documents.routes.ts`, `server/src/schemas/document.schemas.ts`
- **Acceptance proof:**
  - `curl -H "Authorization: Bearer $TOKEN" GET /api/documents?type=ESTIMATE` → `{ success: true, data: { documents: [...] } }`
  - Regression: `curl POST /api/documents/{already_converted_id}/convert` → `400` with `"Document has already been converted"`
  - `curl GET /api/documents/{id}` (unauth) → `401`
- **Blocker chain:** blocks FE-PR1-T1, FE-PR1-T2
- **Time:** S

#### B-PR1-T3: i18n (Backend labels)
- **ID:** B-PR1-T3
- **Owner:** backend
- **Files:** none (backend doesn't have i18n; FE owns this — moved to FE-PR1-T8)
- **Acceptance proof:** N/A
- **Blocker chain:** —
- **Time:** N/A

**Verifier gate after B-PR1:**
- tsc clean: `npm run tsc:check` on `server/`
- curl GET /api/documents?type=ESTIMATE → 200
- curl GET /api/documents/{estimate_id}/lineage → 200 with { source, convertedTo }
- curl POST /api/documents/{id}/convert → 201
- curl (unauth) → 401
- curl convert-already-converted → 400

---

### Frontend Tasks

#### FE-PR1-T1: Sales Types + Constants + Utils
- **ID:** FE-PR1-T1
- **Owner:** DudhHisaab-Frontend-Builder
- **Files:** `src/features/sales/sales.types.ts`, `src/features/sales/sales.constants.ts`, `src/features/sales/sales.utils.ts`
- **Acceptance proof:** Import in other FE tasks succeeds; type inference works (tsc clean)
- **Blocker chain:** blocks FE-PR1-T2, FE-PR1-T5, FE-PR1-T6, FE-PR1-T7
- **Time:** S

#### FE-PR1-T2: Hooks (useDocumentList, useDocumentLineage, sales-list.service, sales-lineage.service)
- **ID:** FE-PR1-T2
- **Owner:** DudhHisaab-Frontend-Builder
- **Files:** `src/features/sales/useDocumentList.ts`, `src/features/sales/useDocumentLineage.ts`, `src/features/sales/sales-list.service.ts`, `src/features/sales/sales-lineage.service.ts`
- **Acceptance proof:** Services call `api()` with correct params; hooks return typed results; offline rule: entityType + entityLabel passed
- **Blocker chain:** blocks FE-PR1-T3
- **Time:** M

#### FE-PR1-T3: Components (DocumentListCard, DocumentListFilterBar, DocumentListSkeleton, DocumentEmptyState)
- **ID:** FE-PR1-T3
- **Owner:** DudhHisaab-Frontend-Builder
- **Files:** `src/features/sales/components/DocumentListCard.tsx`, `src/features/sales/components/DocumentListFilterBar.tsx`, `src/features/sales/components/DocumentListSkeleton.tsx`, `src/features/sales/components/DocumentEmptyState.tsx`
- **Acceptance proof:** Import in list pages works; 4 UI states renderable; no console errors
- **Blocker chain:** blocks FE-PR1-T4
- **Time:** M

#### FE-PR1-T4: PipelineTimeline Component
- **ID:** FE-PR1-T4
- **Owner:** DudhHisaab-Frontend-Builder
- **Files:** `src/features/sales/components/PipelineTimeline.tsx`, `src/features/sales/components/PipelineTimeline.css`
- **Acceptance proof:** Consumes lineage hook output; renders 3-step chain (EST → SO → INV) correctly; tap to navigate wired; loading/empty states match spec
- **Blocker chain:** blocks FE-PR1-T7
- **Time:** M

#### FE-PR1-T5: DocumentListPage + Per-Type Wrappers (EstimatesPage, SaleOrdersPage, DeliveryChallansPage)
- **ID:** FE-PR1-T5
- **Owner:** DudhHisaab-Frontend-Builder
- **Files:** `src/features/sales/DocumentListPage.tsx`, `src/features/sales/EstimatesPage.tsx`, `src/features/sales/SaleOrdersPage.tsx`, `src/features/sales/DeliveryChallansPage.tsx`, `src/features/sales/SalesHubPage.tsx`
- **Acceptance proof:**
  - Screenshot: EstimatesPage loading state (shimmer cards)
  - Screenshot: EstimatesPage empty state ("No estimates yet...")
  - Screenshot: EstimatesPage error state (retry button)
  - Screenshot: EstimatesPage success state (list cards, filter bar, summary)
  - Same 4 states for SaleOrdersPage and DeliveryChallansPage
  - No overflow at 375px or 320px
  - console.error count = 0 (no unhandled promise rejections)
- **Blocker chain:** blocks FE-PR1-T7 (nav integration)
- **Time:** L

#### FE-PR1-T6: Form Integration (CreateInvoicePage, EditInvoicePage type param, InvoiceDetailPage mount PipelineTimeline)
- **ID:** FE-PR1-T6
- **Owner:** DudhHisaab-Frontend-Builder
- **Files:** `src/features/invoices/CreateInvoicePage.tsx` (+~30 LOC), `src/features/invoices/EditInvoicePage.tsx` (+~20 LOC), `src/features/invoices/InvoiceDetailPage.tsx` (+~10 LOC)
- **Acceptance proof:**
  - `<CreateInvoicePage type='ESTIMATE' />` renders without error
  - Form title changes to "Create Estimate"
  - `<CreateInvoicePage type='SALE_ORDER' />` renders; title = "Create Sale Order"
  - InvoiceDetailPage mounts PipelineTimeline; no console errors when lineage empty
  - 375px / 320px overflow check passes
- **Blocker chain:** blocks FE-PR1-T8
- **Time:** M

#### FE-PR1-T7: Detail Pages (EstimateDetailPage, SaleOrderDetailPage, ChallanDetailPage)
- **ID:** FE-PR1-T7
- **Owner:** DudhHisaab-Frontend-Builder
- **Files:** `src/features/sales/EstimateDetailPage.tsx`, `src/features/sales/SaleOrderDetailPage.tsx`, `src/features/sales/ChallanDetailPage.tsx`
- **Acceptance proof:**
  - Screenshot: Estimate detail with PipelineTimeline showing EST-001 → SO-001 → INV-001 (3 steps, current highlighted)
  - Screenshot: ConvertDocumentDrawer on Estimate detail — idle state
  - Screenshot: ConvertDocumentDrawer — converting (spinner)
  - Screenshot: ConvertDocumentDrawer — success (sheet closed, toast visible)
  - Tap "Convert" → converts estimate to SO via `POST /api/documents/{id}/convert`
  - No overflow 375px / 320px
- **Blocker chain:** blocks FE-PR1-T8
- **Time:** L

#### FE-PR1-T8: Router Integration + i18n
- **ID:** FE-PR1-T8
- **Owner:** DudhHisaab-Frontend-Builder
- **Files:** `src/router/routes.tsx`, `src/components/layout/BottomNav.tsx`, `src/translations/en/ext36.ts`, `src/translations/hi/ext36.ts`, `src/features/invoices/components/InvoiceCustomFieldsSection.tsx` (wire into all forms)
- **Acceptance proof:**
  - `/estimates` navigates without 404
  - `/sale-orders` navigates without 404
  - `/delivery-challans` navigates without 404
  - BottomNav "Sales" tab highlights when on any sales route
  - All i18n keys (`estimatesPageTitle`, `saleOrdersPageTitle`, `deliveryChallanPageTitle`, `pipelineStepEst`, etc.) present in both en/ext36.ts and hi/ext36.ts
  - No missing translation errors in console
  - InvoiceCustomFieldsSection on EstimateForm, SaleOrderForm, ChallanForm renders custom fields
- **Blocker chain:** no dependencies
- **Time:** M

**Verifier gate after FE-PR1:**
- tsc clean: `npm run tsc:check` on `src/`
- Screenshots: 4 UI states × 3 list pages (12 total)
- Screenshot: PipelineTimeline 3-step chain
- Screenshot: ConvertDocumentDrawer 3 states
- 375px + 320px overflow: pass
- console.error count: 0
- enforce-offline.mjs: pass (all api() calls have entityType/entityLabel)

---

## PR2 — Price-List Per-Invoice Override (Schema Migration)

**Scope:** Add `Document.priceListId` nullable FK. Accept override on POST/PATCH documents. PriceListOverrideSelector component. Integrates with useLineItemResolver for client-side recalculation.

**Must-fix from Security:** 2.1 (businessId scope on priceList write), 2.2 (Zod .strict + .cuid).

### Backend Tasks

#### B-PR2-T1: Schema Migration
- **ID:** B-PR2-T1
- **Owner:** DudhHisaab-Database-Manager
- **Files:** `server/prisma/schema.prisma` (+3 LOC), `server/prisma/migrations/<ts>_document_price_list_override/migration.sql` (~12 LOC)
- **Acceptance proof:**
  - `npx prisma migrate dev --name document_price_list_override` completes without error
  - `prisma schema validate` passes
  - `sqlite3 app.db "PRAGMA table_info(Document);" | grep priceListId` shows column exists (if using SQLite for local dev)
  - On deployed test DB: `SELECT column_name FROM information_schema.columns WHERE table_name='Document' AND column_name='priceListId';` returns 1 row
- **Blocker chain:** blocks B-PR2-T2
- **Time:** S

#### B-PR2-T2: Document Create/Update Services + Zod Schema
- **ID:** B-PR2-T2
- **Owner:** backend
- **Files:** `server/src/services/document/create.ts` (+~10), `server/src/services/document/update.ts` (+~10), `server/src/services/document/selects.ts` (+~3), `server/src/schemas/document.schemas.ts` (+~6, with `.strict()` + `.cuid()`)
- **Acceptance proof:**
  - MUST-FIX 2.1: `const pl = await prisma.priceList.findFirst({ where: { id: data.priceListId, businessId } })` check in BOTH create.ts and update.ts, throws notFoundError if missing
  - MUST-FIX 2.2: Schema has `priceListId: z.string().cuid().nullable().optional()` AND parent schema uses `.strict()`
  - `curl POST /api/documents -d '{ priceListId: "cm...valid-cuid" }' with auth` → 201, document.priceListId = that CUID
  - `curl POST with valid-uuid-string` → 400 (Zod rejection: not a valid CUID)
  - `curl POST from Tenant A with Tenant B's priceListId` → 404 or 400 (notFoundError('Price list'))
  - `curl PATCH /api/documents/{id} -d '{ priceListId: "cm..." }'` → 200, document updated
- **Blocker chain:** blocks FE-PR2-T1
- **Time:** M

#### B-PR2-T3: Unit Test (cross-tenant isolation)
- **ID:** B-PR2-T3
- **Owner:** backend
- **Files:** `server/src/services/document/__tests__/price-list-override.test.ts` (~140 LOC)
- **Acceptance proof:**
  - Test: `it('rejects priceListId from different business')` — Tenant A tries to create doc with Tenant B's list, expects 404
  - Test: `it('persists priceListId on create')` — create with valid own-business list, document.priceListId matches
  - Test: `it('updates priceListId on patch')` — PATCH changes the override to a different list, verifies in SELECT response
  - All tests pass: `npm test -- price-list-override.test.ts`
- **Blocker chain:** no dependency (parallel to B-PR2-T2)
- **Time:** M

**Verifier gate after B-PR2:**
- tsc clean (server)
- curl POST /api/documents with priceListId → 201 with field populated
- curl POST with Tenant B priceListId → 404 (tenant boundary enforced)
- curl PATCH → 200 with updated priceListId
- curl (no auth) → 401

---

### Frontend Tasks

#### FE-PR2-T1: Price-List Override Hook + Component
- **ID:** FE-PR2-T1
- **Owner:** DudhHisaab-Frontend-Builder
- **Files:** `src/features/pricing/usePriceListOverride.ts` (~120 LOC), `src/features/pricing/components/PriceListOverrideSelector.tsx` (~210 LOC), `src/features/pricing/components/PriceListOverrideSelector.css` (~70 LOC)
- **Acceptance proof:**
  - Hook returns `{ selectedListId, setListId, availableLists, partyDefaultListId }`
  - Component renders chip: "Tier: Wholesale ▼" (or hidden if no lists defined)
  - On tap: list picker opens
  - On selection: chip updates to selected tier, `setListId` called
  - Reset icon clears override → falls back to party default
  - Selector uses `api()` to fetch lists; offline-capable
  - No console errors
- **Blocker chain:** blocks FE-PR2-T2
- **Time:** M

#### FE-PR2-T2: Form Integration (EditInvoiceForm + useInvoiceForm + useLineItemResolver)
- **ID:** FE-PR2-T2
- **Owner:** DudhHisaab-Frontend-Builder
- **Files:** `src/features/invoices/components/EditInvoiceForm.tsx` (+~20), `src/features/invoices/useInvoiceForm.ts` (+~25), `src/features/invoices/components/useLineItemResolver.ts` (+~15), `src/features/invoices/invoice-form.types.ts` (+~5), `src/features/invoices/invoice-api.types.ts` (+~5)
- **Acceptance proof:**
  - Screenshot: CreateInvoice form with PriceListOverrideSelector chip below party search (default tier shown)
  - Tap chip → picker opens, select different tier
  - Screenshot: Chip now shows selected tier; line item prices RECALCULATE client-side (use values from new list)
  - Tap reset icon → prices revert to party default tier
  - Submitting form sends `priceListId` in POST body (from form state)
  - 375px / 320px overflow check passes
  - console.error count = 0
- **Blocker chain:** no dependencies (parallel to FE-PR2-T3)
- **Time:** M

#### FE-PR2-T3: i18n
- **ID:** FE-PR2-T3
- **Owner:** DudhHisaab-Frontend-Builder
- **Files:** `src/translations/en/ext36.ts` (+~15), `src/translations/hi/ext36.ts` (+~15)
- **Acceptance proof:**
  - Keys: `priceListOverrideLabel`, `priceListOverrideHint`, `tierResetIcon` present in both en and hi
  - No missing translation console errors
- **Blocker chain:** no dependency
- **Time:** S

**Verifier gate after FE-PR2:**
- tsc clean (client)
- Screenshots: 3 states of override selector (default, overridden, reset)
- 375px / 320px overflow: pass
- console.error count: 0
- enforce-offline.mjs: pass

---

## PR3 — BOGO Custom-Role Wiring

**Scope:** Update `useBogoPermission` hook to check `permissions.includes('invoicing.bogo')` in addition to `role === 'owner'`. Extend `BusinessSummary` type to include permissions array.

**Must-fix from Security:** 3.2 (BusinessSummary.permissions field required).

### Backend Tasks

#### B-PR3-T1: Project permissions into BusinessSummary (auth response)
- **ID:** B-PR3-T1
- **Owner:** backend
- **Files:** `server/src/services/auth.service.ts` or wherever businesses-list response is hydrated
- **Acceptance proof:**
  - `curl GET /api/me -H "Authorization: Bearer $TOKEN"` → response includes `businesses[0].permissions: ['invoicing.bogo', ...]`
  - Custom-role staff with `invoicing.bogo` perm included in array
  - Custom-role staff without perm: `permissions: []` (not null)
  - `tsc --noEmit` clean
- **Blocker chain:** blocks FE-PR3-T1
- **Time:** S

### Frontend Tasks

#### FE-PR3-T1: Update useBogoPermission Hook + Test
- **ID:** FE-PR3-T1
- **Owner:** DudhHisaab-Frontend-Builder
- **Files:** `src/features/invoices/useBogoPermission.ts` (+~12), `src/features/invoices/__tests__/useBogoPermission.test.ts` (~80 LOC)
- **Acceptance proof:**
  - MUST-FIX 3.2: Hook reads `current.permissions?.includes('invoicing.bogo')`
  - Test: custom-role with `permissions = ['invoicing.bogo']` → returns true
  - Test: custom-role with `permissions = []` → returns false
  - Test: owner role → returns true (existing path)
  - All tests pass: `npm test -- useBogoPermission.test.ts`
  - LineItemEditor free-item toggle now visible to custom-role staff with perm
  - No console errors
- **Blocker chain:** no dependencies
- **Time:** S

#### FE-PR3-T2: Update BusinessSummary Type
- **ID:** FE-PR3-T2
- **Owner:** DudhHisaab-Frontend-Builder
- **Files:** `src/features/auth/auth.types.ts` (+~5)
- **Acceptance proof:**
  - `BusinessSummary.permissions: string[]` field exists in type definition
  - Type exports cleanly: `import { BusinessSummary } from '@/features/auth'`
  - `tsc --noEmit` clean
- **Blocker chain:** blocks FE-PR3-T1
- **Time:** S

**Verifier gate after FE-PR3:**
- tsc clean
- Screenshot: LineItemEditor with free-item toggle visible (custom-role + invoicing.bogo)
- Screenshot: LineItemEditor toggle hidden (custom-role without perm)
- Test: `npm test -- useBogoPermission.test.ts` all pass
- console.error count: 0

---

## PR4 — Custom Fields PDF Rendering

**Scope:** Add custom-fields block to PDF output for all document types. Filter by `showOnInvoice = true` and `businessId`. Render after line-items table, before totals.

**Must-fix from Security:** 4.1 (showOnInvoice + businessId filters), 4.3 (NUMBER/DATE formatting).

### Backend Tasks

#### B-PR4-T1: Custom-Fields PDF Service
- **ID:** B-PR4-T1
- **Owner:** backend
- **Files:** `server/src/services/pdf/custom-fields-block.ts` (~120 LOC), `server/src/services/pdf/custom-fields-block.types.ts` (~40 LOC), `server/src/services/pdf/__tests__/custom-fields-block.test.ts` (~110 LOC)
- **Acceptance proof:**
  - MUST-FIX 4.1: `prisma.documentCustomFieldValue.findMany({ where: { documentId, businessId, fieldDef: { showOnInvoice: true } } })`
  - Block renders fields sorted by fieldDef.sortOrder
  - MUST-FIX 4.3: NUMBER fields formatted with Indian grouping (1,00,000); DATE fields use locale-aware format
  - Empty/null values skipped (no blank rows)
  - Test: cross-tenant isolation — query stops at businessId boundary
  - Test: showOnInvoice=false fields excluded
  - All tests pass: `npm test -- custom-fields-block.test.ts`
- **Blocker chain:** blocks B-PR4-T2
- **Time:** M

#### B-PR4-T2: PDF Service Integration
- **ID:** B-PR4-T2
- **Owner:** backend
- **Files:** `server/src/services/pdf.service.ts` (+~25)
- **Acceptance proof:**
  - `pdf.service.ts` calls custom-fields-block service after line-items table
  - Block inserted before totals row in PDF HTML structure
  - `npm test -- pdf.service.test.ts` all pass
  - `tsc --noEmit` clean
- **Blocker chain:** no dependency (parallel to B-PR4-T1)
- **Time:** S

#### B-PR4-T3: Manual PDF Verification
- **ID:** B-PR4-T3
- **Owner:** backend
- **Files:** none (manual test)
- **Acceptance proof:**
  - Create a document (Estimate/Invoice) with custom fields where `showOnInvoice = true`
  - Generate PDF from `/api/documents/{id}/pdf`
  - Download and open PDF
  - Verify: custom fields appear after line-items, before totals
  - Create a document with a custom field where `showOnInvoice = false`
  - Generate PDF
  - Verify: that field does NOT appear in output
- **Blocker chain:** blocks QA
- **Time:** S

### Frontend Tasks

#### FE-PR4-T1: Document Form Custom-Fields Section
- **ID:** FE-PR4-T1
- **Owner:** DudhHisaab-Frontend-Builder
- **Files:** `src/features/invoices/components/InvoiceCustomFieldsSection.tsx` (+~10)
- **Acceptance proof:**
  - Component now accepts `documentType` prop (ESTIMATE | SALE_ORDER | DELIVERY_CHALLAN | SALE_INVOICE)
  - Query filters fields by documentType from server response
  - Required fields show asterisk, form submit blocked if missing
  - Section hidden if no fields defined for this type
  - Screenshot: CreateEstimatePage with custom fields section rendered
  - 375px / 320px overflow pass
  - No console errors
- **Blocker chain:** no dependency
- **Time:** S

**Verifier gate after FE-PR4:**
- tsc clean
- Screenshot: Custom fields on invoice PDF visible after line items
- Screenshot: Custom fields on estimate PDF visible
- 375px / 320px overflow: pass
- console.error count: 0

---

## QA Validation (All PRs)

Once all backend/frontend verifiers pass, QA agent validates acceptance criteria:

#### QA-T1: Sales Pipeline E2E
- Create Estimate EST-001 → Convert to Sale Order SO-001 → Convert to Invoice INV-001
- Verify: source document status = CONVERTED; cannot convert twice
- Verify: PipelineTimeline shows all 3 steps; tap to navigate works
- Verify: offline queue shows entityType='document', entityLabel='EST-001'

#### QA-T2: Price-List Override
- Create invoice with Party A (default tier = Wholesale)
- Override to Retail tier on form
- Verify: line item prices recalculate to Retail rates
- Reset override → prices revert to Wholesale
- Re-override to a different tier → prices update again
- Verify offline queue metadata is correct

#### QA-T3: BOGO Permissions
- Login as custom-role staff with `invoicing.bogo` permission
- Open invoice form → free-item toggle visible on line editor
- Toggle free item → grandTotal excludes that line
- PDF renders item with ₹0 subtotal
- Stock decrements for free line
- Login as staff WITHOUT perm → toggle hidden (cannot toggle)
- Server rejects free-item request from non-permitted user

#### QA-T4: Custom Fields PDF
- Create custom field "Delivery Terms" with `showOnInvoice = true`
- Create Challan, fill field
- Generate PDF → field appears after line-items
- Create field "Internal Notes" with `showOnInvoice = false`
- Fill field, generate PDF → field does NOT appear
- Verify NUMBER fields use Indian formatting (1,00,000)
- Verify DATE fields use locale-aware format

#### QA-T5: Navigation + UI States
- All 4 states (loading/empty/error/success) visible on EstimatesPage, SaleOrdersPage, DeliveryChallansPage
- No 404 errors on `/estimates`, `/sale-orders`, `/delivery-challans`
- BottomNav "Sales" tab correct highlight behavior
- All i18n keys in English and Hindi

**Final QA Gate:** All 5 acceptance bundles pass → Epic closes with APPROVED status.

---

## Cross-Epic Risks & Rollout

| Risk | Mitigation |
|------|-----------|
| PR2 schema migration on large Document table | Additive nullable FK = metadata-only, <100ms lock time. Deploy BE before FE. Rollback = `DROP COLUMN` if needed. |
| PR1 lineage performance (6 hops × Prisma) | Hard cap at 6, each hop indexed. Worst ~60ms. No DataLoader needed. |
| PR3 auth.types extension (permissions field) | Backwards-compatible: staff without custom roles get `permissions: []`. Owner role unaffected. |
| FE type-prop coupling on shared form | Smoke test added: `<CreateInvoicePage type={...} />` renders for each type. |

**Feature flags (rollout):**
- `FEATURE_SALES_PIPELINE` (PR1) — 10% → 50% → 100%
- `FEATURE_PRICE_LIST_OVERRIDE` (PR2) — 10% → 50% → 100%
- PR3, PR4 — no flag (backwards-compatible changes)

---

## Summary (470 LOC)

**Total tasks:** 26 (10 backend, 13 frontend, 3 QA)
**Critical dependencies:** B-PR1-T1 → FE-PR1-T5; B-PR2-T1 → B-PR2-T2 → FE-PR2-T1 → FE-PR2-T2
**Per-PR gates:** Backend curl proof → Frontend screenshot proof → tsc clean + enforce-offline → QA sign-off
**Estimated time:** PR1 (3d), PR2 (2d), PR3 (0.5d), PR4 (1.5d) = 7 days serial; 4 days parallel

