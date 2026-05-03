---
status: approved
feature: gst-phase-2
created: 2026-05-03T23:51:00Z
approver: Sawan
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
  - server/src/lib/env.ts
  - server/src/config/secrets.nic.ts
  - server/src/services/einvoice/einvoice.service.ts
  - server/src/services/ewaybill/ewaybill.service.ts
agents_invoked:
  - scope-writer (output: docs/SCOPE_gst_phase_2.md)
  - architect (output: docs/ARCHITECTURE_gst_phase_2.md)
  - security (output: docs/SECURITY_AUDIT_gst_phase_2.md)
  - task-manager (output: docs/TASKS_gst_phase_2.md)
acceptance:
  backend:
    - tsc clean across server + client
    - all 22 curl proofs collected (per Architecture §12)
    - all 5 security MB curl proofs collected (per Security §12)
  frontend:
    - all screenshots: loading, error, empty, success per new screen
    - 320px verified on all new screens
    - dark theme verified across all new screens
---

# GST Phase 2 — Implementation Task Plan (v7)

## Executive Summary

12 PRs, ~140 hours, critical path 1 → 2 → 3 → 4 (foundation) then 5/7/8/9 in parallel, with 10/11/12 completing the release. Architecture document is the source of truth for technical design; this document decomposes it into concrete per-PR tasks, acceptance gates, and merge blockers.

**All money is paise (integer). All rates are basis points (1800 = 18.00%). All dates are UTC, persisted as ISO 8601 strings, displayed in Asia/Kolkata (India Standard Time).**

---

## Proof Gate Matrix

### Per-PR Backend Proof Requirements

| PR # | PR Name | Route(s) | Curl Proof | Idempotency | Rate Limit | Security | Status |
|------|---------|----------|-----------|-------------|-----------|----------|--------|
| 1 | schema | — | prisma migrate clean ✓ | — | — | — | ✓ |
| 2 | gst-settings | PATCH /api/gst/settings | 200 gstEnabled flipped ✓ | yes (latest-write) | — | audit log ✓ |  |
| 3 | tax-engine | POST /api/invoices | intra (CGST+SGST) ✓, inter (IGST) ✓, composition (0) ✓, inclusive (backCalc) ✓ | yes (existing) | — | — |  |
| 4 | invoice-form-ui | POST /api/invoices | same as #3 (no new routes) | yes (existing) | — | — |  |
| 5 | templates | — | (no routes, rendering only) | — | — | — |  |
| 6 | composition-rcm | POST /api/invoices | rcm document, composition totals ✓ | yes (existing) | — | — |  |
| 7 | backfill-wizard | POST /api/gst/backfill/{preview,execute,status} | preview 200 ✓, execute 201 ✓, idempotency replay 200 ✓, status polling ✓ | yes (execute key + middleware) | 1/hr per user ✓ | AuditLog per-doc ✓ |  |
| 8 | e-invoice | POST /api/einvoice/{generate,cancel}, GET /api/einvoice/:id | generate 201 ✓, duplicate 200 ✓, cancel >24h 400 ✓, NIC 502 ✓, quota 429 ✓ | yes (documentId unique + middleware) | 10/s, 1000/day ✓ | **MB-1 to MB-5** |  |
| 9 | e-way-bill | POST /api/ewaybill/{generate,cancel,update-partb}, GET /api/ewaybill/:id | generate intra 400 threshold ✓, inter ≥50k 201 ✓, cancel 24h ✓, partB append ✓ | yes (documentId unique + middleware) | 10/s ✓ | MB-1 to MB-5 |  |
| 10 | gstr-1 | GET /api/gst/returns/GSTR1/:period, POST export | 200 b2b/b2cl/b2cs/cdnr/cdnur/hsn/nil ✓, export JSON ✓, CSV ✓, amounts in rupees ✓ | yes (export write) | 5/min ✓ | none new |  |
| 11 | gstr-3b | GET /api/gst/returns/GSTR3B/:period, POST export | 200 all 11 rows ✓, export ✓ | yes (export write) | 5/min ✓ | none new |  |
| 12 | polish | — | (no new routes, feature flag remove) | — | — | — |  |

### Per-PR Frontend Proof Requirements

| PR # | PR Name | Screens | Screenshot Proofs (load/error/empty/success) | 320px | 375px | Dark | Status |
|------|---------|---------|------|------|-------|------|--------|
| 2 | gst-settings | GstSettingsPage | 4 per theme ✓ | ✓ | ✓ | ✓ |  |
| 4 | invoice-form-ui | InvoiceForm (tax column) | 4 per theme, HSN search, POS selector, RCM toggle, inclusive chip ✓ | ✓ | ✓ | ✓ |  |
| 5 | templates | InvoiceRenderer tax block, declaration block | 4 per theme (A4, A5, 80mm, 58mm thermal) ✓ | ✓ | ✓ | ✓ |  |
| 6 | composition-rcm | InvoiceForm (composition mode) | 4 per theme (tax hidden, Bill of Supply label) ✓ | ✓ | ✓ | ✓ |  |
| 7 | backfill-wizard | BackfillWizardPage | 5 steps each at 320px ✓, progress polling ✓ | ✓ | — | ✓ |  |
| 8 | e-invoice | EInvoiceCard, EInvoiceCancelDialog | card: not-generated / loading / error / success / cancel-window ✓, dialog: cancel form ✓ | ✓ | ✓ | ✓ |  |
| 9 | e-way-bill | EWayBillModal, EWayBillCard, PartB dialog | modal: load / error / empty / success, partB: update flow ✓ | ✓ | ✓ | ✓ |  |
| 10 | gstr-1 | Gstr1Page, export UI | load / error / empty (no docs) / success ✓, export button states ✓ | ✓ | ✓ | ✓ |  |
| 11 | gstr-3b | Gstr3bPage, export UI | load / error / empty / success ✓, summary rows visible ✓ | ✓ | ✓ | ✓ |  |
| 12 | polish | All screens | final 320px audit (no h-scroll anywhere) ✓, dark mode QA ✓, copy review ✓ | ✓ | — | ✓ |  |

---

## PR 1: Schema Migration & UQC Seed

### Title & Branch
**Title:** `gst(schema): add 6 GST fields + UQC seed`  
**Branch:** `gst/schema-migration`

### Scope Summary
Additive schema changes: `Business.gstEnabled`, `Business.taxPricingMode`, `Business.gstDeclarationText`, `DocumentSettings.taxPricingMode`, `Document.taxPricingMode`, `HsnCode.uqc`. One migration SQL file, one idempotent seed script. No code changes.

### Files Touched
**Migrations:**
- `server/prisma/migrations/<ts>_gst_phase_2_fields/migration.sql` (new)
- `server/prisma/migrations/<ts>_gst_phase_2_fields/migration.lock` (generated)
- `server/prisma/seed.gst.uqc.ts` (new idempotent UQC seed)

**Schema:**
- `server/prisma/schema.prisma` (6 ADD COLUMN statements)

### Backend Tasks
1. Create migration file with 6 `ALTER TABLE ADD COLUMN ... NOT NULL DEFAULT <value>` statements per Architecture §1.1.
2. Add backfill UPDATE for `Business.gstEnabled = true WHERE gstin IS NOT NULL` in same migration.
3. Write idempotent `seed.gst.uqc.ts` (UPSERT by HSN chapter, no duplicates on re-run).
4. Add `-- DOWN` comment block with inverse `DROP COLUMN` statements (documentation only; Prisma doesn't execute).
5. Regenerate Prisma client: `npx prisma generate`.
6. Run locally: `npx prisma migrate dev --name gst_phase_2_fields` on a fresh test DB (no existing data).
7. Verify no data loss, no locks, migration completes in <5 seconds.

### Frontend Tasks
None — schema-only PR.

### Acceptance / Proof Gates

**Backend:**
- `tsc --noEmit` clean (server + client)
- `npx prisma migrate dev --name gst_phase_2_fields` succeeds on fresh DB
- Schema compiled into Prisma client, `Business.gstEnabled` available in type hints
- `npm run seed` idempotent — running twice produces same DB state
- Rollback manual SQL (in `-- DOWN` comments) documented

**Security:**
- No `db push` used (blocked by pre-commit hook)
- Migration is immutable once merged

**Estimated size:** Tiny (3 files, ~150 lines SQL + 80 lines seed)

### Merge Blockers
None specific to PR #1. Security audit §8 (Migration Safety) is satisfied.

### Dependencies
None — this is the foundation.

---

## PR 2: GST Settings Page & Opt-In Gate

### Title & Branch
**Title:** `gst(settings): enable GST opt-in, auto-flip on GSTIN save`  
**Branch:** `gst/settings-optingate`

### Scope Summary
Extends `PATCH /api/gst/settings` to accept all 7 fields (gstin, gstEnabled, taxPricingMode, compositionScheme, compositionRate, eInvoiceEnabled, eWayBillEnabled, gstDeclarationText). Implements auto-flip rule: when GSTIN is saved, server sets `gstEnabled = true`. Adds `useGstGate()` hook for app-level gate. Wires GST settings page and audit logging.

### Files Touched
**Server:**
- `server/src/services/gst-settings.service.ts` (new, 150 lines)
- `server/src/routes/gst-settings.route.ts` (extend existing, +50 lines)
- `server/src/middleware/validate-gst-settings.ts` (new Zod schema, 80 lines)

**Client:**
- `src/features/gst/GstSettingsPage.tsx` (move + extend from tax/, +100 lines for new fields)
- `src/features/gst/useGstSettings.ts` (new, 40 lines)
- `src/features/gst/useGstGate.ts` (new hook, 20 lines)
- `src/features/gst/gst-settings.service.ts` (new client service, 50 lines)
- `src/features/gst/gst.types.ts` (new types, 30 lines)
- `src/app/AppProviders.tsx` (add `<GstSettingsProvider>`, +10 lines)

### Backend Tasks
1. Write `gst-settings.service.ts`: `updateGstSettings(businessId, patch)` which:
   - Validates all fields via Zod schema
   - Auto-flips `gstEnabled = true` if `gstin` is provided AND valid
   - Reads `stateCode` from GSTIN auto-extraction (use existing `extractStateCode()`)
   - Rejects if `eInvoiceEnabled = true` but `gstin = null` (SCOPE §3.2)
   - Returns updated `GstSettings` object
2. Write Zod schema in `validate-gst-settings.ts`: GSTIN 15-char format, composition rate ∈ {100, 500, 600}, turnover slab enums.
3. Mount route `PATCH /api/gst/settings` with:
   - Session auth (existing middleware)
   - CSRF token (existing middleware)
   - Idempotency check (latest-write-wins is OK here — single tenant has one owner)
   - Request body validation
   - `businessId` from session (never from body)
   - AuditLog write: `action: 'GST_SETTINGS_UPDATE'`, `changes: { before: {...}, after: {...} }` with GSTIN masked suffix-4 (Security MB-4)
   - Success response 200 with full `GstSettings` object
4. Extend `GET /api/gst/settings` to return all 7 new fields (was returning only subset before).
5. Add server-side hook `onGstFirstEnabled()`: when `gstEnabled` flips `false → true`, update all templates in that business to set `fields.gstTaxSummary = true`, `fields.gstDeclaration = true`, `columns.hsn.visible = true` (only if currently `undefined`, never overwrite explicit `false`). Run in same transaction as PATCH.

### Frontend Tasks
1. Move `src/features/tax/GstSettingsPage.tsx` to `src/features/gst/GstSettingsPage.tsx` (one-line import update in nav/routes).
2. Extend form to show new fields:
   - `gstEnabled` toggle (main gate)
   - `gstin` input (15-char, format validation on blur)
   - `stateCode` display (read-only, derived from GSTIN)
   - `taxPricingMode` chip selector (EXCLUSIVE / INCLUSIVE)
   - `compositionScheme` toggle
   - `compositionRate` combobox (100 / 500 / 600 only when compositionScheme=true)
   - `gstDeclarationText` textarea (optional, 500 chars)
   - `turnoverSlab` display (informational, not editable in v7)
3. Add validation feedback: orange warning if GSTIN stateCode ≠ business stateCode.
4. Write `useGstSettings()` hook: TanStack Query `useQuery(['gst-settings', businessId])` with `cacheReads: true`, 5-min stale time.
5. Write `useGstGate()` app-level hook: returns `{ gstEnabled, compositionScheme, taxPricingMode, gstin }`, reads from cached TanStack key. Every feature consumes this, never raw fetch.
6. Create `<GstSettingsProvider>` in `AppProviders.tsx`: initializes `useGstSettings()` once, exposes `useGstGate()` to tree.
7. Add "GST" nav entry under Settings, routing to `features/gst/GstSettingsPage`.
8. Screenshot 4 states: toggle off (no tax), toggle on (fields shown), GSTIN error (red), GSTIN valid (green).

### Acceptance / Proof Gates

**Backend:**
```bash
# GET current settings
curl -H "Authorization: Bearer $TOKEN" https://api.local/api/gst/settings
# Expected: 200 with gstEnabled=false (default)

# Enable GST + save GSTIN
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"gstin": "29ABCDE1234F1Z5"}' \
  https://api.local/api/gst/settings
# Expected: 200, gstEnabled auto-flipped to true, stateCode=29

# GET again
curl -H "Authorization: Bearer $TOKEN" https://api.local/api/gst/settings
# Expected: 200 with all 7 fields present

# Bad GSTIN
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"gstin": "invalid"}' \
  https://api.local/api/gst/settings
# Expected: 400 GSTIN_FORMAT_INVALID

# AuditLog verify (grep for masked GSTIN)
# Expected: AuditLog row with action=GST_SETTINGS_UPDATE, changes.after.gstin='XXXXXXXXXXX1Z5'
```

**Frontend:**
- GstSettingsPage loading state (spinner) ✓
- GstSettingsPage error state (GSTIN validation error toast) ✓
- GstSettingsPage empty (toggle off, no tax shown) ✓
- GstSettingsPage success (toggle on, all 7 fields editable) ✓
- Dark theme: form readable on dark BG ✓
- 320px: no form field overflow, stacked labels OK ✓
- 375px: same as above ✓

**Security:**
- GSTIN never echoed raw in response (it's returned as part of GstSettings object)
- Masked GSTIN in AuditLog (Security MB-4 requires this)
- No `businessId` parameter accepted from body (400 if present)
- Cross-tenant test: tenant-A token PATCH'ing tenant-B settings returns 403 / 404

**Estimated size:** Small (8 files, ~400 lines)

### Merge Blockers
None specific to PR #2. Audit log masking (MB-4) required here.

### Dependencies
PR #1 (schema)

---

## PR 3: Tax Engine Extensions (Inclusive, RCM, Composition)

### Title & Branch
**Title:** `gst(tax): backCalculateInclusive + RCM + composition helpers + parity tests`  
**Branch:** `gst/tax-engine`

### Scope Summary
Extends `src/features/tax/tax-calc.utils.ts` and `server/src/services/tax-calc.service.ts` with 4 new helpers: `backCalculateInclusive()`, `applyRcmFlag()`, `calculateCompositionTotals()`. Adds parity test to ensure client + server agree. Invoice route accepts new fields `taxPricingMode`, `isReverseCharge`, `placeOfSupply` in POST/PUT body.

### Files Touched
**Client:**
- `src/features/tax/tax-calc.utils.ts` (+80 lines)
- `src/features/tax/tax.types.ts` (add TaxPricingMode, SupplyType types)
- `src/features/tax/__tests__/tax-calc.parity.test.ts` (new, 100 lines snapshot)
- `src/features/invoices/invoice.types.ts` (extend DocumentResponse with `taxPricingMode`)

**Server:**
- `server/src/services/tax-calc.service.ts` (+80 lines, byte-for-byte mirror of client)
- `server/src/lib/gstin.utils.ts` (verify `determineSupplyType` is correct, already exists)
- `server/src/routes/invoices.route.ts` (extend POST/PUT to accept new fields, +30 lines)

### Backend Tasks
1. In `tax-calc.service.ts`, add four new export functions matching client:
   ```ts
   function backCalculateInclusive(lineTotal: number, gstRateBP: number): { taxableValue: number; gstAmount: number }
   function applyRcmFlag(summary: DocumentTaxSummary, isRcm: boolean): DocumentTaxSummary
   function calculateCompositionTotals(lines: TaxLineInput[], compositionRateBP: number): { taxableTurnover: number; compositionLiability: number }
   ```
2. Server-side invoice POST/PUT handler:
   - Accept body fields: `taxPricingMode`, `isReverseCharge`, `placeOfSupply`, per-line `taxCategoryId`, `hsnCode`, `sacCode`
   - Validate `taxPricingMode ∈ {'EXCLUSIVE', 'INCLUSIVE'}`
   - Validate `placeOfSupply` is a 2-digit state code OR "OOS" (out-of-state)
   - Determine `interState = isInterState(business.stateCode, placeOfSupply)`
   - Determine `supplyType = determineSupplyType(party.gstin, interState, grandTotal)`
   - For each line item:
     - Fetch `TaxCategory` by `taxCategoryId` (or null if untagged)
     - If `taxPricingMode = 'INCLUSIVE'`, back-calculate: `{ taxableValue, gstAmount } = backCalculateInclusive(lineAmount, taxRate)`
     - If `isReverseCharge = true`, compute tax but store in `DocumentLineItem.*Amount` columns for audit, zero out in `Document` totals later
     - If `compositionScheme = true`, skip all tax (return 0s)
   - Compute `Document` totals using `calculateDocumentTax()` (existing), then apply RCM flag if needed
   - Write `Document` with `placeOfSupply`, `supplyType`, `isReverseCharge`, `taxPricingMode` persisted

3. Invoice service must handle the case where `compositionScheme = true` — compute and store the composition liability (1%/5%/6% flat) in a transient field for UI use, but do NOT persist it in `DocumentLineItem` tax columns (never print).
4. Validate that `business.gstEnabled = true` before allowing any GST fields to be set.

### Frontend Tasks
1. Add type definitions to `tax.types.ts`:
   ```ts
   export type TaxPricingMode = 'EXCLUSIVE' | 'INCLUSIVE'
   export type SupplyType = 'B2B' | 'B2C_LARGE' | 'B2C_SMALL' | 'EXPORT' | 'SEZ'
   ```
2. Extend `DocumentResponse` with `taxPricingMode: TaxPricingMode`.
3. Invoice form accepts new hidden fields (will surface in PR #4):
   - `taxPricingMode` (reads from `DocumentSettings.taxPricingMode` default, can be overridden per-document)
   - `placeOfSupply` (required in GST mode, optional in non-GST)
   - `isReverseCharge` (checkbox, hidden when composition mode)
4. Write client-side tax-calc helpers in `tax-calc.utils.ts` (byte-for-byte match server implementation).
5. Add parity test: `tax-calc.parity.test.ts` uses vitest snapshots, tests both `calculateLineTax` and the 4 new helpers with fixed input vectors, runs both client + server versions, asserts identical output.
6. Test vectors must cover:
   - Intra-state 18% (CGST 9% + SGST 9%)
   - Inter-state 18% (IGST 18%)
   - Composition (all 0s)
   - Inclusive 11800 @ 18% (taxableValue=10000, gstAmount=1800)

### Acceptance / Proof Gates

**Backend:**
```bash
# Intra-state invoice (18%, EXCLUSIVE)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documentNumber": "INV-001",
    "placeOfSupply": "29",
    "lines": [{ "productId": "...", "qty": 1, "rate": 10000, "taxCategoryId": "18%", "taxPricingMode": "EXCLUSIVE" }],
    "taxPricingMode": "EXCLUSIVE"
  }' \
  https://api.local/api/invoices
# Expected: 201, totalCgst=900, totalSgst=900, totalIgst=0, totalCess=0

# Inter-state invoice (18%, EXCLUSIVE)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documentNumber": "INV-002",
    "placeOfSupply": "22",
    "lines": [{ "productId": "...", "qty": 1, "rate": 10000, "taxCategoryId": "18%", "taxPricingMode": "EXCLUSIVE" }],
    "taxPricingMode": "EXCLUSIVE"
  }' \
  https://api.local/api/invoices
# Expected: 201, totalCgst=0, totalSgst=0, totalIgst=1800, totalCess=0

# Inclusive pricing (line 11800 @ 18%)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documentNumber": "INV-003",
    "lines": [{ "productId": "...", "qty": 1, "rate": 11800, "taxCategoryId": "18%", "taxPricingMode": "INCLUSIVE" }],
    "taxPricingMode": "INCLUSIVE"
  }' \
  https://api.local/api/invoices
# Expected: 201, line taxableValue=10000, line gstAmount=1800

# Composition scheme business (all taxes 0)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documentNumber": "INV-004",
    "lines": [{ "productId": "...", "qty": 1, "rate": 10000 }]
  }' \
  https://api.local/api/invoices
# Expected: 201, all tax fields = 0

# RCM flag (line totals computed, Document totals = 0)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documentNumber": "INV-005",
    "isReverseCharge": true,
    "lines": [{ "productId": "...", "qty": 1, "rate": 10000, "taxCategoryId": "18%" }]
  }' \
  https://api.local/api/invoices
# Expected: 201, Document totalCgst/Sgst/Igst = 0, but line item has cgstAmount=900, sgstAmount=900 stored for audit
```

**Frontend:**
- No new screens in PR #3 (forms surface in PR #4)
- Parity test passes: `npm run test -- tax-calc.parity.test.ts` ✓

**Security:**
- `business.gstEnabled` must be true to accept GST fields (400 if false)
- `taxPricingMode ∈ {'EXCLUSIVE', 'INCLUSIVE'}`, reject others (400)
- `placeOfSupply` validated as 2-digit state code or "OOS", no free-text (400)

**Estimated size:** Medium (5 files, ~250 lines)

### Merge Blockers
None specific to PR #3.

### Dependencies
PR #1 (schema), PR #2 (gst gate must be working)

---

## PR 4: Invoice Form UI — Tax Picker, HSN Typeahead, Place-of-Supply Selector

### Title & Branch
**Title:** `gst(invoice-form): per-line tax picker + HSN typeahead + POS selector + RCM toggle + inclusive chip`  
**Branch:** `gst/invoice-form-ui`

### Scope Summary
Invoice form gains 5 new UI elements: per-line tax picker column, HSN/SAC typeahead column, place-of-supply selector, RCM toggle, inclusive/exclusive pricing chip. Form is gated on `useGstGate().gstEnabled`. All 4 UI states (loading, error, empty, success) captured at 320px and 375px, light and dark themes.

### Files Touched
**Client:**
- `src/features/invoices/InvoiceForm.tsx` (+150 lines for new fields, conditionally shown based on `gstEnabled`)
- `src/features/invoices/components/TaxPickerColumn.tsx` (new, 80 lines)
- `src/features/invoices/components/HsnTypeahead.tsx` (new, 120 lines)
- `src/features/invoices/components/PlaceOfSupplySelector.tsx` (new, 60 lines)
- `src/features/invoices/components/RcmToggle.tsx` (new, 40 lines)
- `src/features/invoices/components/TaxPricingChip.tsx` (new, 50 lines)
- `src/features/invoices/invoice.types.ts` (extend schema)
- `src/features/invoices/useInvoiceForm.ts` (+30 lines for new field logic)

### Backend Tasks
1. Invoice POST/PUT route already extended in PR #3 to accept the fields — no additional backend work for PR #4.

### Frontend Tasks
1. **TaxPickerColumn** component:
   - Uncontrolled via `react-hook-form` `useFormContext`
   - Reads `tax-categories` from TanStack Query (already cached by PR #2)
   - Renders dropdown with active `TaxCategory` records
   - On selection, sets `form.watch('lines')[i].taxCategoryId` to selected ID
   - If product has `product.taxCategoryId` and line is new, auto-fill on mount
   - Show orange warning badge "Tax not set" if line has `taxCategoryId = null` after user blur (not on every keystroke)
   - Composition mode: hide this column entirely (CSS `hidden` class from `useGstGate().compositionScheme`)

2. **HsnTypeahead** component:
   - Text input field for HSN/SAC code
   - On keystroke (≥4 chars), debounce 250ms, call `useQuery(['hsn-search', q])` to `/api/hsn/search?q=<term>&limit=10`
   - Results render in a portal popover (fixed position, doesn't disrupt row layout)
   - Each result shows `code` + `description` + `default gst rate`
   - Selecting a result sets `form.watch('lines')[i].hsnCode` and auto-switches tax picker to matched rate
   - Only shown when `gstEnabled = true` and `columns.hsn.visible = true`

3. **PlaceOfSupplySelector** component:
   - Conditional render only when `gstEnabled = true`
   - Combobox with all 28 Indian states + "OOS" (out-of-state, for exports)
   - Defaults to business's own state if invoice is intra-state
   - Determines inter-state vs intra-state logic (CGST/SGST vs IGST)
   - Show in invoice header, not per-line

4. **RcmToggle** component:
   - Checkbox "Reverse Charge Mechanism"
   - Only shown when `gstEnabled = true` AND `supplyType = 'B2B'` (not for B2C)
   - When checked, per-line taxes are computed but Document totals are zeroed (server-side enforcement)
   - Show advisory: "Customer will self-assess tax under RCM"

5. **TaxPricingChip** component:
   - Two-option chip selector: "Exclusive (Inc. Tax)" | "Inclusive (MRP)"
   - Shown in invoice header
   - When toggled, all line amounts are back-calculated using `backCalculateInclusive()` (client-side preview)
   - Persisted to `Document.taxPricingMode`

6. Form schema validation (Zod) extended to:
   - `placeOfSupply` required when `gstEnabled = true`, 2-char state code or "OOS"
   - `lines[].taxCategoryId` optional (can be null for untagged products, defaults to Exempt 0%)
   - `taxPricingMode ∈ {'EXCLUSIVE', 'INCLUSIVE'}`

7. Form submission:
   - Before submit, if any line has `taxCategoryId = null`, show confirmation dialog: "Some items have no tax rate set. Continue?"
   - Compose form payload with all new fields
   - Call invoice create/update service

8. **Screenshots** (4 states × 2 themes × 2 breakpoints = 16 images):
   - **Loading:** spinner in tax picker dropdown, HSN search loading, POS selector spinner
   - **Error:** tax category fetch fails (red error message), HSN search 500 error, POS selector error
   - **Empty:** new invoice form, no line items yet, all controls disabled
   - **Success:** fully populated form, tax rates showing, HSN matching, POS selected, RCM checked, pricing chip at INCLUSIVE
   - All at 320px and 375px breakpoints
   - Both light and dark themes

### Acceptance / Proof Gates

**Backend:**
- Same curl proofs as PR #3 (the route accepts the fields; no new proofs needed)

**Frontend:**
- InvoiceForm **loading** state: spinner shows in tax picker, HSN typeahead shows "Searching..." ✓
- InvoiceForm **error** state: fetch fails, toast "Failed to load tax categories" ✓
- InvoiceForm **empty** state: new document, no lines, form pristine ✓
- InvoiceForm **success** state: lines populated, tax rates shown, HSN matched, POS selected ✓
- At **320px:** no horizontal scroll, tax column wraps OK, HSN popover fits in viewport, all fields tappable ✓
- At **375px:** same as above ✓
- **Dark theme:** tax dropdown visible on dark BG, HSN popover readable, input borders visible ✓
- **Composition mode:** tax column hidden, "Bill of Supply" label shown instead ✓
- **RCM mode:** advisory banner shown when B2B + RCM checked ✓
- **Inclusive mode:** line amount back-calculation correct (11800 @ 18% → taxableValue 10000) ✓

**Security:**
- `taxPricingMode` and `placeOfSupply` validated server-side (enforce not optional due to form validation)

**Estimated size:** Medium (9 files, ~400 lines)

### Merge Blockers
None specific to PR #4.

### Dependencies
PR #1 (schema), PR #2 (gst settings), PR #3 (tax engine)

---

## PR 5: Template Engine — gstTaxSummary & gstDeclaration Flags + Render Blocks

### Title & Branch
**Title:** `gst(templates): add gstTaxSummary + gstDeclaration flags, render blocks, Bill of Supply relabel`  
**Branch:** `gst/templates-gst-blocks`

### Scope Summary
Extends `TemplateFieldsConfig` with two new booleans: `gstTaxSummary`, `gstDeclaration`. Adds two render blocks to `InvoiceRenderer`: `<TaxSummaryBlock>` (between subtotal and grand total) and `<GstDeclarationBlock>` (after terms). When GST is first enabled, auto-sets flags to true on all existing templates (only if `undefined`, never overwrites explicit `false`). No new screens or user interactions — purely rendering.

### Files Touched
**Client:**
- `src/features/templates/template.types.ts` (extend TemplateFieldsConfig: add `gstTaxSummary: boolean`, `gstDeclaration: boolean`)
- `src/features/templates/components/InvoiceRenderer.tsx` (+80 lines: insert two new block components)
- `src/features/templates/components/TaxSummaryBlock.tsx` (new, 90 lines)
- `src/features/templates/components/GstDeclarationBlock.tsx` (new, 60 lines)
- `src/features/templates/template.constants.ts` (new, 100 lines: three declaration defaults + RCM appendix)
- `src/features/templates/components/QrCodeBlock.tsx` (extend: update sizing logic per Architecture §6.5)

**Server:**
- `server/src/services/gst-settings.service.ts` (extend `onGstFirstEnabled()` hook to auto-update templates, +40 lines)

### Backend Tasks
1. In `gst-settings.service.ts`, implement `onGstFirstEnabled()` hook:
   ```ts
   async function onGstFirstEnabled(businessId: string, tx: PrismaTransaction) {
     // Find all templates for this business where fields.gstTaxSummary is undefined
     const templates = await tx.templateConfig.findMany({
       where: { business: { id: businessId } }
     })
     for (const tpl of templates) {
       const fields = tpl.fields as any // JSON column
       if (fields.gstTaxSummary === undefined) fields.gstTaxSummary = true
       if (fields.gstDeclaration === undefined) fields.gstDeclaration = true
       if (fields.columns?.hsn?.visible === undefined) fields.columns.hsn.visible = true
       await tx.templateConfig.update({
         where: { id: tpl.id },
         data: { fields }
       })
     }
   }
   ```
2. Call `onGstFirstEnabled()` inside the transaction that updates `Business.gstEnabled = true`.
3. If existing templates have explicit `false` for these flags, respect them (don't overwrite).

### Frontend Tasks
1. Extend `TemplateFieldsConfig` type in `template.types.ts`:
   ```ts
   interface TemplateFieldsConfig {
     // ... existing fields ...
     gstTaxSummary?: boolean    // renders CGST/SGST/IGST subtotals table
     gstDeclaration?: boolean   // renders declaration text block
   }
   ```

2. Create `TaxSummaryBlock` component:
   - Render only if `template.fields.gstTaxSummary === true && (document.totalCgst + totalSgst + totalIgst + totalCess) > 0`
   - Layout per SCOPE §8.2:
     - **Intra-state (CGST+SGST):** two rows
       - `CGST (X%)` `value` (right-aligned)
       - `SGST (X%)` `value`
       - Separator line
       - `Total Tax` `value` (bold)
     - **Inter-state (IGST):** one row
       - `IGST (X%)` `value`
     - **Composition:** no rows, emit literal text "Composition Dealer under GST" in place (centered)
   - Paper size logic:
     - **A4 / A5 / 80mm:** full layout
     - **58mm thermal:** `null` (too narrow, return nothing)
   - Font sizing: standard 11pt, thermal 9pt
   - Use existing `<Row>` / `<Cell>` primitives from `InvoiceRenderer` (do not add new layout primitives)

3. Create `GstDeclarationBlock` component:
   - Render only if `template.fields.gstDeclaration === true`
   - Source of declaration text:
     ```ts
     const declarationText =
       business.gstDeclarationText
       ?? (business.compositionScheme
         ? COMPOSITION_GST_DECLARATION
         : STANDARD_GST_DECLARATION)
     const finalText = declarationText + (document.isReverseCharge ? '\n' + RCM_DECLARATION_APPENDIX : '')
     ```
   - Render as a `<Paragraph>` block, 9pt, left-aligned, with 10mm top margin
   - Constants in `template.constants.ts`:
     ```ts
     export const STANDARD_GST_DECLARATION = 'We hereby certify that...'
     export const COMPOSITION_GST_DECLARATION = 'Composition Scheme Dealer...'
     export const RCM_DECLARATION_APPENDIX = 'This is subject to Reverse Charge...'
     ```

4. Update `QrCodeBlock` sizing logic per Architecture §6.5:
   - Add table mapping paper size → IRN QR size (40mm A4, 35mm A5, 30mm 80mm, hidden 58mm)
   - When both IRN and UPI QR are present, IRN wins (render IRN, not UPI)
   - When only UPI QR, render UPI (backward compatibility for non-GST invoices)

5. Move insertion points in `InvoiceRenderer`:
   - Insert `<TaxSummaryBlock>` between `<SubtotalRow>` and `<GrandTotalRow>` in `<InvoiceFooter>`
   - Insert `<GstDeclarationBlock>` after `<TermsBlock>` in `<InvoicePrintFooter>` (if it exists)
   - Use conditional renders: `{template.fields.gstTaxSummary && <TaxSummaryBlock />}`

6. Default flag values:
   - New templates created after this PR get `gstTaxSummary: true`, `gstDeclaration: true` by default
   - Existing templates gain `undefined` (treated as `false` by conditional render)
   - The `onGstFirstEnabled()` hook (server-side) sets them to `true` when GST is first enabled

7. **Screenshots** (4 states × 4 paper sizes × 2 themes = 32 images, but can consolidate):
   - **Loading:** PDF renderer loading spinner
   - **Error:** no invoice data, error message
   - **Empty:** invoice exists, no tax calculated (gstTaxSummary block doesn't render)
   - **Success:** invoice with CGST/SGST populated, TaxSummaryBlock visible with correct values, declaration text shown
   - Paper sizes: A4 (full layout), A5 (scaled), 80mm thermal (narrow), 58mm thermal (no tax block)
   - Both light and dark themes

### Acceptance / Proof Gates

**Backend:**
- `npm run test -- gst-settings.service.ts` proves `onGstFirstEnabled()` hook sets flags correctly ✓
- Curl PATCH /api/gst/settings → first enable: verify templates auto-updated in DB ✓

**Frontend:**
- InvoiceRenderer **loading:** spinner ✓
- InvoiceRenderer **error:** error text shown ✓
- InvoiceRenderer **empty:** no invoice, no blocks shown ✓
- InvoiceRenderer **success:** CGST/SGST/IGST values shown in TaxSummaryBlock ✓
- **Composition mode:** "Composition Dealer under GST" text shown, not tax rates ✓
- **RCM mode:** RCM appendix text appended to declaration ✓
- **A4 paper:** full layout, QR 40mm ✓
- **80mm thermal:** narrow layout, QR 30mm ✓
- **58mm thermal:** no tax block shown, QR hidden ✓
- **Dark theme:** text visible on dark BG ✓

**Security:**
- Declaration text (from user input in PR #2) sanitized before rendering (React auto-escapes)
- XSS test: GSTIN in declaration text `<img src=x onerror=alert(1)>` must render as plain text ✓

**Estimated size:** Medium (7 files, ~350 lines)

### Merge Blockers
None specific to PR #5.

### Dependencies
PR #1 (schema), PR #2 (gst settings with declaration text field), PR #4 (templates need to know if tax was calculated)

---

## PR 6: Composition Scheme & RCM Polish

### Title & Branch
**Title:** `gst(composition-rcm): composition tax hiding, self-invoice, ITC banner, RCM advisory`  
**Branch:** `gst/composition-rcm`

### Scope Summary
Implements composition scheme UX: hides tax columns when `compositionScheme = true`, relabels invoice to "Bill of Supply", shows ITC unavailable banner, implements self-invoice for unregistered supplier flow. RCM gets an advisory banner and print line. No new routes — all logic is in invoice form, templates, and settings UI.

### Files Touched
**Client:**
- `src/features/invoices/components/CompositionModeIndicator.tsx` (new, 50 lines)
- `src/features/invoices/components/ItcUnavailableBanner.tsx` (new, 40 lines)
- `src/features/invoices/components/RcmAdvisoryBanner.tsx` (new, 40 lines)
- `src/features/invoices/InvoiceForm.tsx` (+30 lines: conditional rendering of tax UI)
- `src/features/templates/components/InvoiceRenderer.tsx` (+20 lines: relabel to "Bill of Supply")
- `src/features/documents/document.types.ts` (extend: add `isComposite: boolean` if missing)

**Server:**
- `server/src/services/invoices.service.ts` (+50 lines: composition scheme logic)

### Backend Tasks
1. In invoice POST/PUT handler:
   - When saving an invoice with `business.compositionScheme = true`:
     - Compute per-line taxes normally (for audit trail)
     - Set `Document.totalCgst = 0`, `totalSgst = 0`, `totalIgst = 0`, `totalCess = 0` (override tax totals)
     - Compute composition liability (1%/5%/6% on grand total) and store in a transient `Document.compositionLiability` field (not persisted, calculated on load for UI)
     - Set `document.isComposite = true`
   - RCM invoices: compute all taxes, but zero-out document totals if `isReverseCharge = true`

2. Invoices service: validate that composition scheme invoices do NOT have line items with tax marked as collected (UI will prevent this, but server validates).

3. Supplier self-assessment: when invoice is from an unregistered supplier (party has no GSTIN, document is intra-state, not self-issued), flag it for potential self-invoice handling (advisory only in v7, not enforced).

### Frontend Tasks
1. **CompositionModeIndicator** component:
   - Show badge "Bill of Supply (Composition Scheme)" in invoice header when `business.compositionScheme = true`
   - Color: orange/amber to distinguish from standard invoices
   - Render in place of normal "Tax Invoice" label

2. **ItcUnavailableBanner** component:
   - Show blue info banner when `business.compositionScheme = true` AND any line item is taxable
   - Text: "ITC is not available under Composition Scheme. This invoice is for informational purposes only."
   - Show only on creation/edit forms, not on printed template (already handled by template flag)

3. **RcmAdvisoryBanner** component:
   - Show blue info banner when `isReverseCharge = true`
   - Text: "Reverse Charge applies to this invoice. Buyer will self-assess GST."
   - Show on creation/edit forms

4. InvoiceForm modifications:
   - When `compositionScheme = true`:
     - Hide all per-line tax picker columns (CSS `hidden`)
     - Hide place-of-supply selector
     - Hide RCM toggle (incompatible with composition)
     - Hide inclusive/exclusive pricing chip (always exclusive)
     - Show `<CompositionModeIndicator>`
     - Show `<ItcUnavailableBanner>` if any line is taxable
   - Invoice document type dropdown: when `compositionScheme = true`, relabel "Invoice" → "Bill of Supply"

5. InvoiceRenderer (template):
   - When rendering document with `isComposite = true`, relabel to "Bill of Supply" (override template's `documentTypeLabel`)
   - Do NOT print any tax rows (template `gstTaxSummary` is still `true`, but the renderer checks `isComposite` and skips the block)
   - Print a single line: "This is a Bill of Supply issued under Composition Scheme"

6. **Screenshots** (4 states × 2 themes = 8 images):
   - **Loading:** composition mode UI loading
   - **Error:** composition scheme toggle fails
   - **Empty:** form pristine, "Bill of Supply" label shown, tax columns hidden
   - **Success:** form filled, composition indicator badge, ITC unavailable banner, no tax rows printed
   - Both light and dark themes

### Acceptance / Proof Gates

**Backend:**
```bash
# Composition scheme invoice
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documentNumber": "BOS-001",
    "lines": [{ "productId": "...", "qty": 1, "rate": 10000 }]
  }' \
  https://api.local/api/invoices
# Expected: 201, totalCgst=0, totalSgst=0, totalIgst=0, isComposite=true
```

**Frontend:**
- InvoiceForm **loading:** spinners show ✓
- InvoiceForm **error:** error toast ✓
- InvoiceForm **empty:** form pristine, "Bill of Supply" label, tax columns hidden ✓
- InvoiceForm **success:** composition indicator badge, ITC banner, no tax columns ✓
- Template **success:** "Bill of Supply" printed, no tax rows ✓
- Dark theme: readable ✓

**Security:**
- Composition scheme toggle validates `business.gstEnabled = true` first

**Estimated size:** Small (7 files, ~200 lines)

### Merge Blockers
None specific to PR #6.

### Dependencies
PR #1 (schema), PR #2 (gst settings), PR #4 (invoice form), PR #5 (templates)

---

## PR 7: Backfill Wizard — 5-Step UI + Preview/Execute Endpoints

### Title & Branch
**Title:** `gst(backfill): 5-step wizard UI, preview + execute endpoints, progress polling, idempotency`  
**Branch:** `gst/backfill-wizard`

### Scope Summary
Implements a 5-step UI state machine for backfilling GST data (products + invoices). Two new endpoints: `POST /api/gst/backfill/preview` (read-only counts) and `POST /api/gst/backfill/execute` (write, with Idempotency-Key middleware). AuditLog captures per-document backfill changes. Step 4 (processing) is non-cancellable.

### Files Touched
**Server:**
- `server/src/services/gst/backfill.service.ts` (new, 200 lines)
- `server/src/routes/gst-backfill.route.ts` (new, 150 lines)
- `server/src/middleware/idempotency.ts` (extend to `/api/gst/backfill/execute`)

**Client:**
- `src/features/gst-returns/BackfillWizardPage.tsx` (new, 300 lines, state machine)
- `src/features/gst-returns/components/BackfillStep1Preview.tsx` (new, 80 lines)
- `src/features/gst-returns/components/BackfillStep2Options.tsx` (new, 100 lines)
- `src/features/gst-returns/components/BackfillStep3Confirmation.tsx` (new, 60 lines)
- `src/features/gst-returns/components/BackfillStep4Processing.tsx` (new, 100 lines, progress bar)
- `src/features/gst-returns/components/BackfillStep5Complete.tsx` (new, 80 lines)
- `src/features/gst-returns/gst-returns.service.ts` (new, 50 lines)
- `src/features/gst-returns/useBackfill.ts` (new hook, 80 lines)

### Backend Tasks
1. Create `backfill.service.ts`:
   ```ts
   async function previewBackfill(businessId: string): Promise<{
     untaggedProductCount: number
     untaggedProductValue: number
     nullPosInvoiceCount: number
     nullPosTaxableValue: number
   }>
   async function executeBackfill(
     businessId: string,
     payload: {
       defaultTaxCategoryId: string
       dateRange: [Date, Date]
       setPositionFromParty: boolean
     },
     idempotencyKey: string
   ): Promise<{ jobId: string }>
   async function getBackfillStatus(businessId: string, jobId: string): Promise<{
     status: 'RUNNING' | 'COMPLETED' | 'INTERRUPTED'
     processed: number
     total: number
     errors: Array<{ documentId: string; error: string }>
   }>
   ```

2. **Preview endpoint** `POST /api/gst/backfill/preview`:
   - Pure read-only query
   - Count untagged products: `Product WHERE taxCategoryId IS NULL AND businessId = {id}`
   - Count null-position invoices: `Document WHERE placeOfSupply IS NULL AND businessId = {id} AND issueDate BETWEEN {range}`
   - Sum taxable values for each
   - Return 200 with counts (no side effects)

3. **Execute endpoint** `POST /api/gst/backfill/execute`:
   - Require Idempotency-Key header (400 if missing)
   - Mount `idempotency` middleware (already used on POST /api/invoices)
   - Replay within 24h returns cached response without re-running
   - Request body: `{ defaultTaxCategoryId, dateRange: [startDate, endDate], setPositionFromParty: boolean }`
   - Start a long-running background job (async, not awaited):
     - Store job status in Redis: `{ status: 'RUNNING', processed: 0, total: N, errors: [] }`
     - For each untagged product: `UPDATE Product SET taxCategoryId = {defaultTaxCategoryId} WHERE ...`
     - For each null-position invoice:
       - If `setPositionFromParty = true`: `UPDATE Document SET placeOfSupply = (SELECT stateCode FROM Party WHERE ...)` 
       - Recompute taxes using `calculateDocumentTax()`
       - Write AuditLog row: `action: 'GST_BACKFILL'`, `entityType: 'Document'`, `changes: { before: {...totals}, after: {...totals} }`
     - Update Redis: `{ status: 'COMPLETED', processed: N, total: N, errors: [...] }`
     - Rate limit: 1 backfill per user per hour (composite Redis key `backfill:{businessId}:{userId}:{YYYY-MM-DD}`)
   - Return 201 with `{ jobId, status: 'RUNNING' }`

4. **Status endpoint** `GET /api/gst/backfill/status/:jobId`:
   - Read Redis job status
   - If status is stale (>2h old heartbeat), mark as INTERRUPTED
   - Return 200 with current status

5. Transaction boundaries (per Architecture §7.4):
   - One transaction per document, NOT per batch
   - If one fails, others continue
   - On error, append to `errors` array and log

6. Failure-resume strategy:
   - Job status persisted in Redis with 7-day TTL
   - If worker crashes, next GET /status detects stale heartbeat
   - Client shows "Resume" button
   - Replay execute with same idempotency key → server skips already-processed docs (detected by existing AuditLog rows)

7. Rate limiting:
   - `express-rate-limit` on POST /api/gst/backfill/execute: 1 req / hour per businessId + userId (composite key)
   - Return 429 RATE_LIMITED if exceeded

### Frontend Tasks
1. **BackfillWizardPage** state machine using `useReducer`:
   ```ts
   type WizardState =
     | { step: 'preview'; data: PreviewRes | null; loading: boolean }
     | { step: 'options'; defaultTaxCategoryId: string; setPosFromParty: boolean; dateRange: [Date, Date] }
     | { step: 'confirmation'; estimate: PreviewRes }
     | { step: 'processing'; jobId: string; progress: { processed: number; total: number } }
     | { step: 'complete'; result: ExecuteRes }
   ```

2. **Step 1 — Preview:**
   - Load preview data on mount: `POST /api/gst/backfill/preview`
   - Display counts:
     - `{untaggedProductCount}` products have no tax category
     - `{nullPosInvoiceCount}` invoices (₹{value}) have no place of supply
   - Button: "Next" (proceed to Step 2)
   - Show spinner during load, error toast on fail

3. **Step 2 — Options:**
   - Dropdown: select default tax category (all active categories)
   - Checkbox: "Set position from party GSTIN state code"
   - Date range picker: "Backfill invoices from {startDate} to {endDate}"
   - Buttons: "Back" (to Step 1), "Next" (to Step 3)

4. **Step 3 — Confirmation:**
   - Summary of Step 2 choices
   - Estimated impact: "{untaggedProductCount} products + {nullPosInvoiceCount} invoices will be updated"
   - Large red button: "Proceed"
   - Buttons: "Back", "Proceed"
   - Show warning: "This action cannot be undone. All changes will be logged to the audit trail."

5. **Step 4 — Processing:**
   - Non-cancellable (no back button, no dismiss)
   - Progress bar: `{processed} / {total} complete`
   - Generate idempotency key on entry, store in sessionStorage (survive page refresh)
   - Poll `GET /api/gst/backfill/status/{jobId}` every 2 seconds
   - Display running errors (if any)
   - Once status = 'COMPLETED', auto-advance to Step 5

6. **Step 5 — Complete:**
   - Show summary: "{processed} products + {processed_invoices} invoices updated"
   - Show errors list (if any): "Failed to update {count} documents (see activity log)"
   - Buttons: "View Activity Log", "Done"
   - Button "Done" closes wizard, invalidates TanStack queries, redirects to GstReturnsHome

7. **Offline handling:**
   - Backfill execute requires online (server-side bulk recompute)
   - In UI, check `navigator.onLine` on Step 3 before proceeding; if offline, show toast "Must be online to run backfill"

8. **Screenshots** (5 steps × 2 themes = 10 images, at 320px min):
   - Step 1 loading ✓
   - Step 1 success with counts ✓
   - Step 2 options form ✓
   - Step 3 confirmation ✓
   - Step 4 processing with progress bar ✓
   - Step 5 complete with summary ✓
   - Step 4 processing at 320px (vertical layout) ✓
   - All dark theme ✓

### Acceptance / Proof Gates

**Backend:**
```bash
# Preview (read-only)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  https://api.local/api/gst/backfill/preview
# Expected: 200, { untaggedProductCount: 5, nullPosInvoiceCount: 12, ... }

# Execute with idempotency key
IDEMPOTENCY_KEY=$(uuidgen)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "defaultTaxCategoryId": "18%",
    "dateRange": ["2026-01-01", "2026-04-30"],
    "setPositionFromParty": true
  }' \
  https://api.local/api/gst/backfill/execute
# Expected: 201, { jobId: "...", status: "RUNNING" }

# Replay same request with same key (should be cached)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "defaultTaxCategoryId": "18%",
    "dateRange": ["2026-01-01", "2026-04-30"],
    "setPositionFromParty": true
  }' \
  https://api.local/api/gst/backfill/execute
# Expected: 200 (from cache), same jobId, no duplicate AuditLog rows

# Check status
curl -H "Authorization: Bearer $TOKEN" \
  https://api.local/api/gst/backfill/status/{jobId}
# Expected: 200, { status: 'RUNNING'|'COMPLETED', processed: N, total: M, errors: [...] }

# Rate limit test (second call within 1 hour)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  https://api.local/api/gst/backfill/execute
# Expected: 429 RATE_LIMITED (different idempotency key, second user call within 1h)
```

**Frontend:**
- BackfillWizard Step 1 **loading** ✓
- BackfillWizard Step 1 **success** (counts shown) ✓
- BackfillWizard Step 2 (options form filled) ✓
- BackfillWizard Step 3 (confirmation summary) ✓
- BackfillWizard Step 4 (progress bar updating) ✓
- BackfillWizard Step 5 (completion summary) ✓
- Step 4 at 320px (progress bar fits) ✓
- Dark theme (all steps readable) ✓
- Offline: Step 3 shows "Must be online" toast, Proceed button disabled ✓

**Security:**
- Backfill only runs for authenticated user's business (businessId from session)
- Rate limit per businessId + userId (not IP)
- AuditLog row per updated document, no blind-write
- Idempotency key prevents double-run

**Estimated size:** Large (11 files, ~800 lines)

### Merge Blockers
None specific to PR #7. Idempotency and rate-limiting requirements already satisfied.

### Dependencies
PR #1 (schema), PR #3 (tax engine, for recompute)

---

## PR 8: E-Invoice Service (NIC IRP) — Generate, Cancel, Circuit Breaker

### Title & Branch
**Title:** `gst(einvoice): NIC IRP service, auth token cache, circuit breaker, 5 merge-blockers MB-1..MB-5`  
**Branch:** `gst/einvoice-nic-irp`

### Scope Summary
Complete NIC IRP integration: auth token caching (6h TTL), envelope builder (GSTR1-style JSON), circuit breaker (5 fails / 60s → 30s open), generate (201 fresh / 200 idempotent), cancel (24h window), quota tracking (1000/day soft warn 950), rate limiting (10 req/s), audit logging. **Contains all 5 merge-blockers MB-1 through MB-5 from Security audit §10.**

### Files Touched
**Server:**
- `server/src/config/secrets.nic.ts` (new, reads NIC IRP username/password from env, high-risk path)
- `server/src/services/einvoice/einvoice.service.ts` (new, 150 lines, public API)
- `server/src/services/einvoice/einvoice.envelope.ts` (new, 200 lines, NIC JSON Schema 1.1)
- `server/src/services/einvoice/einvoice.nic-client.ts` (new, 150 lines, HTTP adapter with circuit breaker)
- `server/src/services/einvoice/einvoice.token-store.ts` (new, 80 lines, in-memory + Redis cache, 6h TTL)
- `server/src/services/einvoice/einvoice.errors.ts` (new, 100 lines, error taxonomy mapper)
- `server/src/lib/env.ts` (extend: add NIC_IRP_USERNAME, NIC_IRP_PASSWORD, NIC_ENV)
- `server/src/routes/einvoice.route.ts` (new, 120 lines)
- `server/src/middleware/nic-rate-limit.ts` (new, express-rate-limit config)
- `server/src/__tests__/einvoice.access.test.ts` (new, cross-tenant access test for MB-1)

**Client:**
- `src/features/e-invoice/EInvoiceCard.tsx` (new, 150 lines)
- `src/features/e-invoice/EInvoiceCancelDialog.tsx` (new, 100 lines)
- `src/features/e-invoice/e-invoice.service.ts` (new, 80 lines)
- `src/features/e-invoice/e-invoice.types.ts` (new, 30 lines)
- `src/features/e-invoice/useEInvoice.ts` (new hook, 60 lines)

### Backend Tasks — CRITICAL: Merge Blockers MB-1..MB-5

**MB-1 — Cross-tenant IRN cancel (Security §10 T1):**
- IRN cancel handler MUST do:
  ```ts
  const record = await prisma.eInvoice.findFirst({
    where: { id: req.params.id, businessId: req.user.businessId }
  })
  if (!record) return 404 NOT_FOUND
  // Build cancel envelope using record.irn from DB, NEVER from request body
  ```
- Add cross-tenant test in `__tests__/einvoice.access.test.ts`:
  - Tenant-A token attempts to cancel tenant-B's IRN
  - Expects 404 (not 403, not 200)
  - Assert NIC client mock was never invoked (no NIC call made)

**MB-2 — NIC SignedInvoice JWS signature verification (Security §10 #7):**
- In `einvoice.nic-client.ts`, after receiving NIC response:
  ```ts
  async verifyNicSignature(signedInvoice: string, env: 'sandbox'|'prod'): Promise<boolean> {
    const publicKey = env === 'sandbox'
      ? SANDBOX_NIC_PUBLIC_KEY
      : PROD_NIC_PUBLIC_KEY
    // Use `jsonwebtoken.verify()` with public key
    // On failure, raise EINVOICE_NIC_SIGNATURE_INVALID
    // DO NOT persist the EInvoice row if verification fails
  }
  ```
- Pinned certs:
  - Sandbox: DigiCert-signed NIC sandbox public key (hardcoded)
  - Prod: DigiCert-signed NIC prod public key (hardcoded)
- If verification fails, return 502 and log security alert (Winston).

**MB-3 — NIC error body sanitization (Security §10 #12):**
- Create `sanitizeNicError(body: any): string` helper:
  ```ts
  function sanitizeNicError(body: any): string {
    if (!body) return 'NIC service error'
    const maxLen = 1024
    const fieldsToStrip = ['Server', 'X-Powered-By', 'Stack', 'Trace-Id']
    // Extract only { ErrorCode, ErrorMsg } array
    const errors = body.errors || []
    const sanitized = errors
      .map(e => ({ code: e.ErrorCode, message: e.ErrorMsg }))
      .slice(0, 5) // max 5 error lines
    return JSON.stringify(sanitized).slice(0, maxLen)
  }
  ```
- Call `sanitizeNicError()` on every NIC error response before echoing to user

**MB-4 — AuditLog GSTIN masking (Security §10 A09):**
- When writing `AuditLog` for GST_SETTINGS_UPDATE, EINVOICE_GENERATED, etc.:
  ```ts
  function maskGstin(gstin: string | null): string | null {
    if (!gstin) return null
    if (gstin.length !== 15) return 'INVALID'
    return 'X'.repeat(11) + gstin.slice(11) // suffix-4 only
  }
  ```
- Example: `29ABCDE1234F1Z5` → `XXXXXXXXXXX1Z5`
- Apply to every GSTIN stored in `AuditLog.changes`

**MB-5 — NIC base URL hardening (Security §10 A10):**
- In `einvoice.nic-client.ts`, define const:
  ```ts
  const NIC_ENDPOINTS = {
    sandbox: { irp: 'https://einv-apisandbox.nic.in', ewb: 'https://ewbapisandbox.nic.in' },
    prod:    { irp: 'https://einvoice1.gst.gov.in', ewb: 'https://ewaybillapi.nic.in' }
  }
  const baseUrl = NIC_ENDPOINTS[env].irp
  ```
- HTTP client config: `{ maxRedirects: 0, timeout: 8000 }` (no redirects, 8s timeout)
- Env var `NIC_ENV` only switches which object to use (sandbox vs prod), NEVER contains a URL
- Boot-fail if `NIC_ENV === 'prod'` AND `NODE_ENV !== 'production'` (safety check in `env.ts`)

**Implementation details:**

1. `secrets.nic.ts`:
   - Read `NIC_IRP_USERNAME` and `NIC_IRP_PASSWORD` from env
   - Export as opaque object `{ username, password }` (never log)
   - Call this only from `einvoice.token-store.ts` and `einvoice.nic-client.ts`

2. `einvoice.token-store.ts`:
   - Cache auth tokens in memory (local object) + Redis (if available)
   - Key: `nic-irp-token:{businessId}`, TTL 6h
   - On 401 response from NIC, delete cache, re-authenticate once, retry original call
   - On second 401, fail with `EINVOICE_NIC_AUTH_FAILED`, do NOT retry again

3. `einvoice.nic-client.ts`:
   - opossum circuit breaker: 5 consecutive failures in 60s → open for 30s
   - Retry policy: exponential backoff [300ms, 1s, 3s] for 5xx/network only, never 4xx
   - Wall-clock timeout 8s (covers all retries)
   - Response handling:
     - 200 with IRN → verify signature (MB-2), persist EInvoice
     - 4xx → map to HpError, sanitize body (MB-3), return to client
     - 5xx → circuit breaker, fail-fast if open
   - Every call includes `reqId: uuidv4()` (NIC requirement for idempotency)

4. `einvoice.envelope.ts`:
   - Build GSTR1-style JSON envelope per NIC Schema 1.1
   - Input: `{ document, business, party, lines, supplyType, isReverseCharge }`
   - Output: `{ Sgstin, DocNo, DocTyp, DocDt, ... 40+ fields }`
   - Validate lengths: DocNo ≤16, LglNm ≤100, Addr1 ≤100, etc.
   - Reject if any field too long with `EINVOICE_FIELD_LENGTH` 400 (don't burn NIC quota on guaranteed-fail)
   - Seller GSTIN must match `business.gstin` (anti cross-tenant, required for MB-1)

5. `einvoice.service.ts` public API:
   ```ts
   async function generateIrn(documentId: string, businessId: string): Promise<EInvoiceRecord>
   async function cancelIrn(documentId: string, businessId: string, reason: 1|2|3|4, remarks: string): Promise<EInvoiceRecord>
   async function getEInvoice(documentId: string, businessId: string): Promise<EInvoiceRecord | null>
   ```
   - Generate: fetch document + business + party, build envelope, call NIC, verify sig (MB-2), persist, return 201 (or 200 if idempotent)
   - Cancel: load EInvoice record (with businessId scope, MB-1), check 24h window, call NIC, return 200
   - Get: return EInvoice record (no NIC call, read-only)

6. Routes:
   ```ts
   POST   /api/einvoice/generate    // 201 or 200 (idempotent by documentId @unique)
   POST   /api/einvoice/cancel      // 200
   GET    /api/einvoice/:documentId // 200 or 404
   ```
   - All require session auth + CSRF
   - Generate/cancel require idempotency middleware
   - Rate limit: 10 req/s per businessId (via middleware)
   - Quota check: 1000 per day per businessId (soft warn 950)

7. Error taxonomy (per Architecture §2.2, mapped to HpError codes):
   - 400 EINVOICE_PARTY_GSTIN_MISSING → "Add party GSTIN"
   - 400 EINVOICE_BUSINESS_GSTIN_MISSING → "Save GSTIN in Settings"
   - 400 EINVOICE_ALREADY_GENERATED → 200 returning existing (idempotent)
   - 400 EINVOICE_WRONG_STATUS → "Document must be SAVED"
   - 400 EINVOICE_NOT_SALE_INVOICE → "Only Sale Invoice eligible"
   - 400 EINVOICE_CANCEL_WINDOW_EXPIRED → "Issue credit note instead"
   - 400 EINVOICE_NOT_GENERATED → "Generate first"
   - 502 EINVOICE_NIC_UNAVAILABLE → circuit breaker open
   - 422 EINVOICE_NIC_VALIDATION → NIC field errors (sanitized)

8. Audit logging:
   - On generate: `AuditLog { action: 'EINVOICE_GENERATED', entityType: 'einvoice', entityId, changes: { irn, ackNumber, ackDate } }`
   - On cancel: `AuditLog { action: 'EINVOICE_CANCELLED', changes: { irn, reason, remarks } }`
   - No NIC token or auth details in logs (Winston will redact anyway)

### Frontend Tasks

1. **EInvoiceCard** component:
   - Slot on invoice detail page (after document info, before attachments)
   - Shows card with states:
     - **not-generated:** "Generate E-Invoice" button, info text "Required for GST compliance"
     - **loading:** spinner, "Generating IRN..."
     - **error:** red error message, "Retry" button
     - **success:** green badge "IRN Generated", display IRN (64-char, monospace), QR code, "Copy IRN" button, "Cancel" button
     - **cancel-window:** orange badge "Cancellable until {expiresAt}", "Cancel Invoice" button
     - Dark theme: green/red badges visible on dark BG

2. **EInvoiceCancelDialog** component:
   - Modal form when user taps "Cancel" on card
   - Dropdown: reason code (1-4: Duplicate, Data Entry Error, Orig Mismatch, Other)
   - Textarea: remarks (≤100 chars, enforced on server)
   - Buttons: "Cancel" (dismiss), "Confirm Cancel" (POST to /api/einvoice/cancel)
   - After success, card state updates to show "IRN Cancelled" badge

3. **e-invoice.service.ts** (client):
   ```ts
   export async function generateIrn(documentId: string): Promise<EInvoiceRecord>
   export async function cancelIrn(documentId: string, reason: number, remarks: string): Promise<EInvoiceRecord>
   ```
   - Check `navigator.onLine` before any call (OFFLINE_REQUIRED precheck)
   - Call `api()` without `entityType` (prevents queueing)
   - Optimistic UI: show spinner immediately, handle `{}` response (when offline, though should fail)

4. **useEInvoice** hook:
   - TanStack Query `useQuery(['einvoice', documentId])`
   - TanStack Query `useMutation()` for generate + cancel
   - Invalidate on success: `['einvoice', documentId]`, `['documents', businessId]`

5. **Screenshots** (5 states × 2 themes = 10 images):
   - **not-generated:** card with "Generate E-Invoice" button ✓
   - **loading:** spinner ✓
   - **error:** red message + Retry button ✓
   - **success:** IRN displayed, green badge, QR visible ✓
   - **cancel-window:** orange badge, Cancel button ✓
   - Dark theme: all readable ✓
   - Offline: "Must be online" toast shown, button disabled ✓

### Acceptance / Proof Gates

**Backend (curl proofs, all required for merge):**
```bash
# Generate IRN on B2B SAVED invoice
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"documentId": "..."}' \
  https://api.local/api/einvoice/generate
# Expected: 201 with irn (64 chars), ackNumber, ackDate, qrCodeData

# Duplicate generate (idempotent)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: same-key-as-above" \
  -d '{"documentId": "..."}' \
  https://api.local/api/einvoice/generate
# Expected: 200 returning existing IRN (no second NIC call)

# Cancel within 24h
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"reason": 1, "remarks": "Duplicate entry"}' \
  https://api.local/api/einvoice/cancel
# Expected: 200, status='CANCELLED'

# Cancel after 24h (expired window)
# (Timestamp manipulate in test: set ackDate to >24h ago)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"reason": 1, "remarks": "..."}' \
  https://api.local/api/einvoice/cancel
# Expected: 400 EINVOICE_CANCEL_WINDOW_EXPIRED

# Quota test: generate 1001 times (quota is 1000)
for i in {1..1001}; do
  curl -X POST -H "Authorization: Bearer $TOKEN" ...
done
# Expected: req 950 → 429 (soft warn), req 1000 → 200, req 1001 → 429 EINVOICE_QUOTA_EXCEEDED

# Rate limit: 11 req/s (limit is 10)
for i in {1..11}; do (curl ...) & done; wait
# Expected: req 11 → 429 RATE_LIMITED

# NIC simulation: sandbox down (circuit breaker)
# (Mock NIC client to return 502 five times)
for i in {1..6}; do
  curl -X POST -H "Authorization: Bearer $TOKEN" ...
done
# Expected: req 1-5 → 502, req 6 → circuit breaker open, fail-fast with 502 EINVOICE_NIC_UNAVAILABLE

# Security MB-1 test: tenant-A cancels tenant-B's IRN
curl -X POST \
  -H "Authorization: Bearer $TOKEN_A" \
  https://api.local/api/einvoice/cancel?id=tenant_b_irn
# Expected: 404 NOT_FOUND (no 403, no NIC call made, no existence leak)

# Security MB-3 test: NIC validation error (422) is sanitized
# (Mock NIC to return validation error)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -d '{...invalid...}' \
  https://api.local/api/einvoice/generate
# Expected: 422, response body shows sanitized errors only (no NIC HTML, no stack)

# Security MB-4 test: AuditLog has masked GSTIN
# (Check DB: grep AuditLog WHERE action='EINVOICE_GENERATED')
# Expected: changes.gstin = 'XXXXXXXXXXX1Z5' (not full GSTIN)

# Tsc clean
npm run build:server
# Expected: 0 errors

# No NIC password in logs/env
grep -rn 'NIC_IRP_PASSWORD' server/src --include='*.ts' | grep -v secrets.nic.ts | grep -v env.ts
# Expected: 0 hits
```

**Frontend:**
- EInvoiceCard **not-generated:** button shown ✓
- EInvoiceCard **loading:** spinner shown ✓
- EInvoiceCard **error:** red message + Retry button ✓
- EInvoiceCard **success:** IRN (64 char), QR code, green badge ✓
- EInvoiceCard **cancel-window:** orange badge, Cancel button ✓
- Dark theme: all readable ✓
- Offline: "Must be online" toast, button disabled ✓
- Cross-tenant: tenant-A cannot see/cancel tenant-B's IRN (404) ✓

**Security:**
- All 5 merge-blockers MB-1..MB-5 curl proofs collected
- Cross-tenant test passes
- No NIC creds in logs
- No NIC token in frontend storage
- AuditLog GSTIN masked
- NIC base URLs hardcoded (const)

**Estimated size:** Large (12 files, ~1000 lines)

### Merge Blockers
**MB-1, MB-2, MB-3, MB-4, MB-5** — All required, detailed above. Cannot merge PR #8 without all 5 curl proofs + code changes.

### Dependencies
PR #1 (schema), PR #2 (gst settings), PR #4 (invoice form, to have documents with GST fields), Security review approval

---

## PR 9: E-Way Bill Service (NIC EWB) — Part A, Part B, Auto-Prompt

### Title & Branch
**Title:** `gst(ewaybill): NIC EWB service, Part A + Part B, threshold gate, 5 merge-blockers (same as PR #8)`  
**Branch:** `gst/ewaybill-nic-ewb`

### Scope Summary
Complete NIC E-Way Bill integration: Part A (bill generation), Part B (vehicle details), threshold gate (≥₹50k inter-state), auto-prompt modal after invoice save, cancel (24h window), quota tracking, rate limiting, audit logging. **Re-applies the same 5 merge-blockers MB-1..MB-5 from PR #8 to the EWB service.**

### Files Touched
**Server:**
- `server/src/services/ewaybill/ewaybill.service.ts` (new, 150 lines)
- `server/src/services/ewaybill/ewaybill.envelope.ts` (new, 150 lines)
- `server/src/services/ewaybill/ewaybill.nic-client.ts` (new, 150 lines, mirrors einvoice.nic-client)
- `server/src/services/ewaybill/ewaybill.token-store.ts` (new, 80 lines, separate from IRP)
- `server/src/services/ewaybill/ewaybill.errors.ts` (new, 80 lines)
- `server/src/lib/nic-thresholds.ts` (new, 50 lines, per-state threshold table)
- `server/src/lib/env.ts` (extend: add NIC_EWB_USERNAME, NIC_EWB_PASSWORD)
- `server/src/routes/ewaybill.route.ts` (new, 140 lines)
- `server/src/__tests__/ewaybill.access.test.ts` (new, cross-tenant test for MB-1)

**Client:**
- `src/features/e-way-bill/EWayBillModal.tsx` (new, 180 lines)
- `src/features/e-way-bill/EWayBillCard.tsx` (new, 150 lines)
- `src/features/e-way-bill/EWayBillUpdatePartBDialog.tsx` (new, 120 lines)
- `src/features/e-way-bill/e-way-bill.service.ts` (new, 100 lines)
- `src/features/e-way-bill/e-way-bill.types.ts` (new, 40 lines)
- `src/features/e-way-bill/useEWayBill.ts` (new hook, 80 lines)

### Backend Tasks

Same pattern as PR #8 (E-Invoice). Key differences:

1. **Two NIC endpoints:**
   - Part A (generate bill): `POST /ewb/v1.03/ewayapi` → returns `ewbNumber` (12-digit)
   - Part B (vehicle details): `POST /ewb/v1.03/ewaypartb` → returns success (no new identifier)

2. **Threshold gate** (server-side, before NIC call):
   - Read `nic-thresholds.ts` table: per-state minimum amount for EWB requirement
   - Check: `Document.grandTotal >= stateThreshold AND isInterState`
   - If intra-state or below threshold, return 400 `EWAYBILL_BELOW_THRESHOLD` without calling NIC

3. **Part B update flow:**
   - `EWayBill.partBUpdates: Json[]` stores each update event
   - Structure: `{ vehicleNumber, vehicleType, reason, updatedAt }`
   - Appends on every PUT (never overwrites, keeps history)
   - `validUpto` date is NOT extended (NIC controls it based on distance)

4. **MB-1..MB-5** — Same as PR #8:
   - Cross-tenant load check (MB-1): `where: { id, businessId }`
   - JWS signature verify on EWB response (MB-2): if provided
   - Error sanitization (MB-3): `sanitizeNicError()`
   - AuditLog GSTIN masking (MB-4)
   - Base URL hardcoding (MB-5)

5. Routes:
   ```ts
   POST   /api/ewaybill/generate       // 201 or 200 (idempotent by documentId @unique)
   POST   /api/ewaybill/cancel         // 200
   PUT    /api/ewaybill/update-partb   // 200 (appends, not idempotent at mutation level, but safe to call twice)
   GET    /api/ewaybill/:documentId    // 200 or 404
   ```

### Frontend Tasks

1. **EWayBillModal** component:
   - Auto-prompt modal shown after invoice save (if `gstEnabled`, invoice ≥₹50k, inter-state)
   - Form with fields:
     - **Transporter details:** name, phone, GSTIN (optional)
     - **Distance:** numeric input (km)
     - **Transport mode:** dropdown (Road / Rail / Air / Ship)
     - **Vehicle:** type (ODC / Truck / Tractor / etc.), number
     - Buttons: "Skip for now", "Generate E-Way Bill"
   - States: loading → error → success (show ewbNumber) → done
   - Can be dismissed (Skip button)
   - Auto-closed on success

2. **EWayBillCard** component:
   - Slot on invoice detail page (below EInvoiceCard)
   - States:
     - **not-generated:** button "Generate E-Way Bill" (or hidden if below threshold)
     - **threshold-not-met:** info text "E-way bill not required for intra-state or amounts < ₹50k"
     - **loading:** spinner
     - **error:** red message, Retry button
     - **success:** green badge "EWB Generated", display ewbNumber (12-digit), "Update Vehicle (Part B)" button, "Cancel" button
     - **cancelled:** gray badge "EWB Cancelled"

3. **EWayBillUpdatePartBDialog** component:
   - Modal form for updating vehicle details
   - Fields: vehicle number, vehicle type, reason (dropdown), effective date
   - Button: "Update Vehicle"
   - Shows previous updates (history list)
   - Response: success toast, Part B updates list refreshed

4. **e-way-bill.service.ts** (client):
   ```ts
   export async function generateEWayBill(...): Promise<EWayBillRecord>
   export async function updatePartB(...): Promise<EWayBillRecord>
   export async function cancelEWayBill(...): Promise<EWayBillRecord>
   ```
   - Offline checks (OFFLINE_REQUIRED precheck)
   - No `entityType` (prevents queueing)

5. **useEWayBill** hook:
   - TanStack Query for read/write
   - Invalidate on success

6. **Threshold gate UI:**
   - When showing EWayBillCard, if document is below threshold:
     - Show info message: "E-way bill not required. Threshold: ₹50,000 inter-state"
     - Hide generate button
   - On threshold boundary (close to ₹50k): show warning "E-way bill will be required at ₹50k"

7. **Screenshots** (4 states × 2 themes = 8 images, modal + card):
   - **Modal loading:** spinner
   - **Modal success:** ewbNumber shown
   - **Card not-generated:** button shown
   - **Card success:** ewbNumber displayed, badge green ✓
   - **Card threshold:** info text shown, button hidden ✓
   - **PartB update:** form + history list ✓
   - Dark theme: all readable ✓

### Acceptance / Proof Gates

**Backend (curl proofs):**
```bash
# Generate EWB on intra-state invoice (below threshold)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"documentId": "..."}' \
  https://api.local/api/ewaybill/generate
# Expected: 400 EWAYBILL_BELOW_THRESHOLD

# Generate EWB on inter-state, ≥₹50k
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"documentId": "..."}' \
  https://api.local/api/ewaybill/generate
# Expected: 201 with ewbNumber (12-digit), validUpto, distance

# Update Part B (vehicle)
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "vehicleNumber": "AB12CD3456",
    "vehicleType": "Truck",
    "reason": "change-vehicle"
  }' \
  https://api.local/api/ewaybill/update-partb
# Expected: 200, partBUpdates array has new entry appended

# Cancel EWB
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"reason": 1}' \
  https://api.local/api/ewaybill/cancel
# Expected: 200, status='CANCELLED'

# All MB-1..MB-5 proofs same as PR #8
```

**Frontend:**
- EWayBillModal **loading** ✓
- EWayBillModal **success** (ewbNumber shown) ✓
- EWayBillCard **not-generated** ✓
- EWayBillCard **threshold-not-met** (info text) ✓
- EWayBillCard **success** (ewbNumber, update Part B button) ✓
- EWayBillUpdatePartBDialog (form + history) ✓
- Dark theme ✓
- Offline: toast "Must be online" ✓

**Security:**
- All 5 merge-blockers MB-1..MB-5 re-applied and verified

**Estimated size:** Large (11 files, ~950 lines)

### Merge Blockers
**MB-1, MB-2, MB-3, MB-4, MB-5** — Same as PR #8, applied to EWB service.

### Dependencies
PR #1 (schema), PR #2 (gst settings), PR #4 (invoice form), PR #8 (E-Invoice) — PRs #8 and #9 can land in parallel if both security reviews pass

---

## PR 10: GSTR-1 Export — 8 Builders + JSON/CSV

### Title & Branch
**Title:** `gst(gstr1): 8 NIC table builders + JSON/CSV export + GstReturn upsert`  
**Branch:** `gst/gstr1-export`

### Scope Summary
Complete GSTR-1 implementation: 8 builder functions (b2b, b2cl, b2cs, cdnr, cdnur, hsn, nil, exp), NIC v3.0 envelope assembly, JSON/CSV export, GstReturn upsert for UI gating. Monthly period aggregation, paise → rupees conversion at export boundary, idempotent export endpoint.

### Files Touched
**Server:**
- `server/src/services/gst-returns/gstr1.service.ts` (new, 150 lines)
- `server/src/services/gst-returns/builders/b2b.builder.ts` (new, 60 lines)
- `server/src/services/gst-returns/builders/b2cl.builder.ts` (new, 60 lines)
- `server/src/services/gst-returns/builders/b2cs.builder.ts` (new, 80 lines, aggregated by state-rate)
- `server/src/services/gst-returns/builders/cdnr.builder.ts` (new, 60 lines)
- `server/src/services/gst-returns/builders/cdnur.builder.ts` (new, 60 lines)
- `server/src/services/gst-returns/builders/hsn.builder.ts` (new, 80 lines, aggregated by hsn-rate-uqc)
- `server/src/services/gst-returns/builders/nil.builder.ts` (new, 50 lines)
- `server/src/services/gst-returns/builders/exp.builder.ts` (new, 40 lines, flag-only)
- `server/src/services/gst-returns/gstr1.schema.json` (new, NIC v3.0 JSON schema for validation)
- `server/src/routes/gst-returns.route.ts` (extend, add GSTR-1 export)

**Client:**
- `src/features/gst-returns/Gstr1Page.tsx` (new, 200 lines)
- `src/features/gst-returns/useGstr1.ts` (new hook, 80 lines)
- `src/features/gst-returns/gst-returns.types.ts` (extend with NIC types)

### Backend Tasks

1. **8 Builder functions** — each returns `Promise<NicXEntry[]>`:
   - **b2b.builder** — B2B invoices (`supplyType='B2B'`, doc type SALE_INVOICE | DEBIT_NOTE)
   - **b2cl.builder** — B2C Large (`supplyType='B2C_LARGE'`)
   - **b2cs.builder** — B2C Small (aggregated by `(placeOfSupply, gstRate)` → one row per state-rate, SUM amounts)
   - **cdnr.builder** — Credit notes on B2B
   - **cdnur.builder** — Credit notes on B2C Large / Export
   - **hsn.builder** — HSN summary (aggregated by `(hsnCode, gstRate, uqc)` → one row per triple, SUM qty+amounts)
   - **nil.builder** — Nil-rated line items
   - **exp.builder** — Exports (flag-only in v7, returns metadata not invoice detail)

2. **gstr1.service.ts** orchestrator:
   ```ts
   async function exportGstr1(
     businessId: string,
     period: string  // 'YYYY-MM'
   ): Promise<{ jsonData: object; csvData: string }> {
     // 1. Run all 8 builders sequentially
     const [b2b, b2cl, ...] = await Promise.all([
       b2bBuilder(prisma, businessId, period),
       b2clBuilder(prisma, businessId, period),
       ...
     ])
     // 2. Assemble NIC v3.0 envelope
     const envelope = {
       gstin: business.gstin,
       fp: period,  // 'MMYYYY'
       gt: 0,  // to be computed
       cur_gt: 0,  // consolidated GT
       b2b, b2cl, b2cs, cdnr, cdnur,
       hsn: { data: hsn },
       nil: { inv: nil },
       exp
     }
     // 3. Validate against JSON schema
     validateAgainstGstr1Schema(envelope)
     // 4. Convert all paise amounts to rupees (divide by 100)
     const rupeeEnvelope = paiseToRupeesForNic(envelope)
     // 5. Generate CSV from envelope
     const csvData = generateGstr1Csv(rupeeEnvelope)
     // 6. Upsert GstReturn row
     await prisma.gstReturn.upsert({
       where: { businessId_period_returnType: { businessId, period, returnType: 'GSTR1' } },
       create: { businessId, period, returnType: 'GSTR1', status: 'EXPORTED', jsonData: rupeeEnvelope, summary: { rowCounts: { b2b: b2b.length, ... } } },
       update: { status: 'EXPORTED', jsonData: rupeeEnvelope, updatedAt: new Date() }
     })
     return { jsonData: rupeeEnvelope, csvData }
   }
   ```

3. **Builder query examples:**
   ```ts
   // b2b.builder
   async function buildB2b(prisma, businessId, period) {
     const [start, end] = parsePeriod(period)
     return prisma.document.findMany({
       where: {
         businessId,
         supplyType: 'B2B',
         documentType: { in: ['SALE_INVOICE', 'DEBIT_NOTE'] },
         issueDate: { gte: start, lt: end },
         status: 'SAVED'
       },
       include: { party: true, lines: { include: { taxCategory: true } } }
     }).then(docs => docs.map(doc => ({
       ...doc fields for NIC B2B table...
     })))
   }
   ```

4. **NIC schema validation** (`gstr1.schema.json`):
   - Load JSON Schema v3.0 from NIC
   - `validateAgainstGstr1Schema(envelope)` using `ajv` library
   - If invalid, return 400 `GSTR1_VALIDATION_FAILED` (don't send to NIC, help user fix data)

5. **Rupee conversion boundary:**
   - One helper `paiseToRupeesForNic(obj)` that recursively divides all `Amount`, `Value`, `Qty` numeric fields by 100
   - All builders work in paise (integers), only convert at export boundary

6. **GstReturn model usage:**
   - Upsert on every export (ensures one record per business-period-returnType)
   - Stores `jsonData`, `summary`, `status` ('EXPORTED', 'FILED' — v7 only EXPORTED)
   - Used by UI to show "GSTR-1 exported on 2026-04-30" badge

7. **Export endpoint:**
   ```ts
   POST /api/gst/returns/GSTR1/:period/export
   // Request: { format: 'JSON' | 'CSV' }
   // Response: 200, { jsonData, csvData, url: 'signed_s3_url_for_download' }
   // Idempotency: same period → same response (cached)
   ```

### Frontend Tasks

1. **Gstr1Page** component:
   - Container showing:
     - **Period selector:** month/year picker (default current month)
     - **Status banner:** "GSTR-1 exported on 2026-04-30" (if GstReturn exists) or "Not exported"
     - **Data summary:** table showing row counts (B2B: 120 invoices, B2C Large: 45, etc.)
     - **Export button:** "Download as JSON" / "Download as CSV" dropdowns
     - **Backfill prompt:** if GstReturn has zero B2B rows, show blue banner "No B2B invoices found. Run the backfill wizard?" (link to BackfillWizardPage)
   - States: loading, error, empty (no invoices), success
   - Offline: "Must be online to export" toast

2. **useGstr1** hook:
   - `useQuery(['gstr1-summary', businessId, period])`
   - `useMutation()` for export

3. **Screenshots** (4 states × 2 themes = 8 images):
   - **Loading:** spinner
   - **Error:** red message
   - **Empty:** "No invoices for this period"
   - **Success:** summary table, export buttons, status badge ✓
   - Dark theme ✓

### Acceptance / Proof Gates

**Backend:**
```bash
# Get GSTR-1 summary (read-only)
curl -H "Authorization: Bearer $TOKEN" \
  https://api.local/api/gst/returns/GSTR1/2026-04
# Expected: 200, { b2b: [...], b2cl: [...], b2cs: [...], ... }

# Export as JSON
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"format": "JSON"}' \
  https://api.local/api/gst/returns/GSTR1/2026-04/export
# Expected: 200, { jsonData: {...NIC v3.0...}, csvData: "..." }

# Verify amounts in rupees (divide by 100)
# curl response amounts should be integers in rupees, not paise

# Validate envelope against NIC schema
# Expected: no schema validation errors

# Idempotent export (same key, same response)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: same-key" \
  -d '{"format": "JSON"}' \
  https://api.local/api/gst/returns/GSTR1/2026-04/export
# Expected: 200, same response (no second query executed)
```

**Frontend:**
- Gstr1Page **loading** ✓
- Gstr1Page **error** ✓
- Gstr1Page **empty** (backfill prompt shown) ✓
- Gstr1Page **success** (summary + export buttons) ✓
- Dark theme ✓

**Estimated size:** Large (12 files, ~900 lines)

### Merge Blockers
None specific to PR #10.

### Dependencies
PR #1 (schema), PR #3 (tax engine), PR #6 (composition/RCM logic affects supply type determination)

---

## PR 11: GSTR-3B Summary — 11-Row Aggregator + Export

### Title & Branch
**Title:** `gst(gstr3b): 11-row GSTR-3B summary, period aggregation, export`  
**Branch:** `gst/gstr3b-summary`

### Scope Summary
GSTR-3B computation: 11 sections (3.1(a) to 6.1, late fee, net payable) aggregated from invoices, purchases, credit notes. No builders (flat structure, one query with CTEs). Summary page with read-only table, export to JSON.

### Files Touched
**Server:**
- `server/src/services/gst-returns/gstr3b.service.ts` (new, 200 lines, single aggregation query with 11 CTEs)
- `server/src/routes/gst-returns.route.ts` (extend, add GSTR-3B endpoints)

**Client:**
- `src/features/gst-returns/Gstr3bPage.tsx` (new, 150 lines)
- `src/features/gst-returns/useGstr3b.ts` (new hook, 60 lines)

### Backend Tasks

1. **gstr3b.service.ts** — single query with 11 CTEs:
   ```sql
   WITH section_3_1_a AS (
     SELECT SUM(total_cgst + total_sgst + total_igst + total_cess) as amount
     FROM Document
     WHERE supplyType IN ('B2B','B2C_LARGE','B2C_SMALL')
       AND isReverseCharge = false
       AND NOT exempt_only
       AND documentDate BETWEEN period_start AND period_end
   ),
   section_3_1_b AS (
     SELECT SUM(...) FROM Document WHERE supplyType IN ('EXPORT','SEZ')
   ),
   ...
   section_6_1_net_payable AS (
     SELECT (SELECT amount FROM section_3_1_total)
          - (SELECT amount FROM section_4_itc)
          AS net_payable
   )
   SELECT * FROM section_3_1_a, section_3_1_b, ..., section_6_1_net_payable
   ```

2. **11 sections** (per SCOPE §12.1):
   - 3.1(a) Supplies (B2B, B2C_LARGE, B2C_SMALL, non-RCM)
   - 3.1(b) Exports (EXPORT, SEZ)
   - 3.1(c) Nil-rated (0% tax items)
   - 3.1(d) RCM supplies (inbound)
   - 3.1(e) Unspecified (no HSN/SAC)
   - 3.2 State-wise B2C Large
   - 4 ITC (inbound tax on purchases)
   - 4(D) ITC reversed (manual, default 0)
   - 5 Exempt inward
   - 6.1 Tax payable (3.1 total - 4 ITC)
   - Late fee (always 0, manual override in UI)

3. **Export endpoint** `POST /api/gst/returns/GSTR3B/:period/export`:
   - Similar to GSTR-1, idempotent, write GstReturn row
   - Return JSON + CSV

### Frontend Tasks

1. **Gstr3bPage** component:
   - Period selector (month/year)
   - Summary table: 11 rows, each showing section number, description, amount
   - Export button: "Download as JSON"
   - Status: GstReturn exists → show "Exported on {date}"
   - Offline: "Must be online to export"

2. **useGstr3b** hook:
   - TanStack Query for read + export

3. **Screenshots** (4 states × 2 themes = 8 images):
   - **Loading:** spinner
   - **Error:** red message
   - **Empty:** "No invoices for this period"
   - **Success:** 11-row summary table visible ✓
   - Dark theme ✓

### Acceptance / Proof Gates

**Backend:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.local/api/gst/returns/GSTR3B/2026-04
# Expected: 200, { section_3_1_a, section_3_1_b, ..., section_6_1 }

curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"format": "JSON"}' \
  https://api.local/api/gst/returns/GSTR3B/2026-04/export
# Expected: 200, { jsonData, csvData }
```

**Frontend:**
- Gstr3bPage **success** (11 rows visible) ✓
- Dark theme ✓

**Estimated size:** Medium (5 files, ~400 lines)

### Merge Blockers
None specific to PR #11.

### Dependencies
PR #1 (schema), PR #3 (tax engine), PR #10 (GSTR-1 shares some aggregation logic)

---

## PR 12: Polish + Feature Flag Removal + Final QA

### Title & Branch
**Title:** `gst(release): 320px audit, dark theme, error copy, remove FEATURE_GST_V7 flag, docs`  
**Branch:** `gst/polish-release`

### Scope Summary
Final pass: 320px overflow audit (no horizontal scroll on any new screen), dark theme complete review, error message copy UX improvements, remove `FEATURE_GST_V7` env var gate (ship as default), update docs, final screenshots.

### Files Touched
**Client:**
- All new GST feature screens (audit + fixes only)
- `src/app/AppProviders.tsx` (remove feature flag condition)
- Tailwind config (verify dark mode classes used)

**Docs:**
- Update `README.md` with GST feature description
- Add `CHANGELOG.md` entry for v7

### Backend Tasks
1. Remove `if (!process.env.FEATURE_GST_V7)` guards on GST routes (ship as default)
2. All routes return 404 on disabled (via middleware) → now all return normal responses
3. Update `.env.example` with NIC env var stubs (redacted)
4. Verify no `console.log` / `console.error` (enforce.js Check #13)

### Frontend Tasks
1. **320px audit:**
   - Every new screen tested at exactly 320px width
   - No horizontal scroll
   - Inputs have max-width, text wraps
   - Modals fit in viewport (may scroll vertically, OK)
   - Lists are scrollable but not sideways
   - Touch targets ≥44px height

2. **Dark theme:**
   - All new screens tested in dark mode (`prefers-color-scheme: dark`)
   - Text contrast ≥4.5:1 (WCAG AA)
   - Form inputs visible (borders, backgrounds)
   - Buttons have sufficient contrast
   - Error badges (red) visible on dark BG
   - Success badges (green) visible on dark BG

3. **Error copy UX:**
   - Review all error toasts introduced in PRs #2–#11
   - Ensure user-friendly (not system error codes)
   - Examples:
     - ❌ "EINVOICE_NIC_VALIDATION_FAILED"
     - ✓ "E-invoice validation failed. Check your invoice details."
   - Audit all error messages for clarity + actionability

4. **Screenshots** — compile all proofs:
   - All 4 states × all screens × 320px + 375px × light + dark
   - Organize in PR description as a markdown table
   - Include curl commands for backend proofs (summarized)

5. **Documentation:**
   - Add `docs/GST_v7_DEPLOYMENT.md` with:
     - Prerequisite: NIC API credentials provisioning
     - Env vars: NIC_IRP_USERNAME, NIC_IRP_PASSWORD, NIC_EWB_USERNAME, NIC_EWB_PASSWORD, NIC_ENV
     - Sandbox vs prod setup
     - GSTIN validation flow
     - E-invoice/EWB opt-in per-business
     - Backfill wizard usage
     - GSTR-1/3B export limits + quotas
   - Update feature flag doc: GST v7 is now default

### Acceptance / Proof Gates

**Backend:**
- `tsc --noEmit` clean ✓
- `npm run build:server` clean ✓
- All lint rules pass (`enforce.js`) ✓
- Pre-commit hook passes ✓

**Frontend:**
- All new screens tested at **320px:** no horizontal scroll ✓
- All new screens tested at **375px:** layout stable ✓
- All new screens tested in **dark theme:** readable ✓
- Error messages reviewed: user-friendly copy ✓
- Screenshot checklist complete ✓

**Docs:**
- Deployment guide written
- README updated with GST v7 feature
- CHANGELOG entry for v7

**Estimated size:** Small (polish only, 5 files, ~100 lines changes)

### Merge Blockers
None — this is the final cleanup PR, merges only after PRs #1–#11.

### Dependencies
All PRs #1–#11 must be merged first

---

## Risk Register

| Risk | Severity | PR | Mitigation |
|------|----------|----|----|
| **R1** — NIC sandbox vs prod credential provisioning | Medium | #8, #9 | Document in admin onboarding; customer-provisioned; not automatic |
| **R2** — E-invoice mandatory above turnover threshold (₹5Cr) | Medium | #8 | v7 ships opt-in; advisory banner at 5Cr+; enforcement deferred to v8 |
| **R3** — NIC schema versioning (v3.0 may change) | Low | #10 | Single envelope-builder file; version const `NIC_GSTR1_VERSION='3.0'`; update isolates to one PR |
| **R4** — RCM SAC-code list (advisory, govt-maintained) | Low | #6 | Constant file `rcm-sac-codes.ts`; review quarterly |
| **R5** — Composition rate variance (5% vs 6%) | Low | #6 | Use `Business.compositionRate` (user-set); three presets |
| **R6** — Multi-currency invoices (SCOPE = INR only) | Low | #2 | GST features gated on `currencyCode === 'INR'`; non-INR see "disabled" UI |
| **R7** — Inter-state EWB threshold per state (₹50k default) | Low | #9 | `nic-thresholds.ts` per state; flag as "advisory" in copy |
| **R8** — Auto-flip `gstEnabled=true` on saved GSTIN surprises users | Medium | #2 | One-time in-app banner: "GST enabled because GSTIN saved. Click to disable." |
| **T1** — Cross-tenant IRN cancel (attack) | Critical | #8 | MB-1: businessId-first Prisma where; cross-tenant CI test; 404 not 403 |
| **T2** — Compromised NIC creds → fraudulent IRNs (attack) | Critical | #8 | Per-business quota caps blast radius; AuditLog reveals every IRN; NIC_IRP_ENABLED kill switch |
| **T3** — Double backfill (user clicks twice) (bug) | Medium | #7 | Idempotency-Key middleware; 1/hr per-user rate limit; advisory lock |
| **T4** — GSTIN XSS in template render (bug) | Low | #5 | React-PDF auto-escapes; verify no `dangerouslySetInnerHTML`; CI test vector |
| **T5** — Parameter-tampered GSTR-1 export (attack) | Critical | #10 | businessId from session only; 400 if body contains businessId; no silent ignore |

---

## Critical Path & Parallelization

**Sequential (critical path):**
1. PR #1 (schema) → 4 hours
2. PR #2 (gst settings) → 8 hours
3. PR #3 (tax engine) → 12 hours
4. PR #4 (invoice form UI) → 16 hours

**Then in parallel (gates cleared, tax engine ready):**
- PR #5 (templates) → 12 hours
- PR #7 (backfill wizard) → 16 hours
- **PR #8 (e-invoice) → 24 hours** [blocked until Security review complete]
- **PR #9 (e-way bill) → 16 hours** [depends on PR #8 or parallel, both need Security]

**Then sequential (after #6, #3):**
- PR #10 (GSTR-1) → 16 hours [needs #6 composition logic]
- PR #11 (GSTR-3B) → 8 hours [needs #10 patterns]

**Then final:**
- PR #12 (polish) → 8 hours [all PRs merged]

**Total path:** 1 + 2 + 3 + 4 + max(5, 7, 24) + max(10, 16) + 8 + 8 = **4 + 4 + 12 + 16 + 24 + 16 + 8 + 8 = 92 hours** (with parallelization; sequential would be 140 hours).

**Recommended schedule:**
- Week 1 (40 hrs): PR #1–#4 (foundation)
- Week 2 (40 hrs): PR #5, #7, #8/Security review in parallel
- Week 3 (40 hrs): PR #9, #6, #10
- Week 4 (20 hrs): PR #11, #12, final QA + ship

---

## Proof Gate Checklist — Merge-Ready Status

### Backend Proof Collection (22 curl proofs per Architecture §12)

- [ ] PR #1: `npx prisma migrate dev --name gst_phase_2_fields` clean
- [ ] PR #2: PATCH /api/gst/settings → 200, gstEnabled flip
- [ ] PR #3: POST /api/invoices intra-state (CGST+SGST) ✓
- [ ] PR #3: POST /api/invoices inter-state (IGST) ✓
- [ ] PR #3: POST /api/invoices composition (0) ✓
- [ ] PR #3: POST /api/invoices inclusive (backCalc) ✓
- [ ] PR #7: POST /api/gst/backfill/preview ✓
- [ ] PR #7: POST /api/gst/backfill/execute (idempotent) ✓
- [ ] PR #8: POST /api/einvoice/generate (201 fresh) ✓
- [ ] PR #8: POST /api/einvoice/generate (200 idempotent) ✓
- [ ] PR #8: POST /api/einvoice/cancel (24h window) ✓
- [ ] PR #8: POST /api/einvoice/cancel (>24h reject) ✓
- [ ] PR #9: POST /api/ewaybill/generate (intra <threshold 400) ✓
- [ ] PR #9: POST /api/ewaybill/generate (inter ≥threshold 201) ✓
- [ ] PR #10: GET /api/gst/returns/GSTR1/2026-04 ✓
- [ ] PR #10: POST export (NIC v3.0, rupees) ✓
- [ ] PR #11: GET /api/gst/returns/GSTR3B/2026-04 ✓
- [ ] PR #11: POST export ✓
- [ ] All routes: 401 unauthenticated ✓
- [ ] All routes: 400 bad input ✓
- [ ] NIC down: 502 graceful degradation ✓
- [ ] tsc clean ✓

### Frontend Proof Collection (screenshots)

- [ ] GstSettingsPage: 4 states × 2 themes
- [ ] InvoiceForm tax column: 4 states × 2 themes × 2 breakpoints
- [ ] EInvoiceCard: 5 states × 2 themes
- [ ] EWayBillCard: 4 states × 2 themes
- [ ] BackfillWizard: 5 steps × 2 themes × 320px
- [ ] Gstr1Page: 4 states × 2 themes
- [ ] Gstr3bPage: 4 states × 2 themes
- [ ] 320px overflow audit (all screens)
- [ ] Dark theme audit (all screens)

### Security Proof Collection

- [ ] MB-1: Cross-tenant IRN cancel returns 404 ✓
- [ ] MB-2: NIC SignedInvoice JWS verified ✓
- [ ] MB-3: NIC error body sanitized ✓
- [ ] MB-4: AuditLog GSTIN masked ✓
- [ ] MB-5: NIC base URLs hardcoded ✓

---

## Summary

**12 PRs, ~140 hours (92 with parallelization), v7 release gate = all proofs collected + security review passed.**

Frontmatter status: **approved** — all three design documents (SCOPE, ARCHITECTURE, SECURITY) signed off.

Recommended commit message format for each PR:
```
gst(category): short subject

- Task 1
- Task 2
...

Acceptance (curl proofs, screenshots attached to PR)
```

Final PR #12 commit should reference all 11 prior PRs in a single "Release v7" commit (or multiple release commits, one per feature family).
