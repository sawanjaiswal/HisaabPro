---
feature: pos-checkout
status: draft
author: scope-writer
created: 2026-05-07T00:00:00Z
phase: 4
issue: "#118"
effort: M (2–3 weeks)
---

# SCOPE — POS Billing Mode (Phase 4 #118)

## 1. Summary

Fast-path retail checkout screen for kirana counters and wholesale showrooms.
Cashier taps/scans products into a cart, selects payment mode (cash/UPI/card/split),
and confirms — producing a SALE_INVOICE Document, decrementing stock via existing
FEFO logic, and (for cash sales) auto-creating a CashEntry IN. A 58mm/80mm
thermal receipt or WhatsApp image is shared on the spot.

---

## 2. Goals and Non-Goals

### Goals

- Searchable, swipeable product grid with recently-used-first ordering and barcode-scan input
- Cart with qty edit, amount-mode toggle, per-line discount, and line note
- Customer lookup: autocomplete existing Party OR walk-in (free-form name + optional phone)
- GST-aware: auto-apply per-product TaxCategory; inclusive/exclusive toggle; place-of-supply derived from party state (walk-in defaults to business's home state)
- Payment modes: Cash, UPI (QR code display), Card (manual ref), Bank Transfer, Mixed / split tender
- Receipt: 58mm thermal (32-char), 80mm thermal (48-char), A5 PDF fallback; image export for WhatsApp share; browser print
- Sequential receipt numbering: per-business, per-FY, configurable prefix (default `POS-`)
- Soft-void with reason, restore, full audit trail via PosSaleEvent
- Sales history: cursor-paginated POS list, filter by date range / cashier / payment mode
- Idempotent checkout: `X-Idempotency-Key` header guards double-tap save
- Server-authoritative totals (client sends cart; server re-prices from DB, returns canonical total)
- Inventory integration: POS save decrements stock, FEFO batch claim for batch-tracked products, atomic with sale create
- Cash Register integration: cash payment auto-creates CashEntry IN with `referenceType: 'POS_SALE'` and `referenceId: posSale.id`
- Multi-tenant: every query and write scoped by `businessId`
- English + Hindi i18n
- Offline: cart edits are offline-safe (IDB store); checkout itself requires connectivity (confirmed total must round-trip the server)

### Non-Goals (explicitly excluded)

- Barcode generation / label printing — separate feature #105
- Cash drawer hardware control (RJ11/USB impulse) — deferred
- Returns / refund flow in this scope — separate ticket; void is the short-term path
- Purchase POS (inward fast-scan) — separate feature
- Multi-location / multi-cashier session locking
- Loyalty points / rewards program
- Customer-facing display (second screen)
- Online ordering / delivery integration
- EMI / BNPL payment modes
- Automatic e-invoice generation for POS B2B sales (may follow; out of scope here)
- Automatic e-way bill on POS sales

---

## 3. Architecture Decision: Separate `PosSale` vs Reuse `Document`

### Option A — Reuse Document with type `POS_SALE`

**Pros:**
- All existing invoice plumbing (tax engine, payment allocations, share logs, document number series, recurring, PDF pipeline) works immediately
- Party required FK already exists; walk-in handled by a WALK_IN sentinel party per business
- Single model for all reports, day book, GSTR-1 auto-inclusion
- No new DB relations needed for PaymentAllocation

**Cons:**
- `Document.partyId` is `NOT NULL` — need WALK_IN sentinel party (one per business, pre-seeded on business creation)
- POS-specific fields (cashierId, receiptNumber, paymentBreakdown JSON, voidReason, voided status) would need new columns on Document, which adds weight to an already wide model
- History and void flows diverge from the normal Document status machine (DRAFT → SAVED → SHARED)
- Cart-hold state (items being added but not yet confirmed) doesn't fit Document DRAFT well — it would pollute the invoice list

### Option B — Separate `PosSale` model with FK → Document

**Pros:**
- Clean separation: cart-in-progress lives entirely in frontend IDB until checkout; confirmed sale creates ONE atomic PosSale + Document pair
- POS-specific columns (cashierId, receiptNumber, paymentBreakdown, voidedAt, voidReason) are on PosSale without polluting Document
- PosSale.documentId FK means the Document (type = POS_SALE) is the accounting record; PosSale carries the POS-operational metadata
- Void logic: soft-void PosSale, auto-void / reverse the linked Document
- History query is on a smaller, indexed table; the Document is the authoritative invoice

**Cons:**
- Two models to write atomically (use Prisma transaction)
- Slight duplication of line items if stored in both (mitigation: PosSaleItem references DocumentLineItem by FK rather than duplicating)

### Decision: Option B — PosSale + linked Document (type = POS_SALE)

**Rationale:** POS sale is operationally different from an invoice; the cart state, cashier identity, receipt counter, payment breakdown, and void model are distinct enough to warrant a dedicated model. The Document (type = POS_SALE) is created atomically on checkout and serves as the accounting/tax record that flows into GSTR-1 and day book. PosSaleItem stores POS-specific snapshots (price at time of sale, batch claimed) and references the same DocumentLineItem by FK to avoid duplication.

Walk-in customers: use a per-business sentinel Party with name `"Walk-in Customer"` and `type = "CUSTOMER"`. The `walkInName` and `walkInPhone` are stored on PosSale for receipt display; they are NOT written to the Party table. If the user later wants to assign the sale to a real party, that is an out-of-scope operation.

---

## 4. User Stories

### Raju — Micro-retailer kirana counter

- "I tap Biscuit Pack from the grid, change qty to 3, tap Maggi + 2. Total Rs 58. Tap 'Cash'. Done in 8 seconds."
- "Customer scans their own phone for UPI. I tap UPI, QR pops up, they scan, I confirm. Receipt WhatsApp'd."
- "Wrong item added. I long-press the item in cart to remove it."
- "End of day I check POS history to see how many bills I made and total collection."

### Priya — Growing wholesaler showroom

- "Customer is a known party — Ravi Traders. I type 'Ravi' in customer search, pick them from dropdown. Their GSTIN auto-fills. B2B invoice gets proper CGST/SGST."
- "Walk-in customer pays Rs 500 cash + Rs 300 UPI. I tap 'Split', enter amounts, confirm."
- "My staff made a billing mistake. I void the sale with reason 'wrong product'. Stock is restored automatically."
- "I want to see all UPI collections for today to match with bank statement."

---

## 5. UI Surface

### Routes

| Route | Component | Description |
|---|---|---|
| `/pos` | `PosPage` | Main POS screen |
| `/pos/history` | `PosHistoryPage` | Sales history list |
| `/pos/sales/:id` | `PosSaleDetailPage` | Single sale detail + receipt |

### Component Tree (6-layer split, 250 LOC cap each)

```
src/features/pos/
  PosPage.tsx                    — page shell: product grid + cart panel layout
  PosHistoryPage.tsx             — history list page
  PosSaleDetailPage.tsx          — single sale detail page
  usePosPage.ts                  — page-level orchestration: search, barcode, cart ref, checkout mutation
  usePosHistory.ts               — cursor pagination, filters
  usePosSaleDetail.ts            — single sale query + void/restore mutations
  pos.types.ts                   — PosCartItem, PosPaymentSplit, PosSaleDTO, PosProductDTO, etc.
  pos.constants.ts               — PAYMENT_MODES, RECEIPT_WIDTHS, MAX_CART_ITEMS (200)
  pos.utils.ts                   — formatReceiptLine, buildCartTotals, deriveInterState, etc.
  pos.store.ts                   — Zustand: cart state (persisted to IDB)
  pos.cart-calc.ts               — pure fn: recalc cart totals from items + tax inputs (paise math)
  pos.service.ts                 — api() wrappers: createSale, voidSale, restoreSale, listSales
  components/
    ProductGrid.tsx              — virtualized grid of PosProductCard
    PosProductCard.tsx           — product tile: image, name, price chip, stock badge
    ProductSearchBar.tsx         — debounced search + barcode-scan button
    CartPanel.tsx                — scrollable cart items + totals footer
    CartLineItem.tsx             — single line: qty stepper, amount, discount, remove
    CartTotals.tsx               — subtotal, discount, tax breakdown, grand total
    CustomerSelector.tsx         — party autocomplete + walk-in toggle
    PaymentSheet.tsx             — bottom sheet: mode selector + split tender inputs
    UpiQrModal.tsx               — full-screen QR display with amount
    ReceiptPreview.tsx           — React-PDF 58mm/80mm/A5 preview
    ReceiptShareBar.tsx          — WhatsApp, Print, Download actions
    VoidModal.tsx                — confirm dialog with required reason field
    PosHistoryList.tsx           — virtualized cursor-paginated sale list
    PosHistoryFilters.tsx        — date range + cashier + payment mode filters
    PosSaleRow.tsx               — single history row: receipt no, amount, mode, status
```

### 4 UI States — all components

#### PosPage / ProductGrid

| State | Spec |
|---|---|
| Loading | Skeleton grid: 8 product card placeholders (4×2) |
| Error | "Could not load products. Tap to retry." — full-width card with retry button |
| Empty | "No products found. Add products in Inventory." with CTA → `/inventory/products/new` |
| Success | Virtualized grid, recently-used-first ordering |

#### CartPanel

| State | Spec |
|---|---|
| Loading | Not applicable — cart is local IDB state, always instant |
| Error | Checkout error displayed as inline banner above CTA: exact server error message |
| Empty | "Cart is empty. Tap a product to add." with large cart icon, 60px empty state illustration |
| Success | Confirm animation; cart clears; receipt preview opens automatically |

#### PaymentSheet

| State | Spec |
|---|---|
| Loading | "Saving..." spinner on confirm button; sheet uninteractable |
| Error | Inline error below confirm button: exact API message |
| Empty | Mode buttons shown; amount pre-filled from cart total |
| Success | Sheet closes; receipt preview opens |

#### PosHistoryPage / PosHistoryList

| State | Spec |
|---|---|
| Loading | 5 × PosSaleRow skeleton |
| Error | "Could not load sales history. Tap to retry." |
| Empty — no sales ever | "No POS sales yet. Start billing to see your sales here." |
| Empty — filters active | "No sales match the selected filters." + "Clear Filters" button |
| Success | Cursor-paginated list; load-more button at bottom |

#### PosSaleDetailPage

| State | Spec |
|---|---|
| Loading | Skeleton receipt card |
| Error | "Could not load sale details. Tap to retry." |
| Voided | "Sale Voided" banner (red), reason shown, restore button visible if within 7 days |
| Success | Receipt preview, share bar, void button |

#### VoidModal

| State | Spec |
|---|---|
| Loading | "Voiding..." spinner on confirm button |
| Error | Inline error below reason field |
| Empty | Reason field empty; confirm disabled until reason ≥ 3 chars |
| Success | Modal closes, PosSaleDetailPage updates, toast fires |

---

## 6. API Contract

Base: `/api/businesses/:businessId/pos`

Auth: `requireAuth` + `requireBusinessAccess` on all. Permission `pos:create` to checkout; `pos:void` to void/restore; `pos:read` to view history.

### POST /api/businesses/:businessId/pos/sales

Idempotency: `X-Idempotency-Key` header (client-generated UUID). Server stores in `IdempotencyLog` with 24h TTL. Duplicate key within TTL returns the original response without re-processing.

```ts
// Request
interface CreatePosSaleReq {
  idempotencyKey: string          // UUIDv4, client-generated
  items: {
    productId: string
    quantity: number              // decimal OK for kg/ltr; integers for pcs
    batchId?: string | null       // override auto-FEFO when manually selected
    godownId?: string | null      // null = default godown
    discountType?: 'AMOUNT' | 'PERCENTAGE'
    discountValue?: number        // paise or basis points
    note?: string | null          // max 120 chars
  }[]
  // Customer
  partyId?: string | null         // null = walk-in
  walkInName?: string | null      // max 60 chars
  walkInPhone?: string | null     // max 15 chars
  // Tax
  placeOfSupply?: string | null   // 2-digit state code; null = auto from party.stateCode or business.stateCode
  taxPricingMode?: 'INCLUSIVE' | 'EXCLUSIVE'  // null = business default
  // Payment
  payments: {
    mode: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'OTHER'
    amountPaise: number           // must sum to grandTotal
    referenceNumber?: string | null
    note?: string | null
  }[]
  // Optional sanity check — server will reject if drift > 100 paise
  clientGrandTotal?: number
  // Cart-hold client ID for offline trace
  clientId?: string              // max 36 chars, unique per business
  saleDate?: string              // ISO date, default = today; allow backdating if business setting permits
  notes?: string | null          // max 500 chars — printed on receipt
}

// Response 201
interface CreatePosSaleRes {
  success: true
  data: PosSaleDTO
}

// PosSaleDTO
interface PosSaleDTO {
  id: string
  receiptNumber: string          // e.g. "POS-2526-0041"
  documentId: string             // linked SALE_INVOICE Document.id
  documentNumber: string         // linked Document.documentNumber
  status: 'ACTIVE' | 'VOIDED'
  partyId: string | null
  partyName: string              // either party.name or walkInName or "Walk-in Customer"
  walkInName: string | null
  walkInPhone: string | null
  saleDate: string               // ISO date
  subtotal: number               // paise
  totalDiscount: number          // paise
  totalTaxableValue: number      // paise
  totalCgst: number              // paise
  totalSgst: number              // paise
  totalIgst: number              // paise
  totalCess: number              // paise
  grandTotal: number             // paise
  payments: PaymentSplitDTO[]
  items: PosSaleItemDTO[]
  cashierId: string
  cashierName: string
  createdAt: string              // ISO 8601
}

interface PosSaleItemDTO {
  id: string
  sortOrder: number
  productId: string
  productName: string
  sku: string | null
  hsnCode: string | null
  quantity: number
  unitSymbol: string
  ratePaise: number              // server-authoritative price at time of sale
  discountType: 'AMOUNT' | 'PERCENTAGE'
  discountValue: number
  discountAmount: number         // paise
  lineTotal: number              // paise
  taxableValue: number           // paise
  cgstRate: number               // basis points
  cgstAmount: number             // paise
  sgstRate: number               // basis points
  sgstAmount: number             // paise
  igstRate: number               // basis points
  igstAmount: number             // paise
  cessRate: number               // basis points
  cessAmount: number             // paise
  batchId: string | null
  batchNumber: string | null
  note: string | null
}

interface PaymentSplitDTO {
  mode: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'OTHER'
  amountPaise: number
  referenceNumber: string | null
  note: string | null
}

// Errors
// 400 { success: false, error: { code: 'VALIDATION_ERROR', message: 'string' } }
// 400 { success: false, error: { code: 'TOTAL_MISMATCH', message: 'Client sent Rs X, server calculated Rs Y' } }
// 400 { success: false, error: { code: 'PAYMENT_SUM_MISMATCH', message: 'Payments sum Rs X ≠ grand total Rs Y' } }
// 400 { success: false, error: { code: 'OVERSELL_BLOCKED', message: 'Insufficient stock for [product name]' } }
// 400 { success: false, error: { code: 'EXPIRED_BATCH_BLOCKED', message: 'Batch [no] has expired' } }
// 404 { success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product [id] not found or inactive' } }
// 409 { success: false, error: { code: 'DUPLICATE_CLIENT_ID', message: 'A sale with this clientId already exists' } }
// 422 { success: false, error: { code: 'EMPTY_CART', message: 'Cart must have at least one item' } }
```

### GET /api/businesses/:businessId/pos/sales

```ts
// Query params
interface ListPosSalesQuery {
  cursor?: string                // PosSale.id for next page
  limit?: number                 // default 20, max 50
  from?: string                  // ISO date (inclusive)
  to?: string                    // ISO date (inclusive)
  cashierId?: string
  paymentMode?: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'OTHER'
  status?: 'ACTIVE' | 'VOIDED'
  search?: string                // receipt number or party name prefix
}

// Response 200
interface ListPosSalesRes {
  success: true
  data: {
    sales: PosSaleDTO[]
    nextCursor: string | null
    totalCount: number           // count matching filters (not page count)
  }
}
```

### GET /api/businesses/:businessId/pos/sales/:id

```ts
// Response 200
interface GetPosSaleRes {
  success: true
  data: PosSaleDTO              // full DTO including items + payments
}
// 404 when sale not found or belongs to different business
```

### POST /api/businesses/:businessId/pos/sales/:id/void

```ts
// Request
interface VoidPosSaleReq {
  reason: string                 // required, min 3 chars, max 200 chars
}

// Response 200
interface VoidPosSaleRes {
  success: true
  data: { id: string; status: 'VOIDED'; voidedAt: string; voidReason: string }
}

// Errors
// 400 { code: 'ALREADY_VOIDED', message: 'Sale is already voided' }
// 400 { code: 'VOID_WINDOW_EXPIRED', message: 'Sales can only be voided within 7 days' }
// 403 { code: 'FORBIDDEN', message: 'Missing permission pos:void' }
```

### POST /api/businesses/:businessId/pos/sales/:id/restore

```ts
// Request — empty body {}

// Response 200
interface RestorePosSaleRes {
  success: true
  data: { id: string; status: 'ACTIVE'; restoredAt: string }
}

// Errors
// 400 { code: 'NOT_VOIDED', message: 'Sale is not voided' }
// 400 { code: 'RESTORE_WINDOW_EXPIRED', message: 'Sales can only be restored within 7 days of void' }
// 400 { code: 'OVERSELL_ON_RESTORE', message: 'Insufficient stock to restore sale for [product name]' } — warn-only path
```

### GET /api/businesses/:businessId/pos/products

Optimized for the POS grid: returns active products with stock + price only. No heavy joins.

```ts
// Query params
interface PosProductsQuery {
  search?: string                // name / SKU / barcode (substring, min 1 char)
  categoryId?: string
  limit?: number                 // default 60, max 200
  cursor?: string                // Product.id for next page
  includeOutOfStock?: boolean    // default false
}

// Response 200
interface PosProductsRes {
  success: true
  data: {
    products: PosProductDTO[]
    nextCursor: string | null
  }
}

interface PosProductDTO {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  categoryId: string | null
  categoryName: string | null
  imageUrl: string | null
  unitSymbol: string
  salePrice: number              // paise (default; batch-override handled on add)
  currentStock: number           // Float
  isBatchTracked: boolean        // true if any active batch exists
  taxCategoryId: string | null
  taxRate: number                // basis points (0 if no tax category)
  hsnCode: string | null
  lastUsedAt: string | null      // ISO 8601 — for recently-used ordering
}
```

---

## 7. Data Model — Prisma Additions

New models added via migration `20260507_pos_checkout`.

```prisma
// PosSale — POS operational record. Linked to Document (type=POS_SALE).
model PosSale {
  id             String    @id @default(cuid())
  businessId     String

  // Linked accounting document (SALE_INVOICE type)
  documentId     String    @unique

  // Receipt numbering — managed by PosReceiptCounter
  receiptNumber  String    // e.g. "POS-2526-0041"
  receiptSeq     Int       // raw sequence for sorting

  // Customer (walk-in or existing party)
  partyId        String?   // null = walk-in
  walkInName     String?   @db.VarChar(60)
  walkInPhone    String?   @db.VarChar(15)

  // Totals (paise — mirrors Document)
  subtotal               Int  @default(0)
  totalDiscount          Int  @default(0)
  totalTaxableValue      Int  @default(0)
  totalCgst              Int  @default(0)
  totalSgst              Int  @default(0)
  totalIgst              Int  @default(0)
  totalCess              Int  @default(0)
  grandTotal             Int  @default(0)

  // Tax mode snapshot
  taxPricingMode String    @default("EXCLUSIVE") @db.VarChar(20)
  placeOfSupply  String?   @db.VarChar(2)
  supplyType     String    @default("B2C_SMALL")

  // Payment breakdown (JSON array of { mode, amountPaise, referenceNumber, note })
  paymentBreakdown Json    @default("[]")

  // Cashier
  cashierId     String     // BusinessUser.userId

  // Void
  status        String     @default("ACTIVE")  // ACTIVE | VOIDED
  voidedAt      DateTime?
  voidedBy      String?    // userId
  voidReason    String?    @db.VarChar(200)
  restoredAt    DateTime?
  restoredBy    String?    // userId

  // Idempotency
  idempotencyKey String    @unique

  // Offline sync
  clientId      String?    @unique

  // Audit
  saleDate      DateTime
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  business   Business      @relation(fields: [businessId], references: [id], onDelete: Restrict)
  document   Document      @relation(fields: [documentId], references: [id], onDelete: Restrict)
  party      Party?        @relation(fields: [partyId], references: [id], onDelete: SetNull)
  cashier    User          @relation("PosCashier", fields: [cashierId], references: [id], onDelete: Restrict)
  voidUser   User?         @relation("PosVoider", fields: [voidedBy], references: [id])
  restoreUser User?        @relation("PosRestorer", fields: [restoredBy], references: [id])
  items      PosSaleItem[]
  events     PosSaleEvent[]

  @@unique([businessId, receiptNumber])
  @@index([businessId, saleDate])
  @@index([businessId, status])
  @@index([businessId, cashierId])
  @@index([businessId, partyId])
  @@index([documentId])
  @@index([clientId])
}

// PosSaleItem — line snapshot. References DocumentLineItem for accounting;
// stores POS-specific fields (batch claimed, original price) separately.
model PosSaleItem {
  id           String  @id @default(cuid())
  posSaleId    String
  sortOrder    Int     @default(0)

  // Product snapshot at time of sale (immutable)
  productId    String
  productName  String  @db.VarChar(200)
  sku          String? @db.VarChar(60)
  hsnCode      String? @db.VarChar(10)
  unitSymbol   String  @db.VarChar(20)

  quantity     Float
  ratePaise    Int     // server-authoritative price at time of sale
  discountType  String  @default("AMOUNT")
  discountValue Int    @default(0)
  discountAmount Int   @default(0)
  lineTotal    Int     @default(0)

  // Tax snapshot
  taxableValue Int     @default(0)
  cgstRate     Int     @default(0)
  cgstAmount   Int     @default(0)
  sgstRate     Int     @default(0)
  sgstAmount   Int     @default(0)
  igstRate     Int     @default(0)
  igstAmount   Int     @default(0)
  cessRate     Int     @default(0)
  cessAmount   Int     @default(0)

  // Batch / godown (FEFO claimed)
  batchId      String?
  batchNumber  String? @db.VarChar(60)
  godownId     String?

  note         String? @db.VarChar(120)

  posSale  PosSale  @relation(fields: [posSaleId], references: [id], onDelete: Cascade)
  product  Product  @relation(fields: [productId], references: [id], onDelete: Restrict)
  batch    Batch?   @relation(fields: [batchId], references: [id], onDelete: SetNull)
  godown   Godown?  @relation(fields: [godownId], references: [id], onDelete: SetNull)

  @@index([posSaleId])
  @@index([productId])
}

// PosReceiptCounter — per-business, per-FY sequential receipt numbering.
// Locked with UPDATE for serialization inside Prisma transaction.
model PosReceiptCounter {
  id            String @id @default(cuid())
  businessId    String
  financialYear String // "2526"
  prefix        String @default("POS")
  separator     String @default("-")
  paddingDigits Int    @default(4)
  lastNumber    Int    @default(0)
  updatedAt     DateTime @updatedAt

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@unique([businessId, financialYear])
  @@index([businessId])
}

// PosSaleEvent — append-only audit trail per sale.
model PosSaleEvent {
  id        String   @id @default(cuid())
  posSaleId String
  type      String   // CREATED | VOIDED | RESTORED | RECEIPT_SHARED
  actorId   String?
  payload   Json?    // reason, channel, etc.
  createdAt DateTime @default(now())

  posSale PosSale @relation(fields: [posSaleId], references: [id], onDelete: Cascade)

  // Immutable — no updatedAt
  @@index([posSaleId, createdAt])
  @@index([posSaleId, type])
}
```

**Business model additions:**

```prisma
// Add to Business model (additive, nullable)
posSales          PosSale[]
posReceiptCounters PosReceiptCounter[]

// POS settings — reuse DocumentSettings or add a PosSetting model (single-row per business)
// DECISION: new PosSettings table to avoid widening DocumentSettings further.
model PosSetting {
  id                      String  @id @default(cuid())
  businessId              String  @unique
  receiptPrefix           String  @default("POS")
  receiptSeparator        String  @default("-")
  receiptPaddingDigits    Int     @default(4)
  defaultPaymentMode      String  @default("CASH")
  oversellPolicy          String  @default("WARN_ONLY")  // WARN_ONLY | HARD_BLOCK (overrides InventorySetting for POS)
  voidWindowDays          Int     @default(7)
  defaultThermalWidth     String  @default("58MM")       // 58MM | 80MM | A5
  autoShareOnCheckout     Boolean @default(false)
  autoShareChannel        String  @default("WHATSAPP")
  showProfitOnGrid        Boolean @default(false)        // show margin % on product card
  cashierMustSelectParty  Boolean @default(false)        // block checkout if no party selected
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
}
```

**Document.type addition:** add `POS_SALE` as a valid `type` value. No schema change needed — it's a String enum enforced at application layer. `DocumentNumberSeries` entry with `documentType = 'POS_SALE'` is created by the receipt counter; this is a separate series from regular invoices.

**Party model:** no changes needed. Walk-in sales use `partyId = null` on `PosSale`; the Document (POS_SALE type) requires a partyId, so a `WALK_IN` sentinel Party is auto-seeded per business at creation. Sentinel Party: `name = "Walk-in Customer"`, `type = "CUSTOMER"`, `isWalkIn = true` (new boolean column, nullable, default false, backward-compatible).

```prisma
// Party model — add one column (additive migration)
isWalkIn Boolean @default(false)
```

---

## 8. Tax Integration

### Flow

1. On `POST /pos/sales`, server loads each product's `TaxCategory` (rate + cessRate + cessType + hsnCode).
2. Derive `placeOfSupply`: if `partyId` is non-null and `party.stateCode` is set, use it. If walk-in or party has no stateCode, default to `business.stateCode`. If `placeOfSupply` override is sent in request, use it.
3. Derive `interState = isInterState(business.stateCode, placeOfSupply)` using the existing `tax-calc.ts` function.
4. Derive `supplyType`: if party has GSTIN → `B2B`; else `B2C_SMALL` (< Rs 2.5L threshold — POS sales are assumed B2C unless party has GSTIN).
5. For each item, call `calculateLineTax(input, interState)` from `tax-calc.utils.ts`.
6. If `taxPricingMode = 'INCLUSIVE'` (either from request or business default), call `backCalculateInclusive` per line before running `calculateLineTax`.
7. Aggregate with `calculateDocumentTax`.
8. Write results to both `PosSaleItem` columns and `DocumentLineItem` columns within the same transaction.

### Walk-in place-of-supply

Walk-in customers have no registered state. Default = `business.stateCode` → intra-state → CGST+SGST split. This is the correct GST treatment for B2C retail walk-in sales.

### Tax mode toggle mid-cart

Toggling INCLUSIVE ↔ EXCLUSIVE on the frontend recalculates cart totals locally using `backCalculateInclusive` (same pure function). The mode is sent to the server with the checkout request. Server always re-calculates authoritatively.

---

## 9. Inventory Integration

All stock mutations happen inside the Prisma transaction that creates `PosSale` + `Document`.

```
for each PosSaleItem:
  1. If product.batchTracked (has active batches):
     - If batchId provided in request → use that batch (validate belongs to product, is not expired, has stock)
     - If no batchId → call existing FEFO claim service: fefoClaimService.claim(productId, quantity, godownId)
       FEFO service returns { batchId, actualClaimed, batches[] }
       If FEFO can't fulfill → oversell policy applies (see Edge Cases §11)
  2. Create StockMovement:
     type       = 'SALE'
     quantity   = -item.quantity
     referenceType = 'POS_SALE'
     referenceId   = posSale.id (set after PosSale insert within tx)
     referenceNumber = receiptNumber
     batchId    = claimed batch or null
     godownId   = godownId or business default godown
  3. Update Product.currentStock -= item.quantity
  4. If batch: update Batch.currentStock -= item.quantity
```

On **void**: reverse StockMovement (create REVERSAL movement), update `Product.currentStock += item.quantity`, update `Batch.currentStock` if applicable. All within a Prisma transaction.

On **restore**: re-apply the decrement atomically. Check oversell policy again before allowing restore.

---

## 10. Cash Register Integration

When any payment split has `mode = 'CASH'` and `amountPaise > 0`:

1. After the `PosSale` is created (within the same Prisma transaction), create a `CashEntry`:
   ```
   direction         = 'IN'
   amountPaise       = sum of all CASH-mode payment splits
   referenceType     = 'POS_SALE'
   referenceId       = posSale.id
   referenceNumber   = posSale.receiptNumber
   note              = "POS Cash: " + partyName
   cashierId         = posSale.cashierId
   ```
2. The `CashEntry` model must add `referenceType` and `referenceId` nullable columns (additive migration).
   If `CashEntry` does not yet have these columns (Cash Register is still in DRAFT scope per SCOPE_cash_register.md),
   hold off and wire this in when both features land in the same migration batch.
3. On **void**, the linked CashEntry is soft-voided automatically (direction stays IN but `isVoided = true`).
4. On **restore**, the CashEntry is un-voided.

---

## 11. Edge Cases

| Scenario | Handling |
|---|---|
| Cart empty on checkout | 422 EMPTY_CART before any DB write |
| Double-tap "Save" | `X-Idempotency-Key` returns original response; no duplicate document |
| Same `clientId` submitted twice | 409 DUPLICATE_CLIENT_ID |
| Product price changed between cart-load and checkout | Server re-prices from DB; if server total differs from clientGrandTotal by > 100 paise → 400 TOTAL_MISMATCH with message showing both values |
| Payment splits don't sum to grand total | 400 PAYMENT_SUM_MISMATCH |
| Oversell — WARN_ONLY mode | Allow checkout; StockMovement is written with negative balanceAfter; StockAlert created |
| Oversell — HARD_BLOCK mode | 400 OVERSELL_BLOCKED with product name; no DB write |
| Expired batch — WARN_ONLY (Business.expiredBatchPolicy = WARN_ONLY) | Allow; include `warnings: [{ productId, message: 'Batch [no] expired on [date]' }]` in response |
| Expired batch — HARD_BLOCK | 400 EXPIRED_BATCH_BLOCKED |
| Walk-in customer, no name provided | `walkInName = null`; receipt shows "Walk-in Customer" |
| Walk-in sale later assigned to real party | Out of scope; do not build |
| Void after 7 days | 400 VOID_WINDOW_EXPIRED; window configurable via `PosSetting.voidWindowDays` |
| Restore when stock now insufficient | WARN_ONLY: proceed with negative stock + StockAlert; HARD_BLOCK: 400 OVERSELL_ON_RESTORE |
| Discount > line total | 400 VALIDATION_ERROR: "Discount cannot exceed line total" |
| Grand total = 0 (100% discount) | 400 VALIDATION_ERROR: "Grand total must be greater than zero" |
| Tax mode change mid-cart | Frontend recalcs; sent to server with checkout; server re-derives authoritatively |
| Partial payment (underpayment) | 400 PAYMENT_SUM_MISMATCH: "Payments sum Rs X is less than grand total Rs Y. POS requires full payment." (partial payment credit is out of scope for POS) |
| Network failure mid-way (after server processes, before client receives) | Server stored the sale; next checkout attempt with same `X-Idempotency-Key` returns the stored sale with 200 (idempotency hit) |
| Offline checkout attempt | `api()` queues mutation offline; but `pos.service.ts` must check `navigator.onLine` before checkout and show toast: "POS checkout requires an internet connection." Cart is preserved in IDB |
| Product inactive / deleted between grid-load and checkout | Server returns 404 PRODUCT_NOT_FOUND for that item; client shows: "Product '[name]' is no longer available. Please remove it from the cart." |
| More than 200 items in cart | Frontend enforces `MAX_CART_ITEMS = 200`; server validates and returns 400 if exceeded |
| B2B party without GSTIN | Allowed; `supplyType = B2C_SMALL`, CGST/SGST applied based on place-of-supply |
| Mixed split with 0-amount mode | Skip payment modes with `amountPaise = 0` on client; server ignores them if present |

---

## 12. Receipt Format

### 58mm Thermal (32-char width)

```
================================
     [Business Name]
  [Address line 1, City]
  GSTIN: [gstin]
================================
RECEIPT: POS-2526-0041
DATE: 07/05/2026  15:42
================================
CUSTOMER: Raju Sharma
================================
Biscuit Pack (Britannia)
  2 pcs @ Rs 10.00
               Rs 20.00
Maggi 70g
  3 pcs @ Rs 14.00
               Rs 42.00
================================
SUBTOTAL           Rs 62.00
DISC (5%)          Rs -3.10
TAXABLE            Rs 58.90
CGST @9%           Rs  5.30
SGST @9%           Rs  5.30
================================
TOTAL              Rs 69.50
================================
CASH               Rs 69.50
================================
Thank you. Visit again!
================================
```

- Line width: 32 chars
- Product name: truncate at 20 chars + "…" if longer
- Amount right-aligned to col 32
- HSN code shown only if `business.gstEnabled = true`
- QR code of receipt URL at bottom (optional, settable per business)

### 80mm Thermal (48-char width)

- Same structure; product name up to 30 chars
- Tax breakdown expanded: CGST rate, SGST rate, IGST rate on separate lines
- More whitespace between sections

### A5 PDF Fallback

- React-PDF component reusing existing HP invoice PDF template
- Header: business logo, name, GSTIN, address
- Body: line items table with HSN, qty, rate, tax, amount
- Footer: totals, payment mode, signature block
- 32px minimum font size for thermal formats; 14px for A5

### WhatsApp Share

- Generate image using `html-to-image` (off-screen canvas) of the 58mm receipt preview
- Send via `window.open('https://wa.me/?text=...')` with image downloaded first
- Capacitor: use `@capacitor/share` API on Android/iOS

---

## 13. Performance

### Product Grid (1000+ products)

- API: cursor pagination with `limit = 60` per load, `includeOutOfStock = false` by default
- Index: `@@index([businessId, status])` on Product already exists
- For search: existing `@@index([businessId, name])` covers prefix search; for full-text use `ILIKE '%query%'` with the existing GIN trigram index if available, else fallback to ILIKE (acceptable for < 10K products)
- Barcode scan: `GET /pos/products?search=<barcode>&limit=1` — fast single-row lookup via `@@unique([businessId, barcode])` index
- Frontend: `react-window` FixedSizeGrid for the product grid; 120px×140px cell size; overscan 2 rows
- Search debounce: 300ms; min 1 char

### Cart

- Cart is Zustand state + IDB persistence (not API calls until checkout)
- `pos.cart-calc.ts` recalculates totals synchronously on every cart change (pure function, no fetch)
- Tax recalc on cart: client uses snapshot `taxRate` from `PosProductDTO` (loaded at grid-load time); this is good enough for the cart preview; server re-prices on checkout

### History Page

- Cursor pagination, 20 per page
- Index: `@@index([businessId, saleDate])` and `@@index([businessId, status])` on PosSale

---

## 14. UI States — Exact Copy (UX Copy)

### Button Labels

| Action | Label (en) | Label (hi) |
|---|---|---|
| Confirm checkout | "Confirm & Save" | "पुष्टि करें और सेव करें" |
| Add to cart | "Add" | "जोड़ें" |
| Remove from cart | "Remove" | "हटाएं" |
| Void sale | "Void Sale" | "बिक्री रद्द करें" |
| Restore sale | "Restore Sale" | "बिक्री वापस करें" |
| Share on WhatsApp | "Share on WhatsApp" | "WhatsApp पर भेजें" |
| Print receipt | "Print" | "प्रिंट करें" |
| New sale | "New Sale" | "नई बिक्री" |
| Walk-in customer | "Walk-in Customer" | "वॉक-इन ग्राहक" |

### Loading Texts

| Context | Text |
|---|---|
| Checkout in progress | "Saving sale…" |
| Voiding | "Voiding sale…" |
| Loading products | (skeleton cards, no text) |
| Loading history | (skeleton rows, no text) |

### Success Toasts

| Action | Toast |
|---|---|
| Sale saved | "Sale saved — Rs [amount]" |
| Sale voided | "Sale voided" |
| Sale restored | "Sale restored" |
| Receipt shared | "Receipt sent on WhatsApp" |

### Error Toasts / Banners

| Scenario | Message |
|---|---|
| Checkout failed — network | "Could not save sale. Check your connection." |
| Checkout failed — oversell blocked | "Insufficient stock for [product name]. Please reduce quantity." |
| Checkout failed — total mismatch | "Price changed for one or more items. Cart has been updated — please review and confirm again." |
| Checkout failed — payment mismatch | "Payment amounts don't add up to the total. Please recheck." |
| Product no longer available | "Product '[name]' is no longer available. Remove it from the cart." |
| Void failed | "Could not void sale. Try again." |
| Offline checkout attempt | "POS checkout requires an internet connection." |

### Confirm Dialog — Void

```
Title: "Void Sale POS-2526-0041?"
Body:  "This will cancel the sale and restore stock. This cannot be undone after 7 days."
Reason field: placeholder "Enter reason (required)"
Buttons: [Cancel] [Void Sale]
```

### Empty States

| Context | Text | CTA |
|---|---|---|
| Product grid — no products | "No products added yet." | "Add Product" → /inventory/products/new |
| Product grid — search no match | "No products match '[query]'" | "Clear Search" |
| Cart empty | "Cart is empty. Tap a product to add." | — |
| History — no sales | "No POS sales yet. Start billing!" | — |
| History — filtered, no results | "No sales match the selected filters." | "Clear Filters" |

---

## 15. Mobile Layout

- Primary breakpoint: 375px. Minimum: 320px.
- POS page layout on mobile: full-screen product grid with floating cart FAB (shows item count badge); tap FAB opens CartPanel as bottom sheet (80vh, draggable).
- ProductGrid: 2-column grid on 375px; each card 164px wide.
- On 320px: 2-column grid at 142px; product name truncated to 2 lines; no image shown to save space.
- PaymentSheet: full-width bottom sheet; stacked payment mode buttons with amount inputs.
- Receipt preview: full-screen bottom sheet; swipe-to-dismiss.
- CartPanel: scrollable, with sticky totals footer; checkout button 56px height, full width.
- No horizontal overflow at 320px on any screen.
- Capacitor: barcode scan uses `@capacitor-mlkit/barcode-scanning` (Android/iOS camera); falls back to text input on web.

---

## 16. Security

| Item | Spec |
|---|---|
| Auth required | Yes — `requireAuth` + `requireBusinessAccess` on all POS routes |
| Permission — read history | `pos:read` |
| Permission — create sale | `pos:create` |
| Permission — void / restore | `pos:void` |
| Rate limit — POST /pos/sales | 60 req/min per businessId |
| Rate limit — GET /pos/products | 120 req/min per businessId |
| Server re-prices all items | Client-sent prices are IGNORED; server loads fresh from DB |
| Idempotency key | Required on POST /pos/sales; server validates UUID format |
| Tax totals | Server-authoritative; client total used only for sanity check (drift > Rs 1 = error) |
| Walk-in phone | Stored on PosSale only; never auto-creates a Party record |
| Void audit | PosSaleEvent appended on every VOIDED / RESTORED; actor + reason stored |
| Multi-tenant | Every query filtered by `businessId`; server validates sale.businessId matches URL param on detail/void/restore |

---

## 17. Out of Scope

- Barcode generation or label printing (#105 — separate feature)
- Cash drawer hardware impulse control (RJ11, USB)
- Returns / refund flow (separate ticket; void covers same-day mistakes)
- Purchase POS (inward fast-scan)
- Loyalty points or customer reward schemes
- Customer-facing second screen
- Online ordering / delivery dispatch
- EMI / BNPL payment modes
- Auto e-invoice generation for POS B2B
- Auto e-way bill on POS sales
- Walk-in to party assignment after sale
- Partial payment (POS requires full payment at checkout)
- Multi-location cashier session locking
- CSV export of POS history (Phase 2 enhancement)
- Dashboard tile for POS collection (Phase 2 enhancement — wire when dashboard supports)
- Offline checkout (online-only; cart persists offline, checkout requires connection)
- Recurring / subscription POS sales

---

## 18. Acceptance Criteria

- [ ] `curl -X POST /api/businesses/:id/pos/sales` with valid payload and `X-Idempotency-Key` → `{ success: true, data: { id, receiptNumber, grandTotal, ... } }` with HTTP 201
- [ ] Same request with same `X-Idempotency-Key` within 24h → identical 201 response, no second PosSale row
- [ ] Without auth cookie → 401
- [ ] Wrong businessId (another business's ID) → 403
- [ ] Empty `items[]` → 422 `EMPTY_CART`
- [ ] `clientGrandTotal` with > Rs 1 drift from server total → 400 `TOTAL_MISMATCH`
- [ ] Payment splits not summing to grand total → 400 `PAYMENT_SUM_MISMATCH`
- [ ] Product with `HARD_BLOCK` inventory policy, quantity > currentStock → 400 `OVERSELL_BLOCKED`
- [ ] Void within window → `{ status: 'VOIDED', voidReason: '...' }` with HTTP 200; StockMovement REVERSAL row exists
- [ ] Void after window → 400 `VOID_WINDOW_EXPIRED`
- [ ] Restore → status back to `ACTIVE`; new StockMovement SALE row created
- [ ] `curl GET /api/businesses/:id/pos/sales` → `{ success: true, data: { sales: [...], nextCursor, totalCount } }`
- [ ] `curl GET /api/businesses/:id/pos/sales/:id` → full PosSaleDTO with items and payments
- [ ] `curl GET /api/businesses/:id/pos/products?search=biscuit` → PosProductDTO list; barcode search returns single item
- [ ] Cash payment → CashEntry IN row created with `referenceType = 'POS_SALE'` and correct paise amount
- [ ] Batch-tracked product → FEFO batch claimed; PosSaleItem.batchId is set; Batch.currentStock decremented
- [ ] Walk-in sale → Document.partyId = WALK_IN sentinel party ID; PosSale.walkInName persisted
- [ ] B2B party (with GSTIN) → CGST/SGST or IGST split correct per place-of-supply
- [ ] B2C walk-in intra-state → CGST + SGST applied; inter-state walk-in not possible (business.stateCode = placeOfSupply for walk-in)
- [ ] Screenshot: product grid loading ✓, empty ✓, populated ✓
- [ ] Screenshot: cart panel empty ✓, with items ✓, checkout error ✓, success ✓
- [ ] Screenshot: payment sheet ✓, UPI QR modal ✓
- [ ] Screenshot: receipt preview 58mm ✓, share bar ✓
- [ ] Screenshot: POS history loading ✓, empty ✓, list ✓, filtered ✓
- [ ] Screenshot: sale detail ✓, void modal ✓
- [ ] 375px no layout issues ✓, 320px no horizontal overflow ✓
- [ ] `tsc --noEmit` clean (no TypeScript errors)

---

## 19. QA Checklist

Verifier must confirm each item before feature ships:

- [ ] Product grid loads < 800ms on a Pixel 4a (mid-range Android target)
- [ ] Barcode scan via camera opens, scans EAN13 code, adds product to cart
- [ ] Search with < 1 char debounce does not fire API call
- [ ] Cart persists across page refresh (IDB state)
- [ ] Two cashiers on same business — simultaneous checkouts produce sequential receipt numbers (no duplicates)
- [ ] FEFO claim uses earliest-expiry batch first
- [ ] Expired batch with WARN_ONLY: checkout succeeds + `warnings` array in response
- [ ] Expired batch with HARD_BLOCK: checkout blocked, error message shown
- [ ] Oversell WARN_ONLY: Product.currentStock goes negative; StockAlert created
- [ ] Oversell HARD_BLOCK: checkout blocked; stock unchanged
- [ ] Cash + UPI split: CashEntry paise = CASH payment amount only (not full total)
- [ ] Void: Document status → VOIDED (or DELETED — confirm with architect); StockMovement REVERSAL created; linked CashEntry voided
- [ ] Restore after void: stock decremented again; CashEntry un-voided
- [ ] Walk-in name: shown on receipt; no Party row created
- [ ] B2B party with GSTIN in different state: IGST applied (not CGST+SGST)
- [ ] Receipt 58mm: all lines within 32-char width; no truncation artifacts
- [ ] Receipt WhatsApp share: image downloads and opens WhatsApp with image on Android
- [ ] Receipt print: browser print dialog opens with correct page size
- [ ] POS history filter by date range returns only sales in range
- [ ] Offline toast shown when checkout attempted without network
- [ ] All mutations pass `entityType: 'pos_sale'` and `entityLabel: receiptNumber`
- [ ] No `localStorage` writes for POS entity data (IDB only)
- [ ] `scripts/enforce-offline.mjs` passes (no raw fetch in pos.service.ts)
- [ ] All 4 UI states reachable via Storybook or QA scenario

---

## 20. Open Questions for Sawan

1. **PosSetting.oversellPolicy vs InventorySetting.stockValidationMode** — should POS honor the global `InventorySetting.stockValidationMode` or have its own override in `PosSetting`? Proposed: `PosSetting.oversellPolicy` can override global; null = inherit global.

2. **Void window** — 7 days proposed. Is this configurable per business or fixed? Can it be 0 (no void after any time once created)?

3. **Document status on void** — when a PosSale is voided, should the linked Document's `status` be set to `DELETED` (consistent with existing invoice delete flow) or a new `VOIDED` status? Recommend adding `VOIDED` as a valid Document status to distinguish soft-delete from accounting void.

4. **Cash Register integration timing** — Cash Register feature is still in DRAFT scope. Should POS cash entries write directly to a `CashEntry` table (forcing Cash Register to land first) or should POS emit a domain event / write a `PendingCashEntry` that Cash Register picks up? Proposed: ship POS first with a `PosCashEntry` denormalized on `PosSale.paymentBreakdown JSON`; wire to CashEntry in the same sprint as Cash Register launches.

5. **Walk-in sentinel Party** — the WALK_IN Party needs to be seeded for all existing businesses in a migration. Confirm this is acceptable (one extra Party row per business, ~5K rows for current user base).

6. **Receipt URL / QR at bottom** — should the receipt QR link to a public receipt URL (requires a public route) or just the business phone? The public receipt page is a separate feature (#119?); propose omitting QR from receipt for MVP.

7. **POS vs regular invoice numbering** — `PosReceiptCounter` is a separate series from `DocumentNumberSeries`. Confirm: POS receipts do NOT appear in the regular invoice number sequence (e.g., INV-2526-001 is not incremented by POS sales).

8. **GST B2C aggregation for GSTR-1** — POS B2C_SMALL sales below Rs 2.5L per invoice should be aggregated in GSTR-1 B2CS table, not reported per-invoice. Should the POS module handle this or is it left to the GSTR-1 export pipeline? Proposed: GSTR-1 pipeline identifies POS_SALE documents with `supplyType = B2C_SMALL` and aggregates them; no POS-specific code needed.

9. **Cashier filter in history** — should a cashier (non-owner role) see only their own POS sales, or all sales for the business? Proposed: `pos:read_all` permission for owner/manager; `pos:read` for cashier shows only their own sales.

10. **Void reason required?** — proposed as required (min 3 chars). Confirm this isn't too friction-heavy for Raju's kirana use case.

---

## 21. Effort Estimate

**Total: Medium — 2–3 weeks for one full-stack engineer**

| Area | Estimate |
|---|---|
| DB migration (4 new models + Party.isWalkIn + PosSetting) | 0.5 days |
| Server: pos.routes + pos.service + receipt counter | 3 days |
| Server: tax integration + FEFO wiring + CashEntry integration | 2 days |
| Server: void/restore + PosSaleEvent | 1 day |
| Server: GET /pos/products optimized endpoint | 0.5 days |
| Frontend: pos.store + pos.cart-calc + IDB persistence | 1.5 days |
| Frontend: ProductGrid + ProductSearchBar + PosProductCard | 1.5 days |
| Frontend: CartPanel + CartLineItem + CartTotals | 1.5 days |
| Frontend: CustomerSelector (autocomplete + walk-in) | 1 day |
| Frontend: PaymentSheet + UpiQrModal + split tender | 1.5 days |
| Frontend: ReceiptPreview + 58mm/80mm/A5 layouts + ShareBar | 2 days |
| Frontend: PosHistoryPage + PosHistoryList + filters | 1 day |
| Frontend: PosSaleDetailPage + VoidModal | 0.5 days |
| i18n (en + hi keys) | 0.5 days |
| Tests: unit (cart-calc, tax, FEFO), integration (checkout API) | 1.5 days |
| QA + bug fixes | 1.5 days |
| **Total** | **~17 working days** |
