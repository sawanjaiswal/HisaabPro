# PRD — Inventory / Stock Management (Phase 2.0)

**Status:** Draft — awaiting architect  
**Date:** 2026-05-06  
**Personas in scope:** Raju (micro retailer), Priya (growing wholesaler)  
**Amit scope:** architecture must accommodate multi-location; Phase 2.0 UI ships single-godown only

---

## Elevator Pitch

HisaabPro Phase 2 inventory gives Raju and Priya a single source of truth for stock — every purchase, sale, and manual adjustment writes an immutable `StockMovement` row so the ledger is always auditable and `currentStock` never drifts. The result is a live stock value report, actionable low-stock alerts, and a mobile-first physical count workflow, all working offline on a Rs 10K Android phone.

---

## Personas & Jobs-to-be-Done

| Persona | Primary JTBD | Pain today |
|---------|-------------|------------|
| **Raju** — micro retailer, 1-2 staff, Rs 1-5L/month | "Tell me if I'm running low before I run out, and show me what I paid for each item." | Opens a sale, stock not tracked; finds out he's out of stock when a customer complains. |
| **Priya** — growing wholesaler, 2-5 staff, Rs 5-25L/month | "I want to enter a purchase invoice and have stock update automatically. I need to know my stock value at any time." | Manual spreadsheet updated nightly; stock value is always stale; returns go untracked. |
| **Amit** *(future — architecture must support)* | Multi-location stock transfers, per-godown visibility | Phase 2.1 only; APIs must be godown-aware but UI ships single-godown. |

---

## Goals

1. Every stock-changing event (sale, purchase, return, adjustment) produces an immutable `StockMovement` row with a typed reason — no more silent `currentStock` mutations.
2. Stock value report (weighted-average cost) is always computable from the ledger without a separate nightly job.
3. Low-stock alerts are actionable: a dashboard tile + filterable product list shows exactly which SKUs need reordering, with suggested reorder quantity.
4. Physical stock count (verification) completes on mobile in under 10 minutes for a 100-SKU shop.
5. Purchase entry creates a `PURCHASE_INVOICE` document and increments stock atomically inside a single DB transaction — no double-credit on retry.

---

## Non-Goals (Phase 2.0)

- Multi-godown / warehouse transfers (Phase 2.1 — schema columns `godownId` on `StockMovement` are nullable; UI stays single-godown)
- Batch and expiry tracking (Phase 2.2 — pharmacy/bakery only; `batchId` column exists but UI hidden)
- Serial number tracking (Phase 3 — manufacturing)
- Bill of Materials / work orders / manufacturing BOM (Phase 3)
- Barcode scanner hardware integration (Capacitor camera for manual scan — defer if scope risk; fallback to text search)
- FIFO cost valuation (Phase 3 — Phase 2.0 uses weighted-average)
- Demand forecasting / auto-reorder purchase orders
- Import/export of stock movements via CSV (Phase 2.1)
- Supplier management beyond `partyId` on `PURCHASE_INVOICE`

---

## User Stories

### 1. Stock Movements Ledger

- As Raju, I want to see every stock change for a product (oldest first, paginated) so I can audit how stock reached its current level.
- As Priya, I want each movement row to show the reason type, reference document number, quantity delta, and balance-after so I can reconcile with my purchase register.
- As Priya, I want movements to be immutable — once written I cannot edit or delete them (only a reversal movement can offset a wrong entry).

**Acceptance criteria:**
- `GET /api/inventory/products/:productId/movements?cursor=&limit=50` returns `{ data: StockMovement[], nextCursor }` with `type`, `quantity`, `balanceAfter`, `movementDate`, `referenceType`, `referenceNumber`, `reason`, `notes`, `createdBy.name`.
- Without auth → 401. Cross-tenant productId → 404.
- `balanceAfter` on the last row equals `Product.currentStock` (tested in integration).

### 2. Manual Stock Adjustment

- As Raju, I want to manually increase or decrease stock with a reason (damage, theft, gift, audit, return, other) and an optional note.
- As Priya, I want adjustments to appear in the ledger as `ADJUSTMENT_IN` or `ADJUSTMENT_OUT` so I can distinguish them from sales/purchases.
- As Raju, I want a confirmation dialog before saving an adjustment because it's irreversible.

**Acceptance criteria:**
- `POST /api/inventory/adjustments` with `{ productId, type: "ADJUSTMENT_IN"|"ADJUSTMENT_OUT", quantity, reason, notes }` → creates `StockMovement` + updates `Product.currentStock` in a single transaction.
- `quantity <= 0` → 400 `INVALID_QTY`.
- `ADJUSTMENT_OUT` that would push `currentStock < 0` and `InventorySetting.stockValidationMode === "HARD_BLOCK"` → 409 `INSUFFICIENT_STOCK`.
- Idempotency header required; duplicate POST within 60 s → 200 with original row (no double-write).
- `reason` must be one of: `DAMAGE`, `THEFT`, `AUDIT`, `GIFT`, `RETURN`, `OTHER`. `OTHER` requires `notes` (non-empty) — else 400.

### 3. Purchase Entry (Stock In)

- As Raju, I want to create a purchase invoice (supplier, items, quantities, purchase prices) and have stock increase automatically when I save it.
- As Priya, I want the supplier invoice number, date, and payment terms captured on the purchase so I can track what I owe.
- As Priya, I want to void/delete a purchase invoice and have stock reversed automatically.

**Acceptance criteria:**
- `POST /api/documents` with `type: "PURCHASE_INVOICE"` and `status: "SAVED"` → atomically creates `Document`, `DocumentLineItem[]`, and one `StockMovement` per line item with `type: "PURCHASE"`, `referenceType: "PURCHASE_INVOICE"`, `referenceId: document.id`.
- `Product.currentStock` updated within the same transaction.
- `Product.purchasePrice` updated to new weighted-average cost (formula: `(currentStock * oldAvgCost + qty * newCostPaise) / (currentStock + qty)`) — stored in paise, rounded.
- DELETE/void of `PURCHASE_INVOICE` → creates offsetting `StockMovement` with `type: "REVERSAL"` (does NOT mutate/delete original movement rows).
- Idempotency via `Idempotency-Key` header on POST.
- Without auth → 401. `partyId` not found for this business → 400 `PARTY_NOT_FOUND`.

### 4. Sale Invoice → Stock Decrement

- As Raju, when I save or share a sale invoice, stock decreases automatically for each line item.
- As Raju, if stock is insufficient and `stockValidationMode = HARD_BLOCK`, the save is rejected with a clear message per item.
- As Priya, when I void or delete a saved sale invoice, stock is restored via a reversal movement.

**Acceptance criteria:**
- Existing `POST /api/documents` (`type: "SALE_INVOICE"`, `status: "SAVED"|"SHARED"`) → stock decrement happens inside the existing invoice-create DB transaction (no separate API call).
- Each `DocumentLineItem` gets `stockBefore` and `stockAfter` snapshots written at save time (columns already exist on `DocumentLineItem`).
- `stockValidationMode = "HARD_BLOCK"` + any line item `qty > currentStock` → 409 `INSUFFICIENT_STOCK` with `{ productId, productName, available, requested }[]`.
- `stockValidationMode = "WARN_ONLY"` → stock goes negative; response includes `warnings: [{ productId, productName }]` (not an error).
- Void/delete of `SALE_INVOICE` → reversal `StockMovement` created; `currentStock` restored.
- `stockBefore` on `DocumentLineItem` must equal `balanceAfter` of the immediately preceding `StockMovement` for that product (tested in integration).

### 5. Stock Value Report

- As Priya, I want a report showing each product's current quantity, average cost price, and total stock value (qty × avg cost) so I know my working capital tied up in inventory.
- As Priya, I want to filter by category and sort by value descending.

**Acceptance criteria:**
- `GET /api/reports/stock-value?categoryId=&sortBy=value_desc&cursor=&limit=50` → `{ data: { productId, name, sku, unit, currentStock, avgCostPaise, totalValuePaise }[], summary: { totalValuePaise, productCount }, nextCursor }`.
- `avgCostPaise` equals the weighted-average derived from the `PURCHASE` and `OPENING` movements (not a separate stored field — computed on the fly OR from `Product.purchasePrice` snapshot which is kept updated on each purchase).
- Without auth → 401. Empty result → `{ data: [], summary: { totalValuePaise: 0, productCount: 0 } }` (not 404).
- 320px mobile renders without overflow.

### 6. Low Stock + Reorder Alerts

- As Raju, I want each product to have a low-stock threshold (`minStockLevel`, already on `Product`) and a reorder quantity (`reorderQty`, new field) so HisaabPro can warn me before I run out.
- As Priya, I want a dashboard tile showing count of low-stock SKUs; clicking it opens the product list pre-filtered to low-stock.
- As Raju, I want the alert to show the shortfall (threshold − current) and suggested reorder qty.

**Acceptance criteria:**
- `Product` gains `reorderQty Float @default(0)` field (migration required; default 0 = no reorder suggestion).
- Low-stock condition: `currentStock <= minStockLevel` AND `minStockLevel > 0`.
- `GET /api/inventory/low-stock?cursor=&limit=50` → `{ data: { productId, name, currentStock, minStockLevel, reorderQty, shortfall }[], count }`.
- Dashboard tile: `GET /api/dashboard/summary` already exists — add `lowStockCount: number` to its response (no new endpoint).
- `StockAlert` rows (`model StockAlert` already in schema) are written when stock crosses below threshold. Existing `lowStockAlertEnabled` and `lowStockAlertFrequency` on `InventorySetting` govern whether a push notification / in-app alert fires.
- Low-stock filter pill on product list already ships (`56128c1`); this PR wires it to `minStockLevel > 0 AND currentStock <= minStockLevel` server-side filter.

### 7. Stock Verification (Physical Count)

- As Raju, I want to start a stock count, search/scan each SKU, enter the counted quantity, and then apply all discrepancies at once as adjustment movements.
- As Priya, I want to save a count in progress (DRAFT) and resume it later (within the same day).
- As Raju, I want a summary of discrepancies (over/under) before I commit so I can spot errors.

**Acceptance criteria:**
- `StockVerification` and `StockVerificationItem` models already exist in schema.
- `POST /api/inventory/verifications` → creates `StockVerification` with `status: "DRAFT"`.
- `PUT /api/inventory/verifications/:id/items` → upsert `StockVerificationItem[]` (productId + actualQuantity).
- `POST /api/inventory/verifications/:id/complete` → atomically writes one `StockMovement` per discrepant item (`ADJUSTMENT_IN` or `ADJUSTMENT_OUT` with `reason: "AUDIT"`), updates `currentStock`, sets `StockVerification.status = "COMPLETED"`. Idempotent — second POST returns 200 with existing result.
- Cannot complete if any `StockVerificationItem.actualQuantity` is null → 400 `INCOMPLETE_COUNT`.
- `GET /api/inventory/verifications/:id` → includes `items[].{ productName, systemQuantity, actualQuantity, discrepancy, adjusted }`.
- Without auth → 401. Cross-tenant → 404.

---

## Data Model Changes

All changes are additive (no column removed, no existing nullable made NOT NULL without a backfill migration).

### `Product` — add one field

```prisma
reorderQty Float @default(0) // suggested reorder quantity; 0 = not set
```

`Product.purchasePrice` (already `Int?`) must be kept updated to the weighted-average cost in paise on every PURCHASE movement. The service layer owns this update inside the transaction.

### `StockMovement.type` — extend allowed values

Current enum comment: `OPENING, SALE, PURCHASE, ADJUSTMENT_IN, ADJUSTMENT_OUT, RETURN_IN, RETURN_OUT, REVERSAL`

Add: `TRANSFER_IN`, `TRANSFER_OUT` (nullable `godownId` already present; needed for Phase 2.1 compatibility — write the constants now, no UI in 2.0).

### No new tables required

`StockVerification`, `StockVerificationItem`, `StockAlert`, `InventorySetting` all exist. `Document.type = "PURCHASE_INVOICE"` is already in the enum comment.

---

## API Contract Summary

```ts
// POST /api/inventory/adjustments
interface AdjustmentReq {
  productId: string
  type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'
  quantity: number          // positive float, > 0
  reason: 'DAMAGE' | 'THEFT' | 'AUDIT' | 'GIFT' | 'RETURN' | 'OTHER'
  notes?: string            // required when reason = OTHER
  movementDate?: string     // ISO date; defaults to now()
}
interface AdjustmentRes {
  success: true
  data: {
    movementId: string
    productId: string
    newStock: number
    balanceAfter: number
  }
}

// GET /api/inventory/products/:productId/movements
interface MovementsRes {
  success: true
  data: StockMovementRow[]
  nextCursor: string | null
}
interface StockMovementRow {
  id: string
  type: string
  quantity: number
  balanceAfter: number
  reason: string | null
  notes: string | null
  referenceType: string | null
  referenceNumber: string | null
  movementDate: string        // ISO
  createdBy: { id: string; name: string }
}

// GET /api/inventory/low-stock
interface LowStockRes {
  success: true
  data: LowStockItem[]
  count: number
  nextCursor: string | null
}
interface LowStockItem {
  productId: string
  name: string
  sku: string | null
  unit: string
  currentStock: number
  minStockLevel: number
  reorderQty: number
  shortfall: number           // minStockLevel - currentStock, floored at 0
}

// GET /api/reports/stock-value
interface StockValueRes {
  success: true
  data: StockValueRow[]
  summary: { totalValuePaise: number; productCount: number }
  nextCursor: string | null
}
interface StockValueRow {
  productId: string
  name: string
  sku: string | null
  unit: string
  currentStock: number
  avgCostPaise: number        // weighted-average purchase price in paise
  totalValuePaise: number     // currentStock * avgCostPaise (integer, truncated)
}

// POST /api/inventory/verifications/:id/complete
// 200: { success: true, data: { verificationsId, adjustmentsCreated: number, totalDiscrepancy: number } }
// 400: { success: false, error: { code: "INCOMPLETE_COUNT", message: "...", incompleteItems: string[] } }
// 409: { success: false, error: { code: "ALREADY_COMPLETED" } }
```

All error responses: `{ success: false, error: { code: string, message: string } }`.

---

## UI States (all screens must implement all 4)

| Screen | Loading | Empty | Error | Success |
|--------|---------|-------|-------|---------|
| Movements ledger | Skeleton rows (3) | "No stock movements yet. Add stock to get started." | "Could not load movements. Tap to retry." | Paginated list, pull-to-refresh |
| Adjustment form | Submit button spinner + "Saving..." | n/a | Toast: "Could not save adjustment. Try again." | Toast: "Stock updated" + drawer closes |
| Purchase invoice | Same as sale invoice flow | n/a | Per-line error or toast | Toast: "Purchase saved. Stock updated for N items." |
| Stock value report | Skeleton table (5 rows) | "No products with stock. Add items to your catalog first." | "Report failed. Tap to retry." | Table with summary strip |
| Low-stock list | Skeleton cards (3) | "All items are well-stocked." + confetti-free calm state | "Could not load. Tap to retry." | Filterable list, count badge |
| Verification | Skeleton items | "No items added yet. Search or scan a product." | "Could not save count. Changes will retry when online." | Summary sheet → "Apply X adjustments" CTA |

---

## Mobile Specifics

- 375px primary layout. 320px must not overflow (no horizontal scroll).
- Movements ledger: single-column card list, not a table. Quantity shown as `+12 kg` (green) or `−5 kg` (red).
- Adjustment form: bottom sheet drawer, 2-tap flow (reason picker → quantity field → Confirm). Confirmation dialog required before submit ("Adjust stock down by 5 kg? This cannot be undone.").
- Stock value report: summary strip (total value) pinned top; scrollable product list below. No horizontal table — use two-line card (name + unit left, value right).
- Stock verification: search-first UX; camera-based barcode scan via Capacitor Camera API (fallback to text search if permission denied). Large number input (min 48px touch target) for counted quantity.
- Offline: adjustments and verifications queue via `api()` with `entityType: "stock-adjustment"` / `entityType: "stock-verification"`. Reads use `cacheReads: true` only for the low-stock count badge and stock value summary.

---

## UX Copy

| Element | Copy |
|---------|------|
| Adjustment confirm title | "Confirm Stock Adjustment" |
| Adjustment confirm body | "Adjust [product name] [down/up] by [qty] [unit]? This cannot be undone." |
| Adjustment confirm CTA | "Yes, Adjust Stock" |
| Adjustment cancel | "Cancel" |
| Adjustment success toast | "Stock updated" |
| Adjustment error toast | "Could not save. Tap to retry." |
| Insufficient stock (HARD_BLOCK) | "[Product name]: only [N] [unit] in stock, [M] requested." |
| Verification complete CTA | "Apply [N] Adjustments" |
| Verification zero discrepancy | "Stock matches system. No adjustments needed." |
| Verification success toast | "Stock count applied. [N] items adjusted." |
| Purchase saved toast | "Purchase saved. Stock updated for [N] items." |
| Low-stock badge | "[N] items low" |
| Report empty | "No products with stock. Add items to your catalog first." |

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Concurrent sale + purchase hit same product simultaneously | DB-level `UPDATE product SET currentStock = currentStock + delta` (atomic increment/decrement) inside the transaction; no read-modify-write race |
| ADJUSTMENT_OUT makes `currentStock` go negative (WARN_ONLY mode) | Allow; `currentStock` stored as negative float; UI shows stock in red |
| ADJUSTMENT_OUT makes `currentStock` go negative (HARD_BLOCK mode) | 409 `INSUFFICIENT_STOCK`; no movement written |
| Purchase invoice voided after partial sale of that stock | Stock may go negative — WARN_ONLY; reversal movement written regardless |
| Product deleted (soft) while verification in progress | `StockVerificationItem` retains the row; `product.isDeleted = true` items shown greyed with "(deleted)" label; adjustments still apply |
| Two staff complete the same verification simultaneously | `StockVerification.status = COMPLETED` check at start of complete transaction; second request gets 409 `ALREADY_COMPLETED` |
| Offline adjustment queued, then server rejects (e.g. HARD_BLOCK crossed while offline) | `api()` surfaces the 409 on next sync; toast: "Adjustment failed — insufficient stock. Review and retry." |
| `reorderQty = 0` (not set) | Low-stock row shown but "Suggested reorder qty" cell shows "—" |
| Stock verification with 0 discrepancies | `complete` succeeds with `adjustmentsCreated: 0`; toast shows "Stock count applied. No adjustments needed." |
| Purchase invoice with `purchasePrice = 0` (Raju forgot to enter cost) | Allowed; weighted-average formula treats cost as 0; `Product.purchasePrice` not updated if incoming cost is 0 (guard: skip WA update when `newCostPaise = 0`) |

---

## Security

- All endpoints require `Authorization` cookie (standard HP auth middleware).
- Business scoping enforced at service layer: every query includes `businessId` from the authenticated session — never from the request body.
- `productId` in adjustment/verification routes validated to belong to `req.business.id` before any write.
- Rate limit: adjustment POST — 60/min per business. Verification complete POST — 10/min per business.
- No PII in `StockMovement.notes` constraint (user-controlled text — enforce 500 char max, strip HTML).
- Audit log entry on every adjustment and verification completion (existing `AuditLog` pattern).

---

## Out of Scope (explicit)

1. Multi-godown transfers and per-godown stock UI (Phase 2.1)
2. Batch tracking, expiry alerts (Phase 2.2 — pharmacy/bakery)
3. Serial number tracking (Phase 3 — manufacturing)
4. Manufacturing Bill of Materials / work orders (Phase 3)
5. FIFO cost valuation (Phase 3)
6. Barcode scanner hardware (Zebra / Honeywell) integration
7. Demand forecasting / auto-reorder purchase orders
8. Supplier payment tracking beyond the `Document` model (Phase 2.1 — payables ledger)
9. CSV import/export of stock movements
10. Push notifications for low stock (in-app alert only in Phase 2.0; push depends on FCM work)

---

## Top Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Race condition on concurrent writes to same product** | Medium (Priya has 2-3 staff) | High — `currentStock` diverges from ledger sum | Use atomic `UPDATE product SET currentStock = currentStock + delta WHERE id = ?` inside the transaction; never read-then-write |
| **Double-credit on retry of purchase invoice POST** | Medium (mobile 2G, timeouts common) | High — stock inflated, weighted-average wrong | Mandatory `Idempotency-Key` header; server dedupes within 24h window (same pattern as payment links) |
| **`currentStock` drift from `StockMovement` sum over time** | Low (if all writes go through service) | High — report shows wrong values | Nightly reconciliation job: compare `SUM(quantity)` per product vs `currentStock`; write alert if delta > 0.001; do NOT auto-correct (raises a monitoring event instead) |
| **Vertical incompatibility — service businesses have `stockTracking: false`** | Low | Medium — salon creates an adjustment accidentally | Adjustment and purchase entry routes check `InventorySetting.stockValidationMode`; if vertical is `services/salon/clinic/freelancer`, return 403 `STOCK_TRACKING_DISABLED` |
| **Weighted-average breaks when `currentStock <= 0`** | Medium (WARN_ONLY allows negative stock) | Medium — division by zero or nonsense avg cost | Guard: if `currentStock + incomingQty <= 0`, skip WA update and keep previous `purchasePrice`; log a warning |

---

## Open Questions (need yes/no before architect runs)

1. **HARD_BLOCK default for new businesses?** `InventorySetting.stockValidationMode` defaults to `WARN_ONLY` in the schema. Should Phase 2.0 change the default for `retail` and `wholesale` verticals to `HARD_BLOCK`, or stay `WARN_ONLY`? *(Affects sale invoice flow and Raju's mental model.)*

2. **Purchase invoice stock-in trigger: DRAFT → SAVED or only SAVED?** Currently the schema has `DRAFT` and `SAVED` statuses. Should stock increment on `DRAFT` save (auto-save) or only when user explicitly "Finalises" the purchase (status becomes `SAVED`)? *(DRAFT increment risks double-count if user edits qty in draft; SAVED-only is safer but means stock is not reflected until final save.)*

3. **`reorderQty` field: is `Float @default(0)` acceptable, or should it be `Int?` (null = not set, 0 = zero reorder)?** *(Null-vs-zero distinction affects the "—" display logic and the low-stock API filter.)*

---

## PR Breakdown Sketch

The architect will detail sequencing. High-level, 6 PRs:

| PR | Title | Key work |
|----|-------|---------|
| **INV-01** | Schema migration: `reorderQty` + `TRANSFER_IN/OUT` constants | Prisma migration for `Product.reorderQty`; add type constants; no UI |
| **INV-02** | Stock movements ledger API + product movements page | `GET /api/inventory/products/:id/movements` endpoint; movements list screen |
| **INV-03** | Manual stock adjustment API + drawer UI | `POST /api/inventory/adjustments`; adjustment bottom sheet; idempotency middleware |
| **INV-04** | Purchase invoice entry — document + stock-in | Extend existing document create flow with `PURCHASE_INVOICE` type; weighted-average update; stock increment inside transaction |
| **INV-05** | Sale invoice stock decrement + void/reversal | Wire stock decrement into existing `POST /api/documents` (SALE_INVOICE) transaction; add HARD_BLOCK 409 path; void/delete reversal |
| **INV-06** | Stock value report + low-stock API + dashboard tile + stock verification complete flow | `GET /api/reports/stock-value`; `GET /api/inventory/low-stock`; dashboard `lowStockCount`; verification complete endpoint and mobile count UI |

Gate between INV-04 and INV-05: backend integration test confirming `SUM(movements.quantity) = Product.currentStock` after a round-trip purchase + sale.

---

*File:* `/Users/sawanjaiswal/Projects/HisaabPro/docs/inventory-phase-2/PRD.md`
