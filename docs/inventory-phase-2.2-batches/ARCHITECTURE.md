---
status: approved
feature: inventory-phase-2.2-batches
created: 2026-05-06T15:32:00Z
approver: Sawan
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
agents_invoked:
  - architect (output: docs/inventory-phase-2.2-batches/ARCHITECTURE.md)
acceptance:
  backend:
    - tsc clean (server + client)
    - integration: SUM(StockMovement.quantity WHERE batchId=X) == Batch.currentStock after purchase + sale + return cycle
    - curl 401 / 404 cross-tenant / 409 EXPIRED_BATCH / 409 ALL_BATCHES_EXPIRED / 409 INSUFFICIENT_BATCH_STOCK
    - idempotency: duplicate POST same Idempotency-Key returns original response
    - cron dedupe: running batch-expiry-check twice in same day creates no duplicate StockAlert
  frontend:
    - 320px + 375px screenshots: loading / error / empty / success for batch picker, batch entry drawer, expiry alerts list, value report
    - i18n en + hi for every new copy key
    - offline: batch entry queues via api() with entityType="batch", entityLabel=batchNumber
---

# Inventory Phase 2.2 — Batches & Expiry · Architecture

> Builds on Phase 2.0 (single-godown, weighted-avg cost, HARD_BLOCK enforcement).
> Vertical-gated to `batchTracking: true` defaults — pharmacy, wholesale,
> manufacturing, bakery — but every product can override per-row.
> Single-godown only. Multi-godown × batch interaction is explicitly Phase 2.3.

---

## 1. Schema deltas — six additive columns + one index

Verified against `server/prisma/schema.prisma` lines 89, 570, 620, 2183, 2225, 2276.

### 1.1 `Batch` (line 2276) — already exists, audit confirms

All required columns already present: `batchNumber`, `manufacturingDate?`,
`expiryDate?`, `costPrice Int? (paise)`, `salePrice Int?`, `currentStock`,
soft-delete, `@@unique([businessId, productId, batchNumber])`.

**Missing for FEFO performance:** the existing `@@index([businessId, expiryDate])`
does NOT cover the FEFO query, which pivots on `productId` first. Add:

```prisma
@@index([productId, expiryDate])   // FEFO selection
```

No column changes to `Batch` itself.

### 1.2 `Business` (line 89) — two new fields

```prisma
expiryAlertDays      Int?    @default(30)            // 0 = disable advance alerts; null = inherit default 30
expiredBatchPolicy   String  @default("WARN_ONLY")   // WARN_ONLY | HARD_BLOCK — independent of stockValidationMode
```

Decoupled from `InventorySetting.stockValidationMode` because expired-batch
gating is a different ethical bar (a pharmacy may run WARN_ONLY for low-stock
sales but MUST hard-block expired drugs). Pharmacy seed flips to `HARD_BLOCK`;
all other verticals default to `WARN_ONLY`.

> **Per-product `expiryAlertDays` override → deferred to 2.2.1** per locked Q5.

### 1.3 `StockAlert` (line 2183) — one new field, enum extension

```prisma
batchId  String?
batch    Batch?  @relation(fields: [batchId], references: [id], onDelete: SetNull)
```

Update enum comment: `LOW_STOCK, OUT_OF_STOCK, EXPIRY_NEAR, EXPIRY_PASSED`.
Add index for cron dedupe lookup:

```prisma
@@index([businessId, batchId, alertType, status])   // dedupe + auto-resolve
```

### 1.4 `StockVerificationItem` (line 2225) — one new field

```prisma
batchId  String?
batch    Batch?  @relation(fields: [batchId], references: [id], onDelete: SetNull)

@@index([batchId])
```

### 1.5 `Product` — already covered

`batchTracking Boolean @default(false)` and `expiryTracking Boolean @default(false)`
already exist (Phase 2.0 added these for vertical defaults). Confirm in INV-2.2-01;
if absent, add. PRD §Data-Model lists them — schema audit needed in PR-01 first hour.

### 1.6 `StockMovement` (line 570) — no change

`batchId String?` and `@@index([batchId])` already present.

---

## 2. Migration sequence — handwritten SQL only

Two migration files, both additive, `IF NOT EXISTS` guards everywhere.
`CREATE INDEX CONCURRENTLY` lives in its own file (Prisma cannot wrap it in
a transaction).

### `server/prisma/migrations/20260507_bat_phase22_columns/migration.sql`

```sql
-- BAT-01a: Phase 2.2 batch + expiry — additive columns only.

-- 1. Business policy for expired-batch sales (decoupled from stockValidationMode)
ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "expiryAlertDays"    INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "expiredBatchPolicy" TEXT    NOT NULL DEFAULT 'WARN_ONLY';

-- 2. StockAlert links to a batch for EXPIRY_NEAR / EXPIRY_PASSED rows
ALTER TABLE "StockAlert"
  ADD COLUMN IF NOT EXISTS "batchId" TEXT;
ALTER TABLE "StockAlert"
  ADD CONSTRAINT "StockAlert_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 3. Verification items can reference a batch (null = product-level count)
ALTER TABLE "StockVerificationItem"
  ADD COLUMN IF NOT EXISTS "batchId" TEXT;
ALTER TABLE "StockVerificationItem"
  ADD CONSTRAINT "StockVerificationItem_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 4. Pharmacy seed: existing pharmacy businesses → HARD_BLOCK on expired batches
UPDATE "Business" b
   SET "expiredBatchPolicy" = 'HARD_BLOCK'
  FROM "BusinessProfile" p
 WHERE p."businessId" = b."id"
   AND p."verticalType" = 'pharmacy'
   AND b."expiredBatchPolicy" = 'WARN_ONLY';
```

### `server/prisma/migrations/20260507_bat_phase22_indexes/migration.sql`

```sql
-- BAT-01b: indexes (CONCURRENTLY → outside any transaction)

-- FEFO selection: per-product, earliest expiry first
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Batch_productId_expiryDate_idx"
  ON "Batch" ("productId", "expiryDate")
  WHERE "isDeleted" = false AND "currentStock" > 0;

-- Cron dedupe: existing alert lookup by (business, batch, type, status)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "StockAlert_businessId_batchId_alertType_status_idx"
  ON "StockAlert" ("businessId", "batchId", "alertType", "status")
  WHERE "batchId" IS NOT NULL;

-- Verification by batch
CREATE INDEX CONCURRENTLY IF NOT EXISTS "StockVerificationItem_batchId_idx"
  ON "StockVerificationItem" ("batchId")
  WHERE "batchId" IS NOT NULL;
```

After SQL applies, edit `schema.prisma` and run
`npx prisma migrate resolve --applied 20260507_bat_phase22_columns` per the
project's "manual SQL + resolve" rule.

**Backfill: none.** All existing `StockAlert` and `StockVerificationItem`
rows keep `batchId = NULL`. Existing `Business` rows pick up
`expiredBatchPolicy = 'WARN_ONLY'` (and pharmacies upgrade in step 4).

---

## 3. Stock movement integration — batch-aware writes

**Invariant:** every `Batch.currentStock` change is paired with exactly one
`StockMovement` carrying `batchId`, in the same transaction. The single
choke-point becomes `adjustBatchStock()` in
`server/src/services/stock/batch-claim.ts` (new file, ≤200 LOC).

### 3.1 PURCHASE — create-or-upsert per batch

Inside `addForPurchaseInvoice` (`server/src/services/stock/invoice-ops.ts`):

```
for each lineItem li:
  if product.batchTracking || product.expiryTracking:
    for each batchEntry b in li.batches:
      batchRow = prisma.batch.upsert({
        where: { businessId_productId_batchNumber: { ... } },
        create: { ...b, currentStock: 0, businessId, productId },
        update: { /* WA cost merge — see §3.4 */ }
      })
      adjustBatchStock(tx, batchRow.id, +b.quantity, 'PURCHASE', refs)
  else:
    adjustStock(...)   // unchanged Phase 2.0 path
```

`adjustBatchStock()` does, in one tx, on a row-locked batch:

1. `SELECT … FOR UPDATE` on `Batch` row.
2. `UPDATE Batch SET currentStock = currentStock + $delta WHERE id = $id`.
3. Insert `StockMovement { type: 'PURCHASE', batchId, productId, quantity: $delta, balanceAfter: <batch new>, referenceType: 'PURCHASE_INVOICE', referenceId }`.
4. Update `Product.currentStock` via the same `adjustStock` plumbing
   (no batch field — product-level rollup unchanged).

Steps (2) and (4) both happen inside the **same outer document transaction**
that Phase 2.0 already opens. Per past-audit lesson F-06: **no nested tx**.

### 3.2 SALE — FEFO claim, atomic per batch

Inside `deductForSaleInvoice`:

```
for each saleLine sl:
  if product.batchTracking:
    if sl.batchId:                      # client picked
      claim(sl.batchId, sl.quantity)    # validate then decrement
    else:                               # server FEFO
      remaining = sl.quantity
      candidates = SELECT id, currentStock, expiryDate
                     FROM "Batch"
                    WHERE productId = $p AND businessId = $b
                      AND isDeleted = false
                      AND currentStock > 0
                      AND ($policy = 'WARN_ONLY' OR expiryDate IS NULL OR expiryDate > $today)
                    ORDER BY expiryDate ASC NULLS LAST,
                             createdAt ASC
                    FOR UPDATE SKIP LOCKED   -- concurrent sales don't fight
      for c in candidates:
        take = min(remaining, c.currentStock)
        UPDATE Batch SET currentStock = currentStock - take
         WHERE id = c.id AND currentStock >= take
        if 0 rows: continue              # raced; try next
        emit StockMovement(..., batchId = c.id, quantity = -take)
        remaining -= take
        if remaining == 0: break
      if remaining > 0:
        throw 409 ALL_BATCHES_EXPIRED  (HARD_BLOCK)
            or INSUFFICIENT_STOCK      (WARN_ONLY)
  else:
    adjustStock(... unchanged ...)
```

**Note:** a single sale line MAY emit multiple `StockMovement` rows when
FEFO splits across batches. UI rolls these up by `(productId, documentId)`
when rendering the ledger.

### 3.3 RETURN_OUT (purchase return), REVERSAL (void)

- Purchase return — `batchId` required for batch-tracked products
  (`POST /api/documents` PURCHASE_RETURN, validated by Zod).
  Same atomic pattern: `UPDATE Batch SET currentStock = currentStock - qty WHERE id = ? AND currentStock >= qty`. 0 rows → 409 `INSUFFICIENT_BATCH_STOCK` (HARD_BLOCK only;
  WARN_ONLY allows negative).
- Void of a `PURCHASE_INVOICE` — read original movements by `referenceId`,
  emit one `REVERSAL` per original `(batchId, quantity)` pair. Reversal
  decrements `Batch.currentStock`; same negative-stock guard as returns.
- Void of a `SALE_INVOICE` — emit one `RETURN_IN`-style `REVERSAL` per
  original sale movement, restoring stock to the same `batchId`.

### 3.4 Weighted-avg cost on batch upsert

When the same `(businessId, productId, batchNumber)` is purchased twice
(supplier ships a top-up), recompute `Batch.costPrice` using banker's
rounding (per past-audit weighted-avg lesson):

```
newCostPaise = bankersRound(
  (prevStock * prevCostPaise + qty * incomingCostPaise) / (prevStock + qty)
)
```

Skip when `incomingCostPaise = 0` or `prevStock + qty <= 0`.
`Product.weightedAvgCostPaise` continues to update via the existing Phase 2
purchase path — batches' WA cost is independent of product WA cost (the
product-level WA is the rollup used by the legacy report and non-batch
products).

---

## 4. Expiry policy enforcement

Lives in `server/src/services/stock/expiry-policy.ts` (new, ≤120 LOC) — a
pure validator called from FEFO selection (§3.2) and from the per-line
loop in `deductForSaleInvoice`.

```ts
export function checkExpiry(
  batch: { id; batchNumber; expiryDate: Date|null; productId; productName },
  policy: 'WARN_ONLY' | 'HARD_BLOCK',
  today: Date,                      // IST midnight in UTC
): { block: boolean; warning?: ExpiryWarning } {
  if (!batch.expiryDate) return { block: false }
  if (batch.expiryDate > today) return { block: false }
  if (policy === 'HARD_BLOCK') return { block: true }
  return { block: false, warning: { type: 'EXPIRED_BATCH', ...batch } }
}
```

**Where it fires:**
- FEFO `WHERE` clause excludes expired rows when `policy = HARD_BLOCK`
  (cheap; runs in the DB).
- Client-supplied `batchId` path: re-validate after the row-lock.
- After loop: if `block`, throw `expiredBatchError(detail)` →
  HTTP 409 `{ code: 'EXPIRED_BATCH', detail: { batchId, batchNumber,
  expiryDate, productId, productName } }`.
- If FEFO ran but found no non-expired batch, throw 409
  `{ code: 'ALL_BATCHES_EXPIRED', detail: { productId, productName,
  expiredBatchCount } }`.

WARN_ONLY responses bubble warnings into the document POST response:
`{ success: true, data: {...}, warnings: [{ type, batchId, ... }] }`.

**Today computation** — single helper `istMidnightUtc()` in
`server/src/lib/dates.ts`:

```ts
export function istMidnightUtc(d = new Date()): Date {
  // IST is UTC+5:30; midnight IST = 18:30 UTC of previous day
  const ist = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  ist.setHours(0, 0, 0, 0)
  // convert back to UTC
  return new Date(ist.getTime() - 330 * 60_000)
}
```

Used by FEFO, expiry-policy, and the cron — single source of truth so
"today" is identical everywhere.

---

## 5. Cron — daily batch-expiry-alerts at 06:00 IST

`server/src/jobs/batch-expiry-alerts.ts` (new, ≤180 LOC). Wired into
existing scheduler (`server/src/jobs/index.ts`). Cron expression
`30 0 * * *` UTC = 06:00 IST.

### Algorithm

```
today = istMidnightUtc()
for each business b with at least one batch-tracked product:
  alertDays = b.expiryAlertDays ?? 30
  if alertDays == 0: thresholdDate = today           # no advance alerts
  else:              thresholdDate = today + alertDays days

  candidates = SELECT batch.id, batch.productId, batch.batchNumber,
                      batch.expiryDate, batch.currentStock,
                      product.name AS productName, product.sku
                 FROM "Batch" batch
                 JOIN "Product" product ON product.id = batch.productId
                WHERE batch.businessId = $b
                  AND batch.isDeleted  = false
                  AND batch.currentStock > 0
                  AND batch.expiryDate IS NOT NULL
                  AND batch.expiryDate <= $thresholdDate

  for each c in candidates:
    alertType = (c.expiryDate <= today) ? 'EXPIRY_PASSED' : 'EXPIRY_NEAR'
    # dedupe: one ACTIVE alert per (businessId, batchId, alertType)
    existing = SELECT 1 FROM "StockAlert"
                WHERE businessId=$b AND batchId=c.id
                  AND alertType=alertType AND status='ACTIVE' LIMIT 1
    if existing: skip
    # If EXPIRY_PASSED needed and an EXPIRY_NEAR is ACTIVE → resolve the NEAR
    if alertType = 'EXPIRY_PASSED':
      UPDATE "StockAlert" SET status='RESOLVED', resolvedAt=now()
       WHERE businessId=$b AND batchId=c.id
         AND alertType='EXPIRY_NEAR' AND status='ACTIVE'
    INSERT INTO "StockAlert" (..., alertType, batchId, threshold=0, currentQty=c.currentStock)

# Auto-resolve sold-out batches
UPDATE "StockAlert" SET status='RESOLVED', resolvedAt=now()
 WHERE status='ACTIVE'
   AND alertType IN ('EXPIRY_NEAR','EXPIRY_PASSED')
   AND batchId IN (SELECT id FROM "Batch" WHERE currentStock <= 0)
```

Idempotent: re-running the cron creates zero new rows when nothing changed.
Per-business scoping respects multi-tenant boundary (no cross-tenant leak).

Batch creation also fires the auto-resolve check inline (when stock crosses
to 0 mid-day, alert resolves immediately, not 24h later).

**Performance:** one SQL per business; the FEFO partial index covers the
candidate scan. For 10K businesses × 50 active batches ≈ 500K row scan
through the partial index, runs in seconds. Same scheduler tier as the
low-stock cron — they piggyback the same heartbeat row.

---

## 6. Stock value report — per-batch breakdown

### 6.1 Behavioural change

For `Product.batchTracking = true`: report emits one row **per batch**
(batchNumber, expiryDate, currentStock, costPrice, totalValuePaise).
For `batchTracking = false`: one row per product (existing Phase 2 path).

Endpoint stays `GET /api/reports/stock-value`, response shape grows:

```ts
type ValueRow = ProductValueRow | BatchValueRow
interface ProductValueRow {
  kind: 'product'
  productId; name; sku; unit;
  currentStock; avgCostPaise; totalValuePaise
}
interface BatchValueRow {
  kind: 'batch'
  productId; productName; sku; unit;
  batchId; batchNumber; expiryDate; daysToExpiry;
  currentStock; costPaise; totalValuePaise
  status: 'ACTIVE'|'EXPIRY_NEAR'|'EXPIRED'
}
```

### 6.2 Query

```sql
WITH batch_rows AS (
  SELECT 'batch'::text AS kind,
         b.id AS "batchId", b."batchNumber", b."expiryDate",
         b."productId", p.name AS "productName", p.sku, u.symbol AS unit,
         b."currentStock",
         COALESCE(b."costPrice", p."weightedAvgCostPaise", 0) AS cost_paise,
         FLOOR(b."currentStock" *
               COALESCE(b."costPrice", p."weightedAvgCostPaise", 0)) AS total_paise
    FROM "Batch" b
    JOIN "Product" p ON p.id = b."productId"
    JOIN "Unit"    u ON u.id = p."unitId"
   WHERE b."businessId" = $1
     AND b."isDeleted" = false
     AND b."currentStock" > 0
     AND p."batchTracking" = true
     AND p."isDeleted" = false
), product_rows AS (
  SELECT 'product'::text AS kind, NULL AS "batchId", NULL, NULL,
         p.id AS "productId", p.name AS "productName", p.sku, u.symbol,
         p."currentStock",
         COALESCE(p."weightedAvgCostPaise", 0) AS cost_paise,
         FLOOR(p."currentStock" * COALESCE(p."weightedAvgCostPaise", 0)) AS total_paise
    FROM "Product" p
    JOIN "Unit"    u ON u.id = p."unitId"
   WHERE p."businessId" = $1
     AND p."isDeleted" = false
     AND p."batchTracking" = false
)
SELECT * FROM batch_rows UNION ALL SELECT * FROM product_rows
ORDER BY total_paise DESC, "productId" ASC, "batchId" ASC NULLS FIRST
LIMIT $2;
```

Cursor: keyset on `(total_paise DESC, productId ASC, batchId ASC)` — last
row's tuple becomes next cursor (base64).

Summary strip = `SELECT SUM(total_paise) FROM (...)` over the same WHERE,
`Promise.all` with the page query.

Past-audit lesson (banker's rounding): `FLOOR` is correct for value display
because we round individual paise down (conservative). The WA cost itself
uses banker's rounding when written.

---

## 7. PR breakdown — 7 PRs, each ≤8 files, each shippable

| # | PR | Scope | Files | LOC est |
|---|----|-------|-------|---------|
| **BAT-01** | Schema + migrations + index | `prisma/schema.prisma` (5 edits) · 2 migration SQL files · `services/verticals/defaults.ts` (pharmacy → HARD_BLOCK seed) | 4 | ~120 |
| **BAT-02** | Batch claim + FEFO service | `services/stock/batch-claim.ts` (new) · `services/stock/expiry-policy.ts` (new) · `services/stock/invoice-ops.ts` (extend purchase + sale) · `lib/dates.ts` (`istMidnightUtc`) · `__tests__/batch-claim.spec.ts` | 5 | ~600 |
| **BAT-03** | Sale-time policy + 409 + batch picker API | `services/document/create.ts` (wire policy) · `services/stock/expiry-policy.ts` (extend) · `routes/inventory/batches.ts` (new — `GET /products/:id/batches`, `?onlyInStock`) · `lib/errors.ts` (`expiredBatchError`, `allBatchesExpiredError`) · Zod schemas · `__tests__/sale-expired-batch.spec.ts` | 6 | ~500 |
| **BAT-04** | Cron + alerts API + dashboard count | `jobs/batch-expiry-alerts.ts` (new) · `jobs/index.ts` (register) · `routes/inventory/expiry-alerts.ts` (new — `GET /expiry-alerts`) · `services/dashboard.service.ts` (+`expiryAlertCount`) · `services/stock/batch-claim.ts` (auto-resolve hook) · `__tests__/expiry-cron.spec.ts` | 6 | ~500 |
| **BAT-05** | Frontend — batch picker + entry drawer + expiry badge + alerts page | `features/inventory/components/BatchPicker.tsx` · `BatchEntryDrawer.tsx` · `BatchRow.tsx` · `ExpiryBadge.tsx` · `pages/ExpiryAlertsPage.tsx` · `services/batches.service.ts` · `hooks/useBatches.ts` · `types/batch.types.ts` | 8 | ~900 |
| **BAT-06** | Stock value report — per-batch rows | `services/report/stock-value.service.ts` (UNION ALL query) · `routes/reports.ts` (extend) · `features/inventory/pages/StockValueReportPage.tsx` (render `kind`) · `components/StockValueRow.tsx` (variant) · `types/inventory.types.ts` · `__tests__/stock-value-batch.spec.ts` | 6 | ~400 |
| **BAT-07** | i18n + polish + dashboard tile + Settings field | `locales/en/inventory.json` · `locales/hi/inventory.json` · `pages/dashboard/ExpiryTile.tsx` · `pages/settings/InventorySettings.tsx` (+`expiryAlertDays`, +`expiredBatchPolicy`) · `services/business.service.ts` (PATCH allowlist) · screenshots | 6 | ~350 |

**Hard gate between BAT-02 and BAT-03:** integration test
`__tests__/batch-roundtrip.spec.ts` proving
`SUM(StockMovement.quantity WHERE batchId=X) === Batch.currentStock`
after purchase → sale (FEFO) → purchase return → void cycle.

**Hard gate between BAT-04 and BAT-05:** curl proof of
`GET /api/inventory/expiry-alerts?status=ACTIVE` returning seeded EXPIRY_NEAR
+ EXPIRY_PASSED rows with correct `daysRemaining` and `alertType`.

Total estimated work: ~3,400 LOC across 7 PRs over ~9 working days.

---

## 8. Acceptance gates per PR

Every PR must pass BOTH backend and frontend gates before merge.

### BAT-01 — Schema
- **Backend:** `prisma migrate dev` clean on a fresh DB; `tsc` clean; existing tests pass; `EXPLAIN ANALYZE` of FEFO query uses `Batch_productId_expiryDate_idx` (Index Scan, not Seq Scan); pharmacy business seeded after migration shows `expiredBatchPolicy = 'HARD_BLOCK'`.
- **Frontend:** none (schema-only PR).

### BAT-02 — Batch claim + FEFO
- **Backend:** integration test passes (purchase 100 units across 2 batches → sale 60 via FEFO splits earliest batch first → SUM(movements) = batch + product currentStock); concurrency harness: 10 parallel sales of 1 unit each from a 5-unit batch → exactly 5 succeed, 5 return 409; `tsc` clean.
- **Frontend:** none.

### BAT-03 — Policy + 409 + picker API
- **Backend:** curl matrix — sale of expired batch + HARD_BLOCK → 409 `EXPIRED_BATCH` with full detail block; same + WARN_ONLY → 200 with `warnings[].type`; all-expired + HARD_BLOCK → 409 `ALL_BATCHES_EXPIRED`; cross-tenant batchId → 400 `BATCH_PRODUCT_MISMATCH`; `GET /products/:id/batches?onlyInStock=true` → FEFO-sorted JSON; 401 without auth.
- **Frontend:** none yet (API-only PR).

### BAT-04 — Cron + alerts API
- **Backend:** seed batch with `expiryDate = today+15` and `expiryAlertDays=30` → cron creates exactly 1 `EXPIRY_NEAR`; second run creates zero; mark batch sold to 0 → next call resolves alert; `expiryDate = yesterday` → `EXPIRY_PASSED`; `GET /api/inventory/expiry-alerts?status=ACTIVE&cursor=` paginates; `GET /api/dashboard/summary` shows `expiryAlertCount: number`.
- **Frontend:** none.

### BAT-05 — Frontend batch UI
- **Backend:** none.
- **Frontend:** 4 UI states screenshotted at 320px AND 375px for BatchPicker, BatchEntryDrawer, ExpiryAlertsPage; Hindi strings render without overflow; offline batch entry queues with `entityType: 'batch'`, `entityLabel: batchNumber` (verified in `useOnlineStatus` test stub); FEFO row shows "Auto-selected (earliest expiry first)" label; expired row visible-strikethrough in WARN_ONLY, hidden in HARD_BLOCK; date renders `DD MMM YYYY` (never ISO).

### BAT-06 — Value report
- **Backend:** EXPLAIN shows partial index used; `?cursor=` returns deterministic next page; sum of page rows × cursor traversal == summary.totalValuePaise; non-batch products keep single-row format.
- **Frontend:** report page renders both `kind: 'product'` and `kind: 'batch'` rows with right visual variant; expiry badge on batch rows; 320px screenshot.

### BAT-07 — i18n + polish
- **Backend:** Settings PATCH allowlist includes only `expiryAlertDays` and `expiredBatchPolicy` from this feature (no field-drift); 401/403 on non-owner.
- **Frontend:** every new copy key has `en` + `hi`; lint clean; Settings screen 320px screenshot.

---

## 9. Past-audit lessons honored

| ID | Lesson | How this design honors it |
|----|--------|---------------------------|
| **F-01** | No `/api/api` double prefix | All new routes mounted under `/api/inventory/...`; service layer uses `api()` with paths starting `/inventory/...` (the wrapper prepends `/api`). Verified in `services/batches.service.ts` and `services/expiry-alerts.service.ts`. |
| **F-04** | No field drift between FE and BE | Single source of truth for shapes: `server/src/types/batch.contract.ts` exports the Zod schema; `client/src/features/inventory/types/batch.types.ts` re-exports inferred types via shared `@hp/contracts` package (or copy-with-comment if not yet shipped). Settings PATCH uses an allowlist: only `expiryAlertDays` + `expiredBatchPolicy` accepted; unknown fields rejected by Zod `.strict()`. |
| **F-05** | No double-unwrap of `success/data` | All services use `api<ResType>('/...')` which returns the unwrapped `data` directly; no consumer reads `.data.data`. New endpoints return `{ success: true, data: ..., warnings?: [] }` exactly once. Optimistic mutation handlers tolerate `{}` return per `OFFLINE_RULES.md` Rule 5. |
| **F-06** | Per-batch transaction, not outer batch tx | The document-create flow opens ONE outer `$transaction`. All FEFO claim, batch upsert, stock movement insert, and product currentStock update happen inside that single tx. `adjustBatchStock()` accepts `tx` as the first arg — never opens its own. The cron uses per-business transactions (one tx per business), never a global one. |
| **WA-rounding** | Weighted-avg cost uses banker's rounding | `bankersRound()` helper in `server/src/lib/money.ts` (already exists for invoice totals). Both batch-level WA (§3.4) and product-level WA reuse it. `FLOOR` only used at value-display time, never for storage. |
| **Idempotency** | All POSTs idempotent | `POST /api/documents` (purchase + sale) already wrapped by `idempotencyCheck()`. New routes: `POST /api/inventory/expiry-alerts/:id/dismiss` (BAT-04) gets the same middleware; `PATCH /api/business/settings` gets idempotency only on the `expiryAlertDays` write (60s window). |
| **No raw fetch** | All FE API via `api()` | `services/batches.service.ts`, `services/expiry-alerts.service.ts` use `api()` with `entityType` + `entityLabel` for mutations, `cacheReads: true` only for the `expiryAlertCount` read (PII-safe — just a number). |
| **No localStorage for entity data** | Use Dexie | Batch picker offline cache lives in IDB via existing `api-cache.ts`, not localStorage. |

---

## 10. Open risks — Phase 2.2-specific

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | **Concurrent FEFO claim depletes batch between SELECT and UPDATE** | Medium (pharmacy peak) | High — overselling | `FOR UPDATE SKIP LOCKED` on candidates + per-row `WHERE currentStock >= take`; row-count check; loop continues to next batch on miss. Verified by 10-parallel-sale concurrency test. |
| R2 | **Timezone drift — UTC storage, IST cron** | High (all users IST) | Medium — alert fires one day early or late | Single `istMidnightUtc()` helper used by FEFO, expiry-policy, AND cron. Documented in `lib/dates.ts`. Unit-tested across DST-free year (India has no DST so simpler). |
| R3 | **`expiryDate IS NULL` batch sorts last in FEFO ASC** | Low | Medium — UNBATCHED stock never sells while real batches keep arriving | Acceptable per PRD risk row 5; documented; UI shows "(No expiry — manual pick)" label. User can manually pick via batch picker. |
| R4 | **Schema drift if `Product.batchTracking` not present** | Low | Blocking | First task in BAT-01: audit schema; if columns missing, add in same migration. |
| R5 | **Stock value report query slow on big tenants** (1000+ batches) | Medium | Medium — page render lag | Cursor pagination keyed on `(total_paise DESC, productId, batchId)`; partial index on `Batch (productId, expiryDate) WHERE currentStock > 0` also supports `WHERE currentStock > 0 AND batchTracking = true` filter (covering); `EXPLAIN` proof in BAT-06 acceptance. |
| R6 | **Bakery owner toggles `HARD_BLOCK` mid-day; pending sale draft references expired batch** | Low | Medium — sale save fails unexpectedly | `expiredBatchPolicy` change is a Settings action; show confirm dialog "Existing draft sales referencing expired batches will fail to save. Continue?". No retroactive cleanup. |
| R7 | **Cron OOM on a single-process scheduler with 50K businesses** | Low (HP scale today is 4-figure) | High when triggered | Stream businesses in batches of 200; per-business tx; commit between batches. Phase 2.3 may move to a queue worker. |

---

*File:* `/Users/sawanjaiswal/Projects/HisaabPro/docs/inventory-phase-2.2-batches/ARCHITECTURE.md`
