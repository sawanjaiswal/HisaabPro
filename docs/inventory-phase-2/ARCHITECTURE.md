---
status: approved
feature: inventory-phase-2
created: 2026-05-06T13:30:00Z
approver: Sawan
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
agents_invoked:
  - architect (output: docs/inventory-phase-2/ARCHITECTURE.md)
acceptance:
  backend:
    - tsc clean across server + client
    - integration test: SUM(StockMovement.quantity) per product == Product.currentStock after round-trip purchase + sale + adjustment + reversal
    - curl 401 / 404 (cross-tenant) / 409 (HARD_BLOCK + ALREADY_COMPLETED) for every new route
    - idempotency: duplicate POST within 60s returns the original row
  frontend:
    - screenshots at 320px and 375px: loading / error / empty / success for every screen
    - offline: adjustment + verification queue via api() with entityType/entityLabel
    - 6-layer split per feature; no file > 250 LOC
---

# Inventory Phase 2.0 — Architecture

> Phase 2.0 = single-godown, weighted-average cost, HARD_BLOCK retail/wholesale,
> purchase-on-SAVED-only, mobile-first physical count.
> Most plumbing already exists in `server/src/services/stock/*` and the
> document create/delete flow. Phase 2 is **harden + fill gaps + ship UI**.

---

## 1. Schema delta — exactly two changes

Re-confirmed against `server/prisma/schema.prisma` (line 503–598, 2179–2234):

| # | Change | Path | Notes |
|---|--------|------|-------|
| 1 | Add `Product.reorderQty Float?` | `schema.prisma:528` (next to `moq`) | **Nullable** per scope decision. `null` = "not set" (UI shows "—"); `0` = explicit zero. |
| 2 | Add partial index for low-stock filter | `schema.prisma` Product block | `@@index([businessId, currentStock])` already exists composite with `minStockLevel`. We add a **filtered** GIN-style B-tree via raw SQL: `CREATE INDEX "Product_lowStock_idx" ON "Product" ("businessId", "currentStock") WHERE "minStockLevel" > 0 AND "currentStock" <= "minStockLevel" AND "isDeleted" = false;` |

**Nothing else.** All other models exist:

- `StockMovement` — line 566, every required column present (`type`, `reason`, `referenceType`, `balanceAfter`, `batchId?`, `godownId?`).
- `StockAlert` — line 2179, `LOW_STOCK` / `OUT_OF_STOCK` / `RESOLVED` / `ACKNOWLEDGED`.
- `StockVerification` + `StockVerificationItem` — line 2201–2234.
- `InventorySetting.stockValidationMode` — line 619, default `WARN_ONLY`.
- `Document.type === 'PURCHASE_INVOICE'` — line 639 enum comment.
- `DocumentLineItem.purchasePrice / stockBefore / stockAfter` — line 809, 814, 815.

`StockMovement.type` enum text (`OPENING, SALE, PURCHASE, ADJUSTMENT_IN, ADJUSTMENT_OUT, RETURN_IN, RETURN_OUT, REVERSAL`) is a comment-only constraint; we extend the **TypeScript** const union only — `TRANSFER_IN`/`TRANSFER_OUT` reserved for Phase 2.1, no schema change needed.

---

## 2. Migration plan — single hand-written SQL

`server/prisma/migrations/20260507_inventory_phase2_reorder_qty/migration.sql`

```sql
-- INV-01: Phase 2 inventory hardening — additive only.

-- 1. Reorder quantity (nullable: null = not set, 0 = explicit zero).
ALTER TABLE "Product"
  ADD COLUMN "reorderQty" DOUBLE PRECISION;

-- 2. Partial index for the low-stock list query (covers the hot path).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_lowStock_idx"
  ON "Product" ("businessId", "currentStock")
  WHERE "minStockLevel" > 0
    AND "currentStock" <= "minStockLevel"
    AND "isDeleted" = false;
```

Then add `reorderQty Float?` to the Prisma model and run
`npx prisma migrate resolve --applied 20260507_inventory_phase2_reorder_qty`
on staging/prod (matches the project's "manual SQL + resolve" pattern from
`PRISMA_MIGRATION_RULES.md`).

Backfill: **none needed** — null is the intended default. Optional follow-up
migration in 2.1 can copy `minStockLevel` → `reorderQty` for existing rows
where the user opts in via the UI.

`CREATE INDEX CONCURRENTLY` runs outside a transaction — ship it as its own
migration file so Prisma doesn't wrap it.

---

## 3. Stock movement contract

**Invariant:** every change to `Product.currentStock` is paired with exactly
one `StockMovement` row inside the **same DB transaction**. The single
choke-point is `adjustStock()` in `server/src/services/stock/core.ts`.

| Source mutation | Movement `type` | `referenceType` | Direction | Service |
|-----------------|-----------------|-----------------|-----------|---------|
| Sale invoice SAVED | `SALE` | `SALE_INVOICE` | `-qty` | `deductForSaleInvoice` (`stock/invoice-ops.ts:21`) |
| Purchase invoice SAVED | `PURCHASE` | `PURCHASE_INVOICE` | `+qty` | `addForPurchaseInvoice` (`stock/invoice-ops.ts:58`) |
| Manual adjustment in | `ADJUSTMENT_IN` | `ADJUSTMENT` | `+qty` | `adjustStock` (direct) |
| Manual adjustment out | `ADJUSTMENT_OUT` | `ADJUSTMENT` | `-qty` | `adjustStock` (direct) |
| Sale return / Credit note SAVED | `RETURN_IN` *(new)* | `CREDIT_NOTE` | `+qty` | extend `addForPurchaseInvoice`; switch `type` based on doc type |
| Purchase return / Debit note SAVED | `RETURN_OUT` *(new)* | `DEBIT_NOTE` | `-qty` | new helper `deductForDebitNote` |
| Sale/purchase **void or delete** | `REVERSAL` | `ADJUSTMENT` | inverse of original | `reverseForInvoice` (`stock/invoice-ops.ts:95`) |
| Verification adjustment (count delta) | `ADJUSTMENT_IN`/`OUT`, `reason: 'AUDIT'` | `STOCK_VERIFICATION` | signed delta | `applyAdjustments` (verification.service) |
| Opening balance | `OPENING` | `OPENING` | `+qty` | product create when `currentStock > 0` |

The existing `STOCK_DECREASE_TYPES` / `STOCK_INCREASE_TYPES` sets in
`document/helpers.ts:18-19` already include `CREDIT_NOTE` (treated as +stock,
which corresponds to a customer return). Phase 2 work: **rename the movement
`type` to `RETURN_IN`** when the source doc is a `CREDIT_NOTE`, not `PURCHASE`.
Same for `DEBIT_NOTE` → add to `STOCK_DECREASE_TYPES` and emit `RETURN_OUT`.

All movements are **immutable** (no `updatedAt`, no UI delete). Wrong entries
are corrected by writing a new `REVERSAL` row, never by updating the original.

---

## 4. Race-safe stock decrement

**Decision: keep the current `SELECT … FOR UPDATE` pattern in `adjustStock()`**
(`stock/core.ts:64-69`) — already shipped, already used by the invoice flow,
and it composes cleanly with multi-row transactions where two line items
target the same product.

We considered the atomic-`UPDATE … WHERE currentStock >= $qty RETURNING …`
form. Rejected because:

1. It validates **per row**, but `HARD_BLOCK` needs a **per-invoice** error
   payload (`{ productId, productName, available, requested }[]`). A failed
   atomic update returns `0 rows affected` — we'd then have to re-query for
   the friendly name, defeating the round-trip saving.
2. With multiple line items in one invoice that hit the same product (rare
   but legal), `FOR UPDATE` lets us read once, validate cumulatively, then
   update. Atomic `UPDATE` would race against itself across the loop.
3. `FOR UPDATE` extends naturally to the verification flow which locks N
   rows at the start of `applyAdjustments`.

`HARD_BLOCK` failure path: `insufficientStockError()` (`server/src/lib/errors.js`)
throws, the transaction rolls back, the route returns
**HTTP 409** with `{ success: false, error: { code: 'INSUFFICIENT_STOCK', items: [...] } }`.

For the **invoice** path, we batch the per-line error collection: catch the
first `INSUFFICIENT_STOCK` per item, accumulate, and throw a single 409 at
the end of `deductForSaleInvoice` so the UI can highlight every problem
line at once. Today the loop short-circuits on the first failure — change to
collect all and throw after the loop completes (still inside the tx, so the
rollback semantics are unchanged).

Cached stock validation mode (`cachedBusinessValidationMode` in `core.ts:26`)
already prevents N+1 settings reads — keep.

---

## 5. Existing invoice service integration

The document service is **fully generic** over `Document.type`:

- `createDocument()` — `server/src/services/document/create.ts`
  - Already routes `PURCHASE_INVOICE` through `addForPurchaseInvoice` (line 212).
  - Already writes `purchasePrice` per line item (line 172) and `stockBefore`/`stockAfter` (line 175–176).
  - **Gap:** `stockBefore`/`stockAfter` are written **before** the stock adjustment runs (line 175 reads from `productMap`, line 207 calls `deductForSaleInvoice`). For sale invoices this means `stockAfter` equals `stockBefore` in the row — the decrement happens via `StockMovement` but the snapshot column is wrong. **Fix in INV-05:** capture `result.previousStock` / `result.newStock` from `adjustStock()` and update `DocumentLineItem.stockAfter` per line after the loop completes (one `updateMany` keyed by `documentId + productId`).
  - **Gap:** weighted-average cost update for `PURCHASE_INVOICE`. Not done today. Add in `addForPurchaseInvoice`: after each `adjustStock` call, recompute `Product.purchasePrice` (paise) using `(prevStock * prevAvgPaise + qty * incomingPaise) / (prevStock + qty)`. Skip when `incomingPaise === 0` (Raju forgot to enter cost) or when `prevStock + qty <= 0`. Pass `incomingPaise` from the line item (`li.rate` in paise, less GST if inclusive — already calculated as `purchasePrice` field).

- `deleteDocument()` — `server/src/services/document/delete.ts`
  - Already calls `reverseForInvoice` for `PURCHASE_INVOICE` and `SALE_INVOICE` (line 38).
  - `reverseForInvoice` reads movements by `referenceId` and writes inverse `REVERSAL` rows. Works as-is.
  - **Gap:** weighted-average cost is **not reverted** on purchase void. Acceptable for Phase 2 (running average is one-directional; reverting would require recomputing from history). Document this in user-facing copy and the migration note.

- `updateDocument()` — `server/src/services/document/update.ts`
  - **Today:** likely doesn't touch stock if the doc was already SAVED. If the user edits a SAVED purchase invoice and changes a quantity, stock will drift.
  - **Phase 2 decision:** edits to SAVED purchase or sale invoices → **reverse the original movements then re-apply**. Implement as `reverseForInvoice(tx, …)` immediately followed by `addForPurchaseInvoice` / `deductForSaleInvoice` with the new line items, all inside the same `$transaction`. (Audit lessons: do not nest a separate transaction.)

**No new "purchase service" is created.** Purchase entry reuses
`POST /api/documents` with `type: 'PURCHASE_INVOICE'`. The frontend gets a
purchase-flavoured form layer that posts the same payload shape.

Verification adjustments — currently `applyAdjustments` already calls
`adjustStock` per discrepant item (per `stock-verification.service.ts`).
Phase 2 work: ensure the loop runs **inside one `$transaction`** (was
likely per-item before — confirm in INV-06) and fires
`scheduleAlertChecks` after commit.

---

## 6. Stock value report — weighted-average cost

**Source of truth: `Product.purchasePrice`** (paise), kept up-to-date on
every `PURCHASE` movement by `addForPurchaseInvoice` (see §5 gap fix).
This avoids a per-request reduction over `StockMovement`.

Formula (applied in the purchase tx):

```
newAvgPaise = round(
  (prevStock * prevAvgPaise + qty * incomingPaise) / (prevStock + qty)
)
```

Guards:
- `incomingPaise === 0` → keep `prevAvgPaise` (Raju forgot to enter cost).
- `prevStock + qty <= 0` → keep `prevAvgPaise` (negative-stock edge in WARN_ONLY).
- First-ever purchase when `prevStock <= 0` and `prevAvgPaise === null` →
  `newAvgPaise = incomingPaise`.

**Opening cost:** when a product is created with `currentStock > 0`, require
the user to enter `purchasePrice` (already a field on the Product form).
That seeds `prevAvgPaise` for the first purchase.

Report query (`server/src/services/report/stock-value.service.ts`, new):

```sql
SELECT id, name, sku, "currentStock",
       COALESCE("purchasePrice", 0) AS avg_cost_paise,
       FLOOR("currentStock" * COALESCE("purchasePrice", 0)) AS total_value_paise,
       u.symbol AS unit_symbol
FROM "Product" p
JOIN "Unit" u ON u.id = p."unitId"
WHERE p."businessId" = $1
  AND p."isDeleted" = false
  AND ($2::text IS NULL OR p."categoryId" = $2)
ORDER BY total_value_paise DESC, p.id ASC
LIMIT $3 OFFSET 0;
```

Cursor: keyset on `(total_value_paise DESC, id ASC)` — last row's tuple
becomes the next cursor (base64-encoded).

Summary strip = `SELECT SUM(currentStock * COALESCE(purchasePrice, 0))` over
the same `WHERE`, computed in parallel via `Promise.all`.

---

## 7. Reorder alerts

Existing `checkAndCreateAlerts()` (`stock-alert.service.ts:24`) already
implements the dedupe + auto-resolve logic. Phase 2 changes:

1. **Filter signal** — change the query in `listAlerts` and the new
   `/inventory/low-stock` route to use the partial index from §1
   (`minStockLevel > 0 AND currentStock <= minStockLevel`).
2. **`reorderQty` projection** — include `reorderQty` and computed
   `shortfall = max(0, minStockLevel - currentStock)` in the response.
3. **Firing trigger** — already wired: `scheduleAlertChecks(businessId, productIds)`
   runs **after** every `createDocument` / `deleteDocument` that touched stock.
   Phase 2 also wires it after `POST /api/products/:id/stock/adjust` (already
   done at `routes/products/stock.ts:65`) and after verification `applyAdjustments`.
4. **One open alert per product per type** — already enforced by the
   `findFirst` dedupe (`stock-alert.service.ts:56`).
5. **Auto-resolve** — already done when stock recovers above threshold
   (`stock-alert.service.ts:47`).
6. **No spam** — `lowStockAlertFrequency` (`InventorySetting`) governs whether
   a notification fires. The DB row is upserted on every check; the
   notification dispatcher (out of scope for Phase 2.0) reads `frequency` to
   throttle pushes.

---

## 8. Stock verification flow

Single-list mobile flow (PRD §7). Schema rows already exist.

State machine: `DRAFT → IN_PROGRESS → COMPLETED` (no edits after COMPLETED).

| Step | API | What happens |
|------|-----|--------------|
| Start | `POST /api/stock-verification` | Creates `StockVerification (status=DRAFT)`. Snapshots **all active products** as `StockVerificationItem` rows with `systemQuantity = currentStock` and `actualQuantity = null`. One DB tx. |
| Count item | `PATCH /api/stock-verification/:id/items/:itemId` | Upserts `actualQuantity`, computes `discrepancy = actual - system`. Status flips to `IN_PROGRESS` on first patch. Idempotent. **Offline-safe** via `api()` queue. |
| Complete | `POST /api/stock-verification/:id/complete` | Validates: every item has non-null `actualQuantity` else `400 INCOMPLETE_COUNT`. Sets `status = COMPLETED, completedAt = now()`. **Does not** apply adjustments. |
| Apply | `POST /api/stock-verification/:id/adjust` | Within one `$transaction`: for each item with `discrepancy != 0`, call `adjustStock()` with `type = ADJUSTMENT_IN/OUT`, `reason = 'AUDIT'`, `referenceType = 'STOCK_VERIFICATION'`, `referenceId = verification.id`. Sets `item.adjusted = true`. Returns `{ adjustmentsCreated, totalDiscrepancy }`. **Idempotent**: skip items where `adjusted = true`. After commit, fire `scheduleAlertChecks` for all touched productIds. |

Race: if two staff hit `complete` simultaneously, `WHERE status != 'COMPLETED'`
on the update gives one of them 0 rows affected → service throws `409 ALREADY_COMPLETED`.

Soft-deleted product mid-flow: `StockVerificationItem` row stays; UI shows
"(deleted)" label; adjustment still applies (audit trail integrity).

---

## 9. API surface — exact routes

All routes: `auth` middleware, `businessId` scoped from session (never body),
Zod `validate()`, `asyncHandler`. Mutations require `idempotencyCheck()`.
Responses use `sendSuccess` / `sendError` (existing helpers).

### Inventory routes (`server/src/routes/inventory.ts` — new)

| Method | Path | Permission | Idempotency | Zod schema | Returns |
|--------|------|-----------|-------------|------------|---------|
| `POST` | `/api/inventory/adjustments` | `inventory.adjustStock` | yes (60s) | `adjustmentSchema` (productId, type, quantity>0, reason enum, notes?, movementDate?) | `{ movementId, productId, newStock, balanceAfter }`; 409 on HARD_BLOCK |
| `GET` | `/api/inventory/products/:productId/movements` | `inventory.view` | n/a | `cursor?, limit?, from?, to?, type?` | `{ data: StockMovementRow[], nextCursor }` |
| `GET` | `/api/inventory/low-stock` | `inventory.view` | n/a | `cursor?, limit?, categoryId?` | `{ data: LowStockItem[], count, nextCursor }` |
| `POST` | `/api/inventory/alerts/:id/dismiss` | `inventory.adjustStock` | n/a | — | `{ message }` (already exists at `/api/stock-alerts/:id/dismiss` — keep both during a deprecation cycle) |

`POST /api/inventory/adjustments` is the new "many-or-one" entry point;
under the hood it loops over a single-element array. The PRD's per-product
`POST /api/products/:id/stock/adjust` already exists (`products/stock.ts:39`)
and stays as the legacy single-product endpoint. New screens use the new route.

### Reports

| Method | Path | Permission | Returns |
|--------|------|-----------|---------|
| `GET` | `/api/reports/stock-value` | `reports.view` | `{ data, summary, nextCursor }` per PRD §5 |

### Documents (reuse, no new routes)

Phase 2 ships **no new routes** for purchases. The frontend's purchase
form posts to `POST /api/documents` with `type: 'PURCHASE_INVOICE'`, list
filters `GET /api/documents?type=PURCHASE_INVOICE`, etc.

### Stock verification (already shipped)

Existing routes in `routes/stock-verification.ts` are **kept as-is**. PRD's
`POST /api/inventory/verifications/:id/complete` is the existing
`POST /api/stock-verification/:id/complete`. No URL change to avoid
breaking the existing mobile build.

### Dashboard

`GET /api/dashboard/summary` — existing route, **add field**
`lowStockCount: number` (re-uses `getActiveAlertCount` filtered to
`LOW_STOCK + OUT_OF_STOCK`).

### Error response (uniform)

```json
{ "success": false, "error": { "code": "INSUFFICIENT_STOCK", "message": "...", "items": [...] } }
```

Codes: `INSUFFICIENT_STOCK`, `INVALID_QTY`, `STOCK_TRACKING_DISABLED`,
`INCOMPLETE_COUNT`, `ALREADY_COMPLETED`, `PARTY_NOT_FOUND`.

---

## 10. Permissions

Existing keys (verified in `server/src/services/settings/permissions-data.ts`):

- `inventory.view` ✓
- `inventory.create` ✓
- `inventory.edit` ✓
- `inventory.adjustStock` ✓ (used by stock-verification + adjust route)

**Phase 2 additions to `permissions-data.ts`:**

| Key | Label | Default roles |
|-----|-------|--------------|
| `inventory.count` | Run physical stock counts | Owner, Manager |
| `purchases.view` | View purchase invoices | Owner, Manager, Accountant |
| `purchases.manage` | Create/edit/delete purchase invoices | Owner, Manager |

`purchases.*` gates `POST /api/documents` when `type === 'PURCHASE_INVOICE'`
(checked inside the route via a small middleware that reads `req.body.type`
post-validate and re-asserts permission). **Sale invoices keep their existing
`invoicing.*` permissions.**

Vertical seeding: business creation already runs `applyVerticalDefaults`
(`verticals/defaults.ts:118`). Phase 2 adds a `retail` and `wholesale` entry
that sets `stockValidationMode: 'HARD_BLOCK'`. Existing `pharmacy` already
sets HARD_BLOCK — no change. Verticals not in the map keep WARN_ONLY (PRD
non-goal: services/salon/freelancer don't track stock).

---

## 11. Frontend layout

Tree (under `src/features/`):

```
inventory/
  pages/
    StockListPage.tsx              extends ProductListPage with low-stock pill (already shipped 56128c1)
    StockMovementsPage.tsx         per-product ledger (route: /products/:id/movements)
    StockAdjustmentDrawer.tsx      bottom sheet, 2-tap flow
    StockValueReportPage.tsx       summary strip + scrollable list
    LowStockListPage.tsx           filterable list, count badge
  components/
    MovementRow.tsx                +12 kg (green) / -5 kg (red)
    AdjustmentForm.tsx             reason picker + qty + confirm dialog
    StockValueRow.tsx              two-line card (mobile)
    StockValueSummaryStrip.tsx     pinned-top total
    LowStockCard.tsx               name + shortfall + "Reorder N" CTA
    AlertBadge.tsx                 dashboard tile
  services/
    inventory.service.ts           api() calls — adjustments, low-stock, movements
    stock-value.service.ts         api() — report
    inventory-alerts.service.ts    api() — list/dismiss alerts
  hooks/
    useStockMovements.ts           TanStack Query, infinite cursor
    useLowStock.ts
    useStockValueReport.ts
    useAdjustStock.ts              mutation w/ optimistic update + queued toast
  types/
    inventory.types.ts             StockMovementRow, LowStockItem, StockValueRow

purchases/
  pages/
    PurchaseListPage.tsx           wraps DocumentListPage filtered to PURCHASE_INVOICE
    PurchaseDetailPage.tsx         wraps DocumentDetailPage
    PurchaseFormPage.tsx           wraps DocumentFormPage with purchase-flavoured copy + supplier picker
  components/
    SupplierPicker.tsx             party picker filtered to type='supplier'
    PurchaseLineItemRow.tsx        purchasePrice editor (mandatory if no opening cost)
  services/
    purchase.service.ts            wraps documents.service for PURCHASE_INVOICE shape

stock-verification/                already exists; extend
  pages/
    StockVerificationFlow.tsx      single-list mobile count UI
  components/
    CountItemCard.tsx              48px touch target qty input
    DiscrepancySummary.tsx         summary sheet before apply
    ScannerSheet.tsx               Capacitor camera fallback to text search
```

Constraints (from `CLAUDE.md` + `OFFLINE_RULES.md`):

- Every file ≤ 250 LOC. 6-layer split (page / component / service / hook / type / utility).
- All API calls go through `@/lib/api`. Mutations pass `entityType` (`stock-adjustment`, `purchase-invoice`, `stock-verification`) and `entityLabel` (product name / invoice number).
- 4 UI states on every screen (loading skeleton / empty / error retry / success).
- 320px tested; movements ledger and value report use card layout (no horizontal table).
- Reads with `cacheReads: true` only for: dashboard low-stock count, stock value summary strip. Lists are network-only.

---

## 12. PR breakdown — 7 PRs in dependency order

| # | PR | Files (rough) | LOC est | Acceptance |
|---|----|---------------|---------|-----------|
| **INV-01** | Schema + permissions + vertical defaults | `prisma/schema.prisma` (1 line) · new migration SQL · `verticals/defaults.ts` (+retail, +wholesale) · `services/settings/permissions-data.ts` (+3 keys) · `types/inventory.ts` (movement type union with `RETURN_IN/OUT`, `TRANSFER_IN/OUT`) | ~80 | `migrate dev` clean · existing tests pass · new businesses in retail/wholesale get HARD_BLOCK |
| **INV-02** | Movements ledger API hardening + `/inventory/products/:id/movements` route + frontend page | `routes/inventory.ts` (new, movements list only) · `services/stock/list.ts` (cursor pagination) · `src/features/inventory/pages/StockMovementsPage.tsx` + components | ~350 | curl 401/404/200 · invariant test: `balanceAfter` of last row == `Product.currentStock` · 320px screenshots |
| **INV-03** | Manual adjustment API + drawer UI | `routes/inventory.ts` (POST /adjustments) · idempotency wired · `StockAdjustmentDrawer.tsx` + `AdjustmentForm.tsx` + `useAdjustStock.ts` · service-layer cross-tenant guard | ~400 | duplicate POST within 60s = same row · 409 HARD_BLOCK with payload · offline queue toast · confirm dialog screenshot |
| **INV-04** | Purchase invoice — fix `stockAfter` snapshot + weighted-avg update + edit-reverses-and-reapplies | `services/document/create.ts` (post-loop `updateMany` for stockAfter) · `services/stock/invoice-ops.ts` (WA cost computation in `addForPurchaseInvoice`) · `services/document/update.ts` (reverse+reapply on SAVED edit) · `src/features/purchases/*` pages | ~500 | integration test: round-trip purchase → sale → SUM(movements) == currentStock · WA cost matches manual calc · supplier picker on mobile 320px |
| **INV-05** | Sale invoice HARD_BLOCK collect-all-errors + `stockAfter` snapshot fix + reversal verification | `services/stock/invoice-ops.ts` (collect 409 items across loop) · `services/document/create.ts` (stockAfter updateMany) · `services/document/delete.ts` (alert recheck already wired) · sale form 409 inline error display | ~250 | concurrent sale+purchase race test · 409 returns array of `{productId, productName, available, requested}` · void of SAVED sale restores stock exactly |
| **INV-06** | Stock value report API + page · low-stock API + page · dashboard tile | `services/report/stock-value.service.ts` · `routes/reports.ts` (extend) · `routes/inventory.ts` (low-stock) · `services/dashboard.service.ts` (+lowStockCount) · `StockValueReportPage` + `LowStockListPage` + `AlertBadge` | ~550 | empty result returns `{data:[], summary:{totalValuePaise:0, productCount:0}}` not 404 · partial index used (EXPLAIN ANALYZE proof) · dashboard tile click navigates filtered list |
| **INV-07** | Verification mobile flow + `applyAdjustments` single-tx + barcode scan | `services/stock-verification.service.ts` (single-tx loop) · `StockVerificationFlow` page + `CountItemCard` + `DiscrepancySummary` + `ScannerSheet` (Capacitor camera) | ~450 | applyAdjustments idempotent (skip `adjusted=true`) · 409 ALREADY_COMPLETED on concurrent complete · soft-deleted product shows "(deleted)" not crash · 100-SKU count completes in <10 min on a Rs 10K device |

**Hard gate between INV-04 and INV-05:** integration test
`__tests__/stock-roundtrip.spec.ts` proving
`SUM(StockMovement.quantity WHERE productId = X) === Product.currentStock`
after a purchase + partial sale + adjustment + void cycle.

**Total estimated PR work:** ~2,580 LOC across 7 PRs over ~10 working days.

---

## 13. Open risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | **Concurrent sale + purchase on same product** writes overlapping movements | Medium (Priya's 2-3 staff) | High — `currentStock` diverges if not locked | `SELECT … FOR UPDATE` in `adjustStock` already serialises per-product writes inside the tx. Verify with a Jest concurrency harness in INV-04. |
| R2 | **Product soft-deleted mid-flow** (sale invoice in draft, product deleted, draft saved) | Low | Medium — 500 on save | `createDocument` already requires `findMany({ where: { id: { in: ids }, businessId } })` (no `isDeleted` filter — confirms by id only). Add explicit `isDeleted: false` check; return 400 `PRODUCT_DELETED`. INV-05. |
| R3 | **Vertical config drift** — user changes vertical post-creation, `stockValidationMode` stale | Low | Medium — sales suddenly blocked or unblocked | Vertical change is a settings action: when persisted, run `applyVerticalDefaults(businessId, newType)`. Show a confirm dialog: "This will switch stock validation to HARD_BLOCK / WARN_ONLY". |
| R4 | **Weighted-average breaks when first purchase post-dates first sale** (Raju enters opening qty without cost, then sells, then receives a purchase) | Medium | Medium — first WA equals incoming cost; prior sale has no cost basis (profit report wrong) | Mitigation: **require `purchasePrice` on product create when `currentStock > 0`** (form-level). If skipped, profit report shows "—" until first PURCHASE. Document in Settings → Inventory help. |
| R5 | **Voiding a SAVED purchase after stock has been sold** — stock goes negative under WARN_ONLY, weighted-average still references the voided cost | Medium | Medium — stock value report shows nonsense | We **don't reverse WA cost** on void (one-directional). Document this user-facing. Optional follow-up in Phase 2.1: full WA recompute from history when void detected. |
| R6 | **Idempotency-Key collision across users** in same business | Low | Low | Existing `idempotencyCheck()` middleware keys by `(businessId, userId, route, key)` — verify in INV-03. |
| R7 | **`addForPurchaseInvoice` loop is N round-trips** for big purchases (e.g. 100-line wholesale order) | Medium | Medium — slow on 2G | Acceptable for Phase 2 (per-row lock is intentional). Phase 3: batch with `WITH … RETURNING` raw SQL. Add a `>50 line items` perf test in INV-04. |
| R8 | **Verification snapshot vs. live stock** — count starts, stock changes via concurrent sale, complete applies wrong delta | Low (Raju closes shop to count) | High — adjustments overcorrect | Snapshot `systemQuantity` is taken at verification start; on `applyAdjustments` we do **NOT** re-read system stock — we apply `actualQuantity - systemQuantity` as the delta exactly as recorded. This is correct: any sale during the count is already in its own SALE movement. The verification adjusts the *physical mismatch as observed at count time*. Document in PRD UX copy. |
| R9 | **`reorderQty` typed `Float?` in Prisma** but PRD §122 says `Float @default(0)` | n/a | Low — contract drift | This architecture overrides PRD with the user's confirmed `Float?` decision (per scope). Update PRD before coding. |

---

*File:* `/Users/sawanjaiswal/Projects/HisaabPro/docs/inventory-phase-2/ARCHITECTURE.md`
