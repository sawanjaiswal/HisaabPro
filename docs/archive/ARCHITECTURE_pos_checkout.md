---
feature: pos-checkout
status: approved
author: architect
created: 2026-05-07T10:32:00Z
phase: 4
issue: "#118"
approver: Sawan
agents_invoked:
  - scope-writer (output: docs/SCOPE_pos_checkout.md)
  - architect (output: docs/ARCHITECTURE_pos_checkout.md)
  - task-manager (output: docs/TASKS_pos_checkout.md)
acceptance:
  backend:
    - tsc --noEmit clean
    - curl POST /api/businesses/:id/pos/sales success path → 201 PosSaleDTO
    - curl POST /api/businesses/:id/pos/sales same X-Idempotency-Key → identical 201
    - curl POST without auth → 401
    - curl POST cross-business id → 403
    - curl POST empty items → 422 EMPTY_CART
    - curl POST payment sum mismatch → 400 PAYMENT_SUM_MISMATCH
    - curl POST oversell HARD_BLOCK → 400 OVERSELL_BLOCKED
    - curl POST /pos/sales/:id/void within 24h → 200 VOIDED + REVERSAL StockMovement
    - curl POST /pos/sales/:id/void after 24h → 400 VOID_WINDOW_EXPIRED
    - curl POST /pos/sales/:id/restore → 200 ACTIVE + new SALE StockMovement
    - curl GET /pos/sales paginated → cursor + totalCount
    - curl GET /pos/sales as CASHIER role → only own sales
    - curl GET /pos/products?search= → cursor list
    - cash payment → CashEntry IN row created with referenceType=POS_SALE (when CASH_REGISTER_ENABLED)
  frontend:
    - screenshots: product grid (loading, error, empty, success) at 375px and 320px
    - screenshots: cart panel (empty, with items, error, success)
    - screenshots: payment sheet, UPI QR modal, split tender
    - screenshots: receipt preview 58mm + 80mm + A5
    - screenshots: history page (loading, empty, list, filtered)
    - screenshots: sale detail (active, voided, restore window)
    - 320px no horizontal overflow
    - tsc --noEmit clean
high_risk_paths_touched:
  - prisma/schema.prisma
  - prisma/migrations/20260507_pos_checkout_additive
  - prisma/migrations/20260508_pos_settings_seed
---

# ARCHITECTURE — POS Billing Mode (Phase 4 #118)

> Companion to `docs/SCOPE_pos_checkout.md`. Locks structure, contracts and
> data flow. Code may not start until task-manager produces gate plan.

---

## 1. Module Map (6-layer feature split, ≤ 250 LOC each)

### Backend (Express + Prisma)

```
src/server/
  routes/
    pos.routes.ts                       — Express router, mounts under /api/businesses/:businessId/pos      (~180 LOC)
  features/pos/
    pos-checkout.service.ts             — atomic checkout tx orchestrator                                   (~240 LOC)
    pos-checkout.pricing.ts             — pure: re-price items from DB, apply discounts, sum guards         (~180 LOC)
    pos-checkout.tax.ts                 — wrapper around tax-calc.utils for POS line + doc aggregation      (~140 LOC)
    pos-checkout.inventory.ts           — FEFO claim + StockMovement append + currentStock decrement         (~200 LOC)
    pos-checkout.cash.ts                — CashEntry IN creator (feature-flagged)                            (~110 LOC)
    pos-checkout.receipt.ts             — PosReceiptCounter SELECT FOR UPDATE + format                       (~120 LOC)
    pos-checkout.idempotency.ts         — IdempotencyLog read/write helper (24h TTL)                        (~90 LOC)
    pos-checkout.walkin.ts              — sentinel walk-in Party get-or-create                              (~80 LOC)
    pos-query.service.ts                — list/get sales, cashier scoping                                   (~190 LOC)
    pos-void.service.ts                 — void/restore: window check + reverse stock + reverse cash         (~220 LOC)
    pos-products.service.ts             — POS-grid optimised products endpoint                              (~170 LOC)
    pos-receipt-share.service.ts        — generate WhatsApp share link / signed payload                     (~120 LOC)
    pos.types.ts                        — shared backend DTOs/contracts                                     (~180 LOC)
    pos.errors.ts                       — error codes + AppError factories                                  (~70 LOC)
    pos.constants.ts                    — VOID_WINDOW_HOURS=24, MAX_CART_ITEMS=200, RECEIPT_PREFIX, FY_START=APR
                                                                                                            (~50 LOC)
    pos.validators.ts                   — zod schemas: CreatePosSaleReq, VoidReq, ListQuery                  (~200 LOC)
  middlewares/
    requireIdempotencyKey.ts            — validates X-Idempotency-Key UUID format                            (~50 LOC)
```

### Frontend (React + TanStack Query + Zustand)

```
src/features/pos/
  PosPage.tsx                            — page shell                                                      (~180 LOC)
  PosHistoryPage.tsx                     — history list page                                               (~150 LOC)
  PosSaleDetailPage.tsx                  — single sale detail                                              (~190 LOC)
  hooks/
    usePosPage.ts                        — orchestrates search, scan, cart, checkout mutation             (~220 LOC)
    usePosHistory.ts                     — cursor pagination, filters                                     (~140 LOC)
    usePosSaleDetail.ts                  — sale query + void/restore                                      (~120 LOC)
    usePosProducts.ts                    — TanStack Query infinite list                                   (~120 LOC)
    usePosCheckout.ts                    — checkout mutation, idempotency key, online guard               (~160 LOC)
  state/
    pos.store.ts                         — Zustand cart store (transient — clears on checkout)            (~180 LOC)
    pos.cart-calc.ts                     — pure recalc fn, paise math                                     (~220 LOC)
  api/
    pos.service.ts                       — api() wrappers (createSale, voidSale, listSales, products)      (~200 LOC)
  types/
    pos.types.ts                         — PosCartItem, PosSaleDTO, PosProductDTO, PaymentSplit            (~200 LOC)
  utils/
    pos.format.ts                        — formatReceiptLine, truncate, paiseToInr                         (~120 LOC)
    pos.constants.ts                     — PAYMENT_MODES, RECEIPT_WIDTHS, MAX_CART_ITEMS                  (~60 LOC)
  components/
    grid/
      ProductGrid.tsx                    — virtualized (TanStack Virtual)                                  (~210 LOC)
      PosProductCard.tsx                                                                                   (~140 LOC)
      ProductSearchBar.tsx               — 300ms debounce + scan trigger                                   (~150 LOC)
      ProductGridStates.tsx              — loading/error/empty branches                                    (~100 LOC)
    cart/
      CartPanel.tsx                                                                                        (~200 LOC)
      CartLineItem.tsx                   — qty stepper, discount, remove                                   (~210 LOC)
      CartTotals.tsx                     — subtotal/discount/tax/grand total                              (~160 LOC)
      CartEmpty.tsx                                                                                        (~70 LOC)
    customer/
      CustomerSelector.tsx               — party autocomplete + walk-in toggle                            (~210 LOC)
      WalkInForm.tsx                                                                                       (~130 LOC)
    payment/
      PaymentSheet.tsx                   — modes + split rows                                              (~230 LOC)
      PaymentModeButton.tsx                                                                                (~80 LOC)
      SplitTenderRow.tsx                                                                                   (~140 LOC)
      UpiQrModal.tsx                     — full-screen QR display                                         (~170 LOC)
    receipt/
      ReceiptPreview.tsx                                                                                   (~190 LOC)
      Receipt58mm.tsx                    — React-PDF 32-char wide                                          (~220 LOC)
      Receipt80mm.tsx                    — React-PDF 48-char wide                                          (~220 LOC)
      ReceiptA5.tsx                      — React-PDF A5 fallback                                           (~230 LOC)
      ReceiptShareBar.tsx                — WhatsApp/Print/Download                                         (~160 LOC)
    void/
      VoidModal.tsx                                                                                        (~170 LOC)
    history/
      PosHistoryList.tsx                                                                                   (~190 LOC)
      PosHistoryFilters.tsx                                                                                (~190 LOC)
      PosSaleRow.tsx                                                                                       (~120 LOC)
```

All files capped at 250 LOC; if a component grows past 200 during build, split children before merging.

---

## 2. DB Schema

### Migration A — `20260507_pos_checkout_additive` (fully additive)

Adds 5 new tables, 1 enum value, 1 boolean column. Zero data backfill.

```prisma
// === New models ===

model PosSale {
  id              String   @id @default(cuid())
  businessId      String
  documentId      String   @unique          // FK to Document(type=POS_SALE)
  receiptNumber   String                    // "POS25-26-00001"
  receiptSeq      Int                       // raw counter for ORDER BY
  financialYear   String                    // "25-26"

  partyId         String?                   // null = walk-in (sentinel Party still exists for Document FK)
  walkInName      String?  @db.VarChar(60)
  walkInPhone     String?  @db.VarChar(15)

  subtotal           Int   @default(0)
  totalDiscount      Int   @default(0)
  totalTaxableValue  Int   @default(0)
  totalCgst          Int   @default(0)
  totalSgst          Int   @default(0)
  totalIgst          Int   @default(0)
  totalCess          Int   @default(0)
  grandTotal         Int   @default(0)

  taxPricingMode  String   @default("EXCLUSIVE") @db.VarChar(20)
  placeOfSupply   String?  @db.VarChar(2)
  supplyType      String   @default("B2C_SMALL") @db.VarChar(20)

  paymentBreakdown Json    @default("[]")  // [{mode, amountPaise, referenceNumber, note}]

  cashierId       String                    // BusinessUser.userId

  status          String   @default("ACTIVE") @db.VarChar(20)  // ACTIVE | VOIDED
  voidedAt        DateTime?
  voidedBy        String?
  voidReason      String?  @db.VarChar(200)
  restoredAt      DateTime?
  restoredBy      String?

  idempotencyKey  String   @unique
  clientId        String?  @unique

  saleDate        DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  business    Business      @relation(fields: [businessId], references: [id], onDelete: Restrict)
  document    Document      @relation(fields: [documentId], references: [id], onDelete: Restrict)
  party       Party?        @relation(fields: [partyId], references: [id], onDelete: SetNull)
  cashier     User          @relation("PosCashier", fields: [cashierId], references: [id], onDelete: Restrict)
  voidUser    User?         @relation("PosVoider",  fields: [voidedBy],  references: [id])
  restoreUser User?         @relation("PosRestorer",fields: [restoredBy],references: [id])
  items       PosSaleItem[]
  events      PosSaleEvent[]

  @@unique([businessId, receiptNumber])
  @@index([businessId, saleDate])
  @@index([businessId, status])
  @@index([businessId, cashierId])
  @@index([businessId, partyId])
  @@index([businessId, financialYear, receiptSeq])
}

model PosSaleItem {
  id           String  @id @default(cuid())
  posSaleId    String
  sortOrder    Int     @default(0)

  productId    String
  productName  String  @db.VarChar(200)
  sku          String? @db.VarChar(60)
  hsnCode      String? @db.VarChar(10)
  unitSymbol   String  @db.VarChar(20)

  quantity     Float
  ratePaise    Int
  discountType  String @default("AMOUNT") @db.VarChar(20)
  discountValue Int   @default(0)
  discountAmount Int  @default(0)
  lineTotal    Int    @default(0)

  taxableValue Int    @default(0)
  cgstRate     Int    @default(0)
  cgstAmount   Int    @default(0)
  sgstRate     Int    @default(0)
  sgstAmount   Int    @default(0)
  igstRate     Int    @default(0)
  igstAmount   Int    @default(0)
  cessRate     Int    @default(0)
  cessAmount   Int    @default(0)

  batchId      String?
  batchNumber  String? @db.VarChar(60)
  godownId     String?

  note         String? @db.VarChar(120)

  posSale  PosSale  @relation(fields: [posSaleId], references: [id], onDelete: Cascade)
  product  Product  @relation(fields: [productId], references: [id], onDelete: Restrict)
  batch    Batch?   @relation(fields: [batchId],   references: [id], onDelete: SetNull)
  godown   Godown?  @relation(fields: [godownId],  references: [id], onDelete: SetNull)

  @@index([posSaleId])
  @@index([productId])
  @@index([batchId])
}

model PosReceiptCounter {
  id            String  @id @default(cuid())
  businessId    String
  financialYear String                       // "25-26"
  prefix        String  @default("POS")
  separator     String  @default("-")
  paddingDigits Int     @default(5)
  lastNumber    Int     @default(0)
  updatedAt     DateTime @updatedAt

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@unique([businessId, financialYear])
  @@index([businessId])
}

model PosSaleEvent {
  id        String   @id @default(cuid())
  posSaleId String
  type      String   @db.VarChar(40)         // CREATED | VOIDED | RESTORED | RECEIPT_SHARED
  actorId   String?
  payload   Json?
  createdAt DateTime @default(now())

  posSale PosSale @relation(fields: [posSaleId], references: [id], onDelete: Cascade)

  @@index([posSaleId, createdAt])
  @@index([posSaleId, type])
}

model PosSetting {
  id                      String   @id @default(cuid())
  businessId              String   @unique
  receiptPrefix           String   @default("POS")
  receiptSeparator        String   @default("-")
  receiptPaddingDigits    Int      @default(5)
  defaultPaymentMode      String   @default("CASH") @db.VarChar(20)
  voidWindowHours         Int      @default(24)
  defaultThermalWidth     String   @default("58MM") @db.VarChar(8)
  autoShareOnCheckout     Boolean  @default(false)
  autoShareChannel        String   @default("WHATSAPP") @db.VarChar(20)
  showProfitOnGrid        Boolean  @default(false)
  cashierMustSelectParty  Boolean  @default(false)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
}

// === Mutations to existing models (additive only) ===

// Document.status — ADD enum value `VOIDED` (Document.status is a String today; if @db.VarChar
// no migration needed — application enum widened. If a Postgres enum exists, ALTER TYPE … ADD VALUE.)
// → see raw SQL below.

// Party model — add isWalkIn boolean
//   isWalkIn Boolean @default(false)
//   @@index([businessId, isWalkIn])  // partial unique enforced via raw SQL: WHERE isWalkIn = true
```

Raw SQL appended to migration A:

```sql
-- Document.status — widen application enum. If using Postgres enum:
-- ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'VOIDED';
-- (If string column, no DDL needed.)

-- Walk-in sentinel uniqueness per business
CREATE UNIQUE INDEX IF NOT EXISTS "Party_business_walkin_singleton_idx"
  ON "Party" ("businessId") WHERE "isWalkIn" = true;
```

### Migration B — `20260508_pos_settings_seed` (data)

```sql
-- Seed PosSetting for every existing Business with defaults
INSERT INTO "PosSetting" ("id","businessId","createdAt","updatedAt")
SELECT
  'pst_' || encode(gen_random_bytes(12), 'hex'),
  b."id",
  NOW(),
  NOW()
FROM "Business" b
LEFT JOIN "PosSetting" ps ON ps."businessId" = b."id"
WHERE ps."id" IS NULL;
```

Walk-in Party seeding is **lazy** (created on first walk-in checkout via
`pos-checkout.walkin.ts:getOrCreateWalkInParty`) — avoids 5K-row backfill
and keeps the migration fast/reversible.

---

## 3. Service Layer

### `pos-checkout.service.ts` — atomic checkout

```ts
export async function createPosSale(
  ctx: BusinessCtx,
  req: CreatePosSaleReq,
  idempotencyKey: string,
): Promise<PosSaleDTO> {
  // 1. Idempotency check (read-only outside tx)
  const cached = await idempotency.lookup(ctx.businessId, idempotencyKey)
  if (cached) return cached.response as PosSaleDTO

  // 2. Validate cart non-empty, payment mode whitelist, MAX_CART_ITEMS
  validateRequestShape(req)

  return prisma.$transaction(async (tx) => {
    // 3. Resolve products from DB (server-authoritative pricing)
    const priced = await pricing.repriceItems(tx, ctx.businessId, req.items)

    // 4. Resolve party / walk-in sentinel
    const { partyId, partyForDocument, placeOfSupply } =
      await walkin.resolveParty(tx, ctx, req)

    // 5. Tax calculation (uses tax-calc.utils.ts)
    const taxed = posTax.calculateDocument(priced, {
      businessStateCode: ctx.business.stateCode,
      placeOfSupply,
      taxPricingMode: req.taxPricingMode ?? ctx.business.defaultTaxPricingMode,
      partyHasGstin: !!partyForDocument.gstin,
    })

    // 6. Sanity guards
    guards.assertGrandTotalDriftBelow(taxed.grandTotal, req.clientGrandTotal)
    guards.assertPaymentSumEqualsGrandTotal(req.payments, taxed.grandTotal)
    guards.assertDiscountNotExceedsLine(taxed.lines)
    guards.assertGrandTotalPositive(taxed.grandTotal)

    // 7. Inventory: FEFO claim + StockMovement (within tx)
    const claimed = await inventoryHandler.claimAndMove(tx, ctx, taxed.lines, {
      oversellPolicy: ctx.posSetting.oversellPolicy ?? ctx.inventorySetting.stockValidationMode,
      saleReferenceType: 'POS_SALE',
    })

    // 8. Receipt counter — SELECT FOR UPDATE on PosReceiptCounter row
    const { receiptNumber, receiptSeq, financialYear } =
      await receipt.allocateNumber(tx, ctx.businessId, ctx.posSetting)

    // 9. Create Document (type=POS_SALE) + lines
    const document = await documentService.createPosDocument(tx, {
      ...taxed,
      partyId: partyForDocument.id,
      placeOfSupply,
      receiptNumber,
    })

    // 10. Create PosSale + PosSaleItem rows
    const posSale = await tx.posSale.create({
      data: {
        businessId: ctx.businessId,
        documentId: document.id,
        receiptNumber,
        receiptSeq,
        financialYear,
        partyId,
        walkInName: req.walkInName ?? null,
        walkInPhone: req.walkInPhone ?? null,
        ...mapTotals(taxed),
        taxPricingMode: taxed.taxPricingMode,
        placeOfSupply,
        supplyType: taxed.supplyType,
        paymentBreakdown: req.payments,
        cashierId: ctx.userId,
        idempotencyKey,
        clientId: req.clientId ?? null,
        saleDate: req.saleDate ? new Date(req.saleDate) : new Date(),
        items: { create: mapItems(taxed.lines, claimed) },
      },
      include: defaultInclude,
    })

    // 11. CashEntry (feature-flagged)
    if (env.CASH_REGISTER_ENABLED) {
      await cash.createCashEntryForPosSale(tx, ctx, posSale, req.payments)
    }

    // 12. Audit
    await tx.posSaleEvent.create({
      data: { posSaleId: posSale.id, type: 'CREATED', actorId: ctx.userId },
    })

    const dto = toPosSaleDTO(posSale)

    // 13. Idempotency persist (inside tx)
    await idempotency.store(tx, ctx.businessId, idempotencyKey, dto)

    return dto
  }, { isolationLevel: 'Serializable', maxWait: 5000, timeout: 15000 })
}
```

### `pos-query.service.ts` — list/get with cashier scoping

```ts
export async function listPosSales(
  ctx: BusinessCtx,
  query: ListPosSalesQuery,
): Promise<{ sales: PosSaleDTO[]; nextCursor: string | null; totalCount: number }> {
  const where: Prisma.PosSaleWhereInput = {
    businessId: ctx.businessId,
    ...(query.from && { saleDate: { gte: new Date(query.from) } }),
    ...(query.to   && { saleDate: { ...((query.from && { gte: new Date(query.from) }) || {}), lte: endOfDay(query.to) } }),
    ...(query.status        && { status: query.status }),
    ...(query.cashierId     && { cashierId: query.cashierId }),
    ...(query.paymentMode   && { paymentBreakdown: { array_contains: [{ mode: query.paymentMode }] } }),
    ...(query.search        && { OR: [
      { receiptNumber: { contains: query.search, mode: 'insensitive' } },
      { party: { name: { contains: query.search, mode: 'insensitive' } } },
      { walkInName: { contains: query.search, mode: 'insensitive' } },
    ] }),
    // CASHIER scope: see only own sales
    ...(ctx.role === 'CASHIER' && { cashierId: ctx.userId }),
  }

  const [sales, totalCount] = await Promise.all([
    prisma.posSale.findMany({
      where,
      take: (query.limit ?? 20) + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      orderBy: [{ saleDate: 'desc' }, { id: 'desc' }],
      include: defaultInclude,
    }),
    prisma.posSale.count({ where }),
  ])

  const nextCursor = sales.length > (query.limit ?? 20) ? sales.pop()!.id : null
  return { sales: sales.map(toPosSaleDTO), nextCursor, totalCount }
}
```

### `pos-void.service.ts` — void / restore

```ts
export async function voidPosSale(
  ctx: BusinessCtx, posSaleId: string, reason: string,
): Promise<{ id: string; status: 'VOIDED'; voidedAt: string; voidReason: string }> {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.posSale.findFirst({
      where: { id: posSaleId, businessId: ctx.businessId },
      include: { items: true },
    })
    if (!sale) throw new AppError('NOT_FOUND', 404)
    if (sale.status === 'VOIDED') throw new AppError('ALREADY_VOIDED', 400)

    // Window check — uses PosSetting.voidWindowHours (default 24)
    const windowHours = ctx.posSetting.voidWindowHours
    const ageHours = (Date.now() - sale.createdAt.getTime()) / 3_600_000
    if (ageHours > windowHours) throw new AppError('VOID_WINDOW_EXPIRED', 400)

    // Reverse stock — REVERSAL StockMovement, increment Product/Batch.currentStock
    await inventoryHandler.reverseSale(tx, ctx, sale)

    // Reverse linked CashEntry (feature-flagged)
    if (env.CASH_REGISTER_ENABLED) {
      await cash.voidCashEntryForPosSale(tx, sale.id)
    }

    // Mark Document VOIDED
    await tx.document.update({ where: { id: sale.documentId }, data: { status: 'VOIDED' } })

    const updated = await tx.posSale.update({
      where: { id: sale.id },
      data: { status: 'VOIDED', voidedAt: new Date(), voidedBy: ctx.userId, voidReason: reason },
    })

    await tx.posSaleEvent.create({
      data: { posSaleId: sale.id, type: 'VOIDED', actorId: ctx.userId, payload: { reason } },
    })

    return { id: sale.id, status: 'VOIDED', voidedAt: updated.voidedAt!.toISOString(), voidReason: reason }
  })
}
```

`restorePosSale` mirrors `voidPosSale`: re-applies stock decrement (re-uses
oversell policy), un-voids CashEntry, sets Document.status back to its
prior state (`SAVED`), appends `RESTORED` event.

---

## 4. Route Layer

```ts
// src/server/routes/pos.routes.ts
const r = Router({ mergeParams: true })
r.use(requireAuth, requireBusinessAccess)

r.post('/sales',
  requireIdempotencyKey,
  rateLimit({ windowMs: 60_000, max: 60, key: 'pos:create' }),
  requirePermission('pos:create'),
  validate(createPosSaleSchema),
  asyncHandler(async (req, res) => {
    const dto = await checkout.createPosSale(req.ctx, req.body, req.header('X-Idempotency-Key')!)
    res.status(201).json({ success: true, data: dto })
  }),
)

r.get('/sales',
  requirePermission('pos:read'),
  validate(listPosSalesSchema, 'query'),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await query.listPosSales(req.ctx, req.query) })
  }),
)

r.get('/sales/:id', requirePermission('pos:read'),
  asyncHandler(async (req, res) => {
    const dto = await query.getPosSale(req.ctx, req.params.id)
    res.json({ success: true, data: dto })
  }),
)

r.post('/sales/:id/void',
  rateLimit({ windowMs: 60_000, max: 30, key: 'pos:void' }),
  requirePermission('pos:void'),
  validate(voidSchema),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await voidSvc.voidPosSale(req.ctx, req.params.id, req.body.reason) })
  }),
)

r.post('/sales/:id/restore',
  requirePermission('pos:void'),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await voidSvc.restorePosSale(req.ctx, req.params.id) })
  }),
)

r.get('/products',
  rateLimit({ windowMs: 60_000, max: 120, key: 'pos:products' }),
  requirePermission('pos:read'),
  validate(posProductsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await products.list(req.ctx, req.query) })
  }),
)

r.post('/receipt/:id/share',
  requirePermission('pos:read'),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await shareSvc.buildShareLink(req.ctx, req.params.id, req.body) })
  }),
)

export default r
```

Mounted at `/api/businesses/:businessId/pos` in `app.ts`.

---

## 5. Tax Integration

Flow handled in `pos-checkout.tax.ts`, delegating to existing
`src/server/lib/tax-calc.utils.ts` (no fork):

1. Resolve `placeOfSupply`:
   - explicit override > `party.stateCode` (for B2B with GSTIN) > `business.stateCode` (walk-in / unregistered).
2. `interState = isInterState(business.stateCode, placeOfSupply)`.
3. `supplyType` = `B2B` when `party.gstin` set, else `B2C_SMALL`.
4. For `taxPricingMode='INCLUSIVE'`: per-line `backCalculateInclusive` → taxable + tax components.
5. Per-line `calculateLineTax(input, interState)` → CGST/SGST or IGST.
6. `calculateDocumentTax(lines)` → totals, written to PosSale + Document.
7. Walk-in place-of-supply = `business.stateCode` → intra-state → CGST+SGST.

Server is authoritative; client sends `clientGrandTotal` only for drift sanity (>100 paise = 400).

---

## 6. Inventory Integration

Inside the same Prisma `$transaction`:

```
for each priced line:
  if product.batchTracked:
    if request.batchId provided:
      validate batch.productId === productId, !expired (per business policy), batch.currentStock >= qty
    else:
      claim = claimBatchesFEFO(tx, productId, qty, godownId)
      if !claim.fully_claimed:
        if oversellPolicy === HARD_BLOCK → throw OVERSELL_BLOCKED
        if oversellPolicy === WARN_ONLY  → claim allowed; warning collected
  movement = tx.stockMovement.create({
    type: 'SALE',
    quantity: -qty,
    referenceType: 'POS_SALE',
    referenceId: posSaleId,
    referenceNumber: receiptNumber,
    batchId, godownId,
    balanceAfter: product.currentStock - qty,
  })
  tx.product.update({ where: { id }, data: { currentStock: { decrement: qty } } })
  if batch: tx.batch.update({ where: { id: batchId }, data: { currentStock: { decrement: qty } } })
```

Reverse on void: same shape with `type: 'SALE_REVERSAL'`, positive qty,
re-increment Product + Batch. `claimBatchesFEFO` is reused from inventory
phase 2.2 (`src/server/features/inventory/fefo.service.ts`).

---

## 7. Cash Register Integration (feature-flagged)

```ts
// src/server/features/pos/pos-checkout.cash.ts
export async function createCashEntryForPosSale(
  tx: PrismaTx, ctx: BusinessCtx, posSale: PosSale, payments: PaymentSplit[],
) {
  if (!env.CASH_REGISTER_ENABLED) return     // no-op until Cash Register ships
  const cashAmount = sumWhere(payments, p => p.mode === 'CASH')
  if (cashAmount <= 0) return
  await tx.cashEntry.create({
    data: {
      businessId: ctx.businessId,
      direction: 'IN',
      amountPaise: cashAmount,
      referenceType: 'POS_SALE',
      referenceId:   posSale.id,
      referenceNumber: posSale.receiptNumber,
      note: `POS Cash: ${posSale.walkInName ?? posSale.party?.name ?? 'Walk-in'}`,
      cashierId: posSale.cashierId,
      entryDate: posSale.saleDate,
    },
  })
}

export async function voidCashEntryForPosSale(tx: PrismaTx, posSaleId: string) {
  if (!env.CASH_REGISTER_ENABLED) return
  await tx.cashEntry.updateMany({
    where: { referenceType: 'POS_SALE', referenceId: posSaleId, isVoided: false },
    data:  { isVoided: true, voidedAt: new Date() },
  })
}
```

Flag lives in `src/server/lib/env.ts`. Default `false`. Production
flips to `true` once Cash Register PR lands and migration adds
`CashEntry.referenceType/referenceId/isVoided`.

---

## 8. Frontend Tree & State

### State strategy

| Concern                      | Tool                  | Persistence         | Rationale |
|------------------------------|-----------------------|---------------------|-----------|
| Cart (lines, customer, mode) | Zustand (`pos.store`) | transient — clears on checkout success / explicit reset | Avoid IDB stale-cart leaking into next sale; matches scope decision |
| Cart hold (offline draft)    | sessionStorage key    | session only        | Survive accidental tab refresh; cleared on logout |
| Products list                | TanStack Query        | RAM, 5 min stale    | Cursor-paginated, search-keyed |
| Sales history                | TanStack Query        | RAM, 30 sec stale   | Refetched on filter change |
| Sale detail                  | TanStack Query        | RAM                 | Invalidated on void/restore |
| Idempotency key              | `useRef<string>` per checkout attempt | RAM | Regenerated on cart reset |

### Data flow (checkout)

```
PosPage
  ├─ usePosProducts (TQ infinite)
  ├─ pos.store (Zustand cart)
  ├─ usePosCheckout
  │     ├─ guard: navigator.onLine === true (else toast offline)
  │     ├─ build CreatePosSaleReq from pos.store
  │     ├─ idempotencyKey = uuid() (stable per attempt)
  │     ├─ api('/pos/sales', { method:'POST', headers:{'X-Idempotency-Key':k},
  │     │     entityType:'pos_sale', entityLabel: <client receipt placeholder> })
  │     ├─ on success → invalidate ['pos','sales'] + ['pos','products'] + ['inventory','products']
  │     │              → pos.store.reset()
  │     │              → open ReceiptPreview with returned PosSaleDTO
  │     └─ on error → setError(banner); preserve cart
  └─ PaymentSheet → CartTotals → ReceiptPreview
```

Mutation handler tolerates the `{}` optimistic return from `api()`:
checkout is online-only (guarded), so `api()` will not queue. The
guard short-circuits before `api()` is called when offline.

---

## 9. Receipt PDF

- React-PDF (`@react-pdf/renderer`) — same lib as invoice PDF.
- `Receipt58mm.tsx` page size: 58mm × auto, monospace, font-size 8pt, line-height 10pt, 32-char measure.
- `Receipt80mm.tsx` page size: 80mm × auto, font-size 9pt, 48-char measure.
- `ReceiptA5.tsx` page size: A5 portrait, 14pt body.
- Image export for WhatsApp: reuse `src/lib/useImageExport.ts` (Capacitor-aware: native share on Android/iOS, `wa.me/?text=` fallback on web).
- Layout primitives shared in `receipt/RecieptPrimitives.tsx` (Divider, Row, Money, Truncate).

---

## 10. Edge Cases (cross-ref scope §11)

All preserved as-is — explicit handling locked in service guards
(`pos-checkout.service.ts` step 6, `inventoryHandler.claimAndMove`,
`cash.createCashEntryForPosSale`). Backdating: gated by
`PosSetting.allowBackdating` (out of MVP, default false; field reserved).

---

## 11. Test Strategy

### Unit

- `pos-checkout.pricing.test.ts` — re-price drift, discount-exceeds-line, percentage discount math.
- `pos-checkout.tax.test.ts` — intra/inter state, walk-in, inclusive ↔ exclusive equivalence.
- `pos.cart-calc.test.ts` (frontend) — paise math, % discount edge cases, empty cart.
- `pos-checkout.receipt.test.ts` — counter increments, FY rollover (Apr 1), prefix override.

### Integration (supertest + test DB)

- `pos-checkout.create.spec.ts` — happy path, idempotency replay, payment sum mismatch, oversell HARD_BLOCK / WARN_ONLY, walk-in party creation lazy.
- `pos-void.spec.ts` — void within window, void after window, restore, cash reversal.
- `pos-query.spec.ts` — cashier role scoping, date filters, payment-mode JSON filter.

### Concurrency

- `pos-receipt-counter.concurrency.spec.ts` — 20 parallel checkouts → sequential receiptSeq, no duplicates (asserts `SELECT FOR UPDATE` correctness).

### E2E (Playwright on Capacitor web)

- 320px and 375px screenshot pass.
- Barcode scan path mocked.
- Offline guard path: toast + cart preserved.

---

## 12. Risk Register

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| R1 | Receipt counter race under concurrent cashiers | Duplicate receipt numbers | `SELECT … FOR UPDATE` on PosReceiptCounter row inside tx; serializable isolation. Concurrency spec test gates merge. |
| R2 | Document.status enum widening breaks GSTR-1 export | GST mis-reports | GSTR-1 pipeline already filters `status IN ('SAVED','SHARED')`; voided sales drop out automatically. Add explicit guard in gstr1-export.service.ts. |
| R3 | Walk-in sentinel created concurrently → unique violation | First two walk-ins on a fresh business race | Unique partial index `WHERE isWalkIn=true` + retry-on-conflict in `getOrCreateWalkInParty`. |
| R4 | Cash Register feature flag flipped before migration runs | CashEntry insert errors | `cash.createCashEntryForPosSale` checks for column presence via Prisma client model existence; flag flip blocked by deploy gate until Cash Register migration is applied. |
| R5 | FEFO claim partial fulfilment under WARN_ONLY | Negative stock + lost margin | StockAlert auto-created (existing inventory phase 2.2 path); Dashboard tile to surface. |
| R6 | TanStack Virtual cell measurement on 320px janks scroll | Bad UX on cheap phones | Fixed cell size (140×164), no measurement; benchmark on Pixel 4a in QA. |
| R7 | Idempotency key replayed across businessId | Cross-tenant leak | Idempotency key scoped by `(businessId, key)` composite uniqueness — never global. |
| R8 | Void window overflow when business clock skewed | Voids permitted past window | Use server `Date.now()` always; never trust client timestamp. |
| R9 | React-PDF font-loading on offline-first build | Receipt blank on first run | Bundle Inter + a monospace font in `public/fonts`; preload in receipt component. |
| R10 | `paymentBreakdown` JSON queries slow on history filter | History page latency | Filter by mode rare; fall back to GIN on JSONB if p95 > 200ms in prod. |

---

## 13. Open Items Resolved (vs scope §20)

| # | Scope question | Locked answer |
|---|----------------|---------------|
| 1 | oversellPolicy override | `PosSetting.oversellPolicy` is **omitted** from MVP; reuse `InventorySetting.stockValidationMode` directly (per locked decision). Field can be added later if needed. |
| 2 | Void window | 24h hard default; configurable via `PosSetting.voidWindowHours`. |
| 3 | Document status on void | New enum value `VOIDED` (not DELETED). |
| 4 | Cash Register timing | Feature flag `CASH_REGISTER_ENABLED`; no-op when off. |
| 5 | Walk-in seeding | Lazy per-business on first walk-in checkout; no migration backfill. |
| 6 | Receipt QR | Out of MVP. |
| 7 | POS vs invoice numbering | Separate `PosReceiptCounter`; never touches DocumentNumberSeries. |
| 8 | GSTR-1 B2CS aggregation | Handled downstream by GSTR-1 pipeline; no POS code. |
| 9 | Cashier history visibility | Cashier sees own only; Owner/Manager see all. Service-layer scope. |
| 10 | Void reason | Required, min 3 chars. Confirmed. |

---

## 14. Sequencing for Build

1. Migration A (additive) deployed.
2. Migration B (PosSetting seed) deployed.
3. Backend services + routes + tests green.
4. Frontend behind `FEATURE_POS` flag.
5. QA on staging w/ CASH_REGISTER_ENABLED=false.
6. Flip `FEATURE_POS=true` for pilot business.
7. After Cash Register PR merges, flip `CASH_REGISTER_ENABLED=true` and run reconciliation script.

---

End of architecture.
