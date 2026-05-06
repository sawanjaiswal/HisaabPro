# PRD — Inventory Phase 2.2: Batch + Expiry Tracking

**Status:** Draft — awaiting architect
**Date:** 2026-05-06
**Personas in scope:** Pharmacy owner (Vyapar's stronghold), bakery owner (perishable goods)
**Vertical gate:** Feature active only when `Product.batchTracking = true` OR `Product.expiryTracking = true`; both flags derive from the vertical's `defaults` in `verticals.config.ts` and can be overridden per product.

---

## Elevator Pitch

Pharmacy and bakery owners using HisaabPro need to track medicines and baked goods by batch and expiry date so they never sell expired stock, can trace a recall to the exact purchase invoice, and get alerted before goods expire on the shelf. Phase 2.2 adds batch creation at purchase, FEFO auto-pick at sale, expiry alerts, hard blocks on expired batches, and batch-level stock verification — all gated to verticals where it matters without touching retail or services flows.

---

## Personas & Jobs-to-be-Done

| Persona | Primary JTBD | Pain today |
|---------|-------------|------------|
| **Meena** — Pharmacy owner, 1-2 staff, Rs 3-8L/month | "When I buy a medicine, I need to record the batch number and expiry date so I can sell the right batch first and remove expired stock before it causes harm." | Records batch/expiry in a notebook; sells from the wrong shelf; misses a batch nearing expiry; no trail when a manufacturer recalls a batch. |
| **Ravi** — Bakery owner, 1 staff, Rs 1-3L/month | "I bake daily — I need to make sure yesterday's cake doesn't get sold after its best-by date." | No system tracks best-by date; relies on staff memory; customer complaints about stale goods; daily wastage untracked. |
| **Priya** *(wholesale — secondary)* | "I buy branded FMCG goods in batches; I need batch-level stock to match my supplier's credit notes on returns." | Returns a partial batch but the whole product's stock gets adjusted; supplier disputes the quantity because there is no batch reference. |

---

## Goals

1. Every purchase of a batch-tracked product records `batchNumber`, `expiryDate` (optional), `manufacturingDate` (optional) as a `Batch` row; stock increments are attributed to that batch.
2. Every sale of a batch-tracked product picks the batch automatically (FEFO — earliest expiry first; FIFO by purchase date when no expiry) or lets the user override via a batch picker.
3. Expiry alerts fire `expiryAlertDays` before the expiry date (default 30); `EXPIRY_NEAR` and `EXPIRY_PASSED` `StockAlert` rows are created by a daily cron.
4. Expired batch sales are blocked (409) when `stockValidationMode = HARD_BLOCK`; warned in `WARN_ONLY` mode.
5. Physical stock count and purchase-return flows are batch-aware: reversals hit the correct batch, verification counts per batch.

---

## Non-Goals (Phase 2.3 / later)

| Item | Deferred to |
|------|-------------|
| Serial number tracking | Phase 3 — manufacturing |
| Multi-godown by batch (stock split across godowns) | Phase 2.1 first; combine in Phase 2.3 |
| Auto-generate batch numbers (custom numbering schemes) | Phase 2.3 — simple counter only for now; user types batch number |
| Drug license / schedule-H tracking | Deferred — regulatory complexity |
| Recall workflow (bulk write-off by batch across all businesses) | Deferred |
| Batch-level pricing beyond `Batch.salePrice` override | Phase 2.3 |
| Batch tracking for non-pharmacy, non-bakery verticals by default | Opt-in only per product; no bulk enable |

---

## User Stories

### Story 1 — Batch Creation at Purchase

- As Meena, when I save a purchase invoice for a batch-tracked medicine, I want to enter the batch number, expiry date, and manufacturer date so the batch is recorded against that purchase.
- As Meena, I want to enter multiple batches for the same product in a single purchase invoice (a supplier ships two batches of Paracetamol 500mg in the same delivery).
- As Ravi, when I purchase flour with `batchTracking = false` but `expiryTracking = true`, I want to enter an expiry date without a batch number, and the system creates a pseudo-batch automatically using the purchase date as the batch identifier.

**Acceptance criteria:**
- `POST /api/documents` (`type: PURCHASE_INVOICE`, `status: SAVED`) with `lineItems[].batches[]` — each batch entry has `{ batchNumber, expiryDate?, manufacturingDate?, quantity, costPrice? }`.
- One `Batch` row created per unique `(businessId, productId, batchNumber)` — upserted if batchNumber already exists (top-up of an existing batch).
- One `StockMovement` per batch entry (`type: PURCHASE`, `batchId` populated).
- `Batch.currentStock` incremented by the batch quantity.
- `Product.currentStock` incremented by the sum of all batch quantities (existing Phase 2.0 behaviour preserved).
- When `batchTracking = false` and `expiryTracking = true`: system auto-creates a batch with `batchNumber = "EXP-{YYYY-MM-DD}"` from `expiryDate`; `expiryDate` required; `manufacturingDate` optional.
- `batchNumber` max length: 50 chars. `expiryDate` before `manufacturingDate` → 400 `INVALID_DATES`.
- Missing `batchNumber` for a `batchTracking = true` product → 400 `BATCH_NUMBER_REQUIRED`.
- Without auth → 401. Cross-tenant → 404.

---

### Story 2 — Sale by Batch

- As Meena, when I add a batch-tracked medicine to a sale invoice, I want the system to automatically pick the earliest-expiry batch (FEFO) so I sell the stock closest to expiry first.
- As Meena, I want to override the auto-selected batch and manually pick a different batch from a list showing `batchNumber`, `expiryDate`, and available quantity.
- As Ravi, when a batch is expired, I want the system to block the sale (if HARD_BLOCK) or warn me (if WARN_ONLY) with the expiry date displayed.

**Acceptance criteria:**
- `POST /api/documents` (`type: SALE_INVOICE`, `status: SAVED|SHARED`) for a `batchTracking = true` product: if `lineItems[].batchId` is null, server auto-resolves via FEFO (earliest `expiryDate` first among batches with `currentStock > 0`; ties broken by `Batch.createdAt` ascending).
- If `batchId` is provided by client, server validates: batch belongs to this product, belongs to this business, `currentStock >= qty`.
- Expired batch (today >= `expiryDate`) + `HARD_BLOCK`: 409 `EXPIRED_BATCH` with `{ batchId, batchNumber, expiryDate, productId, productName }`.
- Expired batch + `WARN_ONLY`: sale proceeds; response includes `warnings: [{ type: "EXPIRED_BATCH", batchId, batchNumber, expiryDate }]`.
- `Batch.currentStock` decremented within the same transaction as `Product.currentStock`.
- `StockMovement` written with `batchId` populated.
- `GET /api/inventory/products/:productId/batches?onlyInStock=true` returns available batches for the picker, sorted FEFO.

---

### Story 3 — Stock by Batch

- As Meena, I want to see the current stock level, expiry date, and batch number for each batch of a product so I can plan my reorder and disposal.
- As Priya, I want to see a product's stock broken down by batch in the stock movements ledger so each batch's history is traceable.

**Acceptance criteria:**
- `GET /api/inventory/products/:productId/batches` → `{ data: BatchRow[], productId, productName }` where `BatchRow = { id, batchNumber, expiryDate, manufacturingDate, currentStock, costPrice, salePrice, status: "ACTIVE"|"EXPIRY_NEAR"|"EXPIRED", createdAt }`.
- `status` computed server-side: `EXPIRED` if `expiryDate <= today`; `EXPIRY_NEAR` if `expiryDate <= today + expiryAlertDays`; else `ACTIVE`.
- `GET /api/inventory/products/:productId/movements?batchId=` filters movements by batch.
- Without auth → 401. Non-batch-tracked product → returns `{ data: [], batchTrackingEnabled: false }` (not 404).

---

### Story 4 — Expiry Alerts

- As Meena, I want the app to alert me 30 days before any batch expires so I can run promotions or return stock to the supplier before it becomes unsellable.
- As Ravi, I want a dashboard indicator showing how many batches are near-expiry or already expired so I can act immediately when I open the app each morning.

**Acceptance criteria:**
- `InventorySetting` gains `expiryAlertDays Int @default(30)` — configurable per business.
- Daily cron (`batch-expiry-check`) runs at 2 AM IST; scans all `Batch` rows where `expiryDate IS NOT NULL AND isDeleted = false AND currentStock > 0`.
- For each batch: if `expiryDate <= today` AND no existing `EXPIRY_PASSED` `StockAlert` for this batch → create `StockAlert { alertType: "EXPIRY_PASSED", batchId, productId, threshold: 0, currentQty: batch.currentStock }`.
- If `today < expiryDate <= today + expiryAlertDays` AND no existing unresolved `EXPIRY_NEAR` alert → create `StockAlert { alertType: "EXPIRY_NEAR", batchId }`.
- When `Batch.currentStock` reaches 0, existing `EXPIRY_NEAR` / `EXPIRY_PASSED` alerts for that batch are auto-resolved (`status: RESOLVED`).
- `GET /api/inventory/expiry-alerts?status=ACTIVE&cursor=&limit=50` → `{ data: ExpiryAlertRow[], count, nextCursor }` where `ExpiryAlertRow = { alertId, productId, productName, batchId, batchNumber, expiryDate, daysRemaining, currentStock, alertType }`.
- `GET /api/dashboard/summary` gains `expiryAlertCount: number` (count of ACTIVE `EXPIRY_NEAR` + `EXPIRY_PASSED` alerts).
- Without auth → 401.

---

### Story 5 — Block Sale of Expired Batches

- As Meena, I need expired batch sales to be hard-blocked so no patient can accidentally receive an expired medicine.
- As Ravi, I want expired batches to generate a warning so my staff know, but I don't want sales to be blocked in case I'm doing a write-off sale.

**Acceptance criteria:**
- `stockValidationMode = HARD_BLOCK` (pharmacy vertical default): sale of any batch where `today >= expiryDate` → 409 `EXPIRED_BATCH`. This check applies in FEFO auto-pick too — FEFO skips expired batches and picks the next-nearest valid batch. If ALL available batches are expired → 409 `ALL_BATCHES_EXPIRED`.
- `stockValidationMode = WARN_ONLY` (bakery vertical default): expired batch sale succeeds; `warnings[]` in response.
- FEFO algorithm skips expired batches when `HARD_BLOCK`; when `WARN_ONLY`, includes expired batches in FEFO ordering.
- Error body: `{ success: false, error: { code: "EXPIRED_BATCH", message: "[Product name]: batch [batchNumber] expired on [date].", detail: { batchId, batchNumber, expiryDate, productId } } }`.

---

### Story 6 — Purchase Return Reverses the Right Batch

- As Meena, when I return part of a batch to my supplier (PURCHASE_RETURN), I want the stock to be reversed from that specific batch, not from the product total.
- As Priya, I want the `StockMovement` for the return to reference the batch so the batch's history is complete.

**Acceptance criteria:**
- `POST /api/documents` (`type: PURCHASE_RETURN`) with `lineItems[].batchId` → creates `StockMovement { type: "RETURN_OUT", batchId }` and decrements `Batch.currentStock`.
- `batchId` is required on return line items for batch-tracked products → missing → 400 `BATCH_REQUIRED_FOR_RETURN`.
- Return quantity > `Batch.currentStock` + `HARD_BLOCK` → 409 `INSUFFICIENT_BATCH_STOCK`.
- Void of a `PURCHASE_INVOICE` reverses stock from EACH batch recorded on the original purchase line items (one reversal `StockMovement` per batch).
- Without auth → 401. Batch belongs to different product → 400 `BATCH_PRODUCT_MISMATCH`.

---

### Story 7 — Stock Verification by Batch

- As Meena, when I do a stock count I want to count each batch separately and see discrepancies per batch, not just per product.
- As Ravi, I want the verification flow to fall back to product-level counting when `batchTracking = false`.

**Acceptance criteria:**
- `StockVerificationItem` gains `batchId String?` (nullable; null = product-level count for non-batch products).
- `PUT /api/inventory/verifications/:id/items` accepts `batchId?` per item; for batch-tracked products, multiple items may share the same `productId` but differ by `batchId`.
- `POST /api/inventory/verifications/:id/complete` writes one `StockMovement` per discrepant batch (with `batchId` populated), updates `Batch.currentStock`, and rolls up to update `Product.currentStock`.
- `GET /api/inventory/verifications/:id` returns items with `batchNumber`, `expiryDate`, `systemQuantity` (from `Batch.currentStock`), `actualQuantity`, `discrepancy`.
- Non-batch product: existing flow unchanged; `batchId` stays null.
- Without auth → 401.

---

### Story 8 — Migration of Existing Stock When batchTracking Toggled On

- As Meena, I started using HisaabPro before batch tracking was available; I have medicines with existing stock and I want to enable batch tracking without losing my current counts.

**Acceptance criteria:**
- When `Product.batchTracking` changes from `false` to `true` (via `PATCH /api/inventory/products/:productId`):
  - If `Product.currentStock > 0`: server creates one `Batch` row with `batchNumber = "UNBATCHED"`, `currentStock = product.currentStock`, `manufacturingDate = null`, `expiryDate = null`.
  - One `StockMovement { type: "OPENING", batchId: <new batch id>, quantity: product.currentStock, notes: "Migrated from pre-batch stock" }` is written.
  - `Product.currentStock` is unchanged (not double-counted).
- If `Product.currentStock = 0`: no pseudo-batch created; batch tracking enabled cleanly.
- After migration, all new PURCHASE and SALE movements must include a real `batchId` for this product.
- The "UNBATCHED" pseudo-batch appears in the batch list with a grey "(Unbatched)" label in the UI; user cannot edit its `batchNumber` or dates.
- Toggling `batchTracking` back to `false` is **blocked** if any batch has `currentStock > 0` → 409 `BATCHES_STILL_IN_STOCK`. (Prevents orphaned batch stock.)

---

## Data Model Changes

The `Batch` model (schema line 2276) and `StockMovement.batchId` (line 588) already exist. The following additions are needed — all additive.

### `InventorySetting` — add two fields

```prisma
expiryAlertDays   Int  @default(30)   // days-before threshold for EXPIRY_NEAR alert
batchAutoFefo     Boolean @default(true) // auto-pick FEFO when batchId not supplied by client
```

### `StockAlert.alertType` — extend enum comment

Add: `EXPIRY_NEAR`, `EXPIRY_PASSED` (existing comment lists only `LOW_STOCK`, `OUT_OF_STOCK`).

### `StockAlert` — add one field

```prisma
batchId  String?   // populated for EXPIRY_NEAR / EXPIRY_PASSED alerts
batch    Batch?    @relation(fields: [batchId], references: [id], onDelete: SetNull)
```

### `StockVerificationItem` — add one field

```prisma
batchId  String?
batch    Batch?  @relation(fields: [batchId], references: [id], onDelete: SetNull)
```

### `Product` — add two fields

```prisma
batchTracking   Boolean @default(false)  // per-product override of vertical default
expiryTracking  Boolean @default(false)  // per-product override of vertical default
```

These are populated from `VerticalConfig.defaults` at business onboarding but can be toggled per product.

### No new tables required

`Batch`, `StockMovement`, `StockAlert`, `StockVerificationItem` all exist with the right relations. Migration adds only the five columns above.

---

## API Contract

```ts
// GET /api/inventory/products/:productId/batches
interface BatchListRes {
  success: true
  data: BatchRow[]
  productId: string
  productName: string
  batchTrackingEnabled: boolean
}
interface BatchRow {
  id: string
  batchNumber: string
  expiryDate: string | null         // ISO date
  manufacturingDate: string | null  // ISO date
  currentStock: number
  costPrice: number | null          // paise
  salePrice: number | null          // paise
  status: 'ACTIVE' | 'EXPIRY_NEAR' | 'EXPIRED'
  daysToExpiry: number | null       // null when expiryDate is null
  createdAt: string                 // ISO
}

// POST /api/documents — extended lineItem for batch-tracked products
interface BatchLineItemInput {
  productId: string
  quantity: number
  // for PURCHASE_INVOICE, batch-tracked products:
  batches?: {
    batchNumber: string
    expiryDate?: string       // ISO date
    manufacturingDate?: string // ISO date
    quantity: number
    costPrice?: number        // paise; defaults to product.purchasePrice if omitted
  }[]
  // for SALE_INVOICE: optional — omit to trigger FEFO auto-pick
  batchId?: string
}

// GET /api/inventory/expiry-alerts
interface ExpiryAlertsRes {
  success: true
  data: ExpiryAlertRow[]
  count: number
  nextCursor: string | null
}
interface ExpiryAlertRow {
  alertId: string
  productId: string
  productName: string
  sku: string | null
  batchId: string
  batchNumber: string
  expiryDate: string           // ISO date
  daysRemaining: number        // negative = already expired
  currentStock: number
  alertType: 'EXPIRY_NEAR' | 'EXPIRY_PASSED'
}

// POST /api/documents SALE_INVOICE — error response for expired batch
// 409: { success: false, error: { code: "EXPIRED_BATCH" | "ALL_BATCHES_EXPIRED", message: string,
//         detail: { batchId?, batchNumber?, expiryDate?, productId, productName } } }

// POST /api/inventory/products/:productId — toggle batchTracking
// PATCH /api/inventory/products/:productId { batchTracking: true }
// 200: { success: true, data: { productId, batchTracking: true, migrationBatchId?: string } }
// 409: { success: false, error: { code: "BATCHES_STILL_IN_STOCK", message: string } }
```

---

## UI States

All screens must implement all 4 states.

| Screen | Loading | Empty | Error | Success |
|--------|---------|-------|-------|---------|
| Batch list (product detail) | Skeleton rows (3) | "No batches recorded. Add stock to track batches." | "Could not load batches. Tap to retry." | List sorted FEFO, expiry badge per row |
| Batch entry drawer (purchase) | Submit spinner + "Saving…" | n/a | Toast: "Could not save batch. Try again." | Toast: "Batch recorded. Stock updated." |
| Batch picker (sale) | Skeleton list (3) | "No stock in any batch." | "Could not load batches. Try again." | List with FEFO badge on top batch |
| Expiry alerts list | Skeleton cards (3) | "No expiry alerts. All batches are within date." | "Could not load alerts. Tap to retry." | Filterable list; red chip for EXPIRED, amber for EXPIRY_NEAR |
| Dashboard expiry tile | — (inline count) | Hidden when count = 0 | Shows stale count | "[N] batches expiring soon" |
| Verification (batch mode) | Skeleton items | "No batches added yet. Scan or search." | "Could not save count. Will retry when online." | Discrepancy summary → "Apply N adjustments" |

---

## Mobile Specifics

- 375px primary. 320px must not overflow.
- **Batch entry in purchase:** bottom-sheet drawer per line item; "Add another batch" link adds a second batch row inline; each row has `batchNumber` text field, `expiryDate` date picker (required for pharmacy; optional for others), `qty` number input.
- **Batch picker in sale:** searchable bottom-sheet list; each row shows `batchNumber`, `expiryDate` formatted as "Exp: DD MMM YY", `currentStock`, status badge. Expired rows shown with red strike-through when `WARN_ONLY`; hidden when `HARD_BLOCK`.
- **Expiry date display:** always in `DD MMM YYYY` format (e.g., "31 Dec 2026"). Never ISO. Timezone: IST (UTC+5:30) — convert server UTC to IST for display; store in UTC.
- **Expiry alerts list:** same card-list pattern as low-stock; `daysRemaining` shown as "Expires in 12 days" or "Expired 3 days ago" (relative label).
- **Offline:** batch creation mutations queue via `api()` with `entityType: "batch"`, `entityLabel: batchNumber`. Batch picker reads require online; if offline, show last cached batch list with stale banner. FEFO auto-pick happens server-side on sale save.
- **Android/iOS:** date picker uses native date-picker via Capacitor (not custom wheel); `expiryDate` input shows calendar icon, opens native picker.

---

## UX Copy

| Element | Copy |
|---------|------|
| Batch entry label | "Batch No." |
| Expiry date label | "Expiry Date" |
| Mfg date label | "Mfg. Date (optional)" |
| Batch required error (inline) | "Batch number is required for this product." |
| Expiry before mfg error (inline) | "Expiry date must be after manufacturing date." |
| Auto-FEFO indicator | "Auto-selected (earliest expiry first)" |
| Batch picker CTA | "Choose Batch" |
| Expired batch toast (WARN_ONLY) | "[Product]: batch [X] expired on [date]. Sale recorded with warning." |
| Expired batch error (HARD_BLOCK) | "[Product]: batch [X] expired on [date]. Cannot sell expired stock." |
| All batches expired error | "[Product]: all available batches are expired. Sale blocked." |
| Expiry alert tile | "[N] batch(es) expiring soon" |
| Expiry alert empty | "No expiry alerts. All batches are within date." |
| Batch migration notice | "Existing stock moved to 'Unbatched'. New purchases require a batch number." |
| Toggle batch tracking confirm | "Enable batch tracking? Existing stock (N units) will be moved to an Unbatched batch. New purchases will require a batch number." |
| Batch stock in stock, toggle off error | "Cannot disable batch tracking while batches have stock. Write off or sell the remaining batch stock first." |
| Verification batch mode empty | "No batches added yet. Search by batch number or product." |

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Two staff pick the same batch for concurrent sales, batch has only 5 units, each tries to sell 4 | Atomic `UPDATE batch SET currentStock = currentStock - 4 WHERE id = ? AND currentStock >= 4`; second update fails (returns 0 rows) → 409 `INSUFFICIENT_BATCH_STOCK` for second request |
| FEFO auto-pick selects a batch, concurrent sale depletes it before save completes | Server re-runs FEFO inside the transaction; if no valid batch remains → 409 `ALL_BATCHES_EXPIRED` or `INSUFFICIENT_STOCK` |
| Product has `expiryTracking = true` but `batchTracking = false`; expiry date entered at purchase | Auto-batch created with `batchNumber = "EXP-{YYYY-MM-DD}"`; multiple purchases with the same expiry date upsert the same batch |
| Batch `expiryDate = null` (no expiry, e.g., non-perishable bought in a tracked batch) | Batch never appears in expiry alerts; FEFO ordering uses `Batch.createdAt` ascending (FIFO fallback) |
| User voids a purchase invoice; some batch stock was already sold | Reversal reduces `Batch.currentStock`; may go negative. `WARN_ONLY`: allowed, stock goes negative. `HARD_BLOCK`: 409 `INSUFFICIENT_BATCH_STOCK`; user must void the dependent sale first |
| Batch number reused across different products (supplier uses same batch for two SKUs) | `@@unique([businessId, productId, batchNumber])` allows same `batchNumber` on different products — correctly scoped |
| Expiry date in user's local timezone vs UTC storage | Store all dates as UTC midnight. Display in IST. A batch expiring "31 Dec 2026" is stored as `2026-12-31T00:00:00Z`; expiry check compares `today` at IST midnight converted to UTC |
| `expiryAlertDays = 0` (user disables advance alerts) | Only `EXPIRY_PASSED` alerts fire; `EXPIRY_NEAR` never created |
| Batch-tracked product added to stock verification but user does not count all batches | `POST /verifications/:id/complete` → 400 `INCOMPLETE_COUNT` with list of batches not yet counted; same guard as Phase 2.0 but per-batch |
| UNBATCHED pseudo-batch — user tries to update batchNumber or expiryDate | `PATCH /api/inventory/batches/:batchId` blocks edits to batches with `batchNumber = "UNBATCHED"` → 400 `UNBATCHED_NOT_EDITABLE` |
| Same product bought twice on same day from same supplier with same batch number | Upsert: `Batch.currentStock += qty`; `costPrice` updated to weighted average of the two purchases for that batch |
| Wholesale vertical has `batchTracking: true` by default; user does not want it for a specific product | `PATCH /api/inventory/products/:id { batchTracking: false }` allowed if `Batch.currentStock = 0`; same toggle-off guard |

---

## Security

- All endpoints require `Authorization` cookie (standard HP auth middleware).
- `batchId` in sale/return/verification routes validated to belong to `req.business.id` before any write — never trust client-supplied cross-tenant IDs.
- `expiryDate` and `batchNumber` are user-controlled text; enforce `batchNumber` max 50 chars, strip HTML, store as-is (no interpretation).
- Rate limit: batch creation POST (inside purchase invoice) inherits purchase invoice limit (60/min per business). Expiry alert list GET — 120/min per business.
- Audit log entry on `batchTracking` toggle (on or off) via existing `AuditLog` pattern.
- The daily expiry-check cron runs with a read-only DB role for the scan, write-only for `StockAlert` creation.

---

## Out of Scope (explicit)

1. Serial number tracking (Phase 3 — manufacturing)
2. Multi-godown + batch combination — e.g., batch X in Godown A and batch X in Godown B tracked separately (Phase 2.3)
3. Auto-generate batch numbers (custom counter scheme) — user must type the batch number in Phase 2.2
4. Drug license / Schedule-H controlled substance compliance tracking
5. Recall workflow — no ability to bulk-write-off a recalled batch across all customer orders
6. Batch-level FIFO cost valuation for the stock value report (report still uses product-level weighted-average cost from `Product.weightedAvgCostPaise`)
7. Expiry tracking for service verticals (salon, clinic, freelancer) — those verticals have `stockTracking: false`
8. Batch tracking for the Restaurant vertical (deferred — perishable ingredients managed differently)
9. Push notifications for expiry alerts (in-app and dashboard tile only in Phase 2.2; push depends on FCM integration)
10. Batch import / export via CSV

---

## Acceptance Criteria

Binary, independently testable. QA signs off when all are checked.

### Backend / API

- [ ] `curl POST /api/documents` (`PURCHASE_INVOICE`, batch-tracked product, valid batches payload) → 201, `Batch.currentStock` matches sum of batches, `StockMovement.batchId` populated for each batch
- [ ] Same POST without `batchNumber` for a `batchTracking = true` product → 400 `BATCH_NUMBER_REQUIRED`
- [ ] Same POST with `expiryDate` before `manufacturingDate` → 400 `INVALID_DATES`
- [ ] `curl POST /api/documents` (`SALE_INVOICE`, batch-tracked product, no `batchId` supplied) → FEFO auto-picks batch with earliest `expiryDate`; `StockMovement.batchId` populated
- [ ] Sale of batch where `today >= expiryDate` + `HARD_BLOCK` → 409 `EXPIRED_BATCH`
- [ ] Sale of batch where `today >= expiryDate` + `WARN_ONLY` → 200 with `warnings[].type = "EXPIRED_BATCH"`
- [ ] All available batches expired + `HARD_BLOCK` → 409 `ALL_BATCHES_EXPIRED`
- [ ] `curl GET /api/inventory/products/:productId/batches` → sorted FEFO, `status` field correct for ACTIVE / EXPIRY_NEAR / EXPIRED
- [ ] `curl GET /api/inventory/products/:productId/batches` for non-batch-tracked product → `{ batchTrackingEnabled: false, data: [] }` (not 404)
- [ ] `curl GET /api/inventory/expiry-alerts?status=ACTIVE` → `ExpiryAlertRow[]` with `daysRemaining`, `alertType`
- [ ] `curl GET /api/dashboard/summary` → includes `expiryAlertCount: number`
- [ ] Without auth on any batch endpoint → 401
- [ ] Cross-tenant `batchId` in sale line item → 400 `BATCH_PRODUCT_MISMATCH` or 404
- [ ] `PATCH /api/inventory/products/:id { batchTracking: true }` when `currentStock > 0` → 200, pseudo-batch `UNBATCHED` created, `StockMovement` written with `type: OPENING`
- [ ] `PATCH /api/inventory/products/:id { batchTracking: false }` when any batch has `currentStock > 0` → 409 `BATCHES_STILL_IN_STOCK`
- [ ] Daily cron: batch with `expiryDate = today + 15` and `expiryAlertDays = 30` → `StockAlert { alertType: "EXPIRY_NEAR" }` created; running cron again does not create a duplicate
- [ ] Daily cron: batch with `expiryDate = yesterday` → `StockAlert { alertType: "EXPIRY_PASSED" }` created
- [ ] When `Batch.currentStock` → 0 (sold out), existing `EXPIRY_NEAR` / `EXPIRY_PASSED` alerts for that batch auto-resolved
- [ ] Purchase return with valid `batchId` → `StockMovement { type: "RETURN_OUT", batchId }` written, `Batch.currentStock` decremented
- [ ] Purchase return without `batchId` for batch-tracked product → 400 `BATCH_REQUIRED_FOR_RETURN`
- [ ] `POST /api/inventory/verifications/:id/complete` with batch-tracked items → `StockMovement.batchId` populated per adjustment
- [ ] Idempotency: duplicate purchase invoice POST (same `Idempotency-Key`) → 200 with original data, no second batch or movement created

### Frontend / UI

- [ ] Batch entry drawer opens when purchase line item added for `batchTracking = true` product; "Add another batch" adds a second row
- [ ] Batch picker bottom sheet opens on sale line item for `batchTracking = true` product; shows `batchNumber`, `expiryDate`, `currentStock`; top row has "Auto-selected (earliest expiry first)" label when FEFO
- [ ] Expired batch row shows red strike-through in picker when `WARN_ONLY`; hidden entirely when `HARD_BLOCK`
- [ ] Batch list on product detail: sorted FEFO; `EXPIRY_NEAR` chip amber; `EXPIRED` chip red; `ACTIVE` chip green
- [ ] Expiry alerts screen: 4 UI states (loading skeleton, empty, error, list)
- [ ] Dashboard tile shows `expiryAlertCount`; hidden when 0
- [ ] Toggle batch-tracking on for a product with stock: confirmation dialog shows "Existing stock ([N] units) will be moved to Unbatched batch"; confirms → "UNBATCHED" batch appears in batch list with grey label
- [ ] Attempt to toggle batch-tracking off with stock remaining: error toast "Cannot disable batch tracking while batches have stock."
- [ ] All expiry dates rendered in `DD MMM YYYY` format (not ISO, not `MM/DD/YYYY`)
- [ ] 375px: batch entry drawer no horizontal overflow; date picker opens native picker
- [ ] 320px: batch picker list rows no overflow; all CTAs reachable
- [ ] Screenshot: batch entry drawer (purchase) — loading ✓ · error ✓ · success ✓
- [ ] Screenshot: batch picker (sale) — FEFO auto-selected ✓ · expired row strike-through ✓
- [ ] Screenshot: expiry alerts list — empty ✓ · EXPIRY_NEAR + EXPIRY_PASSED mixed ✓

---

## Open Questions (need yes/no before architect runs)

1. **FEFO with no expiry dates: use purchase date or batch creation date?** Current spec says `Batch.createdAt` ascending. Should it use `Batch.manufacturingDate` when present, or always fall back to `Batch.createdAt`? *(Affects FEFO sort query.)*

2. **Bakery default: `WARN_ONLY` or `HARD_BLOCK` for expired batches?** The bakery vertical config has `stockValidationMode` unset (inherits global default `WARN_ONLY`). Should Phase 2.2 set bakery to `HARD_BLOCK` to prevent selling expired goods, or keep `WARN_ONLY` so Ravi can still sell at a discount? *(Directly impacts bakery owner UX.)*

3. **Can the user manually resolve/dismiss an expiry alert without selling or writing off the stock?** Example: Meena returns the batch to the supplier — stock goes to 0 and alert auto-resolves. But if she wants to dismiss a near-expiry alert that she already handled, should there be a "Dismiss" action on the alert card? *(Affects `StockAlert` status state machine.)*

4. **Batch-level weighted-average cost in the stock value report?** Phase 2.2 spec says use product-level `weightedAvgCostPaise`. But pharmacy owners need per-batch cost (each batch may have a different purchase price). Should the stock value report show per-batch breakdown with `Batch.costPrice`? *(If yes, the architect needs to design a per-batch value rollup.)*

5. **What is the `expiryAlertDays` setting scope: per-business or per-product?** Current spec puts it on `InventorySetting` (per-business). Meena may want 60-day alerts for Insulin but 14-day for topical creams. Should `Product` get an `expiryAlertDays Int?` override? *(Schema impact: nullable column on `Product`.)*

---

## Top Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Race condition on concurrent batch stock decrement** | Medium — pharmacy has 2-3 billing staff on a busy day | High — batch `currentStock` diverges, expired batch sold without detection | Atomic `UPDATE batch SET currentStock = currentStock - qty WHERE id = ? AND currentStock >= qty`; row count check after update; 409 if 0 rows affected |
| **Data correctness when toggling `batchTracking` on for a product with existing stock** | Medium — existing Phase 2.0 users will flip this flag | High — double-counting or lost stock if migration is not atomic | Toggle + pseudo-batch creation + `OPENING` movement in a single `$transaction`; idempotent guard: if `UNBATCHED` batch already exists for this product, skip creation |
| **Expiry timezone mismatch: UTC storage vs IST display** | High — all IST users, server UTC | Medium — batch shows "Expired" in app one day before actual expiry if date math is wrong | Store `expiryDate` as UTC midnight (`2026-12-31T00:00:00Z`); compare against IST midnight in the cron (`today` = `new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })`); document this in the cron service file |
| **FEFO auto-pick depleted by the time the transaction commits (concurrent sales)** | Low-medium — pharmacy peak hour | High — sale saves with a batch that has 0 stock | Wrap FEFO selection AND stock decrement in a single serializable transaction; re-verify batch stock inside the transaction before decrementing |
| **`UNBATCHED` pseudo-batch mixed with real batches in FEFO** | Low | Medium — FEFO sorts by `expiryDate`; UNBATCHED has `expiryDate = null`, which sorts last in ascending order, causing it to be picked last — correct for FEFO but could mean unbatched stock is never sold if newer real batches keep arriving | Document FEFO null-last rule; show UNBATCHED at the bottom of the batch picker with a "(Unbatched — no expiry)" label; let user pick it manually |

---

## PR Breakdown Sketch

The architect will refine sequencing. High-level, 5 PRs:

| PR | Title | Key work |
|----|-------|---------|
| **BAT-01** | Schema migration: `batchTracking` + `expiryTracking` on `Product`; `expiryAlertDays` + `batchAutoFefo` on `InventorySetting`; `batchId` on `StockAlert` + `StockVerificationItem`; update `StockAlert.alertType` comment | Migration only; no UI; seed `batchTracking = true` for pharmacy + wholesale businesses on `InventorySetting` |
| **BAT-02** | Batch creation at purchase + batch-toggle-on migration | Extend `PURCHASE_INVOICE` save flow; `Batch` upsert service; `batchTracking` toggle API with pseudo-batch migration; batch list API (`GET /batches`) |
| **BAT-03** | Sale by batch: FEFO auto-pick + batch picker API + expired-batch block | Extend `SALE_INVOICE` save flow; FEFO resolver service; expired-batch 409/warn path; `GET /products/:id/batches?onlyInStock=true` for picker |
| **BAT-04** | Expiry alerts: daily cron + `GET /expiry-alerts` + dashboard `expiryAlertCount` | `batch-expiry-check` cron; `StockAlert` creation/dedup/auto-resolve; expiry alert list endpoint; dashboard summary field |
| **BAT-05** | Purchase return by batch + batch-aware stock verification + UI (batch entry drawer, batch picker, expiry alerts screen, batch list on product detail) | `PURCHASE_RETURN` batch validation; `StockVerificationItem.batchId` support; all mobile UI screens; 4 UI states per screen |

Gate between BAT-02 and BAT-03: integration test confirming `SUM(StockMovement.quantity WHERE batchId = X) = Batch.currentStock` after a round-trip purchase + sale for a single batch.

---

*File:* `/Users/sawanjaiswal/Projects/HisaabPro/docs/inventory-phase-2.2-batches/PRD.md`
