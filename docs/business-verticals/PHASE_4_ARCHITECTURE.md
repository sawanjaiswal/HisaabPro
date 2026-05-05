# Phase 4 Architecture — Custom Order (bakery / tailor verticals)

> Owner: architect agent · Status: design-locked, ready for implementation
> Predecessors: `PRD.md` · `TRD.md` (seed design — sharpened here) · `PHASE_PLAN.md` · `PHASE_3_ARCHITECTURE.md` (shape precedent)
> Touches HIGH-RISK path: `prisma/schema.prisma` (new tables, no column edits to existing tables)

---

## 0. TL;DR

- New `CustomOrder` + `CustomOrderItem` models, new `CustomOrderStatus` enum. **No edits to `Document`** — Order links forward via `invoiceId String? @unique` → `Document.id` (`SetNull`). Mirrors Phase 3's `Job → Document` relation exactly.
- We deliberately **deviate** from the seed-design hint in `TRD.md` §Phase-4 (which suggested adding `deliveryAt`/`deliverySlot`/`customFields` columns to `Document`). Rationale: bakery/tailor flows carry a domain status machine (RECEIVED → IN_PRODUCTION → READY → DELIVERED → INVOICED), partial advance payments, and per-item spec JSON. Cramming those into `Document` would either (a) bleed order-only fields into every invoice/quote/PO row or (b) hide status behind a sibling table. A dedicated `CustomOrder` model parallels Phase 3 `Job`, keeps `Document` lean, and lets convert-to-invoice reuse `createDocument` exactly the way Phase 3 already does.
- `advancePaise` is **not** stored as a row on `Payment` — Phase 4 keeps the advance on the order itself (a denormalised tally of recorded advances). When the order converts, the recorded advances are replayed as `Payment` rows against the new invoice via the existing `payment.service.recordPayment` so reconciliation, ledgers, and outstanding stay untouched. The order also stores an audit trail of advance entries in `CustomOrderAdvance` (3 columns + audit) so reprints can show the receipt history.
- Convert flow reuses `services/document/create.ts:createDocument` exactly as Phase 3 `convertJobToInvoice` does — same `ensureServicePlaceholder` for items without a `productId` (e.g. "3-tier vanilla cake, custom topper"), same single call for totals/numbering/GST/stock/SSE.
- 4 new RBAC keys (`orders.view`, `orders.create`, `orders.edit`, `orders.delete`) under a new `orders` module in `PERMISSION_MATRIX`. Owner inherits via the `role === 'owner'` bypass already in `permission.ts:51`. Role grants follow the same pattern as Phase 3.
- Status machine **server-enforced** in the service layer; client UI mirrors the same table from a shared constant — same approach as Phase 3.
- Visibility on the FE is a `useVertical().isNavVisible(key)` filter — `'orders'` is already in the `NavKey` union (`src/config/verticals.config.ts:36`) and `isNavVisible` already has the `'orders'` branch (currently `return false`). We add `ORDERS_VISIBLE_VERTICALS` and flip that branch to use it.
- Total endpoint count: **10** (CRUD + transition + convert-to-invoice + record-advance + delete-advance + recycle).

---

## 1. Final Prisma schema

Append to `server/prisma/schema.prisma` after the `Job*` block (Phase 3, ~line 1100), before `model Payment`. Also append the inverse relation lines on `Business`, `Party`, `Document`, and `Product`.

### 1a. New models + enum

```prisma
// ─── Phase 4 — Custom Orders (bakery / tailor verticals) ─────────────────────

enum CustomOrderStatus {
  RECEIVED            // taken from customer; advance optional
  IN_PRODUCTION       // shop has started work
  READY               // ready for pickup / dispatch
  DELIVERED           // handed over; not yet billed
  INVOICED            // converted to a SALE_INVOICE Document
  CANCELLED
}

model CustomOrder {
  id              String              @id @default(cuid())
  businessId      String
  partyId         String

  // Numbering — assigned on first SAVE (status leaves draft RECEIVED-with-no-items),
  // null while pure draft. Independent series: "ORD-25-26-0001".
  orderNumber     String?
  sequenceNumber  Int?
  financialYear   String?

  // Content
  title           String              @db.VarChar(200)
  notes           String?             @db.Text
  status          CustomOrderStatus   @default(RECEIVED)

  // Delivery
  deliveryAt      DateTime?           // date + time the customer expects the order
  deliverySlot    String?             @db.VarChar(40)   // 'morning'|'afternoon'|'evening' or free text
  deliveryAddress String?             @db.VarChar(500)
  deliveredAt     DateTime?

  // Lifecycle audit timestamps
  productionStartedAt DateTime?
  readyAt         DateTime?
  cancelledAt     DateTime?
  cancelReason    String?             @db.VarChar(500)

  // Totals (PAISE — Int, matches Document/Job)
  subtotalPaise   Int                 @default(0)
  discountPaise   Int                 @default(0)
  totalPaise      Int                 @default(0)

  // Money received in advance — denormalised sum of CustomOrderAdvance rows.
  // Always recomputed inside the same transaction that mutates advances.
  advancePaise    Int                 @default(0)

  // Convenience computed at write-time so list queries don't sum payments.
  // balancePaise = totalPaise - advancePaise. Persisted (not generated) so
  // the field is queryable + indexable for "balance > 0" filters.
  balancePaise    Int                 @default(0)

  // Forward link to the SALE_INVOICE produced by convert-to-invoice
  invoiceId       String?             @unique

  // Offline sync (matches Document.clientId / Job.clientId pattern)
  clientId        String?             @unique

  // Soft delete (matches Document/Job convention exactly)
  isDeleted       Boolean             @default(false)
  deletedAt       DateTime?
  deletedBy       String?

  // Audit
  createdBy       String
  updatedBy       String?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  business        Business            @relation(fields: [businessId], references: [id], onDelete: Restrict)
  party           Party               @relation(fields: [partyId], references: [id], onDelete: Restrict)
  invoice         Document?           @relation("CustomOrderInvoice", fields: [invoiceId], references: [id], onDelete: SetNull)
  items           CustomOrderItem[]
  advances        CustomOrderAdvance[]

  @@unique([businessId, orderNumber])
  @@index([businessId, status])
  @@index([businessId, partyId])
  @@index([businessId, deliveryAt])           // calendar / "today" / "tomorrow" widgets
  @@index([businessId, isDeleted])
  @@index([clientId])
}

model CustomOrderItem {
  id             String       @id @default(cuid())
  customOrderId  String
  sortOrder      Int          @default(0)

  // Optional product link — bakery/tailor items often have no SKU.
  // When set, lets convert-to-invoice resolve productId for DocumentLineItem.
  productId      String?

  description    String       @db.VarChar(500)

  // Per-item spec JSON. Free-form by design — driven by the per-business
  // `CustomFieldDefinition` rows that already exist in HP. Examples:
  //   bakery: { flavor: 'vanilla', tier: 3, eggless: true, message: 'Happy Birthday Riya', topper: 'unicorn' }
  //   tailor: { measurements: { chest: 38, waist: 32, length: 42 }, fabric: 'silk', style: 'kurta' }
  // Validated at the schema layer against the business's CustomFieldDefinitions
  // for entityType='custom_order_item' (existing infra; no new tables).
  spec           Json?

  // Quantity matches HP convention: Decimal(12,3) for fractional units.
  quantity       Decimal      @db.Decimal(12, 3)

  // Money — PAISE Int, matches DocumentLineItem.
  ratePaise      Int          @default(0)
  discountPaise  Int          @default(0)
  totalPaise     Int          @default(0)

  customOrder    CustomOrder  @relation(fields: [customOrderId], references: [id], onDelete: Cascade)
  product        Product?     @relation("CustomOrderItemProduct", fields: [productId], references: [id], onDelete: SetNull)

  @@index([customOrderId])
  @@index([productId])
}

model CustomOrderAdvance {
  id             String       @id @default(cuid())
  customOrderId  String

  // Money received against this order before the invoice exists.
  amountPaise    Int

  // Same set of payment methods used by the existing Payment model — keep them
  // as a string here (not the full Payment.method enum) so we can replay into
  // payment.service.recordPayment without a brittle enum-import dependency.
  // Validation lives in the Zod schema (see §3.schemas).
  method         String       @db.VarChar(40)   // 'cash' | 'upi' | 'bank' | 'cheque' | 'card' | 'other'
  reference      String?      @db.VarChar(120)  // UPI ref, cheque no., etc.
  receivedAt     DateTime     @default(now())
  notes          String?      @db.VarChar(500)

  // When the order converts, we stamp the resulting Payment row id here so we
  // can show the audit chain on the invoice and prevent double-counting.
  paymentId      String?

  // Audit
  createdBy      String
  createdAt      DateTime     @default(now())

  customOrder    CustomOrder  @relation(fields: [customOrderId], references: [id], onDelete: Cascade)

  @@index([customOrderId])
}
```

### 1b. Inverse relations to add to existing models

`model Business` (the existing relation block):

```prisma
  // Phase 4 — Bakery/tailor vertical
  customOrders          CustomOrder[]
```

`model Party`:

```prisma
  customOrders   CustomOrder[]
```

`model Document` (with the other forward relations like `creditDebitNotes` and the Phase-3 `jobOrigin`):

```prisma
  // Phase 4 — Set when this Document was created by converting a CustomOrder
  customOrderOrigin      CustomOrder? @relation("CustomOrderInvoice")
```

`model Product` (with the Phase-3 `jobItems`):

```prisma
  customOrderItems      CustomOrderItem[] @relation("CustomOrderItemProduct")
```

### Conventions verified against codebase

Identical adoption to Phase 3 (`PHASE_3_ARCHITECTURE.md` §1c). All money in PAISE Int, quantities Decimal(12,3), soft-delete trio + audit trio + `clientId` for offline, FK delete behaviour: `Restrict` on `business`/`party`, `Cascade` on child line items, `SetNull` on the optional forward link to `Document`. Tenant-prefixed composite indexes.

---

## 2. Migration plan

```bash
# from server/
npx prisma migrate dev --name phase4_custom_orders
```

**Migration filename pattern:** `YYYYMMDDHHmmss_phase4_custom_orders` —
matches the Phase 3 file `20260505150000_phase3_jobs/`.

**Order inside the migration (Prisma will generate; we verify):**
1. `CREATE TYPE "CustomOrderStatus" AS ENUM (…)`
2. `CREATE TABLE "CustomOrder"` + indexes + `@@unique([businessId, orderNumber])`
3. `CREATE TABLE "CustomOrderItem"` + indexes
4. `CREATE TABLE "CustomOrderAdvance"` + indexes
5. FKs in dependency order (Business, Party, Document, Product all already exist; Phase 3 `Job`/`JobItem` unaffected)

**No backfill required** — all three tables are new and empty at v0.

**Rollback note:** forward-only. To revert in dev: `npx prisma migrate reset` or write a follow-up `phase4_custom_orders_revert` dropping the three tables + enum. Pre-tool-gate.sh blocks `db push`; we always go through `migrate dev` (per `.claude/rules/PRISMA_MIGRATION_RULES.md`).

---

## 3. Service layer

### File map (every file ≤ 250 LOC)

| Path | Purpose | Reuses |
|---|---|---|
| `server/src/schemas/custom-order.schemas.ts` | Zod: `createCustomOrderSchema`, `updateCustomOrderSchema`, `transitionCustomOrderSchema`, `listCustomOrdersSchema`, `recordAdvanceSchema`, `convertCustomOrderToInvoiceSchema`. Exports inferred types. | `paise()`, `decimalQty()` from `schemas/_shared.ts`; `PAYMENT_METHODS` const from `schemas/payment.schemas.ts` |
| `server/src/services/custom-order/selects.ts` | `CUSTOM_ORDER_LIST_SELECT`, `CUSTOM_ORDER_DETAIL_SELECT` | mirrors `services/job/selects.ts` |
| `server/src/services/custom-order/helpers.ts` | `STATUS_TRANSITIONS` table, `assertTransitionAllowed(from, to)`, `requireCustomOrder(businessId, id)`, `recomputeTotals(items, discountPaise)`, `recomputeAdvanceAndBalance(orderId, tx)` | `notFoundError`, `validationError` from `lib/errors.ts`; `prisma` |
| `server/src/services/custom-order/create.ts` | `createCustomOrder(businessId, userId, input)` | `generateNextNumber(tx, businessId, 'CUSTOM_ORDER', date)` — extend the document-number-service enum to accept `'CUSTOM_ORDER'`; series template `ORD-{FY}-{seq}` |
| `server/src/services/custom-order/get-list.ts` | `getCustomOrder`, `listCustomOrders(businessId, query)` — cursor pagination via `(deliveryAt, id)` for the calendar view, fallback `(updatedAt, id)` for the all-orders view | shared cursor util |
| `server/src/services/custom-order/update.ts` | `updateCustomOrder` — patch title, notes, deliveryAt, deliverySlot, deliveryAddress, items, discountPaise. Recomputes totals + balance. Forbidden if `status` ∈ {INVOICED, CANCELLED} | helpers |
| `server/src/services/custom-order/transition.ts` | `transitionCustomOrder(businessId, id, userId, toStatus, reason?)` — server-enforced state machine. Stamps lifecycle timestamps on entry to each state (productionStartedAt / readyAt / deliveredAt / cancelledAt) | helpers.STATUS_TRANSITIONS |
| `server/src/services/custom-order/record-advance.ts` | `recordAdvance(businessId, orderId, userId, input)` — inserts a CustomOrderAdvance row in a transaction, calls `recomputeAdvanceAndBalance`. Refuses if order is INVOICED/CANCELLED. | helpers |
| `server/src/services/custom-order/delete-advance.ts` | `deleteAdvance(businessId, orderId, advanceId, userId)` — hard-delete (advance is pre-invoice, no ledger impact yet). Same INVOICED/CANCELLED guard. | helpers |
| `server/src/services/custom-order/convert-to-invoice.ts` | **`convertCustomOrderToInvoice(businessId, orderId, userId)`** | `createDocument` from `services/document/create.ts`; `recordPayment` from `services/payment.service.ts`; `ensureServicePlaceholder` from `services/product/placeholders.ts` (added in Phase 3) |
| `server/src/services/custom-order/delete.ts` | `softDeleteCustomOrder` — set `isDeleted/deletedAt/deletedBy`, no FK cascade | matches `job/delete.ts` |
| `server/src/services/custom-order.service.ts` | Barrel re-export — mirrors `services/job.service.ts` | — |
| `server/src/routes/custom-orders.ts` | Express router | `auth`, `requirePermission`, `validate`, `asyncHandler`, `sendSuccess` |

### Function signatures

```ts
// schemas/custom-order.schemas.ts
export const customOrderItemSchema = z.object({
  productId: z.string().cuid().nullable().optional(),
  description: z.string().min(1).max(500),
  spec: z.record(z.string(), z.unknown()).nullable().optional(),  // free-form
  quantity: decimalQty(),
  ratePaise: paise(),
  discountPaise: paise().optional().default(0),
})

export const createCustomOrderSchema = z.object({
  partyId: z.string().cuid(),
  title: z.string().min(1).max(200),
  notes: z.string().max(5000).nullable().optional(),
  deliveryAt: z.string().datetime().nullable().optional(),
  deliverySlot: z.string().max(40).nullable().optional(),
  deliveryAddress: z.string().max(500).nullable().optional(),
  discountPaise: paise().optional().default(0),
  items: z.array(customOrderItemSchema).min(1).max(200),
  clientId: z.string().min(1).max(64).optional(),
})
export type CreateCustomOrderInput = z.infer<typeof createCustomOrderSchema>

export const updateCustomOrderSchema = createCustomOrderSchema.partial().omit({ clientId: true })

export const transitionCustomOrderSchema = z.object({
  toStatus: z.enum(['RECEIVED','IN_PRODUCTION','READY','DELIVERED','CANCELLED']),
  reason: z.string().max(500).optional(),     // required when toStatus === CANCELLED (refined)
})

export const recordAdvanceSchema = z.object({
  amountPaise: paise().refine(v => v > 0, 'Amount must be positive'),
  method: z.enum(['cash','upi','bank','cheque','card','other']),
  reference: z.string().max(120).nullable().optional(),
  receivedAt: z.string().datetime().optional(),
  notes: z.string().max(500).nullable().optional(),
})

export const listCustomOrdersSchema = z.object({
  status: z.enum([...CUSTOM_ORDER_STATUSES]).optional(),
  partyId: z.string().cuid().optional(),
  q: z.string().max(120).optional(),                    // search title/notes
  deliveryFrom: z.string().datetime().optional(),
  deliveryTo: z.string().datetime().optional(),
  hasBalance: z.coerce.boolean().optional(),            // balancePaise > 0
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
```

```ts
// services/custom-order/create.ts
export async function createCustomOrder(
  businessId: string,
  userId: string,
  data: CreateCustomOrderInput,
): Promise<CustomOrderDetail>
```

```ts
// services/custom-order/transition.ts
export async function transitionCustomOrder(
  businessId: string,
  orderId: string,
  userId: string,
  toStatus: CustomOrderStatus,
  reason?: string,
): Promise<CustomOrderDetail>
```

```ts
// services/custom-order/record-advance.ts
export async function recordAdvance(
  businessId: string,
  orderId: string,
  userId: string,
  input: RecordAdvanceInput,
): Promise<CustomOrderDetail>
```

```ts
// services/custom-order/convert-to-invoice.ts
export async function convertCustomOrderToInvoice(
  businessId: string,
  orderId: string,
  userId: string,
): Promise<DocumentDetail>   // returns the new SALE_INVOICE
```

### `convertCustomOrderToInvoice` — reuse strategy (no duplication)

Mirrors Phase 3 `convertJobToInvoice` (`server/src/services/job/convert-to-invoice.ts`). Pseudocode:

```ts
import { createDocument } from '../document/create.js'
import { recordPayment } from '../payment.service.js'
import { ensureServicePlaceholder } from '../product/placeholders.js'   // added in Phase 3
import { requireCustomOrder } from './helpers.js'

export async function convertCustomOrderToInvoice(businessId, orderId, userId) {
  const order = await requireCustomOrder(businessId, orderId, {
    items: { select: { productId, description, quantity, ratePaise, discountPaise, spec } },
    advances: { select: { id, amountPaise, method, reference, receivedAt, paymentId } },
    invoiceId: true, status: true, partyId: true, totalPaise: true, advancePaise: true,
    discountPaise: true,
  })

  if (order.invoiceId) throw validationError('Order is already invoiced')
  if (order.status === 'CANCELLED') throw validationError('Cannot invoice a cancelled order')
  if (order.status !== 'DELIVERED' && order.status !== 'READY') {
    // bakery/tailor flow: invoice only after the customer has the goods
    throw validationError('Order must be READY or DELIVERED before invoicing')
  }

  // Items without productId need a placeholder product to satisfy
  // DocumentLineItem.productId NOT NULL — same helper Phase 3 introduced.
  const lineItems = await Promise.all(order.items.map(async (it) => ({
    productId: it.productId ?? await ensureServicePlaceholder(businessId, it.description),
    quantity: Number(it.quantity),
    rate: it.ratePaise,
    discountType: 'AMOUNT' as const,
    discountValue: it.discountPaise,
    // Spec lands in DocumentLineItem.description as a one-line summary —
    // reusing the existing field; no Document edits.
    description: it.description + (it.spec ? formatSpecOneLiner(it.spec) : ''),
  })))

  // 1. Create the SALE_INVOICE — single call, all the heavy lifting in createDocument.
  const invoice = await createDocument(businessId, userId, {
    type: 'SALE_INVOICE',
    status: 'SAVED',
    partyId: order.partyId,
    documentDate: new Date().toISOString().split('T')[0],
    lineItems,
    additionalCharges: [],
    includeSignature: false,
    notes: `Generated from Custom Order ${order.orderNumber ?? order.id}`,
    termsAndConditions: null,
  })

  // 2. Replay each advance as a Payment row — keeps ledger + outstanding correct,
  //    and stamps the resulting Payment.id back onto CustomOrderAdvance.paymentId
  //    for the audit chain.
  for (const adv of order.advances) {
    const payment = await recordPayment(businessId, userId, {
      partyId: order.partyId,
      documentId: invoice.id,
      amountPaise: adv.amountPaise,
      method: adv.method,
      reference: adv.reference ?? null,
      paidAt: adv.receivedAt,
      kind: 'RECEIVED',
    })
    await prisma.customOrderAdvance.update({
      where: { id: adv.id },
      data: { paymentId: payment.id },
    })
  }

  // 3. Link both directions and move state.
  await prisma.customOrder.update({
    where: { id: orderId },
    data: { invoiceId: invoice.id, status: 'INVOICED' },
  })

  return invoice
}
```

Reused utilities (none re-implemented):
- `generateNextNumber` — extend its allowed-type set to include `'CUSTOM_ORDER'` (one-line change; same change Phase 3 made for `'JOB'`). Series template `ORD-{FY}-{seq}` registered in `DocumentNumberSeries`.
- `calculateDocumentTotals`, GST calc, stock decrement, outstanding update, `DOCUMENT_DETAIL_SELECT`, audit middleware, SSE auto-emit — hit via `createDocument`.
- `recordPayment` — existing `services/payment.service.ts` API. No new payment code path.
- `ensureServicePlaceholder(businessId, label)` — already exists from Phase 3 (`services/product/placeholders.ts`). Idempotent.

---

## 4. Status machine

Server enforces. Client mirrors via `src/features/orders/orders.constants.ts`.

| From \ To           | RECEIVED | IN_PRODUCTION | READY | DELIVERED | INVOICED | CANCELLED |
|---------------------|----------|---------------|-------|-----------|----------|-----------|
| **RECEIVED**        | —        | yes           | yes¹  | —         | —        | yes       |
| **IN_PRODUCTION**   | yes      | —             | yes   | —         | —        | yes       |
| **READY**           | —        | yes           | —     | yes       | (via convert-to-invoice only) | yes |
| **DELIVERED**       | —        | —             | yes   | —         | (via convert-to-invoice only) | yes |
| **INVOICED**        | —        | —             | —     | —         | —        | —         |
| **CANCELLED**       | —        | —             | —     | —         | —        | —         |

¹ Direct RECEIVED → READY allowed for off-the-shelf cake/garment cases (no production lead time).

Rules:
- `INVOICED` is reachable only via `POST /custom-orders/:id/convert-to-invoice`, never via the generic transition endpoint.
- `CANCELLED` requires `reason` (Zod refinement).
- Transition into `IN_PRODUCTION` stamps `productionStartedAt = now()`. Into `READY` stamps `readyAt`. Into `DELIVERED` stamps `deliveredAt`. Into `CANCELLED` stamps `cancelledAt + cancelReason`.
- Once `INVOICED` or `CANCELLED`, the order is read-only — `updateCustomOrder`, `recordAdvance`, `deleteAdvance`, `softDeleteCustomOrder` all reject with 409.

---

## 5. REST endpoints

All routes mounted at `/api/custom-orders` (registered in `server/src/app.ts` after `jobRoutes`). All require `auth` + tenant scoping by `req.user.businessId`. POST/PATCH go through `validate(schema)`. POSTs honour idempotency via `clientId`.

| # | Method | Path | Permission | Request | Response | Idempotency |
|---|--------|------|------------|---------|----------|-------------|
| 1 | GET    | `/api/custom-orders` | `orders.view` | query: `listCustomOrdersSchema` | `{ items: CustomOrderListRow[], nextCursor: string \| null }` | safe |
| 2 | GET    | `/api/custom-orders/:id` | `orders.view` | — | `CustomOrderDetail` | safe |
| 3 | POST   | `/api/custom-orders` | `orders.create` | body: `createCustomOrderSchema` | `CustomOrderDetail` (201) | `clientId` unique → 200 with existing row on replay |
| 4 | PATCH  | `/api/custom-orders/:id` | `orders.edit` | body: `updateCustomOrderSchema` | `CustomOrderDetail` | global `If-Match` etag conflict middleware |
| 5 | POST   | `/api/custom-orders/:id/transition` | `orders.edit` | body: `transitionCustomOrderSchema` | `CustomOrderDetail` | repeated transition to same status returns 200 no-op |
| 6 | POST   | `/api/custom-orders/:id/advances` | `orders.edit` | body: `recordAdvanceSchema` | `CustomOrderDetail` (with new advance row) | `Idempotency-Key` header (existing middleware) |
| 7 | DELETE | `/api/custom-orders/:id/advances/:advanceId` | `orders.edit` | — | `CustomOrderDetail` | natural — repeat returns 404 |
| 8 | POST   | `/api/custom-orders/:id/convert-to-invoice` | `orders.edit` + `invoicing.create` | — | `DocumentDetail` (the new SALE_INVOICE) | `CustomOrder.invoiceId` unique → replay returns existing invoice |
| 9 | DELETE | `/api/custom-orders/:id` | `orders.delete` | — | `{ success: true }` | natural — repeat returns 200 |
| 10 | GET   | `/api/custom-orders/recycle` (+ `POST /:id/restore`, `DELETE /:id/permanent`) | `orders.delete` | — | recycle bin shape matching `documents/recycle.ts` | safe |

**Response envelope:** `sendSuccess` / `sendError` (same as Phase 3).

**Sample shapes:**

```ts
type CustomOrderListRow = {
  id: string
  orderNumber: string | null
  title: string
  status: CustomOrderStatus
  partyId: string
  partyName: string
  deliveryAt: string | null
  deliverySlot: string | null
  totalPaise: number
  advancePaise: number
  balancePaise: number
  invoiceId: string | null
  updatedAt: string
}

type CustomOrderDetail = CustomOrderListRow & {
  notes: string | null
  deliveryAddress: string | null
  subtotalPaise: number
  discountPaise: number
  productionStartedAt: string | null
  readyAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  items: Array<{
    id: string
    sortOrder: number
    productId: string | null
    description: string
    spec: Record<string, unknown> | null
    quantity: string             // Decimal serialised as string
    ratePaise: number
    discountPaise: number
    totalPaise: number
  }>
  advances: Array<{
    id: string
    amountPaise: number
    method: 'cash'|'upi'|'bank'|'cheque'|'card'|'other'
    reference: string | null
    receivedAt: string
    notes: string | null
    paymentId: string | null
  }>
  createdAt: string
  createdBy: string
}
```

**Error contract:**
- 400 — Zod validation, status-machine violation, advance-on-finalised-order
- 401 — not authed
- 403 — `FORBIDDEN` (no permission), `NO_BUSINESS`
- 404 — order not found / cross-tenant / soft-deleted; advance not found
- 409 — etag mismatch on PATCH; `ALREADY_INVOICED` on convert

---

## 6. Permissions

### 6a. `server/src/services/settings/permissions.ts` — append one entry

```ts
{
  key: 'orders', label: 'Custom Orders',
  actions: [
    { key: 'view',   label: 'View Custom Orders' },
    { key: 'create', label: 'Create Custom Orders' },
    { key: 'edit',   label: 'Edit Custom Orders' },
    { key: 'delete', label: 'Delete Custom Orders' },
  ],
},
```

Produces: `orders.view`, `orders.create`, `orders.edit`, `orders.delete`.

### 6b. Role updates (additive)

| Role | New grants | Why |
|---|---|---|
| **Owner** | (auto via `role === 'owner'` bypass) | unchanged |
| **Partner** | all 4 (auto via `ALL_PERMISSIONS.filter(...)`) | unchanged |
| **Manager** | all 4 (auto) | unchanged |
| **Salesman** | `orders.view`, `orders.create`, `orders.edit` | takes orders, records advances; no delete |
| **Cashier** | `orders.view`, `orders.edit` | needs to record advances at the counter |
| **Stock Manager** | `orders.view` | knows what's in production |
| **Delivery Boy** | `orders.view` | sees today's deliveries (FE-only filter) |
| **Accountant** | `orders.view` | needs read for reports |

Same one-shot grant script pattern as Phase 3 (`scripts/grant-orders-permission.ts`) to backfill existing role rows that the idempotent `update: {}` upsert won't touch.

### 6c. Visibility on the FE

`usePermission('orders.view')` — same hook used by Phase 3 (`src/hooks/usePermission.ts`).

---

## 7. Frontend file map — `src/features/orders/` (6-layer split)

All files ≤ 250 LOC. Mobile-first (320px). All 4 UI states per page.

```
src/features/orders/
├── orders.types.ts                       # CustomOrder, CustomOrderItem, CustomOrderAdvance, CustomOrderStatus, list/detail mirrors
├── orders.constants.ts                   # CUSTOM_ORDER_STATUSES, STATUS_TRANSITIONS table, status colour map, route paths
├── orders.utils.ts                       # formatOrderNumber(), getNextStatuses(), canTransition(), totalsFromItems(), formatSpecOneLiner()
├── api/
│   ├── orders.api.ts                     # list/get/create/update/transition/recordAdvance/deleteAdvance/convert/delete — all via api()
│   └── orders.api.types.ts               # request/response interfaces (mirror server schemas)
├── hooks/
│   ├── useCustomOrders.ts                # TanStack useInfiniteQuery — cursor pagination
│   ├── useCustomOrder.ts                 # useQuery for detail
│   ├── useTodayDeliveries.ts             # useQuery — list filtered to deliveryAt = today; used by dashboard widget
│   ├── useTomorrowDeliveries.ts          # useQuery — list filtered to deliveryAt = tomorrow
│   ├── useCreateCustomOrder.ts           # mutation; entityType:'order', entityLabel: title
│   ├── useUpdateCustomOrder.ts           # mutation; tolerates {} optimistic return
│   ├── useTransitionCustomOrder.ts       # mutation
│   ├── useRecordAdvance.ts               # mutation
│   ├── useDeleteAdvance.ts               # mutation
│   └── useConvertCustomOrderToInvoice.ts # mutation; on success, navigate to /invoices/:id
├── components/
│   ├── CustomOrderListItem.tsx           # one row: status pill + title + party + Rs total + balance chip + delivery date
│   ├── CustomOrderStatusPill.tsx         # colour-coded chip (reuses Phase 3 status-pill pattern)
│   ├── CustomOrderStatusActions.tsx      # buttons: current → allowed transitions
│   ├── CustomOrderForm.tsx               # shared by new + edit; reuses PartySearchInput + LineItemsEditor (from invoices)
│   ├── CustomOrderItemSpecEditor.tsx     # dynamic key/value editor driven by per-business CustomFieldDefinition rows for entityType='custom_order_item'
│   ├── CustomOrderItemsList.tsx          # detail-page items table (read-only) with spec rendering
│   ├── CustomOrderAdvancesList.tsx       # advance ledger inside the order
│   ├── RecordAdvanceModal.tsx            # small form: amount + method + reference + notes
│   ├── DeliverySlotPicker.tsx            # date + slot dropdown (morning/afternoon/evening + custom)
│   ├── CustomOrderConvertButton.tsx      # button on READY/DELIVERED orders → calls convert-to-invoice
│   ├── TodayDeliveriesWidget.tsx         # dashboard card; visible only for bakery/tailor verticals
│   ├── TomorrowDeliveriesWidget.tsx      # dashboard card; visible only for bakery/tailor verticals
│   ├── CustomOrdersEmptyState.tsx        # empty UI state
│   ├── CustomOrdersErrorState.tsx        # error UI state
│   └── CustomOrdersListSkeleton.tsx      # loading UI state
└── pages/
    ├── CustomOrdersListPage.tsx          # /orders — list with status filter pill row + balance-only toggle
    ├── CustomOrderNewPage.tsx            # /orders/new
    ├── CustomOrderEditPage.tsx           # /orders/:id/edit
    └── CustomOrderDetailPage.tsx         # /orders/:id — header, status pill, actions, items, advances, convert CTA
```

**Routes** added to `src/routes.tsx` (lazy-imported):
- `/orders` → `CustomOrdersListPage`
- `/orders/new` → `CustomOrderNewPage`
- `/orders/:id` → `CustomOrderDetailPage`
- `/orders/:id/edit` → `CustomOrderEditPage`

**Translations** — every visible string keyed in `src/lib/translations.en.ext*.ts` and `src/lib/translations.hi.ext*.ts` in the same commit.

**Reuse callouts:**
- `PartySearchInput` — shared with invoices, jobs.
- `LineItemsEditor` — shared with invoices; `CustomOrderForm` extends with the spec editor and delivery slot picker.
- Status-pill pattern — copy `JobStatusPill.tsx` shape; only colour map + label keys differ.
- `convert-to-invoice` service-placeholder pattern — `ensureServicePlaceholder` lives in `services/product/placeholders.ts` (Phase 3); Phase 4 imports it. **No duplication.**

---

## 8. Visibility rule — Orders nav appears only for bakery / tailor (and pure-service hybrids)

`src/config/verticals.config.ts` already has `'orders'` in the `NavKey` union (line 36) and `isNavVisible` already has the `'orders'` branch returning `false` (line 242). Phase 4 fills it in.

### Approach (additive — no breaking signature change)

Add a derived constant and flip the `isNavVisible` branch:

```ts
// in verticals.config.ts (additions)

/** Verticals that CAN see the Custom Orders nav. SSOT for Phase 4 visibility. */
export const ORDERS_VISIBLE_VERTICALS: ReadonlySet<BusinessType> = new Set([
  'bakery', 'tailor',
])

// modify isNavVisible:
export function isNavVisible(vertical: VerticalProfile, key: NavKey): boolean {
  if (vertical.hiddenNavKeys.has(key)) return false
  if (key === 'jobs')   return JOBS_VISIBLE_VERTICALS.has(vertical.type)
  if (key === 'orders') return ORDERS_VISIBLE_VERTICALS.has(vertical.type)
  return true
}
```

Concretely:
- `bakery`, `tailor` — `'orders'` shown.
- All others — `'orders'` NOT shown (current behaviour preserved).

Whitelist starts narrow on purpose. Florists, custom-jewellery, and other custom-order verticals can be added in a follow-up by extending `ORDERS_VISIBLE_VERTICALS`; no schema or service changes required.

A unit test in `verticals.config.spec.ts` asserts:
- `isNavVisible(bakery, 'orders') === true`
- `isNavVisible(tailor, 'orders') === true`
- `isNavVisible(retail, 'orders') === false`
- `isNavVisible(services, 'orders') === false`
- Phase-3 cases still pass (`isNavVisible(services, 'jobs') === true`, `isNavVisible(retail, 'invoices') === true`).

### Dashboard widgets

`TodayDeliveriesWidget` and `TomorrowDeliveriesWidget` are gated by:

```ts
const vertical = useVertical()
if (!ORDERS_VISIBLE_VERTICALS.has(vertical.type)) return null
```

placed in the existing `DashboardPage` widget grid, after the cash-flow strip.

---

## 9. Risk surface + acceptance criteria

### Risks + mitigations

| Risk | Mitigation |
|---|---|
| **State-machine drift** between client constants and server helpers (same risk as Phase 3). | Single shared table; unit-test parity check between `services/custom-order/helpers.ts.STATUS_TRANSITIONS` and `src/features/orders/orders.constants.ts.STATUS_TRANSITIONS` via a JSON snapshot read by both sides at build time (or simple object-deep-equal in the spec). |
| **`Document.partyId` mandatory but `CustomOrderItem.productId` isn't.** Convert-to-invoice would crash on `DocumentLineItem.productId NOT NULL`. | Reuse `ensureServicePlaceholder` from Phase 3 (already idempotent + unit-tested). |
| **`generateNextNumber` only knows document types + JOB today.** | Extend its allowed-type set to include `'CUSTOM_ORDER'`; add `ORD-{FY}-{seq}` template to `DocumentNumberSeries`. Single-PR change, integration-tested. |
| **Permission rollout** — adding `orders.*` doesn't retroactively grant existing Salesman/Cashier rows. | `scripts/grant-orders-permission.ts` one-shot updater; same pattern Phase 3 used. |
| **Convert-to-invoice race** — two clients hit convert simultaneously. | `CustomOrder.invoiceId @unique` blocks the second write with P2002. Service catches → `409 ALREADY_INVOICED`. |
| **Advance double-counting** — convert replays advances as Payments; if a network blip causes a partial commit, ledger could be wrong. | Wrap createDocument + recordPayment loop + final `customOrder.update` in a single Prisma `$transaction`. `paymentId` stamping inside the transaction makes replay idempotent (re-running convert sees `invoiceId !== null` → 409 before any new Payment row is written). |
| **Advance refund / cancellation after recording but before convert.** | `DELETE /custom-orders/:id/advances/:advanceId` works while order is non-final. After `INVOICED`, advances are immutable (the linked Payment is the source of truth from then on). |
| **Soft-delete + invoice link** — deleting an order that already has an invoice should not remove the invoice. | `onDelete: SetNull` on `CustomOrder.invoice` FK + soft-delete leaves the document untouched (same as Phase 3 Job). |
| **Offline create followed by online convert** — clientId may not yet be flushed when user converts. | UI gates the Convert button on `order.invoiceId === null && (status === 'READY' || status === 'DELIVERED') && navigator.onLine`. Same pattern as Phase 3. |
| **Spec JSON unbounded growth.** | Zod caps spec object size at 8 KB serialised; reject larger payloads at the route. |
| **High-risk gate** on `prisma/schema.prisma`. | `design-plan-active.md` updated alongside this doc; both committed before the schema PR. |
| **Index hot path** — `(businessId, deliveryAt)` covers Today/Tomorrow widgets and the calendar view; `(businessId, status)` covers the kanban filter; `balancePaise` is persisted (not generated) so the hasBalance filter scans the index, not the table. | Indexes match query plans verified in seed environment. |

### Acceptance — Phase 4 ships when ALL of these are green

**Backend**
- [ ] `tsc` clean across server.
- [ ] `enforce.js` clean (no new patterns; offline rules satisfied).
- [ ] `npx prisma migrate dev --name phase4_custom_orders` runs cleanly on a fresh DB.
- [ ] Unit: `services/custom-order/helpers.spec.ts` covers every cell of the transition table (allowed + forbidden).
- [ ] Integration: Custom Order CRUD happy path (`scripts/curl/custom-orders-crud.sh`) — POST 201 → GET list 200 → GET detail 200 → PATCH 200 → DELETE 200 → GET 404.
- [ ] Integration: Transition path — RECEIVED → IN_PRODUCTION → READY → DELIVERED transitions all 200; RECEIVED → DELIVERED returns 400 `INVALID_TRANSITION`; CANCELLED with no `reason` returns 400.
- [ ] Integration: Record-advance — 3 advances summed correctly into `advancePaise` and `balancePaise`; deleting one recomputes both; recording on INVOICED order returns 409.
- [ ] Integration: Convert-to-invoice — READY order with 2 advances → POST convert → 201 SALE_INVOICE; resulting Document has correct totals (`grandTotal === sum(items.totalPaise) - discountPaise`); 2 Payment rows written, each linked back to the originating CustomOrderAdvance via `paymentId`; subsequent POST returns 409 `ALREADY_INVOICED`; CustomOrder.status moves to INVOICED.
- [ ] Integration: 401 (no auth), 403 (no permission as Cashier trying to delete), 404 (cross-tenant id) covered.
- [ ] Service-placeholder product reuse — converting a Phase-3 Job and a Phase-4 Order in the same business produces ONE shared `__SERVICE__` Product row (no duplicate).

**Frontend**
- [ ] All 4 UI states for `/orders` — screenshots in `docs/business-verticals/screenshots/phase4/orders-list-{loading,error,empty,success}.png`.
- [ ] All 4 UI states for `/orders/:id` — screenshots `orders-detail-*.png`.
- [ ] `/orders/new` form validates required fields at 320px width — screenshot `orders-new-320.png`.
- [ ] Spec editor renders bakery test fixture (`{ flavor, tier, eggless, message }`) and tailor test fixture (`{ measurements: {...}, fabric, style }`) — 2 screenshots.
- [ ] SideNav shows "Custom Orders" only for `bakery`, `tailor` — 2 positive screenshots + 1 negative for `retail`.
- [ ] Dashboard "Today's Deliveries" + "Tomorrow's Deliveries" widgets render only for `bakery`/`tailor` — 4 screenshots (today/tomorrow × bakery/tailor) + 1 negative for retail dashboard with no widgets.
- [ ] Convert button on a READY/DELIVERED order navigates to the new invoice; offline disables it with tooltip.
- [ ] Record Advance modal happy path — submit → list + advancePaise + balancePaise update without page refresh.
- [ ] All API calls go through `api()` with `entityType: 'order'` / `'order_advance'` and a meaningful `entityLabel` (order title). `scripts/enforce-offline.mjs` clean.

**Cross-cutting**
- [ ] Hindi translations present for every new key in the same commit.
- [ ] `verticals.config.spec.ts` updated with the `isNavVisible` cases above.
- [ ] No new file > 250 LOC. No `any` in new TS. No floating-point money.

---

## 10. Out of scope — Phase 4 (deferred)

Explicit non-goals for this phase:

- **PDF order receipt template.** v0 reuses the existing invoice/quote PDF for the eventual SALE_INVOICE; the order itself is screen-only. A dedicated "Order Receipt" PDF (with delivery date block, advance receipt, balance due) is Phase 4.5.
- **WhatsApp delivery reminders to customers.** Use the existing reminder system out-of-band. Auto-trigger on `deliveryAt - 1 day` is Phase 5.
- **Recurring orders** (weekly bread subscriptions). Defer — would touch `RecurringInvoice` machinery; design separately.
- **Order templates** (saved title/items/spec presets — "1 kg vanilla cake template"). Defer — needs a `CustomOrderTemplate` table.
- **Staff/baker assignment** beyond a free-text `notes` field. No `assignedTo: User` FK in v0. Phase 5 (appointments) is the right home.
- **Calendar / kanban views.** v0 ships a list view with status filter pills + Today/Tomorrow widgets. Calendar earns its slot once usage demands it.
- **Order-level photos / attachments.** Add later via a generic `Attachment` table reused by Document/Order/Job.
- **Per-vertical default custom-field templates** (auto-seed bakery's CustomFieldDefinitions on business creation). Hook for Phase 2's vertical-defaults seeder; not Phase 4.
- **Refunding an advance after cancellation** as a discrete bookkeeping event. v0 hard-deletes the advance row pre-invoice; post-cancel refunds are tracked via the existing `Payment` (kind: `REFUND`) flow once an invoice exists. No Phase-4 work needed.
- **Vertical-specific terminology overrides** beyond what `useTerm()` already supplies (`termOrder` for bakery/tailor is already wired). Per-status labels per vertical ("Baking" instead of "In Production" for bakery; "Stitching" for tailor) are Phase 5 polish.
