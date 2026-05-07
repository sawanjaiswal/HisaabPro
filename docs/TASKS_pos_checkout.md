---
feature: pos-checkout
status: active
created: 2026-05-07T20:17:00Z
approver: Sawan
phase: 4
issue: "#118"
effort: ~17 working days (2–3 weeks)
agents_invoked:
  - scope-writer (output: docs/SCOPE_pos_checkout.md)
  - architect (output: docs/ARCHITECTURE_pos_checkout.md)
  - task-manager (output: docs/TASKS_pos_checkout.md)
acceptance:
  backend:
    - tsc --noEmit clean
    - prisma migrate clean
    - curl POST /api/businesses/:id/pos/sales success path → 201 PosSaleDTO
    - curl POST same X-Idempotency-Key → identical 201 (no duplicate)
    - curl POST without auth → 401
    - curl POST cross-business id → 403
    - curl POST empty items → 422 EMPTY_CART
    - curl POST payment sum mismatch → 400 PAYMENT_SUM_MISMATCH
    - curl POST oversell HARD_BLOCK → 400 OVERSELL_BLOCKED
    - curl POST /pos/sales/:id/void within 24h → 200 VOIDED + REVERSAL StockMovement
    - curl POST /pos/sales/:id/void after 24h → 400 VOID_WINDOW_EXPIRED (HTTP 410)
    - curl POST /pos/sales/:id/restore → 200 ACTIVE + new SALE StockMovement
    - curl GET /pos/sales paginated → cursor + totalCount
    - curl GET /pos/sales as CASHIER role → only own sales; UI hides void if no permission
    - curl GET /pos/products?search= → cursor list + recently-used-first
    - cash payment → CashEntry IN row created with referenceType=POS_SALE (when CASH_REGISTER_ENABLED)
    - walk-in party reuse: second walk-in checkout → same sentinel Party
    - FEFO claim within tx: batch-tracked product claimed from earliest-expiry batch
    - receipt counter race: 20 parallel checkouts → sequential receiptSeq, no duplicates
  frontend:
    - screenshots: product grid (loading, error, empty, success) at 375px and 320px
    - screenshots: cart panel (empty, with items, error, success)
    - screenshots: payment sheet, UPI QR modal, split tender single/mixed
    - screenshots: receipt preview 58mm + 80mm + A5 formats
    - screenshots: history page (loading, empty, list, filtered)
    - screenshots: sale detail (active, voided, restore window active/expired)
    - 320px no horizontal overflow, 375px primary breakpoint
    - tsc --noEmit clean
    - console clean (no errors/warnings logged)
high_risk_paths_touched:
  - prisma/schema.prisma
  - prisma/migrations/20260507_pos_checkout_additive
  - prisma/migrations/20260508_pos_settings_seed
---

# TASKS — POS Billing Mode (Phase 4 #118)

**Build Plan with Proof Gates**

Build sequence: 15 PRs over ~2–3 weeks. Each proof gate is **BLOCKING** — features advance
only with evidence, never on verbal "done".

---

## PR1: Schema Migrations (Additive)

**Agent:** DudhHisaab-Database-Manager  
**Files:** `prisma/schema.prisma`, `prisma/migrations/20260507_pos_checkout_additive.sql`, `prisma/migrations/20260508_pos_settings_seed.sql`  
**Effort:** 0.5 days  
**Owner:** Backend

### Scope

1. **Migration A** (`20260507_pos_checkout_additive`) — fully additive, zero data loss:
   - New tables: `PosSale`, `PosSaleItem`, `PosReceiptCounter`, `PosSaleEvent`, `PosSetting`
   - `Party.isWalkIn` boolean (default false) — new unique partial index `WHERE isWalkIn=true` per business
   - `Document.status` add enum value `VOIDED` (soft-delete markers)
   - All columns nullable or have defaults; zero backfill required

2. **Migration B** (`20260508_pos_settings_seed`) — seed PosSetting row per Business:
   ```sql
   INSERT INTO "PosSetting" ("id","businessId","createdAt","updatedAt")
   SELECT 'pst_' || encode(gen_random_bytes(12), 'hex'), b."id", NOW(), NOW()
   FROM "Business" b
   LEFT JOIN "PosSetting" ps ON ps."businessId" = b."id"
   WHERE ps."id" IS NULL;
   ```

### Proof Gate (Verifier)

```bash
# Migration sequence clean
npx prisma migrate dev --name pos_checkout_additive
npx prisma migrate dev --name pos_settings_seed
npx prisma migrate status  # all migrations clean

# TypeScript clean
tsc --noEmit

# Schema applies (no drift)
npx prisma migrate status --experimental-cli
```

**Blockers:**
- Any non-additive changes (column drop, enum value removal, non-nullable column without default)
- Migration fails to apply (SQL syntax error, FK constraint violation)
- TypeScript type generation incomplete

---

## PR2: Receipt Counter Service

**Agent:** DudhHisaab-API-Builder  
**Files:** `src/server/features/pos/pos-checkout.receipt.ts`  
**Tests:** `src/server/features/pos/__tests__/pos-checkout.receipt.test.ts`  
**Effort:** 0.5 days  
**Owner:** Backend

### Scope

Pure service: `allocateNumber(tx, businessId, posSetting) → { receiptNumber, receiptSeq, financialYear }`

- Derive FY from current date (April 1 = new FY; e.g., Apr 2026 → "25-26")
- `SELECT ... FOR UPDATE` on `PosReceiptCounter` row `(businessId, financialYear)` to serialize
- Increment `lastNumber` → new sequence `receiptSeq`
- Format receipt: `{prefix}{FY-short}{paddingZeros(receiptSeq)}`
  - Example: "POS-2526-00001"
- Return `{ receiptNumber, receiptSeq, financialYear }`
- All logic inside Prisma tx → no race conditions
- ≤ 120 LOC

### Proof Gate (Verifier)

```bash
# Unit test — counter increments sequentially
npm test src/server/features/pos/__tests__/pos-checkout.receipt.test.ts

# Concurrency test — 20 parallel allocations → sequential seq
npm run test:concurrency pos-receipt-counter.concurrency.spec.ts
```

**Blockers:**
- Duplicate receipt numbers generated under parallel load
- `SELECT FOR UPDATE` not present in Prisma query
- Counter not incremented (receiptSeq always same)

---

## PR3: Walk-in Party Helper

**Agent:** DudhHisaab-API-Builder  
**Files:** `src/server/features/pos/pos-checkout.walkin.ts`  
**Tests:** `src/server/features/pos/__tests__/pos-checkout.walkin.test.ts`  
**Effort:** 0.3 days  
**Owner:** Backend

### Scope

Idempotent service: `getOrCreateWalkInParty(tx, businessId) → Party`

- Upsert a singleton `Party` per business with:
  - `name = "Walk-in Customer"`
  - `type = "CUSTOMER"`
  - `isWalkIn = true`
  - `businessId = ctx.businessId`
- Handle unique constraint collision on `(businessId, isWalkIn)` → return existing
- Retry-on-conflict if two checkouts race
- Returns the Party record (immutable sentinel)
- ≤ 80 LOC

### Proof Gate (Verifier)

```bash
npm test src/server/features/pos/__tests__/pos-checkout.walkin.test.ts

# Verify idempotency: call twice, same Party.id
# Verify race: concurrent creates → same Party returned
```

**Blockers:**
- Duplicate sentinel Party created
- Query throws on unique violation (not caught)

---

## PR4: Checkout Service (Atomic)

**Agent:** DudhHisaab-API-Builder  
**Files:**
- `src/server/features/pos/pos-checkout.service.ts` (~240 LOC)
- `src/server/features/pos/pos-checkout.pricing.ts` (~180 LOC)
- `src/server/features/pos/pos-checkout.tax.ts` (~140 LOC)
- `src/server/features/pos/pos-checkout.inventory.ts` (~200 LOC)
- `src/server/features/pos/pos-checkout.cash.ts` (~110 LOC)
- `src/server/features/pos/pos-checkout.idempotency.ts` (~90 LOC)
- `src/server/features/pos/pos.validators.ts` (~200 LOC)
- `src/server/features/pos/pos.types.ts` (~180 LOC)
- `src/server/features/pos/pos.errors.ts` (~70 LOC)
- `src/server/features/pos/pos.constants.ts` (~50 LOC)

**Tests:** `src/server/features/pos/__tests__/pos-checkout.create.spec.ts`  
**Effort:** 3 days  
**Owner:** Backend

### Scope

Atomic Prisma transaction orchestrator:

1. **Idempotency check** — lookup in `IdempotencyLog` (or extend existing table)
   - Key: `(businessId, idempotencyKey)` composite unique
   - Store response + TTL 24h
   - Duplicate key within TTL → return stored response, no re-process
   - Out-of-TTL hit → allow retry (new sale)

2. **Validation** — cart non-empty, payment mode whitelist, ≤200 items

3. **Repricing** — load products from DB, apply client-sent discounts per line
   - Server-authoritative prices (ignore `clientGrandTotal` for calculation)
   - Discount validation: cannot exceed line total; AMOUNT ≤ paise, PERCENTAGE ≤ 10000 bps

4. **Party resolution** — `partyId` provided → validate exists & belongs to business
   - Null partyId → call walk-in helper (lazy-create sentinel)
   - Return `(partyId, partyForDocument, placeOfSupply)`

5. **Tax calculation** — call existing `tax-calc.utils.ts`
   - Derive POS from `party.stateCode` (B2B) or `business.stateCode` (walk-in)
   - `supplyType = B2B if party.gstin else B2C_SMALL`
   - Per-line: `calculateLineTax` (handles inclusive/exclusive toggle)
   - Doc aggregate: `calculateDocumentTax`
   - Result: item-level + doc-level tax totals

6. **Guards** (inline validation, throw `AppError`)
   - `grandTotal > 0`
   - Client drift `> 100 paise` → 400 TOTAL_MISMATCH
   - `paymentBreakdown.sum !== grandTotal` → 400 PAYMENT_SUM_MISMATCH
   - No 0-amount payment modes (skip client-side; validate server-side)

7. **Inventory claim** — call `inventoryHandler.claimAndMove(tx, ...)`
   - FEFO batch claim if product tracked
   - Manual batch if `batchId` provided (validate not expired)
   - Oversell policy: HARD_BLOCK → 400 OVERSELL_BLOCKED; WARN_ONLY → allow + collect warnings
   - Create `StockMovement` type='SALE' inside tx
   - Decrement `Product.currentStock` + `Batch.currentStock`

8. **Receipt counter** — call `receipt.allocateNumber(tx, ...)`
   - Locks counter row, increments, formats receipt

9. **Document create** — call existing `documentService.createPosDocument(tx, ...)`
   - Type = 'POS_SALE'
   - `partyId` = walk-in sentinel or provided
   - Copy tax totals + line items from tax calculation
   - Returns document (immutable invoice record)

10. **PosSale + PosSaleItem create** — inside same tx
    - Create PosSale row with all totals, payment breakdown JSON
    - Create PosSaleItem rows (snapshot of line pricing/tax at sale time)
    - `idempotencyKey` unique per sale

11. **Cash Entry** — feature-flagged (default off)
    - If `CASH_REGISTER_ENABLED=true` and any payment split `mode='CASH'`:
      - Sum cash amounts
      - Create CashEntry IN with `referenceType='POS_SALE'`, `referenceId=posSale.id`

12. **Audit event** — append `PosSaleEvent` type='CREATED'

13. **Idempotency persist** — store in `IdempotencyLog` before tx commits

14. **Return** — `PosSaleDTO` (includes documentId, receiptNumber, items, payments)

### Error Codes

| Code | HTTP | Message |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Missing/invalid required field |
| `EMPTY_CART` | 422 | items array empty |
| `PRODUCT_NOT_FOUND` | 404 | Product not found or inactive |
| `OVERSELL_BLOCKED` | 400 | Insufficient stock; hard policy |
| `EXPIRED_BATCH_BLOCKED` | 400 | Batch expired; hard policy |
| `TOTAL_MISMATCH` | 400 | Client total drifts > Rs 1 |
| `PAYMENT_SUM_MISMATCH` | 400 | Payment splits don't sum to total |
| `DUPLICATE_CLIENT_ID` | 409 | clientId already exists |
| `INVALID_IDEMPOTENCY_KEY` | 400 | Not a valid UUID format |

### Proof Gate (Verifier)

```bash
# TypeScript clean
tsc --noEmit

# Prisma migrate clean (PR2 prerequisite)
npx prisma migrate status

# Unit tests (pricing, tax, receipt counter, FEFO)
npm test src/server/features/pos/__tests__/pos-checkout.pricing.test.ts
npm test src/server/features/pos/__tests__/pos-checkout.tax.test.ts
npm test src/server/features/pos/__tests__/pos-checkout.receipt.test.ts

# Integration tests (checkout, idempotency, oversell, walk-in, cashier)
npm test src/server/features/pos/__tests__/pos-checkout.create.spec.ts

# Curl matrix (live server on test DB)
curl -X POST http://localhost:3000/api/businesses/BIZ_ID/pos/sales \
  -H "X-Idempotency-Key: uuid-v4" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId":"PROD_ID","quantity":2}],
    "payments": [{"mode":"CASH","amountPaise":5000}],
    "idempotencyKey":"uuid-v4"
  }' \
  # Expect: 201 { success: true, data: { id, receiptNumber, ... } }

# Idempotency replay
curl -X POST ... -H "X-Idempotency-Key: <same-uuid>" \
  # Expect: 201 { success: true, data: { id, ... } } (identical to first response)

# Oversell HARD_BLOCK
curl -X POST ... -d '{"items":[{"productId":"PROD","quantity":999}],...}' \
  # Expect: 400 { success: false, error: { code: 'OVERSELL_BLOCKED' } }

# Payment sum mismatch
curl -X POST ... -d '{...,"payments":[{"mode":"CASH","amountPaise":1000}]}' \
  # (grand total is 5000)
  # Expect: 400 { success: false, error: { code: 'PAYMENT_SUM_MISMATCH' } }

# No auth
curl -X POST ... (no cookie)
  # Expect: 401 { success: false, error: { code: 'UNAUTHORIZED' } }

# Cross-business
curl -X POST /api/businesses/OTHER_BIZ/pos/sales ... (logged-in user in diff business)
  # Expect: 403 { success: false, error: { code: 'FORBIDDEN' } }
```

**Blockers:**
- Any test fails
- tsc reports errors/warnings
- Any curl returns non-expected status/response shape

---

## PR5: Query Service

**Agent:** DudhHisaab-API-Builder  
**Files:** `src/server/features/pos/pos-query.service.ts` (~190 LOC)  
**Tests:** `src/server/features/pos/__tests__/pos-query.spec.ts`  
**Effort:** 1 day  
**Owner:** Backend

### Scope

List/get services with cashier scoping:

1. **listPosSales(ctx, query)** — cursor pagination, filters
   - Where: `businessId`, optional `from`/`to` date range, `status` (ACTIVE/VOIDED), `cashierId`, `paymentMode` (JSON array search)
   - Cashier role → auto-scoped to own sales only (filter by `cashierId = ctx.userId`)
   - Owner/Manager → see all
   - Order: `saleDate DESC, id DESC`
   - Return: `{ sales: PosSaleDTO[], nextCursor, totalCount }`

2. **getPosSale(ctx, saleId)** — single-sale fetch
   - Validate businessId match + cashier scope (if CASHIER role, only own sales)
   - Return: `PosSaleDTO` with items, payments, audit events

### Proof Gate (Verifier)

```bash
npm test src/server/features/pos/__tests__/pos-query.spec.ts

# Cashier scoping
curl GET /api/businesses/.../pos/sales \
  (logged in as CASHIER)
  # Response contains only this cashier's sales

# Owner sees all
curl GET /api/businesses/.../pos/sales \
  (logged in as OWNER)
  # Response contains all sales for business

# Date filter
curl GET /api/businesses/.../pos/sales?from=2026-05-01&to=2026-05-07
  # Only sales in range

# Pagination
curl GET /api/businesses/.../pos/sales?limit=20
  # Returns nextCursor if more results
```

**Blockers:**
- Cashier can see other cashier's sales
- Date range not applied
- Cursor pagination broken

---

## PR6: Void Service

**Agent:** DudhHisaab-API-Builder  
**Files:** `src/server/features/pos/pos-void.service.ts` (~220 LOC)  
**Tests:** `src/server/features/pos/__tests__/pos-void.spec.ts`  
**Effort:** 1 day  
**Owner:** Backend

### Scope

Void/restore inside Prisma tx:

1. **voidPosSale(ctx, posSaleId, reason)** — soft-delete + stock reversal
   - Lookup PosSale: validate businessId, check not already voided
   - Window check: `createdAt + voidWindowHours` not expired (use server time)
     - Default 24h (configurable via `PosSetting.voidWindowHours`)
     - Expired → 400 VOID_WINDOW_EXPIRED (HTTP 410 OK)
   - Reverse inventory: call `inventoryHandler.reverseSale(tx, ctx, sale)`
     - Create StockMovement type='SALE_REVERSAL', positive qty
     - Increment Product.currentStock + Batch.currentStock
   - Reverse cash: if `CASH_REGISTER_ENABLED`, void linked CashEntry IN
   - Set Document.status = 'VOIDED'
   - Update PosSale: `status='VOIDED'`, `voidedAt=now`, `voidedBy=userId`, `voidReason=reason`
   - Append PosSaleEvent type='VOIDED'
   - Return: `{ id, status: 'VOIDED', voidedAt, voidReason }`

2. **restorePosSale(ctx, posSaleId)** — undo void (within window)
   - Lookup PosSale: validate businessId, check IS voided
   - Window check: `voidedAt + voidWindowDays` not expired
     - Default 7 days (configurable per business)
     - Expired → 400 RESTORE_WINDOW_EXPIRED
   - Re-apply inventory: call `inventoryHandler.reclaimSale(tx, ctx, sale)`
     - Create StockMovement type='SALE', negative qty
     - Decrement Product.currentStock + Batch.currentStock
     - Check oversell policy (warn if insufficient stock to restore)
   - Restore cash: if `CASH_REGISTER_ENABLED`, un-void linked CashEntry
   - Set Document.status = 'SAVED' (revert from VOIDED)
   - Update PosSale: `status='ACTIVE'`, `restoredAt=now`, `restoredBy=userId`
   - Append PosSaleEvent type='RESTORED'
   - Return: `{ id, status: 'ACTIVE', restoredAt }`

### Proof Gate (Verifier)

```bash
npm test src/server/features/pos/__tests__/pos-void.spec.ts

# Void within window
curl -X POST /api/businesses/.../pos/sales/:id/void \
  -d '{"reason":"wrong product"}' \
  # Expect: 200 { success: true, data: { status: 'VOIDED' } }
  # Check: StockMovement REVERSAL row exists
  # Check: Document.status = VOIDED
  # Check: PosSaleEvent type=VOIDED appended

# Void after window expired
(wait 25 hours)
curl -X POST /api/businesses/.../pos/sales/:id/void \
  # Expect: 400 { code: 'VOID_WINDOW_EXPIRED' } OR 410 GONE

# Restore within window
curl -X POST /api/businesses/.../pos/sales/:id/restore \
  # Expect: 200 { success: true, data: { status: 'ACTIVE' } }
  # Check: StockMovement SALE row created (positive qty)
  # Check: Document.status = SAVED
  # Check: PosSaleEvent type=RESTORED appended

# Restore when stock insufficient (WARN_ONLY)
(set inventory policy to WARN_ONLY, decrement stock after void)
curl -X POST /api/businesses/.../pos/sales/:id/restore \
  # Expect: 200 { success: true, data: { status: 'ACTIVE' } }
  # Check: StockAlert created (negative balance)
```

**Blockers:**
- Void permitted after window (no window check)
- Stock not reversed on void
- CashEntry not reversed (if feature flag on)
- Document.status not set to VOIDED

---

## PR7: Restore + Receipt Share Services

**Agent:** DudhHisaab-API-Builder  
**Files:** `src/server/features/pos/pos-receipt-share.service.ts` (~120 LOC)  
**Effort:** 0.5 days  
**Owner:** Backend

### Scope

1. **Receipt share** — build signed WhatsApp/email link
   - Load PosSale + Document
   - Generate signed shareable URL with TTL (e.g., 30 days)
   - Return: `{ channel: 'WHATSAPP' | 'EMAIL', link, expires }`
   - Append PosSaleEvent type='RECEIPT_SHARED'

2. **Restore is in PR6** (included, not separate)

### Proof Gate (Verifier)

```bash
npm test src/server/features/pos/__tests__/pos-receipt-share.test.ts

curl GET /api/businesses/.../pos/receipt/:id/share \
  # Expect: 200 { success: true, data: { link, channel, expires } }
```

**Blockers:**
- Link signature invalid
- Receipt event not appended

---

## PR8: Routes + Zod Validation

**Agent:** DudhHisaab-API-Builder  
**Files:**
- `src/server/routes/pos.routes.ts` (~180 LOC)
- `src/server/features/pos/pos.validators.ts` (included in PR4, but validate here)
- `src/server/middlewares/requireIdempotencyKey.ts` (~50 LOC)

**Effort:** 0.5 days  
**Owner:** Backend

### Scope

Express routes, all under `/api/businesses/:businessId/pos`:

1. **POST /sales** — checkout
   - Headers: `X-Idempotency-Key` (required, UUID format)
   - Body: `CreatePosSaleReq` (zod validated)
   - Permissions: `pos:create`
   - Rate limit: 60 req/min per businessId
   - Handler: `checkout.createPosSale(ctx, body, idempotencyKey)`
   - Response: 201 `{ success: true, data: PosSaleDTO }`

2. **GET /sales** — list history
   - Query: cursor, limit, from, to, cashierId, paymentMode, status, search
   - Permissions: `pos:read`
   - Rate limit: 120 req/min
   - Handler: `query.listPosSales(ctx, query)`
   - Response: 200 `{ success: true, data: { sales, nextCursor, totalCount } }`

3. **GET /sales/:id** — single sale
   - Permissions: `pos:read`
   - Handler: `query.getPosSale(ctx, id)`
   - Response: 200 `{ success: true, data: PosSaleDTO }`

4. **POST /sales/:id/void** — soft-delete
   - Body: `{ reason: string }` (min 3 chars)
   - Permissions: `pos:void`
   - Handler: `voidSvc.voidPosSale(ctx, id, reason)`
   - Response: 200 `{ success: true, data: { id, status, voidedAt, voidReason } }`

5. **POST /sales/:id/restore** — undo void
   - Permissions: `pos:void`
   - Handler: `voidSvc.restorePosSale(ctx, id)`
   - Response: 200 `{ success: true, data: { id, status, restoredAt } }`

6. **GET /products** — grid products
   - Query: search (min 1 char), categoryId, limit (default 60, max 200), cursor, includeOutOfStock
   - Permissions: `pos:read`
   - Rate limit: 120 req/min
   - Handler: `products.list(ctx, query)`
   - Response: 200 `{ success: true, data: { products: PosProductDTO[], nextCursor } }`

7. **POST /receipt/:id/share** — WhatsApp link
   - Permissions: `pos:read`
   - Handler: `shareSvc.buildShareLink(ctx, id, body)`
   - Response: 200 `{ success: true, data: { link, channel, expires } }`

### Proof Gate (Verifier)

```bash
# TypeScript clean
tsc --noEmit

# Route validation (Zod schemas)
npm test src/server/features/pos/__tests__/pos.validators.test.ts

# curl tests
npm run test:integration pos.routes.spec.ts
```

**Blockers:**
- Missing idempotency key header → not rejected
- Validation schema doesn't match contract
- Wrong HTTP status codes returned

---

## PR9: Permissions & Role Seed

**Agent:** DudhHisaab-API-Builder  
**Files:** `src/server/scripts/seed-permissions.ts` (or extend existing seed)  
**Effort:** 0.3 days  
**Owner:** Backend

### Scope

Add permissions registry + Cashier role seed:

1. **Permissions** (add to registry, if not yet present):
   - `pos:read` — view sales history + product grid
   - `pos:create` — create new sale (checkout)
   - `pos:void` — void / restore sales

2. **Role: Cashier** (new or extend)
   - Permissions: `pos:read`, `pos:create`
   - No `pos:void`
   - Scope: sees only own sales

3. **Role: Manager** (extend)
   - Permissions: `pos:read`, `pos:create`, `pos:void`
   - Scope: sees all business sales

4. **Role: Owner** (auto-bypass)
   - All permissions implied

### Proof Gate (Verifier)

```bash
# Permission registry includes pos:*
curl GET /api/permissions (if exists)
  # Expect pos:read, pos:create, pos:void in list

# Cashier role created
curl GET /api/businesses/.../roles
  # Expect CASHIER with permissions [pos:read, pos:create]

# Seed idempotent (no duplicates)
npm run seed
npm run seed  # second run
  # Expect: no duplicate permission/role entries
```

**Blockers:**
- Permissions not in registry
- Cashier role missing
- Duplicate permission seeds

---

## PR10: Frontend — Component Tree & State

**Agent:** DudhHisaab-Frontend-Builder  
**Files:** 24 component files + 6 hook/service/store files (see ARCHITECTURE §2)  
**Tests:** Storybook, visual regression (optional)  
**Effort:** 6 days  
**Owner:** Frontend

### Scope (High-level module boundaries)

All files ≤ 250 LOC; split if growth exceeds 200 during build.

#### Pages (3)
- `PosPage.tsx` — main layout: product grid + floating cart FAB
- `PosHistoryPage.tsx` — sales list with filters
- `PosSaleDetailPage.tsx` — single-sale receipt + void/restore buttons

#### Hooks (5)
- `usePosPage.ts` — orchestrates search, scan, cart, checkout
- `usePosHistory.ts` — cursor pagination + filter state
- `usePosSaleDetail.ts` — sale query + void/restore mutations
- `usePosProducts.ts` — TanStack Query infinite product list
- `usePosCheckout.ts` — checkout mutation, idempotency key, online guard

#### State (3)
- `pos.store.ts` — Zustand cart (transient; clears on checkout)
- `pos.cart-calc.ts` — pure function: recalc totals from items + tax inputs
- `pos.service.ts` — api() wrappers (no raw fetch)

#### Component Tree (16)
- **Grid:** ProductGrid (virtualized), PosProductCard, ProductSearchBar, ProductGridStates
- **Cart:** CartPanel, CartLineItem, CartTotals, CartEmpty
- **Customer:** CustomerSelector, WalkInForm
- **Payment:** PaymentSheet, PaymentModeButton, SplitTenderRow, UpiQrModal
- **Receipt:** ReceiptPreview, Receipt58mm, Receipt80mm, ReceiptA5, ReceiptShareBar
- **Void:** VoidModal
- **History:** PosHistoryList, PosHistoryFilters, PosSaleRow

#### Utilities (4)
- `pos.types.ts` — DTO types (mirrors backend)
- `pos.constants.ts` — PAYMENT_MODES, RECEIPT_WIDTHS, MAX_CART_ITEMS=200
- `pos.format.ts` — formatReceiptLine, truncate, paiseToInr
- `pos.utils.ts` — buildCartTotals, deriveInterState (pure functions)

### Key Requirements

1. **Cart state** — Zustand store persisted to sessionStorage (survive page refresh, cleared on logout)
2. **4 UI states** — every component: loading, error, empty, success (exact copy from SCOPE §14)
3. **Offline support**:
   - All API calls via `api()` from `@/lib/api` (no raw fetch)
   - Mutations pass `entityType: 'pos_sale'` + `entityLabel: receiptNumber`
   - No `localStorage` for entity data (IDB only via `api()`)
   - Checkout guarded: online-only toast if offline
4. **Virtualization** — ProductGrid uses TanStack Virtual (FixedSizeGrid)
5. **Search debounce** — 300ms, min 1 char
6. **Responsive** — 375px primary, 320px minimum, no horizontal overflow
7. **React-PDF** — Receipt templates (not Puppeteer)
8. **Icons/colors** — match existing design system (Jupiter/Cred polish)
9. **Accessibility** — semantic HTML, ARIA labels on forms

### Proof Gate (Verifier)

```bash
# TypeScript clean
tsc --noEmit

# Storybook renders all components
npm run storybook
  (manual visual review of all 16 components in 4 states each)

# Console clean (no errors/warnings in browser console)
npm run test:visual 320px 375px
  (screenshots in Playwright; check console output)
```

**Blockers:**
- tsc errors
- Component renders broken/blank
- Console errors/warnings
- Missing UI states (< 4 states on any component)
- Horizontal scroll on 320px

---

## PR11: Receipt PDF Templates

**Agent:** DudhHisaab-Frontend-Builder  
**Files:**
- `src/features/pos/components/receipt/Receipt58mm.tsx` (~220 LOC)
- `src/features/pos/components/receipt/Receipt80mm.tsx` (~220 LOC)
- `src/features/pos/components/receipt/ReceiptA5.tsx` (~230 LOC)
- `src/features/pos/components/receipt/ReceiptPrimitives.tsx` (~150 LOC)

**Effort:** 2 days  
**Owner:** Frontend

### Scope

React-PDF receipt templates (NOT Puppeteer):

1. **Receipt58mm** — 32-char width, monospace
   - Font: Courier or Courier New, 8pt, line-height 10pt
   - Page size: 58mm × auto
   - Layout:
     - Header: business name, address, GSTIN
     - Receipt number + date + time
     - Customer name (or "Walk-in Customer")
     - Line items (truncate product name to 20 chars + "…")
     - Subtotal, discount (if any), taxable, tax breakdown, total
     - Payment mode + amount
     - Footer: "Thank you. Visit again!"
   - All amounts right-aligned
   - HSN code shown only if `business.gstEnabled = true`

2. **Receipt80mm** — 48-char width, more breathing room
   - Font: 9pt
   - Tax breakdown with rates on separate lines
   - Product names up to 30 chars

3. **ReceiptA5** — A5 portrait, 14pt body (fallback)
   - Standard invoice layout (reuse existing A5 invoice template if available)
   - Header, line items table, totals, footer

4. **ReceiptPrimitives** — shared layout components
   - `Divider` (rule line)
   - `Row` (left/right aligned pair)
   - `Money` (paise → INR format right-aligned)
   - `Truncate` (smart line wrapping for monospace)

### Proof Gate (Verifier)

```bash
# Component renders without errors
npm test src/features/pos/components/receipt/

# Screenshot validation (pixel-perfect vs design)
npm run test:visual receipt58 receipt80 receiptA5 at 375px 320px
  # Check: no truncation artifacts, all text visible, alignment correct

# Browser print (manual)
# 58mm receipt: print to PDF, measure → width should be ~58mm
# 80mm receipt: measure → width should be ~80mm
```

**Blockers:**
- Text overflow beyond width
- Fonts don't load (use bundled fonts, preload in component)
- Line breaks wrong (monospace measure broken)

---

## PR12: Cash Register Integration Test

**Agent:** DudhHisaab-API-Builder  
**Files:** `src/server/features/pos/__tests__/pos-checkout.cash.spec.ts`  
**Effort:** 0.5 days  
**Owner:** Backend

### Scope

Feature-flagged integration: `CASH_REGISTER_ENABLED` (default false)

1. **Setup** — create a business with `CASH_REGISTER_ENABLED=true`
2. **POS checkout with cash** — validate CashEntry IN created:
   - referenceType = 'POS_SALE'
   - referenceId = posSale.id
   - direction = 'IN'
   - amountPaise = sum of CASH-mode splits
   - referenceNumber = receiptNumber
3. **Void** — CashEntry marked isVoided=true
4. **Restore** — CashEntry isVoided=false
5. **Feature flag off** — no CashEntry created

### Proof Gate (Verifier)

```bash
npm test src/server/features/pos/__tests__/pos-checkout.cash.spec.ts

# Feature on: CashEntry created
CASH_REGISTER_ENABLED=true npm test ...
  # Expect: CashEntry row exists

# Feature off: no CashEntry
CASH_REGISTER_ENABLED=false npm test ...
  # Expect: CashEntry not created (no-op)
```

**Blockers:**
- CashEntry columns don't exist (wait for Cash Register migration)
- referenceType/referenceId/isVoided not set correctly

---

## PR13: Internationalization

**Agent:** Frontend  
**Files:** `public/locales/en/pos.json`, `public/locales/hi/pos.json`  
**Effort:** 0.5 days  
**Owner:** Frontend

### Scope

i18n keys for all UI copy (SCOPE §14):

- Button labels (en + hi)
- Loading texts
- Success toasts
- Error messages (5 scenarios)
- Confirm dialog (void)
- Empty states (3 contexts)
- Field placeholders

All components use `useTranslation()` hook (existing setup).

### Proof Gate (Verifier)

```bash
# i18n files exist and are valid JSON
jq . public/locales/en/pos.json
jq . public/locales/hi/pos.json

# All keys are referenced in components
npm run i18n:check
  # Expect: no missing translations
```

**Blockers:**
- JSON syntax errors
- Keys missing in one language
- Mismatch with SCOPE copy

---

## PR14: Verifier — Proof Gates (Curl + Screenshots)

**Agent:** Verifier  
**Files:** None (test execution environment)  
**Effort:** 2 days  
**Owner:** QA

### Scope

Run comprehensive proof matrix against live staging server:

#### Backend Proof (curl matrix)

All tests run against test DB with fresh business + products.

| # | Test | Curl | Expected | Blocker |
|----|------|------|----------|---------|
| 1 | POST /sales happy path | curl -X POST /api/biz/:id/pos/sales [valid payload] -H "X-Idempotency-Key: [uuid]" | 201 PosSaleDTO, receiptNumber format correct | HTTP status ≠ 201, response missing fields |
| 2 | Idempotency replay | curl (same uuid) | 201 identical to #1 | Different response or new row created |
| 3 | No auth | curl (no cookie) | 401 | Returns 200 or 2xx |
| 4 | Cross-business | curl /api/biz/OTHER_ID/... | 403 | User can access other business |
| 5 | Empty items | curl -d '{"items":[]}' | 422 EMPTY_CART | Returns 201 or 2xx |
| 6 | Payment sum mismatch | curl -d '{"items":[...], "payments":[{"mode":"CASH","amountPaise":1000}]}' (total=5000) | 400 PAYMENT_SUM_MISMATCH | Payment validation not applied |
| 7 | Oversell HARD_BLOCK | curl -d '{"items":[{"productId":"P","quantity":999}]}' (stock=10) | 400 OVERSELL_BLOCKED | Checkout allowed, stock oversold |
| 8 | Void within 24h | curl -X POST /api/.../pos/sales/:id/void -d '{"reason":"test"}' (< 24h old) | 200 VOIDED | void rejected or status not updated |
| 9 | Void after 24h | curl ... (> 24h old) | 400 VOID_WINDOW_EXPIRED or 410 GONE | void allowed | 
| 10 | Restore | curl -X POST /api/.../pos/sales/:id/restore (voided, < 7d) | 200 ACTIVE | Status not updated |
| 11 | GET /sales paginated | curl GET /api/.../pos/sales?limit=20 | 200 { sales: [], nextCursor, totalCount } | Missing cursor or totalCount |
| 12 | GET /sales cashier scoped | curl GET ... (logged as CASHIER) | Only own sales | Sees all business sales |
| 13 | GET /products search | curl GET /api/.../pos/products?search=biscuit | 200 list matching query | Search not applied |
| 14 | Cash payment → CashEntry | curl POST [cash payment 5000p] → verify CashEntry IN created | CashEntry.amountPaise=5000, referenceType=POS_SALE | CashEntry not created or amount wrong |
| 15 | Walk-in reuse | 2× curl POST [walk-in, no partyId] → same Party.id used | No new Party rows created | Duplicate sentinel Parties created |
| 16 | FEFO batch claim | curl POST [batch-tracked product] → PosSaleItem.batchId set | Batch claimed from earliest-expiry | Wrong batch selected or unclaimed |
| 17 | Receipt counter race | curl 20× parallel checkouts | receiptSeq 1..20, no duplicates | Duplicates or gaps in sequence |

**tsc clean**
```bash
tsc --noEmit
  # Expect: 0 errors
```

**Prisma migrate clean**
```bash
npx prisma migrate status
  # Expect: all migrations applied
```

#### Frontend Proof (Screenshots)

All screenshots at 375px (primary) and 320px (minimum).

| # | Component | State | Screenshot | Check |
|----|-----------|-------|-----------|-------|
| 1 | ProductGrid | Loading | skeleton 4×2 grid | 8 placeholder cards |
| 2 | ProductGrid | Error | "Could not load products" banner | Button visible, no crash |
| 3 | ProductGrid | Empty | "No products found" with CTA | Link to /inventory/products/new |
| 4 | ProductGrid | Success | Grid of 8 products, recently-used-first | Product cards render, name + price visible, stock badge |
| 5 | CartPanel | Empty | "Cart is empty. Tap a product to add." | Large cart icon, text present |
| 6 | CartPanel | With items | 1 item in cart | Qty, amount, remove button visible |
| 7 | CartPanel | With items (multi) | 3+ items in cart | All visible in scrollable list |
| 8 | CartPanel | Checkout error | Inline error banner above button | API error message shown, dismiss option |
| 9 | CartPanel | Success (animated) | Receipt preview opens automatically | ReceiptPreview renders, share bar visible |
| 10 | PaymentSheet | Single mode | "Cash" or "UPI" selected | Amount pre-filled, confirm button enabled |
| 11 | PaymentSheet | Split tender | 2 payment rows (CASH + UPI) | Both modes visible, amounts sum correctly |
| 12 | UpiQrModal | Full-screen | QR code + amount displayed | QR visible, dismiss button |
| 13 | ReceiptPreview | 58mm format | Monospace 32-char layout | Receipt number, customer, items, total, payment all visible, no overflow |
| 14 | ReceiptPreview | 80mm format | Monospace 48-char layout | More whitespace than 58mm, tax rates shown separately |
| 15 | ReceiptPreview | A5 format | PDF portrait layout | Header, table, footer, signature block |
| 16 | ReceiptShareBar | WhatsApp button | Button rendered | Tappable, opens wa.me link (or share sheet on native) |
| 17 | ReceiptShareBar | Print button | Button rendered | Browser print dialog opens |
| 18 | PosHistoryList | Loading | 5× skeleton rows | Placeholders animate |
| 19 | PosHistoryList | Error | "Could not load sales history" | Retry button visible |
| 20 | PosHistoryList | Empty (no sales) | "No POS sales yet" message | CTA present |
| 21 | PosHistoryList | Empty (filters) | "No sales match filters" + "Clear Filters" | Button clears state |
| 22 | PosHistoryList | Success (paginated) | 20 rows visible, load-more button | Cursor pagination works |
| 23 | PosSaleRow | Active | Receipt number, amount, date, mode, status | All fields visible |
| 24 | PosSaleDetailPage | Active | Receipt preview + void button + share bar | Void button enabled |
| 25 | PosSaleDetailPage | Voided | "Sale Voided" red banner + reason + restore button | Void button hidden, restore visible if < 7 days |
| 26 | VoidModal | Empty | Reason field, confirm button disabled | Confirm grayed out |
| 27 | VoidModal | Reason entered | Reason > 3 chars, confirm enabled | Button clickable |
| 28 | VoidModal | Loading | "Voiding..." spinner on button | Button uninteractable |
| 29 | VoidModal | Error | Inline error below reason field | Error message shown |
| 30 | All screens | 320px | No horizontal scroll, text readable | Verify on actual 320px device or Playwright |
| 31 | All screens | 375px | Primary layout | Standard spacing |
| 32 | Console | All pages | No errors/warnings | Dev tools clean |

### Proof Gate (Verifier)

```bash
# Run curl matrix
npm run test:proof-gates curl-matrix.ts
  # All 17 curl tests pass

# Screenshot validation
npm run test:visual pos 375px 320px
  (generates Playwright screenshots)
  # Review: all 32 screenshots visually correct, no layout breaks, no console errors

# tsc + migrate
tsc --noEmit
npx prisma migrate status
```

**Blockers:**
- Any curl test fails (wrong HTTP status, response shape, data missing)
- Any screenshot shows layout break, text overflow, console error
- tsc errors
- Prisma migration not applied

---

## PR15: QA Gate & Approval

**Agent:** QA  
**Effort:** 1 day  
**Owner:** QA Lead (Sawan)

### Scope

Final acceptance checklist (cross-ref SCOPE §18 + ARCHITECTURE §12):

- [ ] All PR proof gates passed (curl matrix + screenshots + tsc)
- [ ] Acceptance criteria met (all checkboxes in SCOPE §18)
- [ ] QA checklist (SCOPE §19) verified:
  - [ ] Product grid loads < 800ms
  - [ ] Barcode scan flow works (camera opens, EAN13 detected)
  - [ ] Search debounce observed (no API call for < 1 char)
  - [ ] Cart persists across page refresh
  - [ ] Concurrent checkouts → sequential receipt numbers
  - [ ] FEFO batch claim uses earliest-expiry
  - [ ] Expired batch policies (WARN_ONLY + HARD_BLOCK) both tested
  - [ ] Oversell policies (WARN_ONLY + HARD_BLOCK) both tested
  - [ ] Cash + UPI split: CashEntry = CASH amount only
  - [ ] Void + restore: stock + CashEntry + Document.status all correct
  - [ ] Walk-in name: shown on receipt, no Party created
  - [ ] B2B party (GSTIN in different state): IGST applied
  - [ ] Receipt 58mm: 32-char width verified
  - [ ] Receipt WhatsApp share: image downloads + opens app
  - [ ] Receipt print: browser dialog + page size correct
  - [ ] POS history filters (date range, payment mode, cashier) work
  - [ ] Offline toast: checkout blocked, cart preserved
  - [ ] All mutations pass `entityType: 'pos_sale'` + `entityLabel: receiptNumber`
  - [ ] No `localStorage` writes for POS data
  - [ ] `scripts/enforce-offline.mjs` passes
  - [ ] All 4 UI states reachable (via Storybook or QA scenario)

### Sign-Off

Once all gates pass and QA approves, sign off on feature:
- Mark status: COMPLETED
- Flip feature flag: `FEATURE_POS=true` for pilot business
- Schedule rollout: full business population (phased if needed)

---

## Timeline

| Phase | Duration | PRs | Owner |
|-------|----------|-----|-------|
| **DB Setup** | 0.5d | PR1 | Backend |
| **Receipt Counter + Walk-in** | 0.8d | PR2–3 | Backend |
| **Checkout Service (core)** | 3d | PR4 | Backend |
| **Query + Void/Restore** | 1.5d | PR5–6 | Backend |
| **Routes + Permissions** | 0.8d | PR7–9 | Backend |
| **Backend Testing & Proof** | 1.5d | — | Verifier |
| **Frontend Components** | 6d | PR10 | Frontend |
| **Receipt PDF** | 2d | PR11 | Frontend |
| **i18n** | 0.5d | PR13 | Frontend |
| **Frontend Testing & Proof** | 1.5d | — | Verifier |
| **Cash Register Integration** | 0.5d | PR12 | Backend |
| **Verifier Proof Gates** | 2d | PR14 | Verifier |
| **QA Final Gate** | 1d | PR15 | QA |
| **Total** | ~17 working days | 15 PRs | Team |

---

## Build Constraints

- ≤ 250 LOC per file (split if growth exceeds 200 during build)
- All API calls via `api()` from `@/lib/api` (no raw `fetch`)
- Mutations pass `entityType: 'pos_sale'`, `entityLabel: receiptNumber`
- No `console.log`, no `: any`, no `/api/api/...`
- BE/FE field name parity locked in API_CONTRACTS.md
- Atomic tx for checkout + void
- React-PDF NOT Puppeteer
- Permissions enforced in service layer (not route middleware alone)
- Feature flag `FEATURE_POS` for frontend rollout (default false)
- Feature flag `CASH_REGISTER_ENABLED` for Cash Register integration (default false, flipped when Cash Register PR lands)

---

## Success Criteria

✓ All curl tests pass (17 scenarios, correct HTTP status + response shape)  
✓ All screenshots pass (32 scenarios, 375px + 320px, console clean, no overflow)  
✓ tsc --noEmit clean (backend + frontend)  
✓ Prisma migrations apply cleanly (no drift)  
✓ Permissions registry includes `pos:*` (read, create, void)  
✓ Cashier role sees own sales only; UI hides void if no permission  
✓ All 4 UI states reachable on every component  
✓ QA sign-off on acceptance criteria (SCOPE §18)  
✓ Verifier re-runs all gates on redo (if any BLOCKERs)  
✓ Postmortem triggered if QA rejects or Redo > 1 (auto-escalation)

