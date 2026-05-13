# ARCHITECTURE — Phase 5 Epic B: Sales Workflow

**Status:** DRAFT — 2026-05-13
**Author:** architect agent (per Sawan)
**Source scope:** `docs/SCOPE_phase5_sales_workflow.md` (user-approved)
**Companion:** `docs/ARCHITECTURE_phase5_marketing_comms.md` (Epic A)
**Reuses:** Polymorphic `Document` model + `ALLOWED_CONVERSIONS` (already shipped in `server/src/services/document/helpers.ts`); invoice form primitives (`LineItemEditor`, `useInvoiceForm`, `invoice-calc.utils.ts`).

---

## 0. Guiding constraints (re-stated from project rules)

- Mobile-first 320 px+, 4 UI states (loading / error / empty / success) for every screen.
- Files ≤ 200 LOC (HARD via `/f` skill). LineItemEditor (242 LOC) **must split before PR1**.
- No `any`. All client API calls go through `api()` with `entityType` + `entityLabel`.
- Schema migrations: additive only — never `NOT NULL` an existing column without an explicit backfill PR. **All four PRs are pure-additive — no backfills needed.**
- All money in paise (Int). resolvePrice returns Int paise.
- Multi-tenant: every Prisma query in a service includes `businessId: req.user.businessId`. No exceptions.

This epic ships as **four sequential PRs**, each independently revertable by feature-flagged routes/UI and clean additive schema. Order: PR1 (BOGO) → PR2 (custom fields) → PR3 (pipeline UI) → PR4 (price lists). PR3 is FE-only on top of existing BE.

---

## 1. Module split

### 1.1 PR1 #133 — BOGO / free-item flag

#### 1.1.0 Pre-work: LineItemEditor split (NOT in PR1 — separate prep PR or first commit of PR1)

`src/features/invoices/components/LineItemEditor.tsx` currently 242 LOC. Split into:

```
src/features/invoices/components/
  LineItemEditor.tsx               # MODIFY · ≤120 LOC · parent orchestrator
  LineItemRow.tsx                  # NEW · ≤140 LOC · pure row JSX
  LineItemBatchPicker.tsx          # NEW · ≤60  LOC · extracted batch picker block
  hooks/useLineItemHandlers.ts     # NEW · ≤120 LOC · qty/rate/discount onChange callbacks
```

Snapshot tests added *before* the split, asserting identical render for 6 fixtures (with batch, without, with profit, free-item-off, discount AMOUNT, discount PERCENT). See §10 risk register.

#### 1.1.1 Server (PR1)

```
prisma/
  schema.prisma                              # MODIFY: +1 col on DocumentLineItem (isFreeItem)
  migrations/
    20260514_bogo_free_item_col/
      migration.sql                          # additive — see §2.1
services/document/
  helpers.ts                                 # NO CHANGE
  line-item-calc.service.ts                  # NEW · ≤180 LOC · pure calc — zero-out branch when isFreeItem
                                             #   (extracted from existing inline calc inside document-create/document-update)
  document-create.service.ts                 # MODIFY: route lineItem calc through line-item-calc.service
  document-update.service.ts                 # MODIFY: same
  document.validators.ts                     # MODIFY: extend lineItem Zod with isFreeItem?: boolean (default false)
```

#### 1.1.2 Client (PR1)

```
src/features/invoices/
  invoice.types.ts                           # MODIFY: LineItemFormData adds isFreeItem?: boolean
  invoice-calc.utils.ts                      # MODIFY: calculateLineTotal returns zeros when isFreeItem === true
  components/
    LineItemRow.tsx                          # MODIFY (post-split): add free-item toggle pill + visual "FREE" badge
    FreeItemToggle.tsx                       # NEW · ≤80 LOC · accessible Switch (44px target, aria-pressed)
  hooks/
    useLineItemHandlers.ts                   # MODIFY: handleFreeItemToggle resets rate/discount UI display, persists isFreeItem
```

### 1.2 PR2 #134 — Invoice custom fields

#### 1.2.1 Server (PR2)

```
prisma/
  schema.prisma                              # MODIFY: +1 col CustomFieldDefinition.documentTypes
                                             #         +1 model DocumentCustomFieldValue
  migrations/
    20260515_custom_field_doc_types_col/
      migration.sql                          # additive col w/ default — see §2.2
    20260516_document_custom_field_value/
      migration.sql                          # new table — see §2.2

routes/
  custom-field-definition.ts                 # NEW · ≤120 LOC · CRUD router, requireAuth
  document-custom-field.ts                   # NEW · ≤140 LOC · wired into document detail page (read-side only; writes go via document upsert)

services/custom-fields/
  custom-field-definition.service.ts         # NEW · ≤180 LOC · CRUD scoped by businessId
  custom-field-definition.validators.ts      # NEW · ≤120 LOC · Zod schemas
  document-custom-field.service.ts           # NEW · ≤180 LOC · resolve definitions for type + persist values atomically inside document tx
  document-custom-field.validators.ts        # NEW · ≤80 LOC

services/document/
  document-create.service.ts                 # MODIFY: after document row insert, call documentCustomFieldService.upsertMany(tx, doc.id, payload.customFields)
  document-update.service.ts                 # MODIFY: same, with delete-then-upsert semantics inside tx
```

#### 1.2.2 Client (PR2)

```
src/features/custom-fields/
  custom-fields.types.ts                     # NEW · ≤100 LOC
  custom-fields.service.ts                   # NEW · ≤140 LOC · reads (cacheReads: true — definitions are non-PII)
  custom-fields-crud.service.ts              # NEW · ≤160 LOC · mutations with entityType='custom-field'
  pages/
    CustomFieldDefinitionListPage.tsx        # NEW · ≤200 LOC · 4 states, filter by documentType
    CustomFieldDefinitionFormPage.tsx        # NEW · ≤200 LOC
  components/
    CustomFieldValueInput.tsx                # NEW · ≤160 LOC · renders correct input per fieldType
    DocumentCustomFieldsSection.tsx          # NEW · ≤180 LOC · embedded into InvoiceCreatePage / EstimateCreatePage / etc.
  hooks/
    useCustomFieldDefinitions.ts             # NEW · ≤100 LOC
```

### 1.3 PR3 #122 — Sales pipeline UI (FE-only, no schema)

```
src/app.routes.sales-workflow.tsx            # NEW · ≤140 LOC · RouteObject[] for /estimates,/sale-orders,/delivery-challans
src/App.tsx                                  # MODIFY: migrate from <Routes><Route/></Routes> to useRoutes(routes)
                                             #         (currently 246/250 — extraction REQUIRED, see §9)
src/config/routes.config.ts                  # MODIFY: +4 constants (ESTIMATES, SALE_ORDERS, DELIVERY_CHALLANS, PRICE_LISTS)
src/config/verticals.config.ts               # MODIFY: +4 NavKey entries
src/features/more/more.constants.ts          # MODIFY: +4 MoreMenuItem entries
src/lib/translations.en.ext28.ts             # NEW · ≤80 LOC
src/lib/translations.hi.ext28.ts             # NEW · ≤80 LOC
src/lib/translations.ts                      # MODIFY: import + spread ext28

src/features/sales-pipeline/                 # NEW feature folder (NOT under invoices/, deliberately top-level)
  pipeline.types.ts                          # ≤100 LOC · DocumentType union shared with server
  pipeline.service.ts                        # ≤180 LOC · listByType, getById — wrap GET /documents?type=…
  pipeline-crud.service.ts                   # ≤180 LOC · create/update/convert wrappers
  pipeline.constants.ts                      # ≤100 LOC · per-type labels, badge colors, allowed-conversion meta
  pages/
    EstimateListPage.tsx                     # ≤180 LOC · 4 states
    EstimateCreatePage.tsx                   # ≤180 LOC · reuses <InvoiceFormShell> with prop typeOverride='ESTIMATE'
    EstimateDetailPage.tsx                   # ≤200 LOC · shows convert CTA(s) per ALLOWED_CONVERSIONS
    SaleOrderListPage.tsx                    # ≤180 LOC
    SaleOrderCreatePage.tsx                  # ≤180 LOC
    SaleOrderDetailPage.tsx                  # ≤200 LOC
    DeliveryChallanListPage.tsx              # ≤180 LOC
    DeliveryChallanCreatePage.tsx            # ≤180 LOC
    DeliveryChallanDetailPage.tsx            # ≤200 LOC
  components/
    ConvertDocumentSheet.tsx                 # ≤180 LOC · bottom-sheet picker for target type
    PipelineStatusBadge.tsx                  # ≤80 LOC
    ConvertedFromBanner.tsx                  # ≤80 LOC · links back to source doc
  hooks/
    useConvertDocument.ts                    # ≤120 LOC · mutation, navigates to new doc on success
    usePipelineList.ts                       # ≤120 LOC

src/features/invoices/components/
  InvoiceFormShell.tsx                       # MODIFY: accept `type: DocumentType` prop; default 'SALE_INVOICE' (backward-compat)
                                             #   adjusts terminology ("Invoice #" → "Estimate #" etc.) via prop-driven labels
```

### 1.4 PR4 #132 — Multiple price lists

```
prisma/
  schema.prisma                              # MODIFY: +1 col on Party (defaultPriceListId)
                                             #         +1 model PriceList
                                             #         +1 model PriceListItem
  migrations/
    20260517_price_list_tables/
      migration.sql                          # new tables — see §2.4
    20260518_party_default_price_list_col/
      migration.sql                          # additive nullable col — see §2.4

routes/
  price-list.ts                              # NEW · ≤140 LOC · CRUD + bulk-item upsert, requireAuth

services/pricing/
  price-list.service.ts                      # NEW · ≤180 LOC · CRUD on PriceList + cascade isActive toggle
  price-list.validators.ts                   # NEW · ≤120 LOC
  price-list-item.service.ts                 # NEW · ≤180 LOC · bulk upsert (txn, chunks of 500)
  price-resolver.service.ts                  # NEW · ≤140 LOC · resolvePrice + resolvePricesBatch (see §3.4, §7)
  price-resolver.types.ts                    # NEW · ≤60 LOC

services/document/
  document-create.service.ts                 # MODIFY: before line-item insert, call price-resolver.resolvePricesBatch
                                             #   when payload line.rate is omitted (rate becomes optional on input)
  document-update.service.ts                 # MODIFY: same (only when explicitly re-resolving — default is to keep snapshot)

services/party/
  party.service.ts                           # MODIFY: include defaultPriceListId in selects; validate FK existence
  party.validators.ts                        # MODIFY: defaultPriceListId?: string (cuid)
```

Client (PR4):

```
src/features/price-lists/
  price-lists.types.ts                       # ≤100 LOC
  price-lists.service.ts                     # ≤160 LOC · cacheReads: true (non-PII)
  price-lists-crud.service.ts                # ≤180 LOC · entityType='price-list', entityLabel=name
  pages/
    PriceListPage.tsx                        # ≤180 LOC · list of price lists, 4 states
    PriceListDetailPage.tsx                  # ≤200 LOC · items grid + bulk import sheet
    PriceListFormPage.tsx                    # ≤160 LOC · create/rename
  components/
    PriceListItemRow.tsx                     # ≤140 LOC
    PriceListBulkImportSheet.tsx             # ≤180 LOC · paste/CSV → preview → apply
    PartyDefaultPriceListPicker.tsx          # ≤120 LOC · used inside Party edit page
  hooks/
    usePriceLists.ts                         # ≤100 LOC
    usePriceListItems.ts                     # ≤100 LOC

src/features/parties/components/PartyForm.tsx   # MODIFY: render PartyDefaultPriceListPicker
src/features/invoices/components/ProductPicker.tsx
                                                # MODIFY: when partyId is known, call resolvePrice locally
                                                #   via service wrapper to prefill rate (server still authoritative)
```

---

## 2. Prisma migration sequence

All four PRs are **purely additive**. Every new column is either nullable, or has a default applied retroactively by Postgres. No `NOT NULL` on existing rows. Order is enforced by Prisma's filename ordering and FK dependencies.

### 2.1 PR1 — `20260514_bogo_free_item_col`

```sql
ALTER TABLE "DocumentLineItem"
  ADD COLUMN "isFreeItem" BOOLEAN NOT NULL DEFAULT false;
```

Invocation:

```
npx prisma migrate dev --name bogo_free_item_col
```

Safe — `DEFAULT false` is applied retroactively by Postgres; no backfill PR.

### 2.2 PR2 — two migrations

**Migration A — `20260515_custom_field_doc_types_col`:**

```sql
ALTER TABLE "CustomFieldDefinition"
  ADD COLUMN "documentTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill-via-default trick: existing rows that already have an entityType
-- of 'INVOICE' should be reachable. We do NOT backfill in a separate step
-- because we can update inside the same migration (constant-time, no data shape change).
UPDATE "CustomFieldDefinition"
  SET "documentTypes" = ARRAY['SALE_INVOICE']
  WHERE "entityType" = 'INVOICE' AND cardinality("documentTypes") = 0;
```

Note: this `UPDATE` is acceptable inside a *new-column* migration because it operates on a column being introduced in the same statement and never makes the column NOT NULL after the fact (it already is). It is NOT a separate backfill step on an existing column.

**Migration B — `20260516_document_custom_field_value`:**

```sql
CREATE TABLE "DocumentCustomFieldValue" (
  "id"          TEXT PRIMARY KEY,
  "documentId"  TEXT NOT NULL REFERENCES "Document"("id") ON DELETE CASCADE,
  "fieldDefId"  TEXT NOT NULL REFERENCES "CustomFieldDefinition"("id") ON DELETE RESTRICT,
  "valueJson"   JSONB NOT NULL,
  "businessId"  TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "DocumentCustomFieldValue_doc_field_uq" UNIQUE ("documentId","fieldDefId")
);
CREATE INDEX "DocumentCustomFieldValue_business_idx"
  ON "DocumentCustomFieldValue"("businessId","documentId");
```

Invocations:

```
npx prisma migrate dev --name custom_field_doc_types_col
npx prisma migrate dev --name document_custom_field_value
```

### 2.3 PR3 — **no schema changes.** FE-only on top of existing polymorphic Document model.

### 2.4 PR4 — two migrations

**Migration A — `20260517_price_list_tables`** (must run before Party col migration because Party FK references PriceList):

```sql
CREATE TABLE "PriceList" (
  "id"          TEXT PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "businessId"  TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
  "currency"    TEXT NOT NULL DEFAULT 'INR',
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "PriceList_business_active_idx"
  ON "PriceList"("businessId","isActive");
CREATE UNIQUE INDEX "PriceList_business_name_uq"
  ON "PriceList"("businessId","name");

CREATE TABLE "PriceListItem" (
  "id"            TEXT PRIMARY KEY,
  "priceListId"   TEXT NOT NULL REFERENCES "PriceList"("id") ON DELETE CASCADE,
  "productId"     TEXT NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "priceInPaise"  INTEGER NOT NULL CHECK ("priceInPaise" >= 0),
  CONSTRAINT "PriceListItem_list_product_uq" UNIQUE ("priceListId","productId")
);
CREATE INDEX "PriceListItem_product_idx" ON "PriceListItem"("productId");
```

**Migration B — `20260518_party_default_price_list_col`:**

```sql
ALTER TABLE "Party"
  ADD COLUMN "defaultPriceListId" TEXT
    REFERENCES "PriceList"("id") ON DELETE SET NULL;
CREATE INDEX "Party_defaultPriceList_idx"
  ON "Party"("defaultPriceListId")
  WHERE "defaultPriceListId" IS NOT NULL;
```

Nullable + `ON DELETE SET NULL` — safe additive, no backfill, no NOT NULL flip later.

Invocations:

```
npx prisma migrate dev --name price_list_tables
npx prisma migrate dev --name party_default_price_list_col
```

**Order summary across the epic:** add-col (PR1) → add-col + new table (PR2) → no-op (PR3) → new tables + add-col (PR4). Zero backfills, zero NOT-NULL flips.

---

## 3. Backend service shapes

Every route below is mounted under `requireAuth`. Every Prisma read/write **scopes by `businessId: req.user.businessId`**. Every handler wraps via `asyncHandler`. Zod schemas live in the matching `*.validators.ts`.

### 3.1 PR1 — BOGO

No new endpoints. Existing `POST /documents` and `PUT /documents/:id` validators extend:

```ts
// document.validators.ts
const lineItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().positive(),
  rate: z.number().int().nonnegative(),
  discountType: z.enum(['AMOUNT','PERCENTAGE']).optional(),
  discountValue: z.number().nonnegative().optional(),
  isFreeItem: z.boolean().optional().default(false),  // NEW
  batchId: z.string().cuid().optional(),
})
```

`line-item-calc.service.ts` shape:

```ts
export interface LineCalcInput { quantity:number; rate:number; discountType?:DiscountType; discountValue?:number; gstRate?:number; isFreeItem?:boolean }
export interface LineCalcOutput { rate:number; discountAmount:number; taxableValue:number; cgstAmount:number; sgstAmount:number; igstAmount:number; cessAmount:number; lineTotal:number }
export function calculateLineAmounts(i: LineCalcInput): LineCalcOutput
```

**Money invariant** (enforced inside `calculateLineAmounts`): if `isFreeItem === true`, return `{rate:0,discountAmount:0,taxableValue:0,cgstAmount:0,sgstAmount:0,igstAmount:0,cessAmount:0,lineTotal:0}` while preserving `quantity` on the caller's payload (the caller writes the row).

### 3.2 PR2 — Custom fields

| Method | Path | Zod | Gate | Notes |
|---|---|---|---|---|
| GET | `/custom-fields/definitions` | listQuerySchema | requireAuth | Filter by `documentTypes` ?type=SALE_INVOICE |
| GET | `/custom-fields/definitions/:id` | idParamSchema | requireAuth | businessId scoped |
| POST | `/custom-fields/definitions` | createDefinitionSchema | requireAuth | idempotency middleware |
| PUT | `/custom-fields/definitions/:id` | updateDefinitionSchema | requireAuth | |
| DELETE | `/custom-fields/definitions/:id` | idParamSchema | requireAuth | soft-delete; cascade to values? **NO** — RESTRICT, return 409 if values exist |
| GET | `/documents/:id/custom-fields` | idParamSchema | requireAuth | join through Document → values |

Document create/update inline:

```ts
// document-create.service.ts — inside existing prisma.$transaction
const doc = await tx.document.create({...})
if (payload.customFields?.length) {
  await documentCustomFieldService.upsertMany(tx, {
    documentId: doc.id,
    businessId: req.user.businessId,
    values: payload.customFields,
  })
}
```

Server validates: each `fieldDefId` must (a) belong to `req.user.businessId`, (b) include `payload.documentType` in its `documentTypes` array, (c) match the runtime type of `valueJson` against `fieldType`.

### 3.3 PR3 — Pipeline (zero new endpoints, FE-only)

Existing endpoints used:
- `POST /documents` (works for all types — pass `type: 'ESTIMATE' | 'SALE_ORDER' | 'DELIVERY_CHALLAN'`)
- `GET /documents?type=…&cursor=…`
- `POST /documents/:id/convert` (existing — see `document/convert.service.ts`; uses `ALLOWED_CONVERSIONS`)

No server changes. Verify existing `convertDocument` already: (a) checks `ALLOWED_CONVERSIONS`, (b) scopes by businessId, (c) sets `source.status = 'CONVERTED'` inside transaction. If any of these is missing, that becomes a tiny prep PR before PR3, not a code change inside PR3.

### 3.4 PR4 — Price lists

| Method | Path | Zod | Gate |
|---|---|---|---|
| GET | `/price-lists` | listQuerySchema | requireAuth |
| GET | `/price-lists/:id` | idParamSchema | requireAuth |
| POST | `/price-lists` | createPriceListSchema | requireAuth |
| PUT | `/price-lists/:id` | updatePriceListSchema | requireAuth |
| DELETE | `/price-lists/:id` | idParamSchema | requireAuth (cascade items via FK) |
| GET | `/price-lists/:id/items` | listItemsSchema (cursor) | requireAuth |
| POST | `/price-lists/:id/items/bulk` | bulkItemsSchema | requireAuth (chunked txn) |
| GET | `/pricing/resolve` | resolveQuerySchema | requireAuth (debug/preview) |

`price-resolver.service.ts` signatures:

```ts
export async function resolvePrice(args: {
  tx?: PrismaTx
  businessId: string
  partyId: string | null
  productId: string
}): Promise<{ priceInPaise: number; source: 'PARTY_PRICING' | 'DEFAULT_PRICE_LIST' | 'PRODUCT_SALE_PRICE' }>

export async function resolvePricesBatch(args: {
  tx?: PrismaTx
  businessId: string
  partyId: string | null
  productIds: string[]
}): Promise<Map<string, { priceInPaise: number; source: ResolveSource }>>
```

**Callers:**
- `document-create.service.ts` — when any line `rate` is missing, call `resolvePricesBatch` once for all such products.
- `document-update.service.ts` — same, but only for **newly-added** lines; existing lines keep snapshot price (see §6).
- `ProductPicker.tsx` (client) — calls `/pricing/resolve` preview when product is added to a draft document.

**Precedence (top wins):**

1. `PartyPricing` row matching `(partyId, productId)` — existing model, unchanged.
2. `Party.defaultPriceListId → PriceListItem.priceInPaise`.
3. `Product.salePrice` (existing fallback).

If `partyId` is null, skip steps 1–2 and return `Product.salePrice` with `source='PRODUCT_SALE_PRICE'`.

---

## 4. State machine — PR3 conversion FSM

Allowed transitions (mirror of `ALLOWED_CONVERSIONS` in `helpers.ts`):

| From | To (allowed targets) |
|---|---|
| ESTIMATE | SALE_ORDER, SALE_INVOICE |
| PROFORMA | SALE_INVOICE |
| SALE_ORDER | SALE_INVOICE, DELIVERY_CHALLAN |
| PURCHASE_ORDER | PURCHASE_INVOICE |
| DELIVERY_CHALLAN | SALE_INVOICE |
| SALE_INVOICE | (terminal) |
| PURCHASE_INVOICE | (terminal) |
| CREDIT_NOTE | (terminal) |
| DEBIT_NOTE | (terminal) |

**States on each document row:** `DRAFT | OPEN | PARTIALLY_PAID | PAID | CONVERTED | CANCELLED`.

**Guard rules** (enforced inside `convertDocument` service transaction; FE shows the disabled state):

1. `source.status === 'CANCELLED'` → reject `400 CANNOT_CONVERT_CANCELLED`.
2. `source.status === 'CONVERTED'` → reject `409 ALREADY_CONVERTED` (idempotency / race protection).
3. `source.type === 'SALE_INVOICE' && source.status === 'PAID'` → reject `400 CANNOT_CONVERT_PAID_INVOICE` (the original scope explicitly excludes paid invoices).
4. `targetType ∉ ALLOWED_CONVERSIONS[source.type]` → reject `400 INVALID_CONVERSION`.

**FSM diagram:**

```
DRAFT ──submit──> OPEN
OPEN ──convert──> CONVERTED (terminal for source) + creates new Document in DRAFT
OPEN ──cancel──> CANCELLED (terminal)
OPEN ──pay──> PARTIALLY_PAID ──pay──> PAID (terminal, for SALE_INVOICE)
CONVERTED ──(no transitions)
CANCELLED ──(no transitions)
PAID ──(no convert allowed)
```

Convert is atomic: the source flips to `CONVERTED` and the new doc is inserted in the same `prisma.$transaction`. The unique guard is `source.status='CONVERTED'` check **inside** the transaction (SELECT … FOR UPDATE not needed — the UPDATE itself is the lock; the second concurrent caller sees `RowsAffected=0` because we'll write the UPDATE with `WHERE status != 'CONVERTED'` and check the count).

---

## 5. Data flow diagrams

### 5.1 PR4 — resolvePrice flow

```
                       ┌────────────────────────────┐
   line item draft ───▶│ document-create.service.ts │
   (partyId, prodId,   └──────────────┬─────────────┘
    rate?, qty)                       │
                                      │ if any rate omitted
                                      ▼
                       ┌────────────────────────────┐
                       │ resolvePricesBatch         │
                       │   businessId, partyId,     │
                       │   productIds[]             │
                       └──────────────┬─────────────┘
                                      │ 1 query each (3 max)
        ┌─────────────────────────────┼──────────────────────────────┐
        ▼                             ▼                              ▼
  PartyPricing                  Party.defaultPriceListId       Product.salePrice
  WHERE partyId IN …            → PriceListItem                WHERE id IN …
  AND productId IN …            WHERE priceListId IN …
  AND businessId=…              AND productId IN …
                                AND businessId=…
        │                             │                              │
        └────────────────┬────────────┴──────────────┬───────────────┘
                         │      merge by precedence  │
                         ▼                           ▼
              Map<productId,{paise, source}> ──────▶ Caller writes
                                                     DocumentLineItem.rate
                                                     (SNAPSHOT — never recomputed)
```

### 5.2 PR3 — conversion flow

```
   user taps "Convert to SALE_INVOICE"
              │
              ▼
   ┌─────────────────────────────────┐
   │ POST /documents/:id/convert     │
   │ { targetType: 'SALE_INVOICE' }  │
   └────────────────┬────────────────┘
                    ▼
       prisma.$transaction:
         1. SELECT source FOR (implicit row lock via UPDATE)
         2. UPDATE Document SET status='CONVERTED'
              WHERE id=:srcId AND status NOT IN ('CONVERTED','CANCELLED')
              RETURNING *
            ── if 0 rows → throw 409 ALREADY_CONVERTED
         3. validate ALLOWED_CONVERSIONS[src.type] contains target
         4. INSERT new Document {
              type: target,
              status: 'DRAFT',
              partyId, businessId,
              sourceDocumentId: src.id,
              ...snapshot of party header
            }
         5. INSERT DocumentLineItem rows
              copy {productId, qty, rate, discount, isFreeItem}
              recompute lineTotal via calculateLineAmounts
              (rates are SNAPSHOT from source — never re-resolved)
         6. copy DocumentCustomFieldValue rows where definition.documentTypes
              includes target type
              ─────────────▼
                  newDoc returned
                       │
                       ▼
              FE useConvertDocument
              navigates to /sale-invoices/:newDocId
```

---

## 6. Money math invariants

### PR1 — Free item

When `isFreeItem === true`, **all** of the following MUST equal `0` in both the calc service output and the persisted `DocumentLineItem` row:

- `rate`
- `discountValue`, `discountAmount`
- `taxableValue`
- `cgstAmount`, `sgstAmount`, `igstAmount`, `cessAmount`
- `lineTotal`

Preserved unchanged:
- `quantity` (the customer still gets N units of the free product)
- `productId`, `batchId`
- `isFreeItem` itself

Skipped:
- Profit calc (`profit`, `profitPercent` are not displayed in the row; aggregated profit excludes free-item lines)
- Stock-decrease for the free product **does** still apply on SALE_INVOICE/DELIVERY_CHALLAN — the unit physically leaves inventory.

### PR3 — Conversion

Prices are **snapshot at conversion time**. The new document's `DocumentLineItem.rate` is copied byte-for-byte from the source row. **Never** re-invoke `resolvePrice` during conversion. Rationale: source quote was a commitment to the customer; resolving again could change the price under their feet if a price list moved between quote and invoice.

If a user wants the new price they cancel-and-recreate; this is documented in the UI (small info tooltip on convert sheet).

### PR4 — Resolution

`resolvePrice` returns paise (Int). Callers may NOT do float math on the return value. If a UI needs a rupee display, convert via existing `paiseToRupees` helper from `invoice-format.utils.ts`.

---

## 7. Performance

### 7.1 resolvePrice — O(1) amortised per line

For a document with N line items, we do **exactly 3 queries** (not 3N):

1. `PartyPricing` — `WHERE businessId=$1 AND partyId=$2 AND productId IN ($3..$3+N) `
2. `PriceListItem` — `WHERE businessId=$1 AND priceListId=$2 AND productId IN (…)` (only fired if party has `defaultPriceListId`)
3. `Product` — `WHERE businessId=$1 AND id IN (…)` (already part of the existing document-create stock-check; we read `salePrice` from the same result set, no extra query)

`resolvePricesBatch` is the public API; `resolvePrice` (single) wraps it. Service callers that resolve one product at a time are a code-smell — lint rule deferred.

**Budget:** 3 indexed lookups by `(businessId, productId)` for up to 50 line items completes in <20 ms on Render Starter Postgres. Below the 100 ms p95 query budget. No N+1.

### 7.2 PR2 — Custom fields

Document detail page does **one** join: `Document → DocumentCustomFieldValue ← CustomFieldDefinition` filtered by `businessId`. Indexes on `(businessId, documentId)` cover the lookup.

### 7.3 PR3 — List pages

Each pipeline list page is a thin filter over existing `GET /documents?type=…` with cursor pagination (existing). Per-route lazy-loaded via `React.lazy` in `app.routes.sales-workflow.tsx` to stay under per-route 100KB gzip budget.

### 7.4 Bundle budget

PR3 adds ~9 new pages × ~5 KB each = ~45 KB gzipped, all lazy-loaded. Initial JS bundle untouched. PR2 + PR4 add ~3 routes each, also lazy-loaded.

---

## 8. File manifest with LOC budget

All files ≤ 200 LOC (HARD per `/f`). Files marked NEW are estimates; if they grow during implementation, split first, code second.

| File | New/Mod | LOC est. |
|---|---|---|
| `prisma/schema.prisma` | MOD | +5 lines PR1; +12 PR2; +35 PR4 |
| `prisma/migrations/20260514_bogo_free_item_col/migration.sql` | NEW | 2 |
| `prisma/migrations/20260515_custom_field_doc_types_col/migration.sql` | NEW | 6 |
| `prisma/migrations/20260516_document_custom_field_value/migration.sql` | NEW | 14 |
| `prisma/migrations/20260517_price_list_tables/migration.sql` | NEW | 24 |
| `prisma/migrations/20260518_party_default_price_list_col/migration.sql` | NEW | 6 |
| `server/src/services/document/line-item-calc.service.ts` | NEW | 180 |
| `server/src/services/custom-fields/custom-field-definition.service.ts` | NEW | 180 |
| `server/src/services/custom-fields/custom-field-definition.validators.ts` | NEW | 120 |
| `server/src/services/custom-fields/document-custom-field.service.ts` | NEW | 180 |
| `server/src/services/custom-fields/document-custom-field.validators.ts` | NEW | 80 |
| `server/src/routes/custom-field-definition.ts` | NEW | 120 |
| `server/src/routes/document-custom-field.ts` | NEW | 140 |
| `server/src/services/pricing/price-list.service.ts` | NEW | 180 |
| `server/src/services/pricing/price-list.validators.ts` | NEW | 120 |
| `server/src/services/pricing/price-list-item.service.ts` | NEW | 180 |
| `server/src/services/pricing/price-resolver.service.ts` | NEW | 140 |
| `server/src/services/pricing/price-resolver.types.ts` | NEW | 60 |
| `server/src/routes/price-list.ts` | NEW | 140 |
| `src/features/invoices/components/LineItemEditor.tsx` | MOD | 120 (down from 242) |
| `src/features/invoices/components/LineItemRow.tsx` | NEW | 140 |
| `src/features/invoices/components/LineItemBatchPicker.tsx` | NEW | 60 |
| `src/features/invoices/hooks/useLineItemHandlers.ts` | NEW | 120 |
| `src/features/invoices/components/FreeItemToggle.tsx` | NEW | 80 |
| `src/features/invoices/invoice-calc.utils.ts` | MOD | +20 |
| `src/features/custom-fields/*` (8 files) | NEW | ≤200 each |
| `src/features/sales-pipeline/*` (15 files) | NEW | ≤200 each |
| `src/features/price-lists/*` (10 files) | NEW | ≤200 each |
| `src/app.routes.sales-workflow.tsx` | NEW | 140 |
| `src/App.tsx` | MOD | 240 (migrate to useRoutes — see §9) |
| `src/config/routes.config.ts` | MOD | +8 |
| `src/config/verticals.config.ts` | MOD | +12 |
| `src/features/more/more.constants.ts` | MOD | +16 |
| `src/lib/translations.en.ext28.ts` | NEW | 80 |
| `src/lib/translations.hi.ext28.ts` | NEW | 80 |
| `src/lib/translations.ts` | MOD | +4 |

---

## 9. Cross-feature touches

### 9.1 `src/App.tsx` migration to `useRoutes`

App.tsx is currently at 246/250 LOC and uses `<Routes><Route .../></Routes>`. React Router v6 does **not** allow wrapping `<Routes>` children in an arbitrary component — `<Routes>` walks its direct children to build the match table. Importing a `RouteGroup` component would silently drop those routes.

**Pattern:** migrate App.tsx to call `useRoutes(routes)` where `routes: RouteObject[]` is composed by spreading per-feature route arrays:

```tsx
// src/App.tsx (post-migration)
import { useRoutes } from 'react-router-dom'
import { marketingRoutes } from './app.routes.marketing'
import { salesWorkflowRoutes } from './app.routes.sales-workflow'
import { coreRoutes } from './app.routes.core'

function App() {
  const element = useRoutes([
    ...coreRoutes,
    ...marketingRoutes,
    ...salesWorkflowRoutes,
  ])
  return <Providers>{element}</Providers>
}
```

This unblocks both Epic A and Epic B and keeps App.tsx at ~80 LOC permanently. Each per-feature `RouteObject[]` file owns its lazy imports.

### 9.2 routes.config.ts / verticals.config.ts / more.constants.ts

Add four entries to each (ESTIMATES, SALE_ORDERS, DELIVERY_CHALLANS, PRICE_LISTS). Confirmed no string collision with existing Phase 4 routes — Phase 4 ORDERS = `/orders` (custom orders for veg vendors); new PR3 entries are `/sale-orders`, `/estimates`, `/delivery-challans`. **Disjoint paths, disjoint constants, disjoint nav keys.**

### 9.3 translations

`src/lib/translations.{en,hi}.ext28.ts` — new pair. Wire in `translations.ts` via existing spread pattern (`{...en, ...enExt28}`). Strings: 4 vertical names × 2 langs + ~30 UI strings (convert sheet, free-item label, custom field section heading, price list page strings).

### 9.4 LineItemEditor split (already covered in §1.1.0)

---

## 10. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | LineItemEditor split introduces functional regression in invoice math | M | H (silent miscalc on bills) | Snapshot tests for 6 fixtures **before** split (same PR); manual create-invoice smoke on staging |
| R2 | `resolvePrice` N+1 in document-create | L | H (slow create, Postgres conn exhaustion under load) | Public API is `resolvePricesBatch`; mark single-resolve callers with TODO; service-level test asserts ≤3 queries for N=50 lines |
| R3 | Concurrent conversion of same source document → duplicate target docs | L | H (double inventory hit, double receivable) | Optimistic lock: `UPDATE Document SET status='CONVERTED' WHERE id=$1 AND status NOT IN ('CONVERTED','CANCELLED')` returning row count; 0 rows → 409. Whole convert flow inside one txn |
| R4 | CustomFieldDefinition.documentTypes backfill for legacy `entityType='INVOICE'` rows | L | M (legacy fields invisible on invoice page) | Same-migration UPDATE statement seeds `['SALE_INVOICE']` for existing INVOICE rows (see §2.2) |
| R5 | Phase 4 `/orders` (custom orders) confused with `/sale-orders` | L | L (UX confusion) | Distinct constants `ORDERS` vs `SALE_ORDERS`; distinct vertical labels in copy; QA gate in PR3 |
| R6 | App.tsx `useRoutes` migration breaks an unrelated route | M | M | Migrate in its own commit at the top of PR3; tsc clean + manual click-through every existing route on staging before merging |
| R7 | Custom field `valueJson` shape drift over time | M | M | `documentCustomFieldService.upsertMany` validates runtime type against `definition.fieldType` (TEXT/NUMBER/DATE/BOOLEAN/SELECT) before insert; 400 on mismatch |
| R8 | PriceListItem bulk import explodes Postgres conn pool | L | M | Bulk endpoint chunks at 500 rows per `prisma.createMany`, single connection per request; cap total upload at 10k items per call |
| R9 | Snapshot price on convert surprises users when source list changed | L | L | Tooltip on convert sheet "Prices copied from source. To use current prices, create fresh document." |
| R10 | Free-item line still triggers tax on combined invoice total via aggregate rounding | L | M | Calc service zero-out happens at line level *before* invoice-level totals are summed; integration test covers a mixed invoice (1 paid line + 1 free line) |

---

## 11. Rollout plan

Sequential merges to `master`, each tagged in prod:

1. **Prep PR (LineItemEditor split + snapshot tests).** Functional no-op. Tag `v-prep-li-split`. Hold 24 h.
2. **PR1 #133 BOGO.** Migration A. Feature is implicit (toggle visible to all users immediately — low-risk, no flag needed since `isFreeItem` defaults false on every existing row). Tag `v-bogo`. Hold 48 h, watch invoice-create error rate.
3. **PR2 #134 Custom fields.** Migrations B+C. Gated by `FEATURE_INVOICE_CUSTOM_FIELDS` env var on backend and `VITE_FEATURE_INVOICE_CUSTOM_FIELDS` on FE. Internal-only on Sawan phone first; flip 100% after 48h. Tag `v-custom-fields`.
4. **PR3 #122 Pipeline UI.** Zero schema. Gated by `VITE_FEATURE_SALES_PIPELINE`. Internal → 10% → 50% → 100%, 48h between stages. Tag `v-sales-pipeline`.
5. **PR4 #132 Price lists.** Migrations D+E. Gated by `FEATURE_PRICE_LISTS` / `VITE_FEATURE_PRICE_LISTS`. Internal → 100%. Tag `v-price-lists`.

Each PR is **independently revertable**: flip the env flag off (UI vanishes), schema additions are inert (nullable / defaulted). Migrations are never reverted in prod; if a column needs to die, a follow-up `DROP COLUMN` migration is shipped weeks later after confirming no readers.

---

## 12. Test plan

### Per PR — common scaffold

- **Unit**: pure functions with Vitest fixtures
- **Integration**: real Postgres via `prisma migrate dev` + transactional rollback per test
- **E2E**: Playwright on staging, viewport 375×812; covers 4 UI states (loading / error / empty / success) for every new page

### PR1 — BOGO

- Unit: `calculateLineAmounts` returns all-zero financials for `isFreeItem:true`, preserves qty
- Unit: invoice-level total excludes free-line contribution (paise-exact)
- Integration: create invoice with 1 paid + 1 free line; assert `Document.grandTotal == paid line total`; assert stock decreased for both products
- Integration: convert estimate with free line → new sale invoice preserves `isFreeItem`
- E2E: open create-invoice on iPhone-13 viewport, add product, toggle "Free", line total flips to ₹0, badge "FREE" visible

### PR2 — Custom fields

- Unit: validators reject wrong runtime type for `fieldType`
- Integration: create invoice with 2 custom fields → 2 `DocumentCustomFieldValue` rows; update invoice removing 1 → 1 row remains; delete invoice → values cascade
- Integration: definition with `documentTypes:['SALE_INVOICE','ESTIMATE']` shows on both forms; not on PURCHASE_INVOICE
- Multi-tenant: business A cannot read business B's definitions or values (403)
- E2E: definition list page → 4 states; field input rendering for TEXT/NUMBER/DATE/BOOLEAN/SELECT

### PR3 — Pipeline UI

- Unit: `usePipelineList` filters by type
- Integration (BE smoke): existing `convertDocument` rejects PAID source, CANCELLED source, double-convert (409)
- E2E: create estimate → tap Convert → SALE_INVOICE; new doc visible at /sale-invoices/:id with `ConvertedFromBanner` linking back
- E2E: each pipeline list page renders 4 states at 320px and 375px
- Regression: existing /invoices route still works post-`useRoutes` migration

### PR4 — Price lists

- Unit: `resolvePrice` precedence (PartyPricing > defaultPriceList > salePrice); `partyId:null` skips 1–2
- Integration: `resolvePricesBatch` issues ≤3 queries for N=50 line items (assert via `prisma.$on('query')` counter)
- Integration: bulk import 1000 items in a single call → chunked, succeeds, txn integrity (all-or-nothing)
- E2E: create price list → add 5 items → assign as Party default → create invoice for that party with no rate → rate prefilled correctly
- E2E: delete price list referenced by Party → Party.defaultPriceListId becomes NULL (ON DELETE SET NULL)

---

## Open questions

1. **Free items + stock decrement** — scope said "stock decreased for both products" (the assumed behaviour). Confirm: do free items ever NOT decrement stock (e.g. "marketing samples that are written off")? If yes, need a second toggle. Defaulting to "free items still decrement stock" for PR1.
2. **Custom field values on conversion** — current plan copies values where `definition.documentTypes` includes the target type. Confirm: do we want to **always** carry forward (even when target type isn't listed) or strict-filter? Defaulting to strict.
3. **Currency on PriceList** — schema has `currency` defaulting to `'INR'`. Are non-INR price lists in scope for PR4, or pure forward-compat? Defaulting to "forward-compat only, validator hard-pins to 'INR' in PR4".
4. **`convertDocument` existing implementation** — needs a 5-minute audit to confirm businessId scope and the optimistic-lock-via-UPDATE pattern is already in place. If not, prep PR before PR3.
5. **Per-vertical detail page CTAs** — does the "Convert" sheet need to support multi-step (e.g. ESTIMATE → SALE_ORDER → SALE_INVOICE as two clicks vs. one) or is single-hop sufficient? Defaulting to single-hop, with the next conversion available from the new doc.
