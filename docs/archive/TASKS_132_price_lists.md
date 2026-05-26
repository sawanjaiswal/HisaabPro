# TASKS #132 — Price Lists (Tiered Pricing)

> Status: Draft · Author: Task Manager · Date: 2026-05-14
> Proof-gated sequential batches. Each gate must pass before the next batch starts.

---

## Batch 1: Schema + Migration
**Agent:** Backend (Prisma specialist)
**Files:**
- `server/prisma/schema.prisma` [~40 LOC delta]
- `server/prisma/migrations/<ts>_price_lists_init/migration.sql` [auto-generated]

**Work:**
- Add `PriceListMode` enum (ABSOLUTE, PERCENT_OFF, FIXED_OFF)
- Create `PriceList` model with `businessId` FK, `name`, `isDefault` (denorm mirror), soft-delete fields
- Create `PriceListEntry` model with `priceListId`, `productId`, `mode`, three nullable value columns (`valuePaise` for ABSOLUTE, `percentBps` 0–10000 for PERCENT_OFF, `fixedOffPaise` for FIXED_OFF), `minQty` (default 1), `maxQty` (nullable for open-ended), soft-delete fields
- Add `Party.priceListId` nullable FK + `Party.priceList` relation (onDelete: SetNull)
- Add `Business.defaultPriceListId` nullable FK + `Business.defaultPriceList` relation (onDelete: SetNull)
- Add indexes: PriceList `[businessId, isDeleted]`, PriceListEntry `[priceListId, productId, isDeleted]` + `[productId]`
- Add unique constraints: PriceList `[businessId, name]`, PriceListEntry `[priceListId, productId, minQty]`

**Acceptance:**
- Migration file created and applies cleanly with `npx prisma migrate dev --name price_lists_init`
- `npx prisma generate` succeeds (Prisma client updated)
- `tsc --noEmit` on server (`server/` dir) completes with zero errors
- All five new models appear in `@prisma/client` auto-generated types
- No NOT-NULL tightening — all new columns on existing models (priceListId on Party/Business) remain nullable

**Proof required to unlock Batch 2:**
- Screenshot of terminal showing `prisma migrate dev --name price_lists_init` success
- Output of `tsc --noEmit` showing clean exit
- Paste `npx prisma generate` output confirming types regenerated
- Store in `/Users/sawanjaiswal/Projects/HisaabPro/proofs/132_batch1_migration.md`

---

## Batch 2: Resolver + Shared Fixtures
**Agent:** Backend
**Files:**
- `server/src/services/pricing-resolver.ts` [~120 LOC]
- `server/src/validators/__fixtures__/pricing-resolver.cases.json` [~200 LOC]
- `server/src/services/__tests__/pricing-resolver.test.ts` [~150 LOC]

**Work:**
- Implement pure function `resolveLinePrice(input: ResolveInput)` that applies the four-step resolution order:
  1. Manual override (if provided)
  2. PartyPricing match (if qty >= minQty)
  3. PriceList entry match (if qty falls in qty-break range)
  4. Product.sellingPrice fallback
- Return type includes `{ paise: number; source: 'MANUAL'|'PARTY_PRICING'|'PRICE_LIST'|'PRODUCT_DEFAULT'; entryId?: string }`
- Input: `{ product: { id, sellingPrice }, partyPricing: { price, minQty } | null, partyList: { entries: PriceListEntry[] } | null, qty: number, manualOverridePaise?: number | null }`
- Create comprehensive fixture file with test cases covering all four levels: manual override winning, PartyPricing beating list, list beating product default, fallback to product default
- Include qty-break edge cases: exact boundary, open-ended max-qty, no matching range (fallthrough)
- Implement Vitest test suite consuming the fixture file; assert each test case resolves to expected `{ paise, source }`

**Acceptance:**
- All resolver test cases pass (unit tests green)
- Coverage report shows all four resolution paths exercised
- Fixture file has ≥ 8 distinct test cases (manual, partyPricing, list-qty-break-hit, list-qty-range-miss, product-default, boundary-qty, open-ended, combined scenarios)
- No floating-point math — all paise and percentBps as Int
- percentBps conversion verified: 1500 bps = 15% off default

**Proof required to unlock Batch 3:**
- `npm run test -- pricing-resolver.test.ts` output showing all tests pass
- Coverage report snippet showing 100% of four resolution branches covered
- Store in `/Users/sawanjaiswal/Projects/HisaabPro/proofs/132_batch2_resolver.md`

---

## Batch 3: Backend Services + Routes
**Agent:** Backend
**Files:**
- `server/src/services/price-list.service.ts` [~160 LOC]
- `server/src/services/price-list-entry.service.ts` [~140 LOC]
- `server/src/services/price-list-assign.service.ts` [~100 LOC]
- `server/src/services/__tests__/price-list.service.test.ts` [~120 LOC]
- `server/src/validators/price-list.schema.ts` [~80 LOC]
- `server/src/routes/price-lists.routes.ts` [~180 LOC]
- `server/src/routes/price-list-entries.routes.ts` [~150 LOC]
- `server/src/routes/price-list-assign.routes.ts` [~140 LOC]
- `server/src/routes/__tests__/price-lists.routes.test.ts` [~100 LOC]
- `server/src/services/business-settings.service.ts` [modify or create: ~50 LOC delta]

**Work:**

**Services:**
- `price-list.service.ts`: `createList(businessId, name)`, `renameList(id, newName)`, `deleteList(id)` with assignment-blocking check ("X parties assigned"), `getList(id)`, `listAll(businessId, cursor)` with party count aggregates
- `price-list-entry.service.ts`: `createEntry(priceListId, productId, mode, value, minQty, maxQty)` with overlap validation (zod + code), `updateEntry(entryId, ...)`, `deleteEntry(entryId)`, `getEntriesForProduct(priceListId, productId)`
- `price-list-assign.service.ts`: `bulkAssignParties(priceListId, partyIds[])` returning `{ updatedCount, partyPricingOverlapCount }`, `countAssignedParties(priceListId)`
- All services scoped by `businessId` from `requireAuth` context; no cross-tenant leaks
- Soft-delete support (filter `isDeleted = false` on reads)

**Validators:**
- `price-list.schema.ts`: zod for create/rename (name max 60 chars, required), entry create (mode enum, exactly one value non-null, qty validation: minQty >= 1, maxQty > minQty if provided)

**Routes:**
- `price-lists.routes.ts`:
  - GET `/price-lists` → list all with cursor + party count (requireAuth)
  - POST `/price-lists` → create with zod validation (requireAuth, body: { name }, returns { id, name, createdAt })
  - GET `/price-lists/:id` → detail with entries (requireAuth)
  - PATCH `/price-lists/:id` → rename (requireAuth, body: { name })
  - DELETE `/price-lists/:id` → soft-delete, block if parties assigned (requireAuth)
  - GET `/price-lists/sync-bundle?since=<timestamp>` → offline cache prime (returns all lists + entries for business)
  - PATCH `/settings/default-price-list` → set business default (requireAuth, body: { priceListId: string | null }, updates both `Business.defaultPriceListId` and `PriceList.isDefault` in transaction)

- `price-list-entries.routes.ts`:
  - GET `/price-lists/:id/entries` → paginated entries (requireAuth, cursor)
  - POST `/price-lists/:id/entries` → create/upsert (requireAuth, zod validate, body: { productId, mode, valuePaise?, percentBps?, fixedOffPaise?, minQty, maxQty? })
  - PATCH `/price-lists/:id/entries/:entryId` → edit entry (requireAuth, zod validate same as POST)
  - DELETE `/price-lists/:id/entries/:entryId` → soft-delete (requireAuth)

- `price-list-assign.routes.ts`:
  - POST `/price-lists/:id/bulk-assign-parties` → bulk assign (requireAuth, body: { partyIds: string[] }, returns { updatedCount, partyPricingOverlapCount, updatedPartyIds? }, calls `bulkAssignParties` + `countAssignedParties`)
  - GET `/products/:id/price-preview` → all list prices for a product at qty=1 (requireAuth, returns { lists: [{ priceListId, name, mode, effectivePrice }] })

**Route tests:**
- `price-lists.routes.test.ts`: happy path (201 created, 200 list, 200 detail) + error paths (401 no auth, 400 zod fail, 403 party block on delete)

**Integration:**
- `business-settings.service.ts`: add/extend with `setDefaultPriceList(businessId, priceListId: string | null)` that runs in `prisma.$transaction` to update both `Business.defaultPriceListId` and mirror `PriceList.isDefault` flags (set old default's flag to false, set new default's flag to true)

**Acceptance:**
- All three route files pass curl happy-path tests
- POST /price-lists returns 201 with { id, name, createdAt }
- POST /price-lists with no auth returns 401
- POST /price-lists with invalid name (>60 chars or missing) returns 400 with zod error
- DELETE /price-lists/:id with assigned parties returns 403 with message "X parties assigned — reassign before deleting"
- POST /price-lists/:id/bulk-assign-parties returns 200 with { updatedCount, partyPricingOverlapCount }
- Tenant isolation verified: Party/List/Entry queries filter by businessId
- Soft-delete fields (isDeleted, deletedAt) populated on delete routes
- `business-settings.service` method updates both Business and PriceList.isDefault atomically

**Proof required to unlock Batch 4:**
- Curl POST /price-lists (success 201)
- Curl POST /price-lists (failure 401, no auth)
- Curl POST /price-lists (failure 400, zod validation)
- Curl POST /price-lists/:id/bulk-assign-parties with 3+ partyIds (success 200)
- Curl GET /products/:id/price-preview (success 200)
- `npm run test -- price-lists.routes.test.ts` output (all pass)
- `tsc --noEmit` on server clean
- Store in `/Users/sawanjaiswal/Projects/HisaabPro/proofs/132_batch3_backend.md`

---

## Batch 4: Frontend Settings Page
**Agent:** Frontend (with design)
**Files:**
- `frontend/src/features/price-lists/types.ts` [~40 LOC]
- `frontend/src/features/price-lists/constants.ts` [~30 LOC]
- `frontend/src/features/price-lists/pricing-resolver.ts` [~120 LOC] — literal copy of server resolver
- `frontend/src/features/price-lists/price-list.service.ts` [~100 LOC] — api() wrappers with entityType/entityLabel
- `frontend/src/features/price-lists/hooks/usePriceLists.ts` [~70 LOC]
- `frontend/src/features/price-lists/hooks/usePriceListMutations.ts` [~90 LOC]
- `frontend/src/features/price-lists/hooks/useResolveLinePrice.ts` [~60 LOC]
- `frontend/src/features/price-lists/components/PriceListRow.tsx` [~50 LOC]
- `frontend/src/features/price-lists/components/PriceListEntryEditor.tsx` [~160 LOC]
- `frontend/src/features/price-lists/components/QtyBreakRow.tsx` [~80 LOC]
- `frontend/src/features/price-lists/components/PriceListPicker.tsx` [~70 LOC]
- `frontend/src/features/price-lists/pages/PriceListsSettingsPage.tsx` [~150 LOC]
- `frontend/src/features/price-lists/pages/PriceListDetailPage.tsx` [~180 LOC]
- `frontend/src/features/price-lists/__fixtures__/pricing-resolver.cases.json` [~200 LOC] — symlink/copy of SSOT
- `frontend/src/features/price-lists/__tests__/pricing-resolver.test.ts` [~100 LOC]
- `frontend/src/config/routes.ts` [modify: +2 routes]
- `frontend/src/config/features.ts` [modify: +1 flag]

**Work:**

**Core:**
- `types.ts`: TypeScript mirrors of PriceList, PriceListEntry, PriceListMode
- `constants.ts`: MODE_LABELS (ABSOLUTE, PERCENT_OFF, FIXED_OFF), MAX_NAME_LENGTH, error codes
- `pricing-resolver.ts`: paste the server resolver exactly; keep in sync via fixture file
- `price-list.service.ts`: `api()` wrappers for all routes. **MANDATORY: All mutations pass `entityType: 'price-list' | 'price-list-entry'` and `entityLabel` (list name or entry description).** Example: `await api('/price-lists', { method: 'POST', body: JSON.stringify(data), entityType: 'price-list', entityLabel: data.name })`
- `usePriceLists.ts`: TanStack Query hooks for list fetch, detail fetch, sync-bundle
- `usePriceListMutations.ts`: TanStack Query mutations for create/rename/delete/assign with offline-tolerant handlers (don't deref response fields without an `if`)

**Components:**
- `PriceListRow.tsx`: renders a list summary row (name, party count, default indicator)
- `PriceListEntryEditor.tsx`: full-page form for a list's entries. UI shows:
  - Mode toggle buttons (ABSOLUTE | PERCENT_OFF | FIXED_OFF)
  - Product picker (searchable)
  - Value input (currency for ABSOLUTE, percent 0–100 for PERCENT_OFF, paise for FIXED_OFF)
  - Computed price preview (read-only, recalc as user types)
  - Qty-break rows section with add/remove row buttons
  - Save button, blocking if ranges overlap with message "Qty ranges overlap — fix before saving"
  - Soft loading/error states
- `QtyBreakRow.tsx`: single qty-break row (minQty, maxQty, price input)
- `PriceListPicker.tsx`: reusable single-select dropdown for assigning a list to a party or setting the business default. Shows all lists + "None" option.

**Pages:**
- `PriceListsSettingsPage.tsx`: list of all price lists, each row clickable to detail. States:
  - Loading: skeleton rows
  - Empty: "Create your first price list" CTA
  - Error: toast + retry
  - Success: list of PriceListRows + "Create new" FAB
  - Each row has actions: edit (→ detail), delete (with confirmation)
  - Default indicator badge on the default list
- `PriceListDetailPage.tsx`: entry editor for a single list. States same as above (load/error/empty/success). Entry list is editable; each row shows mode, product name, values, qty-breaks. Can add new entry or edit existing.

**Testing:**
- `pricing-resolver.test.ts`: mirror of server tests, same fixture, assert FE resolver matches server

**Config:**
- `frontend/src/config/routes.ts`: add `/settings/pricing` → PriceListsSettingsPage, `/settings/pricing/:id` → PriceListDetailPage
- `frontend/src/config/features.ts`: add `PRICE_LISTS: import.meta.env.VITE_FEATURE_PRICE_LISTS === 'true'`

**Acceptance:**
- PriceListsSettingsPage renders in 4 states: loading (skeleton), error (toast), empty (CTA), success (list + FAB)
- PriceListDetailPage form saves entry without overlap blocking, no overlaps allowed
- Mode toggle switches inputs (absolute paise, percent %, fixed paise)
- Computed price preview updates in real-time as user changes values
- 320px viewport tested on settings page (list scrollable, form inputs accessible)
- tsc --noEmit on frontend clean
- enforce.js clean (no platform-shell violations, no raw localStorage, no unbounded lists)
- All mutations pass entityType/entityLabel validation

**Proof required to unlock Batch 5:**
- Screenshots:
  - PriceListsSettingsPage: loading state (skeleton rows)
  - PriceListsSettingsPage: empty state (CTA visible)
  - PriceListsSettingsPage: success state (3+ list rows visible)
  - PriceListsSettingsPage: error state (toast + retry visible)
  - PriceListDetailPage: entry editor with mode toggle + qty-break rows
  - 320px viewport: settings page (list scrolls, header visible)
  - 320px viewport: detail page (form accessible, save button visible)
- `npm run test -- pricing-resolver.test.ts` on frontend (all pass, matches server)
- `tsc --noEmit` on frontend clean
- `npm run enforce` output (zero violations)
- Store in `/Users/sawanjaiswal/Projects/HisaabPro/proofs/132_batch4_frontend_settings.md`

---

## Batch 5: Frontend Party Form Integration
**Agent:** Frontend
**Files:**
- `frontend/src/features/parties/components/PartyForm.tsx` [modify: ~30 LOC delta]

**Work:**
- Add `<PriceListPicker>` field to PartyForm (between existing fields, logical location TBD by design)
- For new parties: default picker to business's defaultPriceListId
- For existing parties: pre-select their current priceListId
- Clearing the picker (selecting "None") sets field to null
- Form mutation passes `entityType: 'party', entityLabel: partyName` as before (no change to existing mutation)

**Acceptance:**
- PartyForm new-party flow shows price-list picker defaulted to business default
- PartyForm edit flow shows picker pre-selected to party's current list
- Picker can be cleared to "None" (null)
- Form saves with priceListId included

**Proof required to unlock Batch 6:**
- Screenshot: PartyForm create (new party, price-list picker visible, defaulted)
- Screenshot: PartyForm edit (existing party, price-list picker pre-selected)
- tsc --noEmit clean
- enforce.js clean
- Store in `/Users/sawanjaiswal/Projects/HisaabPro/proofs/132_batch5_party_form.md`

---

## Batch 6: Frontend Invoice Line Auto-Fill + Override State
**Agent:** Frontend
**Files:**
- `frontend/src/features/invoices/hooks/useInvoiceLine.ts` [modify: ~80 LOC delta]
- `frontend/src/features/invoices/components/InvoiceLineRow.tsx` [modify: ~50 LOC delta]

**Work:**
- Implement line state machine: AUTO | EDITED
- Initial state on line add: AUTO (resolver-derived price)
- When party/product/qty selected and line is AUTO: resolve price via `useResolveLinePrice`, fill price field, show subtle "auto" pill
- When user taps price field and types: transition to EDITED, show "edited" pill, stop re-evaluating on party/product/qty changes
- When user clears price field: transition back to AUTO, re-resolve
- When party/product/qty changes and line is EDITED: preserve manual price, keep "edited" pill
- Show "from <price-list-name>" hint below price field when resolved from a tier (source === 'PRICE_LIST'), not shown for manual/PartyPricing/product default
- On invoice save: client resolves locally (for UX feedback); server re-resolves authoritatively and stores `DocumentLineItem.unitPrice`

**Acceptance:**
- New invoice line starts in AUTO state with auto-filled price
- Tapping price field and typing transitions to EDITED, stops re-eval
- Clearing price field transitions back to AUTO
- "from <list-name>" hint appears when price source is PRICE_LIST
- Qty change re-evaluates price silently when in AUTO state
- Qty change preserves manual price when in EDITED state
- 4 UI states captured in screenshots: (1) loading, (2) invoice with empty line, (3) line with auto-filled tier price + hint, (4) line with manual override + edited pill

**Proof required to unlock Batch 7:**
- Screenshot: invoice load state
- Screenshot: invoice with new line, empty state
- Screenshot: invoice line with auto-filled tier price and "from Wholesale" hint
- Screenshot: invoice line with manual override, "edited" pill visible, no hint
- tsc --noEmit clean
- enforce.js clean
- Store in `/Users/sawanjaiswal/Projects/HisaabPro/proofs/132_batch6_invoice_autofill.md`

---

## Batch 7: Frontend Product Detail Price Preview
**Agent:** Frontend
**Files:**
- `frontend/src/features/products/pages/ProductDetailPage.tsx` [modify: ~60 LOC delta]

**Work:**
- Add "Price lists" section to product detail below existing pricing info
- Render table: List name | Mode | Effective price (at qty=1)
- Fetch via GET `/products/:id/price-preview`
- If product has no entry in a list, that row shows "—"
- Table is read-only; tapping a row navigates to `/settings/pricing/:priceListId` (deep-link to edit that list)
- Loading state: skeleton rows; error state: toast + retry

**Acceptance:**
- Product detail shows price-lists section with table
- All active lists appear (or placeholder if none)
- Entries show mode + effective price at qty 1
- Missing entries show "—"
- Tapping a row deep-links to that list's edit page
- 320px viewport tested

**Proof required to unlock Batch 8:**
- Screenshot: product detail with price-lists section (3+ lists visible)
- Screenshot: product detail with missing entry (shows "—")
- Screenshot: 320px viewport (section scrolls, table readable)
- tsc --noEmit clean
- enforce.js clean
- Store in `/Users/sawanjaiswal/Projects/HisaabPro/proofs/132_batch7_product_preview.md`

---

## Batch 8: Frontend Bulk-Assign Sheet
**Agent:** Frontend
**Files:**
- `frontend/src/features/parties/pages/PartiesListPage.tsx` [modify: ~100 LOC delta]
- `frontend/src/features/price-lists/components/BulkAssignSheet.tsx` [~120 LOC]

**Work:**
- Add multi-select mode to PartiesListPage (checkbox per row, similar to other bulk actions)
- When ≥1 party selected, show bulk action bar with "Assign price list" button
- Tapping button opens BulkAssignSheet (drawer bottom pattern, no fixed-bottom in feature CSS — use Drawer component's footer slot)
- BulkAssignSheet shows:
  - Selected count badge: "X parties selected"
  - PriceListPicker dropdown
  - Warning if any selected parties have PartyPricing overrides: "Y of X parties have product-level overrides that will continue to take precedence over this list"
  - Confirm button, cancels sheet on close
- On confirm: POST `/price-lists/:id/bulk-assign-parties` with `{ partyIds: [...] }`
- Success: toast "Price list updated for X parties" (or "X updated · Y queued for sync" if offline)
- Mutation passes `entityType: 'party', entityLabel: 'bulk-assign'` (or similar)
- Parties list refetches on success

**Acceptance:**
- Parties list multi-select mode checkbox per row
- ≥1 selection shows bulk action bar with "Assign price list" button
- BulkAssignSheet opens with PriceListPicker
- Warning about PartyPricing overlaps shown when applicable
- POST to bulk-assign returns 200 with updatedCount
- Toast success with proper offline messaging
- Parties list refetches and selection clears
- 320px viewport tested (sheet content scrolls, confirm button accessible)

**Proof required to unlock Batch 9:**
- Screenshot: parties list with multi-select visible, 3+ parties checked
- Screenshot: bulk-assign sheet open with picker + warning visible
- Screenshot: success toast after bulk-assign
- Curl POST /price-lists/:id/bulk-assign-parties with 3+ partyIds (200 response)
- tsc --noEmit clean
- enforce.js clean
- Store in `/Users/sawanjaiswal/Projects/HisaabPro/proofs/132_batch8_bulk_assign.md`

---

## Batch 9: QA Gate
**Agent:** QA
**Files:**
- `proofs/132_qa_signoff.md` [~150 LOC]

**Work:**
- Read SCOPE_132_price_lists.md acceptance criteria (all 8 acceptance criteria sections)
- Review all proof artifacts from Batches 1–8
- Validate each acceptance criterion against the proof evidence
- Run end-to-end scenario: create a price list with 3+ entries (different modes, qty-breaks), assign to 2 parties, create invoice for each party, verify auto-filled prices follow resolver order (manual → PartyPricing → tier → product default), override one line and verify it sticks, change product default and verify tier prices float, then save invoice and verify server resolver matches client
- Verify 4 UI states captured: loading, error, empty, success (on all major pages)
- Verify 320px viewport tested on all pages (settings, party form, invoice, product detail)
- Verify tsc clean + enforce.js clean on all batches
- Verify all curl proofs show correct status codes (201, 401, 400, 200)
- Verify offline-first pattern: all mutations pass entityType/entityLabel
- Verify soft-delete: isDeleted and deletedAt fields used consistently
- Verify tenant isolation: no cross-businessId leaks in any query
- Verify feature flag gracefully disables when off

**Acceptance:**
- Every SCOPE acceptance criterion (8 criteria × ~4 sub-items) has proof evidence linked
- End-to-end scenario passes with all 4 resolution levels exercised
- UI state matrix (load/error/empty/success × 5 pages) captured
- 320px tested everywhere
- Offline queue entityType/entityLabel validation passed
- Soft-delete and tenant isolation audited
- No tsc or enforce violations remain

**Proof required (final gate):**
- `/Users/sawanjaiswal/Projects/HisaabPro/proofs/132_qa_signoff.md` — full acceptance audit with links to all batch proofs, end-to-end test log, UI state matrix, 320px attestation
- All batch proof files populated and linked

---

## Redo: If QA Rejects

If QA identifies violations:
1. Read the violations named in 132_qa_signoff.md
2. Determine which batch(es) are broken (typically Batch 6–8 for logic, Batch 4 for UI)
3. Fix the root issue in that batch's code
4. Re-run the proof gate for that batch (e.g., re-screenshot Batch 6 if invoice autofill is broken)
5. Re-run Batch 9 (QA gate) with updated proof files
6. Do NOT skip gates; task-manager blocks redo-completion without re-validated proofs

---

## Feature Flag Rollout

When all QA is signed off:

```ts
// .env or .env.local
FEATURE_PRICE_LISTS=true
VITE_FEATURE_PRICE_LISTS=true
```

Routes 404 when flag off. UI surfaces no-op cleanly. Resolver short-circuits with
`partyList=null` when flag off — invoice behaviour unchanged.

| Stage | Audience | Verify before next |
|-------|----------|--------------------|
| Internal | Sawan phone only | Manual exercise of all 8 user stories |
| 10% | hash(businessId) % 10 === 0 | 48h error rate < 0.5%, no resolver mismatches logged |
| 100% | all | watch errors 7d |

---

## Summary

- **Total batches:** 9 (1 schema, 1 resolver, 1 backend routes, 3 frontend pages, 1 party integration, 1 invoice integration, 1 QA)
- **Est total new LOC:** ~2,800 (backend ~1,000, frontend ~1,500, tests ~300)
- **Critical path:** Batch 1 (schema) blocks all others; Batch 3 (routes) blocks Batches 4–8; Batch 4 (settings UI) blocks Batch 9
- **Highest-risk batches:** Batch 6 (invoice state machine — correct auto/edited transition) and Batch 2 (resolver parity FE/BE via fixture)
- **File written:** `/Users/sawanjaiswal/Projects/HisaabPro/docs/TASKS_132_price_lists.md`

---

## Mandatory Enforcement Notes

### Offline Rules (OFFLINE_RULES.md compliance)
- All mutations in `price-list.service.ts` must use `api()` with `entityType` + `entityLabel`
- Example: `await api('/price-lists', { method: 'POST', body: JSON.stringify(data), entityType: 'price-list', entityLabel: data.name })`
- Mutation handlers must NOT deref response fields without an `if` (offline returns `{}`)
- Read cache opt-in: `/price-lists/sync-bundle` passes `cacheReads: true` (safe reference data)
- No `localStorage` for list/entry data; use IndexedDB via Dexie on client

### Schema Rules (PRISMA_MIGRATION_RULES.md compliance)
- One migration file: `migrations/<ts>_price_lists_init/migration.sql` (all-in-one, no backfill needed)
- All new columns nullable — no NOT-NULL tightening
- No GIN indexes (trgm) in MVP — all indexes B-tree via `@@index`
- `npx prisma migrate dev --name price_lists_init` must apply cleanly
- `npx prisma generate` must succeed and refresh `@prisma/client`

### Money Rules
- All prices stored in paise (Int) — no floats
- Percent stored in basis points (Int, 0–10000) — no floats
- resolver.ts and pricing-resolver.ts must have zero float arithmetic

### Tenant Isolation
- Every service method and route validates `businessId` from context
- No query without a businessId filter
- DELETE and PATCH operations verify ownership before mutation

