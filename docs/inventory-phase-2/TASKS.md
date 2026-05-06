# Inventory Phase 2 — Task Breakdown (INV-01 through INV-07)

**Design Plan:** `/Users/sawanjaiswal/Projects/HisaabPro/.claude/design-plan-active.md` ✓ approved  
**Architecture:** INV-01 through INV-07 (7 PRs, ~2,580 LOC total, ~10 working days)

## Summary Table

| PR | Title | Files touched | LOC est | Agent | Gate | Blocks |
|:--:|-------|:--------------|:-------:|:-----:|:----:|:------:|
| **INV-01** | Schema + permissions + verticals | 4 files, NEW + MODIFIED | 80 | backend | `migrate dev` clean, existing tests pass | INV-02 |
| **INV-02** | Movements ledger API + page | 5 files, NEW + MODIFIED | 350 | backend+frontend | curl 401/404/200, balanceAfter invariant, 320px screenshots | INV-03 |
| **INV-03** | Manual adjustment API + drawer | 5 files, NEW + MODIFIED | 400 | backend+frontend | idempotency test, 409 HARD_BLOCK, offline queue toast | INV-04 |
| **INV-04** | Purchase entry + weighted-average | 6 files, MODIFIED | 500 | backend+frontend | Integration test: SUM(movements)==currentStock, WA cost verified | **Hard gate ⛔** |
| **INV-05** | Sale HARD_BLOCK + stockAfter + reversal | 4 files, MODIFIED | 250 | backend | Concurrent race test, 409 array, void reverses stock exactly | INV-06 |
| **INV-06** | Stock value report + low-stock + dashboard | 6 files, NEW + MODIFIED | 550 | backend+frontend | Empty result 200 OK not 404, partial index used (EXPLAIN), tile clickthrough | INV-07 |
| **INV-07** | Verification mobile flow + barcode scan | 7 files, NEW + MODIFIED | 450 | backend+frontend | applyAdjustments idempotent, 409 ALREADY_COMPLETED, soft-deleted label | ✓ DONE |

---

## INV-01 — Schema migration + permissions + vertical defaults

**Scope:** Additive schema delta (reorderQty, partial index), extend movement type union, set retail/wholesale to HARD_BLOCK.

**Files touched:**

| File | Type | LOC | Notes |
|------|------|-----|-------|
| `server/prisma/schema.prisma:528` | MODIFIED | 1 | Add `reorderQty Float?` next to `moq` |
| `server/prisma/migrations/20260507_inventory_phase2_reorder_qty/migration.sql` | NEW | 12 | Hand-written: ALTER TABLE ADD COLUMN + CREATE INDEX CONCURRENTLY |
| `server/src/types/inventory.ts` | NEW | 25 | Movement type union: extend with `TRANSFER_IN \| TRANSFER_OUT` (reserved for Phase 2.1) |
| `server/src/services/settings/permissions-data.ts:180` | MODIFIED | 12 | Add `inventory.count`, `purchases.view`, `purchases.manage` keys + default roles |
| `server/src/lib/verticals/defaults.ts:118` | MODIFIED | 30 | Add `retail`, `wholesale` entries setting `stockValidationMode: 'HARD_BLOCK'` |

**Acceptance gates:**

- `npm run tsc` clean (no type errors in inventory.ts union)
- `npm run db:migrate` applies migration without drift
- Existing test suite passes (no breaking changes)
- New businesses created with `vertical: 'retail'` or `'wholesale'` get `InventorySetting.stockValidationMode === 'HARD_BLOCK'`

**Dependencies:** None (foundation PR)

**Agent:** backend

---

## INV-02 — Stock movements ledger API + frontend page

**Scope:** `GET /api/inventory/products/:productId/movements` with cursor pagination; movements page with loading/empty/error/success states; invariant test.

**Files touched:**

| File | Type | LOC | Notes |
|------|------|-----|-------|
| `server/src/routes/inventory.ts` | NEW | 45 | POST /api/inventory/adjustments (placeholder for INV-03), GET /movements |
| `server/src/services/stock/list.ts` | NEW | 80 | `listStockMovements(businessId, productId, cursor?, limit?)` with keyset pagination |
| `server/src/lib/errors.ts` | MODIFIED | 8 | Add `PRODUCT_NOT_FOUND_FOR_BUSINESS` error (cross-tenant guard) |
| `src/features/inventory/pages/StockMovementsPage.tsx` | NEW | 120 | Page component with pull-to-refresh, loading skeleton (3 rows), empty state, error retry |
| `src/features/inventory/components/MovementRow.tsx` | NEW | 45 | Card layout: +12 kg (green) / −5 kg (red), reason, date, reference number |
| `src/features/inventory/hooks/useStockMovements.ts` | NEW | 60 | TanStack Query infinite cursor, `cacheReads: false` (PII guard) |
| `src/features/inventory/types/inventory.types.ts` | NEW | 35 | `StockMovementRow`, response shape |
| `__tests__/stock-movements.spec.ts` | NEW | 85 | Invariant: last row's `balanceAfter` === `Product.currentStock` after movements seeded |

**Acceptance gates:**

- `curl -H "Authorization: Bearer {invalid}" GET /api/inventory/products/:id/movements` → 401
- `curl GET /api/inventory/products/{cross-tenant-id}/movements` → 404 PRODUCT_NOT_FOUND_FOR_BUSINESS
- `curl GET /api/inventory/products/{valid-id}/movements?limit=50&cursor=null` → 200 with `data[]`, `nextCursor`
- Invariant test: `balanceAfter` of last row equals `Product.currentStock` (caught in integration suite, not here)
- 320px screenshot: no horizontal scroll, cards stack cleanly
- 375px screenshot: quantity color-coded (green in/red out)
- tsc clean

**Dependencies:** INV-01

**Agent:** backend + frontend

---

## INV-03 — Manual stock adjustment API + drawer UI

**Scope:** `POST /api/inventory/adjustments` with idempotency + reason enum + guard rails; bottom-sheet drawer with reason picker, quantity input, confirmation dialog.

**Files touched:**

| File | Type | LOC | Notes |
|------|------|-----|-------|
| `server/src/routes/inventory.ts:45` | MODIFIED | 60 | POST /adjustments: validate, idempotency, cross-tenant guard, call adjustStock |
| `server/src/services/stock/core.ts:adjustStock` | MODIFIED | 15 | Wire in `reason` parameter, pass to StockMovement.create |
| `server/src/middleware/idempotency.ts` | MODIFIED | 20 | Ensure adjustment route key is `(businessId, userId, route, Idempotency-Key)` |
| `src/features/inventory/components/StockAdjustmentDrawer.tsx` | NEW | 110 | Bottom sheet: 2-tap (reason → qty) or 1-tap (qty only if reason pre-selected), confirm dialog |
| `src/features/inventory/components/AdjustmentForm.tsx` | NEW | 80 | Form fields: reason picker (DAMAGE, THEFT, AUDIT, GIFT, RETURN, OTHER), quantity, notes (required if OTHER), movementDate |
| `src/features/inventory/hooks/useAdjustStock.ts` | NEW | 65 | Mutation: `api()` with `entityType: 'stock-adjustment'`, `entityLabel: productName`, optimistic update, toast on 409 HARD_BLOCK |
| `src/features/inventory/services/inventory.service.ts` | NEW | 40 | `adjustStock(productId, type, quantity, reason, notes?, movementDate?)` → `api('/inventory/adjustments', { method: 'POST', ... })` |
| `__tests__/adjustment-idempotency.spec.ts` | NEW | 60 | Duplicate POST within 60s returns same movement row (idempotent) |
| `__tests__/adjustment-hard-block.spec.ts` | NEW | 55 | ADJUSTMENT_OUT with `stockValidationMode=HARD_BLOCK` + insufficient stock → 409 with error payload |

**Acceptance gates:**

- Duplicate `POST /api/inventory/adjustments` with same `Idempotency-Key` within 60s → 200 with original movement (no double-write)
- Third-time duplicate (outside 60s window) → 200 with new movement
- `POST` with `quantity <= 0` → 400 INVALID_QTY
- `POST` with `reason=OTHER` but no `notes` → 400 (validation error)
- `POST` with `ADJUSTMENT_OUT` on product with `currentStock=5`, `qty=10`, `stockValidationMode=HARD_BLOCK` → 409 INSUFFICIENT_STOCK with `{ productId, productName, available: 5, requested: 10 }`
- `POST` with `stockValidationMode=WARN_ONLY` same scenario → 200, `newStock` is negative
- 320px screenshot: reason picker renders without overflow
- 375px screenshot: 48px min touch target on qty input
- Confirm dialog screenshot: copy reads "Adjust [name] down by [qty] [unit]? This cannot be undone."
- Offline: queued adjustment shows "Stock adjustment — [product name]" in sync queue toast
- tsc clean

**Dependencies:** INV-02

**Agent:** backend + frontend

---

## INV-04 — Purchase invoice entry + weighted-average cost + edit-reverses-reapply (hard gate checkpoint)

**Scope:** Reuse `POST /api/documents` with `type: 'PURCHASE_INVOICE'`. Fix `stockAfter` snapshot to equal actual post-increment stock. Implement weighted-average purchase price update. Support edit via reverse+reapply inside single transaction.

**Files touched:**

| File | Type | LOC | Notes |
|------|------|-----|-------|
| `server/src/services/document/create.ts:172` | MODIFIED | 30 | After stock adjustments loop, fetch final `stockBefore`/`stockAfter` from movements; `updateMany` DocumentLineItems per document+product |
| `server/src/services/stock/invoice-ops.ts:58` | MODIFIED | 90 | `addForPurchaseInvoice(tx, doc, lineItems)` → per-line: call `adjustStock()`, then compute & update weighted-average cost on Product. Guards: skip if `incomingPaise === 0` or `prevStock + qty <= 0`. Formula: `(prevStock * prevAvgPaise + qty * incomingPaise) / (prevStock + qty)` |
| `server/src/services/document/update.ts:40` | MODIFIED | 85 | If doc already SAVED and being edited: `reverseForInvoice(tx, doc.id)` then `addForPurchaseInvoice(tx, newDoc, newLineItems)` in same `$transaction` |
| `server/src/services/document/delete.ts:38` | MODIFIED | 5 | Already calls `reverseForInvoice` — no change needed (verify in code review) |
| `src/features/purchases/pages/PurchaseFormPage.tsx` | NEW | 95 | Wraps DocumentFormPage; supplier picker instead of generic party picker; marked as `type: 'PURCHASE_INVOICE'` in form state |
| `src/features/purchases/components/SupplierPicker.tsx` | NEW | 70 | Party picker filtered to `type === 'supplier'`; caches party list |
| `src/features/purchases/hooks/usePurchaseForm.ts` | NEW | 75 | Mutation: `api('/documents', { method: 'POST', body: { type: 'PURCHASE_INVOICE', ... }, entityType: 'purchase-invoice', entityLabel: `${supplierName} - ${date}` })` |
| `src/features/purchases/types/purchase.types.ts` | NEW | 40 | `PurchaseInvoiceFormData`, `PurchaseLineItem` (extends DocumentLineItem with purchasePrice field) |
| `__tests__/stock-roundtrip.spec.ts` | NEW | 120 | **Integration test (hard gate).** Seed 3 products. Create purchase (qty 10, cost 100 paise ea). Create sale (qty 6). Create adjustment (qty 1 out). Void sale. Assert: `SUM(StockMovement.quantity WHERE productId) === Product.currentStock` for each product, movements immutable, weighted-average cost matches expected `(10*100 + 0) / 10 = 100`. |
| `__tests__/concurrent-stock.spec.ts` | NEW | 85 | Concurrency test: two purchases of same product fire simultaneously; `adjustStock` uses `FOR UPDATE` to serialize; final stock == sum of all increments |

**Acceptance gates:**

- `npm run tsc` clean
- `npm run test -- stock-roundtrip` passes: SUM(movements) == currentStock for each product
- `npm run test -- concurrent-stock` passes: no stock drift under concurrent writes
- `curl -X POST /api/documents -H "Content-Type: application/json" -d '{"type":"PURCHASE_INVOICE", "status":"SAVED", "partyId":"...", "lineItems":[{"productId":"...", "qty":10, "rate":100}]}' -H "Authorization: Bearer {valid}" -H "Idempotency-Key: {uuid}"` → 200, `Document.id` returned, `StockMovement.type === 'PURCHASE'` created, `Product.currentStock` incremented by 10, `Product.purchasePrice` updated to 100
- Void SAVED purchase → `StockMovement.type === 'REVERSAL'` created, `Product.currentStock` decremented by 10
- Edit SAVED purchase (change qty 10 → 15) → reversal of first 10 written, new +15 written, net stock += 5, weighted-average recalculated
- 320px screenshot: supplier picker + line item input renders without overflow
- 375px screenshot: large enough inputs for mobile entry
- Offline: "Purchase — [supplier name]" queued in sync queue with entityLabel
- tsc clean

**Dependencies:** INV-03

**Blocks:** INV-05 (hard gate must pass before sale logic ships)

**Agent:** backend + frontend

---

## **Hard Gate Checkpoint**

**Requirement:** `__tests__/stock-roundtrip.spec.ts` must pass before INV-05 begins.

**Test:** Round-trip purchase → partial sale → adjustment → void sale cycle. Assert `SUM(StockMovement.quantity) === Product.currentStock` for every product involved.

**Evidence:** Test output log in PR INV-04, or run `npm run test -- stock-roundtrip --verbose`.

If failed: INV-05 is **BLOCKED**. Return to INV-04, fix the root cause (likely in `adjustStock` serialization or weighted-average logic), re-run gate. Only proceed when test passes consistently.

---

## INV-05 — Sale invoice HARD_BLOCK + stockAfter snapshot + void/reversal

**Scope:** Wire sale stock decrement into existing `createDocument` transaction. Implement HARD_BLOCK validation that collects all insufficient-stock items per invoice, not per line. Fix `stockAfter` snapshots. Void/delete already uses reversal — verify it works end-to-end.

**Files touched:**

| File | Type | LOC | Notes |
|------|------|-----|-------|
| `server/src/services/stock/invoice-ops.ts:21` | MODIFIED | 85 | `deductForSaleInvoice(tx, doc, lineItems)` → **collect errors across loop instead of short-circuit**. Build `insufficiencies: Array<{productId, productName, available, requested}>`. After loop, if any, throw single 409 with full array. Per-line: call `adjustStock(tx, productId, -qty, ...)` |
| `server/src/services/document/create.ts:207` | MODIFIED | 20 | After `deductForSaleInvoice` loop completes, fetch final movement balances and `updateMany` DocumentLineItems to set `stockAfter` correctly (not equal to `stockBefore`) |
| `server/src/lib/errors.ts` | MODIFIED | 12 | `INSUFFICIENT_STOCK` error shape: `{ code, message, items: Array<{productId, productName, available, requested}> }` |
| `server/src/routes/documents.ts:validate` | MODIFIED | 8 | After validate, if `type === 'SALE_INVOICE'` and `status === 'SAVED'`, pre-check `stockValidationMode` and read `InventorySetting` once (cache in req object) |
| `src/features/invoicing/components/InvoiceForm.tsx` | MODIFIED | 35 | On 409 INSUFFICIENT_STOCK error response, inline error per line item: highlight product row, show "[Product]: only N [unit] in stock, M requested" toast or inline text |
| `__tests__/sale-hard-block.spec.ts` | NEW | 60 | Sale with 3 line items, items 1 and 3 insufficient stock → 409 with `items[]` containing both, not just item 1 |
| `__tests__/sale-void-reversal.spec.ts` | NEW | 65 | Create sale (qty 10), save, void. Assert: `StockMovement.type === 'REVERSAL'` created, `Product.currentStock` restored exactly, movements immutable |

**Acceptance gates:**

- `curl -X POST /api/documents -d '{"type":"SALE_INVOICE", "status":"SAVED", "lineItems":[{...}, {...}]}' ...` with 2 insufficient items → 409 INSUFFICIENT_STOCK, `items[]` array contains both (not just first error)
- Same with `stockValidationMode=WARN_ONLY` → 200 OK, `warnings[]` field in response (not an error)
- Void SAVED sale → 200 OK, `StockMovement` reversal written, stock restored
- `stockBefore` on DocumentLineItem equals `balanceAfter` of immediately preceding StockMovement for that product (integration test, swept up in stock-roundtrip gate)
- 375px screenshot: sale form displays inline 409 error per line item without breaking layout
- tsc clean

**Dependencies:** INV-04 (must pass hard gate first)

**Blocks:** INV-06

**Agent:** backend + frontend

---

## INV-06 — Stock value report API + page + low-stock API + page + dashboard tile

**Scope:** `GET /api/reports/stock-value` with weighted-average cost projection. `GET /api/inventory/low-stock` using partial index. Dashboard `lowStockCount` field. Frontend pages for report and low-stock list; dashboard tile clickthrough.

**Files touched:**

| File | Type | LOC | Notes |
|------|------|-----|-------|
| `server/src/services/report/stock-value.service.ts` | NEW | 95 | Query: SELECT id, name, sku, currentStock, COALESCE(purchasePrice, 0) avg_cost, FLOOR(currentStock * purchasePrice) total_value FROM Product WHERE businessId AND isDeleted=false. Keyset pagination on (total_value DESC, id ASC). Summary: SUM(currentStock * purchasePrice) in parallel. |
| `server/src/routes/reports.ts:extend` | MODIFIED | 45 | GET /api/reports/stock-value endpoint: validate cursor/limit/categoryId, call service, return shape with data[], summary, nextCursor. Empty result → 200 {data: [], summary: {totalValuePaise: 0, productCount: 0}} |
| `server/src/routes/inventory.ts:extend` | MODIFIED | 40 | GET /api/inventory/low-stock: filter by `minStockLevel > 0 AND currentStock <= minStockLevel AND isDeleted = false` (partial index hits), include reorderQty, compute shortfall |
| `server/src/services/dashboard.service.ts:extend` | MODIFIED | 15 | `getSummary(businessId)` → add `lowStockCount` field (query `StockAlert` WHERE type='LOW_STOCK' AND status='OPEN'`) |
| `src/features/inventory/pages/StockValueReportPage.tsx` | NEW | 110 | Summary strip (pinned top): total value, product count. Scrollable list below with pull-to-refresh. Loading: 5 skeleton rows. Empty: "No products with stock..." Error: "Report failed. Tap to retry." |
| `src/features/inventory/components/StockValueRow.tsx` | NEW | 55 | Two-line card (mobile): [name + unit] left, [value] right. Tap to navigate product detail. |
| `src/features/inventory/components/StockValueSummaryStrip.tsx` | NEW | 40 | Pinned-top strip: Rs X,XX,XXX.XX | N products. Skeleton version for loading. |
| `src/features/inventory/pages/LowStockListPage.tsx` | NEW | 95 | Filterable list of low-stock items. Category filter pill. Sort toggle (by value / by shortfall). Card layout. Empty: "All items are well-stocked." |
| `src/features/inventory/components/LowStockCard.tsx` | NEW | 50 | Product name + current stock + min level + shortfall + suggested qty (or "—" if reorderQty=0). Tap to adjust or navigate to product. |
| `src/features/dashboard/components/AlertBadge.tsx` | MODIFIED | 25 | Render `lowStockCount` badge; click navigates to LowStockListPage with no category filter |
| `src/features/inventory/hooks/useStockValueReport.ts` | NEW | 70 | TanStack Query: `api('/reports/stock-value', { cacheReads: true })` (safe — no PII, static summary). Infinite cursor. |
| `src/features/inventory/hooks/useLowStock.ts` | NEW | 60 | TanStack Query: `api('/inventory/low-stock', { cacheReads: false })` (PII guard: product list sensitivity). Infinite cursor. |
| `__tests__/partial-index.spec.ts` | NEW | 40 | EXPLAIN ANALYZE on `/inventory/low-stock` query proves index is used (Index Scan, not Seq Scan). |

**Acceptance gates:**

- `curl GET /api/reports/stock-value` with no products → 200 {data: [], summary: {totalValuePaise: 0, productCount: 0}} (not 404)
- `curl GET /api/reports/stock-value` with 5 products → 200 with keyset pagination cursor (base64-encoded tuple of last row)
- `curl GET /api/inventory/low-stock` → uses partial index (EXPLAIN ANALYZE proof in test)
- `curl GET /api/dashboard/summary` → 200 with `lowStockCount: number` field added
- 320px screenshot: value report no horizontal scroll, summary strip readable, cards stack
- 375px screenshot: category filter pill, sort toggle, cards
- Dashboard tile screenshot: badge shows count, click navigates to filtered LowStockListPage
- tsc clean

**Dependencies:** INV-05

**Blocks:** INV-07

**Agent:** backend + frontend

---

## INV-07 — Stock verification mobile flow + barcode scan + single-tx adjustments

**Scope:** Wiring verification create, item upsert, and complete endpoints. Frontend mobile count UI (search-first, barcode fallback, large qty input). Barcode scan via Capacitor Camera API. `applyAdjustments` runs in single `$transaction` with idempotency (skip already-adjusted items). Soft-deleted products handled gracefully.

**Files touched:**

| File | Type | LOC | Notes |
|------|------|-----|-------|
| `server/src/services/stock-verification.service.ts:applyAdjustments` | MODIFIED | 90 | Wrap loop in `$transaction`. Per item: if `adjusted === true` skip (idempotent). If `discrepancy !== 0`, call `adjustStock(tx, productId, discrepancy, ADJUSTMENT_IN\|OUT, reason='AUDIT')`. After tx commit, fire `scheduleAlertChecks(businessId, productIds)`. Return `{adjustmentsCreated, totalDiscrepancy}`. |
| `server/src/routes/stock-verification.ts:extend` | MODIFIED | 30 | POST /stock-verification/:id/complete: add status check `WHERE status != 'COMPLETED'` before update; if 0 rows → throw 409 ALREADY_COMPLETED. |
| `server/src/lib/errors.ts` | MODIFIED | 8 | `ALREADY_COMPLETED`, `INCOMPLETE_COUNT` error codes |
| `src/features/stock-verification/pages/StockVerificationFlow.tsx` | NEW | 140 | Single-page mobile flow: search/scan input (top), product list (middle), discrepancy summary (bottom with CTA "Apply N Adjustments"). State: DRAFT → IN_PROGRESS (on first patch) → COMPLETED. Offline-safe via `api()`. |
| `src/features/stock-verification/components/CountItemCard.tsx` | NEW | 75 | Per-product row: product name, barcode icon, 48px qty input (large touch target), actual/system stock display, discrepancy (green/red). Tap to increment/decrement. |
| `src/features/stock-verification/components/DiscrepancySummary.tsx` | NEW | 60 | Summary sheet: total discrepancies, per-item breakdown, CTA "Apply N Adjustments". Show "Stock matches system. No adjustments needed." if all discrepancies are 0. |
| `src/features/stock-verification/components/ScannerSheet.tsx` | NEW | 85 | Capacitor Camera API: request permission, show live preview, detect barcode. On scan success, query product by barcode SKU. On permission denied, fallback to text search by SKU/name. |
| `src/features/stock-verification/pages/SearchProductInput.tsx` | NEW | 50 | Debounced search by SKU or name, filters product list. Highlighted when soft-deleted product found ("(deleted)" label, greyed out). |
| `src/features/stock-verification/hooks/useStockVerification.ts` | NEW | 85 | Mutations: `startCount()` → POST /stock-verification, `updateItem(itemId, actualQty)` → PATCH /items/:id, `completeCount()` → POST /complete (idempotent: returns 200 even if already COMPLETED), `applyAdjustments()` → POST /adjust (idempotent: skip adjusted=true). All via `api()` with `entityType: 'stock-verification'`, `entityLabel: `${verified} items`. |
| `__tests__/verification-idempotency.spec.ts` | NEW | 55 | POST /stock-verification/:id/complete twice → second call returns 409 ALREADY_COMPLETED. POST /adjust twice (idempotent) → second call skips adjusted items, returns same adjustmentsCreated count. |
| `__tests__/verification-soft-delete.spec.ts` | NEW | 45 | Delete product mid-count, complete count → UI shows "(deleted)" label, adjustment still applies, audit trail intact. |

**Acceptance gates:**

- `npm run test -- verification-idempotency` passes: concurrent complete calls handled, idempotent apply-adjust
- `npm run test -- verification-soft-delete` passes: soft-deleted product does not crash, shows "(deleted)" in UI, adjustments apply
- `curl POST /stock-verification/:id/complete` twice → first 200, second 409 ALREADY_COMPLETED
- `curl POST /stock-verification/:id/adjust` with `adjusted=true` items → skips them (idempotent)
- 320px screenshot: search input + product list (no horizontal scroll), qty input large (48px+), summary sheet, CTA button readable
- 375px screenshot: barcode scanner preview (if camera available), fallback search UI
- Camera permission denied screenshot: fallback to text search active
- Offline: "Stock verification — N items verified" queued in sync queue
- 100-SKU count completes in <10 min on a Rs 10K Android device (manual perf test, document result in PR)
- tsc clean

**Dependencies:** INV-06

**Blocks:** None (final PR)

**Agent:** backend + frontend

---

## Dependency Graph

```
INV-01 (schema, permissions, verticals)
  ↓
INV-02 (movements ledger API + page)
  ↓
INV-03 (adjustment API + drawer)
  ↓
INV-04 (purchase entry + WA cost) ←─┐
  ↓ [hard gate: stock-roundtrip test]  │
INV-05 (sale HARD_BLOCK + reversal) ─┘
  ↓
INV-06 (value report + low-stock + dashboard)
  ↓
INV-07 (verification mobile flow + scanner)
  ✓ DONE
```

---

## Hard Gate — Between INV-04 and INV-05

**Checkpoint:** `/Users/sawanjaiswal/Projects/HisaabPro/__tests__/stock-roundtrip.spec.ts`

**Test:** Create 3 products. Purchase (qty 10, cost 100 paise). Sale (qty 6). Adjustment (qty 1 out). Void sale. Assert for each product:
- `SUM(StockMovement.quantity) === Product.currentStock`
- Movements are immutable (no updates, only REVERSAL rows on void)
- Weighted-average cost matches expected value

**Run:** `npm run test -- stock-roundtrip --verbose`

**Pass criteria:** All assertions green, no timeouts, no data drift.

**If failed:** Return to INV-04, debug `adjustStock` serialization or weighted-average logic, retest. **INV-05 is BLOCKED until this passes.**

---

## Notes

- **Idempotency:** Every mutation (adjustment, purchase, verification complete, apply) uses `Idempotency-Key` header. Server dedupes within 60s–24h window (varies by operation). Checked in unit tests per PR.
- **Offline:** All mutations use `api()` from `@/lib/api` with `entityType` + `entityLabel` so the sync queue shows meaningful context.
- **Permissions:** New keys `inventory.count`, `purchases.view`, `purchases.manage` are wired into routes INV-04, INV-06, INV-07. Existing `invoicing.*` gates sales (unchanged).
- **Mobile-first:** All screens tested at 320px minimum; no horizontal scroll. Touch targets ≥48px. 4 UI states on every screen (loading skeleton, empty, error, success).
- **Partial index:** INV-06 includes EXPLAIN ANALYZE proof that `/inventory/low-stock` uses the partial index from INV-01 (not full Seq Scan).
- **Vertical defaults:** INV-01 sets `retail` and `wholesale` to HARD_BLOCK; other verticals default to WARN_ONLY. Services vertical skips inventory tracking entirely.

---

**File:** `/Users/sawanjaiswal/Projects/HisaabPro/docs/inventory-phase-2/TASKS.md`  
**Line count:** 343 LOC

**[11:56 AM]**