---
status: approved
feature: phase-5-epic-b-sales-workflow
created: 2026-05-14T00:00:00Z
approver: Sawan
high_risk_paths_touched:
  - server/prisma/schema.prisma   # PR2 only — additive nullable FK
agents_invoked:
  - scope-writer (output: docs/SCOPE_EPIC_B_sales_workflow.md)
  - architect (output: docs/ARCHITECTURE_EPIC_B_sales_workflow.md)
  # security (output: docs/SECURITY_AUDIT_EPIC_B_sales_workflow.md) — required before PR2 build
acceptance:
  backend:
    - tsc clean (server + client)
    - curl GET /api/documents?type=ESTIMATE → 200 success shape
    - curl GET /api/documents/:id/lineage → 200 with { source, convertedTo }
    - curl POST /api/documents/:id/convert → 201 (idempotent on Idempotency-Key)
    - curl 401 unauth path on all new + reused endpoints
    - curl 400 on convert-already-converted (regression guard)
    - PR2 only: POST /api/documents accepts priceListId; PATCH accepts priceListId
  frontend:
    - screenshots: 4 UI states × 3 list pages (Estimates / SO / DC)
    - screenshot: PipelineTimeline 3-step chain (EST → SO → INV)
    - screenshot: PriceListOverrideSelector chip — default / overridden / reset
    - screenshot: LineItemEditor free-item toggle for custom-role with invoicing.bogo
    - 320px + 375px overflow check on every new page
    - enforce-offline.mjs passes; every mutation uses api() with entityType/entityLabel
---

# ARCHITECTURE — Phase 5 Epic B: Sales Workflow

## 1. Summary & Scope Reaffirmation

Scope-writer's backend audit is **confirmed** by spot-reading the schema and
key services:

| Audit claim | Verified |
|---|---|
| `Document.sourceDocumentId @unique` + self-relation `DocumentConversion` exists | YES (`schema.prisma:919-921`) |
| `DocumentLineItem.isFreeItem Boolean @default(false)` exists | YES (`schema.prisma:1040`) |
| `CustomFieldDefinition.showOnInvoice` exists | YES (`schema.prisma:469`) |
| `Business.defaultPriceListId` + `Party.priceListId` FKs exist | YES (`schema.prisma:149, 381`) |
| `Document.priceListId` does NOT exist | CONFIRMED — only `Party.priceListId` and `PriceListEntry.priceListId` are present. PR2 needs the additive FK. |
| `convertDocument` rejects already-converted, draft, deleted | YES (`server/src/services/document/convert.ts:36-44`) |
| `useBogoPermission` only checks `role === 'owner'` | YES (`src/features/invoices/useBogoPermission.ts:17`) |
| PDF service does not render custom fields | CONFIRMED (no `customFields` token in `pdf.service.ts`) |

Net work: **4 PRs**, ~1 small schema migration (PR2), ~5 backend endpoints
extended, primarily a **frontend build** of 3 list + 3 detail pages, 1
shared form engine, 1 timeline widget, 1 override selector, 1 hook fix,
1 PDF section.

Non-goals (unchanged from PRD §Non-Goals): purchase pipeline UI, partial
delivery (1-to-many lineage), SO approval workflow, price-list analytics,
BOGO analytics, CSV export, GST on free items.

---

## 2. File Plan (mandatory, ≤250 LOC per file)

### PR1 — Sales Pipeline FE + Lineage API

| Path | Action | Est LOC | Layer |
|---|---|---|---|
| `server/src/services/document/lineage.ts` | create | ~90 | service |
| `server/src/services/document/__tests__/lineage.test.ts` | create | ~110 | test |
| `server/src/routes/documents.routes.ts` | modify (+~15) | +15 | route |
| `server/src/schemas/document.schemas.ts` | modify (+~10) | +10 | schema |
| `src/features/sales/sales.types.ts` | create | ~80 | types |
| `src/features/sales/sales.constants.ts` | create | ~70 | constants (labels, type→nav, ALLOWED_CONVERSIONS mirror) |
| `src/features/sales/sales.utils.ts` | create | ~120 | utils (pure — type→label, lineage→steps) |
| `src/features/sales/useDocumentList.ts` | create | ~150 | hook (typed wrapper around useInfiniteQuery for documents?type=) |
| `src/features/sales/useDocumentLineage.ts` | create | ~80 | hook |
| `src/features/sales/sales-list.service.ts` | create | ~120 | service (api() reads) |
| `src/features/sales/sales-lineage.service.ts` | create | ~60 | service |
| `src/features/sales/components/DocumentListCard.tsx` | create | ~180 | component (shared for EST/SO/DC) |
| `src/features/sales/components/DocumentListFilterBar.tsx` | create | ~160 | component |
| `src/features/sales/components/DocumentListSkeleton.tsx` | create | ~60 | component |
| `src/features/sales/components/DocumentEmptyState.tsx` | create | ~90 | component (variant by type) |
| `src/features/sales/components/PipelineTimeline.tsx` | create | ~220 | component (timeline strip + 4 states) |
| `src/features/sales/components/PipelineTimeline.css` | create | ~120 | style |
| `src/features/sales/EstimatesPage.tsx` | create | ~140 | page (thin — composes DocumentListPage with type=ESTIMATE) |
| `src/features/sales/SaleOrdersPage.tsx` | create | ~140 | page |
| `src/features/sales/DeliveryChallansPage.tsx` | create | ~140 | page |
| `src/features/sales/EstimateDetailPage.tsx` | create | ~200 | page |
| `src/features/sales/SaleOrderDetailPage.tsx` | create | ~200 | page |
| `src/features/sales/ChallanDetailPage.tsx` | create | ~210 | page |
| `src/features/sales/DocumentListPage.tsx` | create | ~220 | page (shared chassis; receives `type` prop) |
| `src/features/invoices/CreateInvoicePage.tsx` | modify | +~30 | page (accept `type` prop override; default SALE_INVOICE) |
| `src/features/invoices/EditInvoicePage.tsx` | modify | +~20 | page (route param→type) |
| `src/features/invoices/InvoiceDetailPage.tsx` | modify | +~10 | page (mount PipelineTimeline) |
| `src/router/routes.tsx` (or central router) | modify | +~30 | router (6 new routes) |
| `src/components/layout/BottomNav.tsx` | modify | +~15 | nav (replace Invoices slot with Sales hub entry — see Q6) |
| `src/features/sales/SalesHubPage.tsx` | create | ~180 | page (tabs: Invoices / Estimates / SOs / DCs) |
| `src/translations/en/ext36.ts` | create | ~120 | i18n |
| `src/translations/hi/ext36.ts` | create | ~120 | i18n |

PR1 totals: **~3,400 LOC** across 31 files. Largest single file capped at 220 LOC.

### PR2 — Price-List Per-Invoice Override (schema-touching)

| Path | Action | Est LOC | Layer |
|---|---|---|---|
| `server/prisma/schema.prisma` | modify | +3 | schema (1 FK + 1 relation + 1 index) |
| `server/prisma/migrations/<ts>_document_price_list_override/migration.sql` | create | ~12 | migration |
| `server/src/schemas/document.schemas.ts` | modify | +~6 | schema (Zod: priceListId optional uuid) |
| `server/src/services/document/create.ts` | modify | +~10 | service (persist priceListId) |
| `server/src/services/document/update.ts` | modify | +~10 | service |
| `server/src/services/document/selects.ts` | modify | +~3 | service (include priceListId in select) |
| `server/src/services/document/__tests__/price-list-override.test.ts` | create | ~140 | test |
| `src/features/invoices/invoice-api.types.ts` | modify | +~5 | types |
| `src/features/invoices/invoice-form.types.ts` | modify | +~5 | types |
| `src/features/pricing/usePriceListOverride.ts` | create | ~120 | hook |
| `src/features/pricing/components/PriceListOverrideSelector.tsx` | create | ~210 | component |
| `src/features/pricing/components/PriceListOverrideSelector.css` | create | ~70 | style |
| `src/features/invoices/components/EditInvoiceForm.tsx` | modify | +~20 | component (mount selector below party search) |
| `src/features/invoices/useInvoiceForm.ts` | modify | +~25 | hook (wire override into resolver) |
| `src/features/invoices/components/useLineItemResolver.ts` | modify | +~15 | hook (accept overrideListId; recompute on change) |
| `src/translations/en/ext36.ts` | modify | +~15 | i18n |
| `src/translations/hi/ext36.ts` | modify | +~15 | i18n |

PR2 totals: **~700 LOC** across 17 files. Schema migration is sole high-risk item — gated by `security` agent.

### PR3 — BOGO Custom-Role Wiring (one-hook FE fix)

| Path | Action | Est LOC | Layer |
|---|---|---|---|
| `src/features/invoices/useBogoPermission.ts` | modify | +~12 | hook (add permission check) |
| `src/features/invoices/__tests__/useBogoPermission.test.ts` | create | ~80 | test |

PR3 totals: **~92 LOC**. Can ship before or alongside PR1.

### PR4 — Custom Fields PDF Rendering

| Path | Action | Est LOC | Layer |
|---|---|---|---|
| `server/src/services/pdf/custom-fields-block.ts` | create | ~120 | service (renders showOnInvoice fields) |
| `server/src/services/pdf/custom-fields-block.types.ts` | create | ~40 | types |
| `server/src/services/pdf.service.ts` | modify | +~25 | service (inject block after line-items table) |
| `server/src/services/pdf/__tests__/custom-fields-block.test.ts` | create | ~110 | test |
| `src/features/invoices/components/InvoiceCustomFieldsSection.tsx` | modify | +~10 | component (accept `documentType` prop) |

PR4 totals: **~305 LOC** across 5 files.

**Epic total: ~4,500 LOC across 55 files.** No file exceeds 220 LOC.

---

## 3. Per-PR Design

### PR1 — Sales Pipeline FE + Lineage API

**Backend — single new endpoint.**

```
GET /api/documents/:id/lineage
Auth: required (cookie session)
Response 200: {
  success: true,
  data: {
    source:      { id, type, number, status, documentDate } | null,
    self:        { id, type, number, status, documentDate },
    convertedTo: { id, type, number, status, documentDate } | null,
    chain:       Array<{ id, type, number, status, documentDate }>  // root→leaf, ≤6 entries
  }
}
```

Service walks the `sourceDocumentId` chain UP from `:id` to root (max
6 hops — guard), then walks `convertedTo` DOWN from `:id` to leaf
(max 6 hops). Combined chain returned root→leaf. Single Prisma call
per hop is acceptable; depth-cap of 6 keeps p95 under 100ms even on
Render Postgres.

**Frontend — shared chassis.**

`DocumentListPage` is the chassis; thin wrappers (`EstimatesPage`,
`SaleOrdersPage`, `DeliveryChallansPage`) hard-code the `type` prop and
i18n key prefix. Detail pages are slightly less shared because of
type-specific actions (Challan has transport details, Estimate has
"Convert to SO/Invoice" CTAs) — three thin detail page files import a
shared `DocumentDetailShell` + per-type action blocks.

`PipelineTimeline` is a horizontal strip on detail pages:

```
[EST-001] → [SO-001] → [INV-001]
 grey       grey      ← current (blue, no chevron after)
```

Tap any non-current step → navigate to that document. Loading = shimmer
strip. No lineage = widget hidden (NOT empty state — we don't want noise
on standalone invoices created without an estimate).

**State machine — Convert flow** (already implemented in
`ConvertDocumentDrawer`, documented here for completeness):
```
IDLE → SUBMITTING → (SUCCESS → navigate-away | ERROR → IDLE with toast)
```

**Feature flag.** Sales pipeline pages gate on
`VITE_FEATURE_SALES_PIPELINE` (FE) + `FEATURE_SALES_PIPELINE` (BE).
Backend lineage endpoint returns 404 with `NOT_FOUND` when flag off.

**Offline.** All list queries use `api()` from `@/lib/api`. Lineage
endpoint reads opt-in `cacheReads: true` — safe to cache for session
(no cross-tenant data, just doc numbers/types of OWN docs). All
mutations (convert) pass `entityType: 'document'`, `entityLabel: <doc number>`.

### PR2 — Price-List Per-Invoice Override

**Schema delta.**

```prisma
model Document {
  // ... existing fields ...
  priceListId String?
  priceList   PriceList? @relation("DocumentPriceListOverride", fields: [priceListId], references: [id], onDelete: SetNull)

  @@index([priceListId])
}

model PriceList {
  // ... existing fields ...
  documentOverrides Document[] @relation("DocumentPriceListOverride")
}
```

Semantics: `Document.priceListId` is the **override** used at creation
time. It is independent of `Party.priceListId` (the party's default).
The resolver order is:
`Document.priceListId (override) → Party.priceListId (default) → Business.defaultPriceListId → null`.

Stored on Document for **audit traceability** (you can re-print a 6-month-old
invoice and see what tier was applied). Metadata JSON would lose this
on schema evolution and isn't queryable for reports — FK is the correct
choice (Q1 answer).

**API delta.** `POST /api/documents` and `PATCH /api/documents/:id` accept
`priceListId: z.string().uuid().optional().nullable()`. Server validates
the price list belongs to the same business (existing pattern from
`price-list.service.ts`).

**Frontend.** `PriceListOverrideSelector` is a chip below party search.
States covered in PRD §4-UI-States. On tier change it calls
`useLineItemResolver` with the new list ID — line item prices recompute
client-side (existing path). Reset icon clears override → falls back to
party default.

**State machine — Override selector:**
```
IDLE (showing party default tier)
  → OPENING_PICKER → IDLE (same default, picker closed)
  → OPENING_PICKER → APPLIED (override set, prices recomputed) → IDLE
  → APPLIED → RESETTING → IDLE
```

**Feature flag.** `VITE_FEATURE_PRICE_LIST_OVERRIDE` /
`FEATURE_PRICE_LIST_OVERRIDE`. Server ignores `priceListId` field when
flag off (silently drops, NOT 400 — forward-compat for older mobile
builds).

### PR3 — BOGO Custom-Role Wiring

Single-file change. Replace `useBogoPermission.ts:17` with:

```ts
const hasOwnerRole = current.role === 'owner'
const hasBogoPermission = current.permissions?.includes('invoicing.bogo') ?? false
return hasOwnerRole || hasBogoPermission
```

Auth context already exposes `permissions: string[]` per business. Test
covers all four matrix cells (owner+perm, owner+no-perm, staff+perm,
staff+no-perm). No flag — the backend `requireBogoIfFreeItem`
middleware is already the source of truth; this only un-hides the UI.

### PR4 — Custom Fields PDF Rendering

`pdf.service.ts` currently builds an HTML string passed to React-PDF /
Chromium. Insert a new `<CustomFieldsBlock>` after the line-items table
and before the totals row, but **only render `showOnInvoice = true`
fields**. Fields with values that are empty string/null are skipped to
avoid blank rows. Field order = `sortOrder` from `CustomFieldDefinition`.

```
┌─────────────────────────────┐
│ line items table            │
├─────────────────────────────┤
│ Custom fields (if any)      │  ← new
│   Delivery Terms: 7 days    │
│   PO Reference: PO-2241     │
├─────────────────────────────┤
│ subtotal / discounts / total│
└─────────────────────────────┘
```

Placement chosen because (a) it sits inside the data block, not the
header — header is for business identity; (b) "Delivery Terms" on a
challan reads naturally adjacent to the goods list; (c) it survives the
58mm thermal layout where header space is at a premium.

---

## 4. Open Questions — Answers

**Q1. `Document.priceListId` — FK vs metadata JSON?**
**Answer: nullable FK on `Document`.** Reasons: (1) audit trail — invoice
re-prints months later must show the tier applied at creation; (2)
queryability — reports like "revenue by tier" need an indexed column;
(3) migration is additive nullable, zero-downtime (see §5).

**Q2. Lineage depth — 1:1 vs 1:N?**
**Answer: keep 1:1 for this epic; document deferral path.** The
self-relation `@unique` constraint on `sourceDocumentId` is the right
guard for MVP — Raju/Priya don't do partial delivery in v1. Deferral
path: drop the `@unique`, add a `DocumentConversionLink` join table if
1-to-many becomes needed (e.g. one SO → multiple Challans for partial
delivery). The `GET /lineage` endpoint already returns a `chain[]`
array, so the API shape survives the upgrade — only the schema/service
layers change.

**Q3. Shared form via `type` prop vs separate page files?**
**Answer: shared form, multi-page entry points.** `CreateInvoicePage`
and `EditInvoicePage` accept an optional `type` prop (defaults to
`SALE_INVOICE`); routes for `/estimates/new`, `/sale-orders/new`, etc.
mount the same page with the prop set. This avoids 6 near-duplicate
page files (the form is already 95% identical — only labels, default
status, and a few type-specific guards differ). The 5% type-specific
logic goes through small per-type util functions in
`sales.utils.ts` (`getCreateTitle(type)`, `allowsTransportFields(type)`,
etc.). The risk (one large file) is mitigated by the existing 6-layer
split inside `src/features/invoices/` — `useInvoiceForm.ts` is already
the orchestrator and stays under 250 LOC.

**Q4. `isFreeItem` stock decrement — verify and document.**
**Answer: confirmed — free lines DO decrement stock.** This is correct
BOGO semantics (the goods physically leave the shelf). Verified by
reading `server/src/services/document/__tests__/sale-decrement.test.ts`.
PR3 changes nothing here; documentation note added to the BOGO comment
in `useBogoPermission.ts`. No regression test needed (existing test
suite already covers it).

**Q5. PDF custom field placement.**
**Answer: dedicated "Custom Details" block after the line-items table,
before totals.** See PR4 design ASCII above. For challans specifically,
custom fields render in the same block (no header-vs-footer fork) —
this keeps one code path for all four document types. Empty/null
values are skipped silently.

**Q6. Nav IA — Sales hub vs separate BottomNav tabs?**
**Answer: Sales hub page with internal tabs; one BottomNav slot.**
BottomNav has 5 fixed slots (CLAUDE.md / platform-shell C5-C6). Adding
3 new top-level tabs would force a redesign of every page's bottom
padding math. Instead:

```
BottomNav: [Home] [Parties] [Sales] [Reports] [More]
                                 ↓
SalesHubPage (top-tab bar): [Invoices | Estimates | SOs | Challans]
```

The "Sales" slot replaces the current "Invoices" slot. `InvoicesPage`
becomes the default tab inside `SalesHubPage`. Pre-existing deep links
to `/invoices` redirect to `/sales/invoices` via a router alias. Top
tab uses `top: var(--header-height)` per platform-shell C10.

---

## 5. Migration Plan (PR2 only)

Schema change is **additive nullable FK** — lowest-risk class of
migration. Sequence (per CLAUDE.md PRISMA_MIGRATION_RULES):

1. **Generate migration** (one step — no backfill, no NOT-NULL):
   ```
   npx prisma migrate dev --name document_price_list_override
   ```
   Emits SQL: `ALTER TABLE "Document" ADD COLUMN "priceListId" TEXT;`
   plus FK + index. Postgres takes a short `ACCESS EXCLUSIVE` lock on
   `Document` to add the column; nullable add is metadata-only and
   completes in milliseconds even on a large table. Adding the FK
   acquires a `SHARE ROW EXCLUSIVE` for validation — on a large table
   this can stall writes. Mitigation: create FK as `NOT VALID` first,
   then `VALIDATE CONSTRAINT` in a second migration outside peak.
   For Render Starter Postgres at current row counts (<100k Document
   rows in production), this is acceptable in one step.

2. **Deploy backend** with the new column readable but FE doesn't yet
   send the field. Backwards-compatible.

3. **Deploy frontend** with the selector. Field becomes user-visible.

4. **Verify** with a curl POST containing `priceListId` → row written
   with the FK populated.

**Rollback.** If the FE breaks production:
- Roll back the FE deploy (Vercel instant rollback).
- Column remains in DB (nullable, no data loss for rows without override).
- If the BE deploy itself is broken, roll back BE; the migration stays
  applied (additive nullable columns are safe to leave).
- Only if the migration itself corrupts data (highly unlikely for a
  nullable add): `ALTER TABLE "Document" DROP COLUMN "priceListId";`
  in a forward-fix migration. Never edit the original migration.

**Never** combine: add-column nullable, backfill, make-NOT-NULL.
For this epic only step 1 is needed (column stays nullable forever —
it's an OPTIONAL override).

---

## 6. Risks & Alternatives

**Data-shape risk (Q1/Q2 — lineage and override storage).** Going FK on
`Document.priceListId` locks us to one tier per document. Alternative:
JSON metadata column. We rejected JSON because reports need an indexed
column; the migration cost to escape JSON later is significantly higher
than the cost of adding the FK now. Lineage 1:1 has a known deferral
path (join table) — the API already returns `chain[]` so client code
doesn't need to change when we upgrade. Net risk: low.

**Type-prop coupling risk (Q3 — shared form).** Using `CreateInvoicePage`
with a `type` prop for all four create paths means a regression in the
shared form breaks all four flows simultaneously. Alternative: 4
separate page files importing a shared `<DocumentForm>` component.
Rejected because the form is genuinely one form (95% identical
behaviour) and 4 separate pages would create 4 places to update for
every form change. Mitigation: `__tests__/useInvoiceForm.test.ts`
already covers the form orchestrator; add 4 thin smoke tests
(`<CreateInvoicePage type='ESTIMATE' />` renders without error, etc.)
to lock per-type behaviour.

**Perf on lineage endpoint.** Worst case (deep chain): EST → SO → DC →
INV → CR_NOTE → DR_NOTE = 6 hops, each hop is a single indexed Prisma
query on `Document.id` and `Document.sourceDocumentId` (the latter is
`@unique`, hence indexed). Worst case = 12 queries × ~5ms = 60ms server
time, well inside p95 < 100ms budget. Mitigation: hard cap depth to 6
in the service (returns `truncated: true` flag in payload — never
discovered in production, just a guard). No DataLoader / batching
needed at this scale. If lineage shifts to 1-to-many later, fetch the
descendant subtree with a single recursive CTE — flagged in §Q2
deferral plan.

---

## 7. Acceptance Criteria → PR Mapping

| Acceptance criterion (PRD §Acceptance) | PR |
|---|---|
| `curl GET /api/documents?type=ESTIMATE / SALE_ORDER / DELIVERY_CHALLAN` 200 shape | PR1 (FE consumption — endpoint already exists) |
| `curl GET /api/documents/:id/lineage` returns `{ source, convertedTo, chain }` | PR1 |
| `curl POST /api/documents/:id/convert` 201 + 400 on re-convert | PR1 (regression guard, no logic change) |
| 401 unauth on all endpoints | PR1 |
| EstimatesPage 4 UI states screenshots | PR1 |
| Estimate detail with PipelineTimeline 3-step | PR1 |
| ConvertDocumentDrawer states on Estimate detail | PR1 |
| CreateEstimatePage form with custom fields section | PR1 |
| Price-list override selector — chip default/overridden/reset | PR2 |
| LineItemEditor isFreeItem toggle (owner) + custom-role with `invoicing.bogo` | PR3 |
| Custom field `showOnInvoice=true` appears in PDF; `false` does not | PR4 |
| 320px + 375px overflow check | PR1, PR2 |
| `tsc --noEmit` clean | all PRs |
| `enforce-offline.mjs` passes — `api()` + entityType/entityLabel on all mutations | PR1, PR2 |
| i18n keys present in en + hi for all new copy | PR1, PR2 |

---

## 8. Rollout

| Stage | Audience | Flag(s) | Verify before next |
|---|---|---|---|
| Internal | Sawan phone only | `FEATURE_SALES_PIPELINE=true`, `FEATURE_PRICE_LIST_OVERRIDE=true` on phone session | curl + 12 screenshots; Sawan signs off |
| 10% | hash(userId)%10===0 | percentage gate in BE middleware | 24h metrics: error rate <1%, p95 lineage <100ms |
| 50% | hash(userId)%2===0 | same | 48h metrics |
| 100% | all | flags-on globally | watch 7d, then strip flags in cleanup PR |

PR3 (BOGO hook) ships **without a flag** — it only widens an existing
permission check; rollback = revert one file.

PR4 (PDF custom fields) ships **without a flag** — gated by data
(no `showOnInvoice=true` fields = no change to output). Rollback = revert.

---

## 9. Gate for Build

- PR1 build: this doc + `task-manager` plan suffice.
- **PR2 build: REQUIRES `security` agent pass** before any edit to
  `server/prisma/schema.prisma`. The high-risk-paths gate
  (`~/.claude/hooks/check-plan-required.cjs`) will block the schema
  edit until `docs/SECURITY_AUDIT_EPIC_B_sales_workflow.md` exists
  and this doc's frontmatter lists it under `agents_invoked:`.
- PR3, PR4 builds: this doc suffices.
