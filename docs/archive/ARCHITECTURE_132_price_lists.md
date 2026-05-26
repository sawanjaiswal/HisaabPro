# ARCHITECTURE #132 — Price Lists (Tiered Pricing)

> Status: Draft · Author: Architect · Date: 2026-05-14
> Source: `docs/SCOPE_132_price_lists.md`

---

## Overview

Two new entities — `PriceList` (named tier per business) and `PriceListEntry`
(per-product price rule, qty-break aware) — plus a nullable FK on `Party`
(`priceListId`) and a nullable FK on `Business` (`defaultPriceListId`). The
existing `PartyPricing` table is preserved untouched and continues to win
over the tier price in the resolution order. `Product.sellingPrice` remains
the floor. A pure-function resolver, shared in spirit between server and
client, computes the effective unit price for any `(productId, partyId, qty)`
tuple; it is authoritative on the server at invoice save and mirrored on the
client for instant line autofill. Money stays in paise (Int); percent stays
in basis points (Int, `bps`) — no floats anywhere in the data layer.

---

## Schema

### New: `PriceList`

```prisma
model PriceList {
  id         String    @id @default(cuid())
  businessId String
  name       String    // max 60 chars (validated in zod)
  isDefault  Boolean   @default(false) // mirror of Business.defaultPriceListId; convenience flag, NOT SSOT
  isDeleted  Boolean   @default(false)
  deletedAt  DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  business Business         @relation(fields: [businessId], references: [id], onDelete: Restrict)
  entries  PriceListEntry[]
  parties  Party[]          @relation("PartyPriceList")

  @@unique([businessId, name])
  @@index([businessId, isDeleted])
}
```

SSOT for "which list is the business default" is `Business.defaultPriceListId`.
The `PriceList.isDefault` flag is a denormalised read-mirror maintained in the
same transaction as the Business write; it makes list-pages cheap to render
without a second join. Resolver code never trusts `isDefault` — it reads
`Business.defaultPriceListId`.

### New: `PriceListEntry` (qty-breaks ARE entries)

```prisma
enum PriceListMode {
  ABSOLUTE
  PERCENT_OFF
  FIXED_OFF
}

model PriceListEntry {
  id             String        @id @default(cuid())
  priceListId    String
  productId      String
  mode           PriceListMode
  // exactly one of the three value columns is non-null, enforced by zod + DB CHECK:
  valuePaise     Int?          // for ABSOLUTE
  percentBps     Int?          // for PERCENT_OFF; 0..10000 (10000 = 100%)
  fixedOffPaise  Int?          // for FIXED_OFF
  minQty         Int           @default(1)
  maxQty         Int?          // null = "and above"
  isDeleted      Boolean       @default(false)
  deletedAt      DateTime?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  priceList PriceList @relation(fields: [priceListId], references: [id], onDelete: Cascade)
  product   Product   @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@unique([priceListId, productId, minQty])
  @@index([priceListId, productId, isDeleted])
  @@index([productId])
}
```

Decision — **qty-breaks are denormalised into entries**, not a separate
`PriceListQtyBreak` child table:

1. Lookup path is "give me the entry where `priceListId=X AND productId=Y AND
   minQty <= qty AND (maxQty IS NULL OR maxQty >= qty)`" — a single covered
   index hit. A child table forces a join on every line-item resolve.
2. The `(priceListId, productId, minQty)` unique key prevents two rows from
   starting at the same minQty. Overlap *across* ranges is validated at
   write-time in the service (cheap; entries-per-product is small).
3. Three modes × n qty-bands stays one table; the editor UI is just rows.

Percent uses **basis points** (`Int`, 0..10000) so the schema stays float-free
and matches `creditLimit` / `outstandingBalance` paise conventions.

### Mutations to existing models

```prisma
// Party — add nullable FK + relation. onDelete: SetNull so deleting a list
// (when zero parties — see AC) is defensive; existing safeguard is the
// service-level "X parties assigned" block.
model Party {
  // ...existing fields...
  priceListId String?
  priceList   PriceList? @relation("PartyPriceList", fields: [priceListId], references: [id], onDelete: SetNull)
  @@index([businessId, priceListId])
}

// Business — add nullable FK; SetNull on list delete.
model Business {
  // ...existing fields...
  defaultPriceListId String?
  defaultPriceList   PriceList? @relation("BusinessDefaultPriceList", fields: [defaultPriceListId], references: [id], onDelete: SetNull)
}
```

Both FKs stay **nullable forever** — "no tier" is a valid runtime state
(Raju persona) and "no business default" is the post-onboarding state until
the owner sets one.

---

## Migration sequence

All in `server/prisma/migrations/`. One migration, no backfill needed (no
existing rows).

```
npx prisma migrate dev --name price_lists_init
```

This single migration adds:
1. `PriceListMode` enum
2. `PriceList` table
3. `PriceListEntry` table
4. `Party.priceListId` column (nullable) + FK + index
5. `Business.defaultPriceListId` column (nullable) + FK

Why one migration is safe here: every new column is nullable, there is no
data to backfill, and the only existing model mutation is a nullable FK
which Postgres adds without a table rewrite (it's metadata-only on a NULL
default). No NOT-NULL tightening step exists in MVP and none is planned —
nullability is the correct long-term state per scope.

Add column → backfill → NOT NULL ordering is not violated because we never
arrive at the NOT NULL step.

---

## Open question resolutions

**1. Floating vs. snapshotted `PERCENT_OFF` / `FIXED_OFF` — FLOATING.**
Entries store the rule (`percentBps` or `fixedOffPaise`), not a derived
price. At resolve-time the resolver reads the *current*
`Product.sellingPrice` and applies the rule. Snapshotting would force every
list-entry to be re-edited whenever Priya changes a product's default,
which defeats the entire "% off default" affordance. The price is only
snapshotted into `DocumentLineItem.unitPrice` (paise) at invoice line
finalize — exactly as today. Invoices are immutable history; lists are live
rules.

**2. Qty re-evaluation on qty change — SILENT, with an "auto" affordance.**
Re-evaluate on every qty change as long as the line is in "auto" state
(no manual override). The price field shows a subtle "auto" pill; once the
user taps and types, the pill flips to "edited" and re-eval stops for that
line. A prompt on every qty edit is the wrong default for high-volume
invoice entry. The "edited" state is reversible — clearing the field
restores auto and re-evaluates.

**3. Offline qty-break resolution — entries piggyback on the products
sync.** When the app syncs the product catalog into IndexedDB on open,
the active price lists and their entries for the current business are
synced alongside (single endpoint `GET /price-lists/sync-bundle?since=...`).
Records keyed by `priceListId` in a Dexie store; entries denormalised
under each list. Eviction follows the same policy as products — cleared on
logout, refreshed on app open. Cap is generous (10k entries total per
business covers Priya and Amit comfortably; alert at 50k for review).

**4. PartyPricing interaction on bulk assign — warn in the confirm sheet.**
Before confirming a bulk assignment, the service returns a count of
"selected parties that have per-product PartyPricing overrides." The sheet
displays "N of M selected parties have product-level overrides that will
continue to take precedence over this list." The assignment itself does
not touch `PartyPricing` rows.

**5. Zero-product list save — ALLOWED.** Priya should be able to create
"Wholesale" up front, assign parties, then add entries product by product
over time. A list with zero entries simply falls through to the product
default for every line — a valid state. Empty-list UI shows a clear
"Add your first product price" CTA.

---

## API surface

All routes tenant-scoped via existing `requireAuth` + `businessId` middleware.

| Verb | Path | Purpose |
|------|------|---------|
| GET | `/price-lists` | List all (cursor-paginated, includes counts) |
| POST | `/price-lists` | Create list |
| GET | `/price-lists/:id` | Detail with entries |
| PATCH | `/price-lists/:id` | Rename |
| DELETE | `/price-lists/:id` | Soft-delete; blocked if parties assigned |
| GET | `/price-lists/:id/entries` | Paginated entries for big catalogs |
| POST | `/price-lists/:id/entries` | Upsert entry (mode + value + qty range) |
| PATCH | `/price-lists/:id/entries/:entryId` | Edit entry |
| DELETE | `/price-lists/:id/entries/:entryId` | Soft-delete entry |
| POST | `/price-lists/:id/bulk-assign-parties` | Body `{ partyIds: string[] }`; returns `{ updatedCount, partyPricingOverlapCount }` |
| GET | `/products/:id/price-preview` | Returns all list prices for a product at qty=1 |
| GET | `/price-lists/sync-bundle` | Offline cache prime (lists + entries) |
| PATCH | `/settings/default-price-list` | Body `{ priceListId: string \| null }` |

Server-side resolve endpoint is **not** exposed. The resolver is a pure
function; the client mirrors it for autofill and the server calls it during
invoice create/update. Saves a round-trip per line.

---

## Resolution-order implementation

Pure, stateless, dependency-free:

```ts
// server/src/services/pricing-resolver.ts  (~120 LOC)
export interface ResolveInput {
  product: { id: string; sellingPrice: number };
  partyPricing: { price: number; minQty: number } | null;  // already filtered to this product
  partyList: { entries: PriceListEntry[] } | null;          // already filtered to this product
  qty: number;
  manualOverridePaise?: number | null;
}
export function resolveLinePrice(input: ResolveInput): { paise: number; source: 'MANUAL'|'PARTY_PRICING'|'PRICE_LIST'|'PRODUCT_DEFAULT'; entryId?: string };
```

Order: manual → PartyPricing (if `qty >= minQty`) → PriceList entry
(matching qty-band) → `product.sellingPrice`.

**Frontend mirror.** `frontend/src/features/pricing/resolver.ts` re-exports
the same logic (literal copy, kept in sync by a single Vitest fixture file
`__fixtures__/pricing-resolver.cases.json` consumed by both sides). On
invoice line edit, the frontend resolves locally for instant fill. On save,
the server re-resolves authoritatively — if the two disagree (race with a
product price change), the server wins and the document line records its
own `unitPrice` from the server's resolve.

---

## File plan manifest

Every file ≤ 200 LOC.

### Backend — schema & migration
- `server/prisma/schema.prisma` — additions only (above) [~40 LOC delta]
- `server/prisma/migrations/<ts>_price_lists_init/migration.sql` — auto-generated

### Backend — services & validators
- `server/src/services/pricing-resolver.ts` — pure resolver function
- `server/src/services/price-list.service.ts` — CRUD + soft-delete + assignment-block check
- `server/src/services/price-list-entry.service.ts` — entry CRUD + overlap validation
- `server/src/services/price-list-assign.service.ts` — bulk assign + overlap-count
- `server/src/services/__tests__/pricing-resolver.test.ts` — fixture-driven, 4 resolution levels
- `server/src/services/__tests__/price-list.service.test.ts` — CRUD + tenant isolation
- `server/src/validators/price-list.schema.ts` — zod
- `server/src/validators/__fixtures__/pricing-resolver.cases.json` — SSOT for FE+BE tests

### Backend — routes
- `server/src/routes/price-lists.routes.ts` — list/detail/CRUD endpoints
- `server/src/routes/price-list-entries.routes.ts` — entry endpoints
- `server/src/routes/price-list-assign.routes.ts` — bulk assign + sync-bundle
- `server/src/routes/__tests__/price-lists.routes.test.ts` — 201/400/401 happy + error paths

### Backend — invoice integration
- `server/src/services/document.service.ts` — call resolver on line save *(modify, ≤ 30 LOC delta)*
- `server/src/services/business-settings.service.ts` — `setDefaultPriceList` *(modify or new)*

### Frontend — feature folder `frontend/src/features/price-lists/`
- `types.ts` — `PriceList`, `PriceListEntry`, `PriceListMode` mirrors
- `constants.ts` — mode labels, max-name length, error codes
- `pricing-resolver.ts` — mirror of server resolver
- `price-list.service.ts` — `api()` wrappers, all with `entityType`/`entityLabel`
- `hooks/usePriceLists.ts` — React Query list/detail
- `hooks/usePriceListMutations.ts` — create/rename/delete with offline-tolerant handlers
- `hooks/useResolveLinePrice.ts` — wraps resolver + party + product
- `components/PriceListRow.tsx`
- `components/PriceListEntryEditor.tsx` — mode toggle + qty-band rows
- `components/QtyBreakRow.tsx`
- `components/PriceListPicker.tsx` — reused in Party form + Settings default + Bulk-assign
- `components/BulkAssignSheet.tsx` — drawer footer pattern (no fixed-bottom in feature CSS)
- `pages/PriceListsSettingsPage.tsx` — list of lists
- `pages/PriceListDetailPage.tsx` — entries editor
- `__fixtures__/pricing-resolver.cases.json` — symlink/copy of SSOT
- `__tests__/pricing-resolver.test.ts` — same cases, asserts FE/BE parity

### Frontend — integration points (modify)
- `frontend/src/features/parties/components/PartyForm.tsx` — add `<PriceListPicker>` field
- `frontend/src/features/parties/pages/PartiesListPage.tsx` — bulk-action "Assign price list"
- `frontend/src/features/invoices/hooks/useInvoiceLine.ts` — resolver autofill + edited-state
- `frontend/src/features/invoices/components/InvoiceLineRow.tsx` — "auto"/"edited" pill
- `frontend/src/features/products/pages/ProductDetailPage.tsx` — Price lists preview section
- `frontend/src/features/settings/pages/PricingSettingsPage.tsx` — default list picker
- `frontend/src/lib/offline-sync.ts` — wire `/price-lists/sync-bundle` into app-open sync

### Frontend — config
- `frontend/src/config/routes.ts` — `/settings/pricing`, `/settings/pricing/:id`
- `frontend/src/config/features.ts` — `VITE_FEATURE_PRICE_LISTS`
- `server/src/config/features.ts` — `FEATURE_PRICE_LISTS`

File count: ~38 new + 8 modified.

---

## Performance budgets

- Per-route chunk (`/settings/pricing*`): ≤ 80 KB gzipped (lazy-loaded).
- Resolver: O(1) PartyPricing lookup (already keyed), O(log n) entry scan
  in memory (n = entries per product per list, typically < 5).
- Invoice line autofill: < 16ms client-side (one frame); no network call.
- `GET /price-lists/sync-bundle` p95: < 200ms for 10k entries (single
  query, index-covered).
- DB query p95 for line resolve on save: < 30ms (joined products + lists
  prefetched per invoice).

---

## Feature flags & rollout

```ts
// server/src/config/features.ts
PRICE_LISTS: process.env.FEATURE_PRICE_LISTS === 'true'
// frontend/src/config/features.ts
PRICE_LISTS: import.meta.env.VITE_FEATURE_PRICE_LISTS === 'true'
```

Routes 404 when flag off; UI surfaces (party picker, settings link, invoice
autofill) no-op cleanly. Resolver still runs but with `partyList=null`
short-circuit when flag off — invoice behaviour is unchanged from today.

| Stage | Audience | Verify before next |
|-------|----------|--------------------|
| Internal | Sawan phone only | Manual exercise of all 8 user stories |
| 10% | hash(businessId) % 10 === 0 | 48h error rate < 0.5%, no resolver disagreements logged |
| 100% | all | watch errors 7d |

---

## State machine — invoice line price state

```
States:    AUTO | EDITED
Initial:   AUTO (resolver-derived)
Terminal:  none (reversible)

Transitions:
  AUTO   --user types in price field--> EDITED
  AUTO   --party/product/qty changes--> AUTO (re-resolve silently)
  EDITED --user clears field--> AUTO (re-resolve)
  EDITED --party/product/qty changes--> EDITED (preserve manual)
```

---

## Risks & mitigations

1. **Resolver divergence FE vs BE.** Mitigation: shared JSON fixture file
   (`pricing-resolver.cases.json`) consumed by Vitest on both sides; CI
   fails if either side disagrees. Logged "resolve mismatch" telemetry on
   server save when the document's `clientResolvedPrice` differs from the
   server's resolve.
2. **Qty-break lookup cost on large catalogs.** Mitigation: covered index
   `(priceListId, productId, isDeleted)` + the qty-band scan is in-memory
   over the small set of entries-for-this-product (typically < 5). No
   table scan; no join through entries during invoice creation because the
   line item already knows its `priceListId` via the party.
3. **Orphan entries on product soft-delete.** Mitigation: `Product` is
   `onDelete: Restrict` in `PriceListEntry`; soft-deleting a product
   filters entries at query time (`isDeleted: false` on both sides) but
   does not cascade. Reviving a product brings its entries back live.
4. **Race: owner changes product `sellingPrice` mid-invoice.** Mitigation:
   server is authoritative at save; client autofill is provisional. The
   saved `DocumentLineItem.unitPrice` is the immutable record.
5. **`PriceList.isDefault` mirror drifts from `Business.defaultPriceListId`.**
   Mitigation: a single service method (`setDefaultPriceList`) runs both
   updates in a `prisma.$transaction`. Resolver never reads `isDefault`.
