---
feature: phase-5-epic-b-sales-workflow
status: approved
created: 2026-05-14T00:00:00Z
scope: backlog items #122, #132, #133, #134
gates: architect required before PR1 build begins
---

# SCOPE — Phase 5 Epic B: Sales Workflow

## Summary

Epic B ships four sales-workflow improvements across a single document-engine
codebase: (1) a visible sales pipeline with Estimate→Order→Challan→Invoice
conversion UX, (2) price-list tier selection on the invoice form, (3) BOGO /
free-item line marking, and (4) per-business custom fields on documents.
The backend for all four items is fully or partially shipped; this epic is
primarily a frontend build with targeted backend gap-fills.

---

## Schema Audit — What Already Exists

### #122 Sales Pipeline

**Backend — COMPLETE.**

- `Document.type` stores `ESTIMATE | PROFORMA | SALE_ORDER | PURCHASE_ORDER |
  DELIVERY_CHALLAN | SALE_INVOICE | PURCHASE_INVOICE | CREDIT_NOTE | DEBIT_NOTE`
  (plain `String`, validated by Zod, not a Prisma enum — safe to extend without
  a migration).
- `Document.sourceDocumentId` / `convertedTo` form a self-referential
  `DocumentConversion` relation (one-to-one chain).
- `Document.status = 'CONVERTED'` marks the source after conversion.
- `ALLOWED_CONVERSIONS` map lives in both `server/src/services/document/helpers.ts`
  and `src/features/invoices/invoice.constants.ts`:
  `ESTIMATE → SALE_ORDER | SALE_INVOICE`, `SALE_ORDER → SALE_INVOICE | DELIVERY_CHALLAN`,
  `DELIVERY_CHALLAN → SALE_INVOICE`.
- `POST /api/documents/:id/convert` route is live with idempotency + replay protection.
- `src/features/invoices/components/ConvertDocumentDrawer.tsx` exists (FE component).

**Frontend — INCOMPLETE.**

- `InvoicesPage` only loads `SALE_INVOICE` docs. There are no dedicated list or
  detail pages for `ESTIMATE`, `SALE_ORDER`, or `DELIVERY_CHALLAN`.
- No nav entry / route for Estimates, Sale Orders, or Delivery Challans.
- `ConvertDocumentDrawer` exists but is only wired to `InvoiceDetailPage`.
- No pipeline timeline widget showing the conversion chain on a document.

**Gap:** Add routes, list pages, detail pages, nav entries, and a pipeline
breadcrumb/timeline for the three pre-invoice document types. No schema work.

---

### #132 Multiple Price Lists

**Backend — COMPLETE.**

- `PriceList`, `PriceListEntry` (ABSOLUTE / PERCENT_OFF / FIXED_OFF modes), and
  `PartyPricing` (per-party product overrides) are all in schema.
- `Business.defaultPriceListId` FK + `Party.priceListId` FK exist.
- Services: `price-list.service.ts`, `price-list-entry.service.ts`,
  `price-list-assign.service.ts` all present.
- Routes: `price-lists.routes.ts`, `price-list-entries.routes.ts`,
  `price-list-assign.routes.ts` all registered.

**Frontend — COMPLETE for management; INCOMPLETE for invoice form.**

- `PriceListsPage`, `PriceListDetailPage`, `BulkAssignDrawer` exist and are
  routed.
- `useLineItemResolver.ts` and `useLinePriceMeta.ts` exist and resolve price
  from the party's price list or `PartyPricing` entry.
- `PriceSourceHint.tsx` exists (shows which tier a line price came from).
- Gap: `use-party-tier.ts` resolves the party's tier but there is no UI to
  **override** the price list mid-invoice (e.g. switch from Wholesale to
  Retail for a single invoice). This is the remaining missing piece.

**Gap (small):** Optional price-list override selector on the Create/Edit
invoice form — lets the user pick a different tier without permanently
reassigning the party. No schema work; pure FE + one query param to the
document-create API.

---

### #133 BOGO / Free-Item Support

**Backend — COMPLETE.**

- `DocumentLineItem.isFreeItem Boolean @default(false)` exists in schema.
- Calc layer (`document-calc.ts`) already excludes free-item lines from totals.
- Stock still decrements for free lines (correct — goods move).
- `invoicing.bogo` permission defined in roles system.
- `requireBogoIfFreeItem` middleware guards the endpoint.

**Frontend — COMPLETE.**

- `useBogoPermission.ts` exists (gates the toggle to `owner` role, pending
  custom-role wiring).
- `LineItemEditor.tsx` contains the free-item toggle.
- `invoice-calc.utils.ts` handles `isFreeItem` in totals computation.
- Translation keys present in ext28 files.

**Gap:** Custom-role `invoicing.bogo` permission is not yet wired to the
`useBogoPermission` hook — it only checks `role === 'owner'`. This is a
one-file FE fix.

---

### #134 Invoice Custom Fields

**Backend — COMPLETE.**

- `CustomFieldDefinition` model with `entityType = 'DOCUMENT'`, `documentTypes
  String[]`, `fieldType TEXT | NUMBER | DATE | DROPDOWN`, `required`, `sortOrder`,
  `showOnInvoice` columns — all in schema.
- `DocumentCustomFieldValue` (documentId, fieldDefId, businessId, valueJson) —
  in schema.
- `document/custom-fields.ts` service with `persistDocumentCustomFieldValues`
  and `listDocumentCustomFields` — live and called from create/update document
  flows.
- Management UI: `DocumentCustomFieldsPage`, `DocumentCustomFieldDrawer`,
  `DocumentCustomFieldRow` exist in `src/features/settings/`.

**Frontend — INCOMPLETE on document forms.**

- `InvoiceCustomFieldsSection.tsx` exists but only wired to `SALE_INVOICE`
  form.
- Custom fields are NOT rendered in Estimate / Sale Order / Delivery Challan
  forms because those forms don't exist yet (gap from #122).
- Custom fields are NOT rendered in the document PDF template (architect must
  confirm scope of `showOnInvoice` flag).

**Gap:** Wire `InvoiceCustomFieldsSection` into Estimate / SO / DC forms (part
of #122 FE work). Add `showOnInvoice` rendering in the PDF template (small
BE/template work). No schema work.

---

## Goals

- **#122:** Give Raju a one-tap "Convert" flow and a visual pipeline showing
  where every deal sits in the Estimate→Order→Challan→Invoice chain.
- **#132:** Let Priya override a party's default price-list tier on a
  per-invoice basis without permanently changing the party's record.
- **#133:** Allow a cashier with BOGO permission (not just owner) to mark any
  line item as free; the invoice still shows the item with ₹0 subtotal.
- **#134:** Ensure document custom fields defined in Settings appear on all
  document types (Estimate, SO, DC, Invoice) in both form and PDF.

---

## Non-Goals

- Purchase pipeline (PO → Purchase Invoice) — conversion already works via
  `ConvertDocumentDrawer`; dedicated list pages are out of scope for this epic.
- Multi-step approval workflow on Sale Orders — deferred.
- Partial delivery (split Challan from one SO) — deferred; current 1-to-1
  conversion chain only.
- Price-list analytics / pricing history — deferred to Epic D CRM.
- BOGO report / "free items given" analytics — deferred.
- Custom field CSV export — deferred.
- GST on BOGO lines — out of scope (no GST in MVP per CLAUDE.md).

---

## User Stories

**Raju — Micro retailer**
- As Raju, I want to create an Estimate for a customer, then convert it to a
  Sale Invoice with one tap, so I stop re-entering the same items twice.
- As Raju, I want to mark a bonus item as "Free" on the invoice so the
  customer sees it listed but charged ₹0.

**Priya — Growing wholesaler**
- As Priya, I want to create a Sale Order for a new customer who usually gets
  the Retail price, but override them to Wholesale tier for this one order.
- As Priya, I want my "Delivery Terms" custom field to appear on every Delivery
  Challan PDF automatically.
- As Priya, I want to see a timeline on every document showing which Estimate
  it came from and which Invoice it turned into.

**Amit — Multi-location distributor**
- As Amit, I want my staff (not just owner) to be able to grant free items when
  they have the `invoicing.bogo` role permission.
- As Amit, I want a list of all open Sale Orders so I can track which ones
  still need to be dispatched or invoiced.

---

## API Surface

New endpoints (gaps to fill):

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/documents?type=ESTIMATE` | Estimate list (existing endpoint, new FE route) |
| `GET` | `/api/documents?type=SALE_ORDER` | Sale Order list |
| `GET` | `/api/documents?type=DELIVERY_CHALLAN` | Delivery Challan list |
| `GET` | `/api/documents/:id` | Document detail (existing, reused for all types) |
| `POST` | `/api/documents/:id/convert` | Convert doc (existing, already wired) |
| `GET` | `/api/documents/:id/lineage` | **NEW** — return the full conversion chain for a document (source → children) |

Existing endpoints reused without change:
- `GET /api/price-lists` — list for tier override selector
- `GET /api/price-lists/:id/entries?productIds[]=` — resolve entry rates
- `PATCH /api/documents/:id` — passes optional `priceListId` override in body (architect to confirm if field exists or must be added to Document model)
- `POST /api/documents` — `priceListId` field to be accepted for invoice-time override
- `GET /api/documents/:id/custom-fields`
- `PUT /api/documents/:id/custom-fields`

---

## DB Additions / Changes

> Full migration design owned by architect. This section flags what is needed
> and the ordering risks.

### #122 Sales Pipeline
No schema changes. All models exist.

### #132 Price Lists — invoice-level override
`Document` may need a `priceListId String?` FK column for per-invoice tier
override (distinct from `Party.priceListId` which is the party's default).
Architect to decide: add FK to Document, or store in Document metadata JSON
if one exists.

Migration risk: additive nullable column — low risk, can be zero-downtime.

### #133 BOGO
No schema changes (`isFreeItem` already exists on `DocumentLineItem`).
Only FE fix needed for custom-role wiring.

### #134 Custom Fields
No schema changes (all tables exist, `documentTypes` array already supports
ESTIMATE / SALE_ORDER / DELIVERY_CHALLAN).
Backend gap: `showOnInvoice` flag on `CustomFieldDefinition` must be respected
by the PDF render service (`pdf.service.ts`). Architect to audit this path.

### Migration Ordering Risk (#122 audit result)
Schema audit is DONE (above). No migrations needed for #122, #133, #134.
Only potential migration is the `Document.priceListId` nullable FK for #132
override. This must run FIRST before any FE release that sends the field.
Ordering: schema migration → deploy backend → deploy frontend.

---

## 4 UI States — per screen

### Estimates List Page

| State | Description |
|-------|-------------|
| Loading | Skeleton rows (3 shimmer cards, same pattern as InvoicesPage) |
| Empty | "No estimates yet. Create your first estimate to share a quote with a customer." + "New Estimate" CTA |
| Error | "Could not load estimates. Tap to retry." + retry button |
| Success | List of EstimateCard rows; filter bar (date, party, status); summary bar (total amount) |

### Sale Orders List Page

| State | Description |
|-------|-------------|
| Loading | Skeleton rows (3 shimmer cards) |
| Empty | "No sale orders yet. Convert an estimate or create one directly." + "New Sale Order" CTA |
| Error | "Could not load sale orders. Tap to retry." + retry button |
| Success | List of SaleOrderCard rows; filter bar; "Open / Converted" status filter |

### Delivery Challans List Page

| State | Description |
|-------|-------------|
| Loading | Skeleton rows |
| Empty | "No delivery challans yet. Create one from a sale order when goods are dispatched." + "New Challan" CTA |
| Error | "Could not load challans. Tap to retry." |
| Success | List rows; transport details visible on card (vehicle number if set) |

### Document Detail (all types) — Pipeline Timeline Widget

| State | Description |
|-------|-------------|
| Loading | Shimmer timeline strip (2–4 steps wide) |
| No lineage | Widget hidden (standalone document, no conversion chain) |
| Error | Widget silently hidden (non-critical; toast logged to console) |
| Has lineage | Horizontal step row: EST-001 → SO-001 → INV-001 (current step highlighted; tappable to navigate) |

### Convert Document Drawer

| State | Description |
|-------|-------------|
| Idle | Sheet with allowed target types shown as radio cards; "Convert" primary button |
| Converting | Button becomes spinner, sheet locked |
| Error | Toast: "Could not convert. [reason]. Try again." Sheet stays open |
| Success | Sheet closes; navigates to new document detail; toast: "Converted to [type] successfully" |

### Create / Edit Estimate & Sale Order Form

| State | Description |
|-------|-------------|
| Loading | Skeleton form (same as CreateInvoicePage skeleton) |
| Error | Full-page error state with retry |
| Editing | Same form as CreateInvoicePage; type selector pre-set; BOGO toggle visible if permitted |
| Saving | Submit button spinner; form locked |

### Price-List Override Selector (on invoice/SO/estimate form)

| State | Description |
|-------|-------------|
| Loading | Inline skeleton chip under Party search |
| No lists defined | Selector hidden |
| Party has default list | Chip shows "Tier: Wholesale ▼" pre-filled from party record |
| Overridden | Chip shows selected tier name with a reset icon; line item prices recalculate |

### Custom Fields Section (all document forms)

| State | Description |
|-------|-------------|
| Loading | Skeleton input rows |
| No fields defined | Section hidden |
| Has fields | Rendered below "Details" section; required fields show asterisk |
| Validation error | Inline error under each invalid field; form submit blocked |

---

## Rollout Plan

### PR1 — Sales Pipeline FE + Lineage API
- New backend: `GET /api/documents/:id/lineage` endpoint
- New FE: EstimatesPage, EstimateDetailPage, SaleOrdersPage, SaleOrderDetailPage,
  DeliveryChallansPage, ChallanDetailPage
- Reuse: CreateInvoicePage / EditInvoicePage rendered with `type` prop (Estimate,
  SO, DC share the same form engine — only labels differ)
- New FE component: `PipelineTimeline` (consumes lineage endpoint)
- Wire: `ConvertDocumentDrawer` on all three detail pages
- Wire: `InvoiceCustomFieldsSection` on all three forms
- Nav: Add Estimates / Sale Orders / Delivery Challans to nav (behind
  `invoicing.read` permission)
- i18n: New translation keys for all three doc types
- No schema migration

### PR2 — Price-List Per-Invoice Override
- Schema (if needed): `Document.priceListId String?` nullable FK
- Migration: additive nullable — zero-downtime
- Backend: accept `priceListId` on `POST /api/documents` and `PATCH /api/documents/:id`
- FE: `PriceListOverrideSelector` component on Create/Edit form; integrates with
  `useLineItemResolver` to recalculate prices on tier change

### PR3 — BOGO Custom-Role Wiring
- FE only: update `useBogoPermission` to check `permissions.includes('invoicing.bogo')`
  in addition to `role === 'owner'`
- No schema, no backend, no migration
- Small PR — can ship with PR1 or standalone

### PR4 — Custom Fields PDF Rendering
- Backend: audit `pdf.service.ts` — render `showOnInvoice = true` fields in the
  PDF template for all document types
- FE: ensure `InvoiceCustomFieldsSection` passes `documentType` filter correctly
  for ESTIMATE / SALE_ORDER / DELIVERY_CHALLAN
- No schema migration

---

## Open Questions for Architect

1. **Document.priceListId** — Should the per-invoice price-list override be stored
   as a FK on `Document`, or should the existing `Document` metadata / notes JSON
   be repurposed? FK is cleaner; architect to confirm migration feasibility given
   document table size.

2. **Lineage depth** — The current conversion chain is one-to-one (single
   `sourceDocumentId` FK). Is there a future where one SO spawns multiple
   Delivery Challans (partial delivery)? If yes, the lineage model needs to
   change to one-to-many before PR1 ships. Flag now or defer?

3. **Shared form vs. separate pages** — CreateInvoicePage + its form hooks are
   large files. Should Estimate / SO / DC render via `type` prop on the same
   page component, or get their own page files that import a shared `DocumentForm`?
   The latter is cleaner for per-type guards but adds ~3 files.

4. **isFreeItem stock decrement** — Confirm the current server-side behaviour:
   a free line DOES decrement stock (correct for BOGO — goods leave). The BOGO
   scope does not change this. Architect to verify and document in the service.

5. **PDF custom fields** — `showOnInvoice` flag exists. Where in the PDF template
   should custom fields appear? After the line-items table? In a separate section?
   Priya's "Delivery Terms" field on a challan PDF — does it appear in the
   header area or footer? Design call for architect + frontend to align on.

6. **Nav placement** — Do Estimates, Sale Orders, Delivery Challans each get their
   own BottomNav tab, or are they grouped under a "Sales" hub page with sub-tabs?
   The current BottomNav has 5 fixed slots. A "Sales" hub (Invoices + pre-invoice
   types) is likely the right pattern. Architect to propose nav IA.

---

## Acceptance Criteria

- [ ] `curl GET /api/documents?type=ESTIMATE` with valid auth → `{ success: true, data: { documents: [...] } }`
- [ ] `curl GET /api/documents?type=SALE_ORDER` → same shape
- [ ] `curl GET /api/documents?type=DELIVERY_CHALLAN` → same shape
- [ ] `curl GET /api/documents/:id/lineage` → `{ source: {...} | null, convertedTo: {...} | null }`
- [ ] `curl POST /api/documents/:id/convert` with `targetType: SALE_ORDER` on an ESTIMATE → `201`
- [ ] Without auth → `401` on all above
- [ ] Convert an already-converted document → `400` with `Document has already been converted`
- [ ] Screenshot: EstimatesPage loading state, empty state, error state, list state
- [ ] Screenshot: Estimate detail with PipelineTimeline showing EST → SO chain
- [ ] Screenshot: ConvertDocumentDrawer on Estimate detail — idle, converting, success
- [ ] Screenshot: CreateEstimatePage form with custom fields section
- [ ] Screenshot: price-list override selector showing tier chip
- [ ] Screenshot: LineItemEditor with isFreeItem toggle visible (owner role)
- [ ] 375px — no overflow on all new pages
- [ ] 320px — no overflow on all new pages
- [ ] `tsc --noEmit` clean on both server and client
- [ ] `scripts/enforce-offline.mjs` passes (all mutations use `api()` with entityType/entityLabel)
- [ ] i18n keys present in both `translations.en` and `translations.hi` for all new copy

---

## QA Checklist

Verifier must confirm each item before epic is closed:

- [ ] Create Estimate → Convert to Sale Order → Convert to Sale Invoice: full chain completes, statuses update correctly
- [ ] Source document status shows CONVERTED after conversion; cannot be converted again
- [ ] PipelineTimeline on the Invoice shows EST-001 → SO-001 → INV-001 chain (3 steps)
- [ ] Price-list tier override on Create Invoice: changing tier recalculates all line item rates
- [ ] Resetting tier override reverts prices to party's default tier
- [ ] Free item line: grandTotal excludes the free item; PDF shows item with ₹0 subtotal; stock decrements
- [ ] Staff with `invoicing.bogo` permission can see and use the free-item toggle
- [ ] Staff without `invoicing.bogo` cannot see the free-item toggle
- [ ] Required custom field missing → form submit blocked with inline error
- [ ] Optional custom field empty → form submits successfully
- [ ] Custom field with `showOnInvoice = true` appears in PDF
- [ ] Custom field with `showOnInvoice = false` does NOT appear in PDF
- [ ] Offline: Create Estimate while offline → queued with entityType `estimate` and entityLabel = party name
- [ ] Navigation: Estimates / Sale Orders / Delivery Challans accessible from nav without 404

---

## Out of Scope (explicit)

- Purchase-side pipeline pages (PO list, PO detail) — PO already works via ConvertDocumentDrawer
- Partial delivery / split challan (one SO → multiple DCs)
- Multi-step approval / sign-off on Sale Orders
- Price-list analytics, pricing audit log
- BOGO analytics / "free items given" report
- Custom field CSV export
- GST treatment on free items
- Payment recording from Estimate or Sale Order detail pages
- E-invoice / E-way bill compliance for Delivery Challan (already gated to SALE_INVOICE / PURCHASE_INVOICE)
