# SCOPE — Bill of Materials / Item Conversion / Production Runs
**Feature #115 · Phase 4 · HisaabPro**

---

## Summary

Allow manufacturers and assemblers to define recipes (Bills of Materials) mapping raw component products to a finished good, then execute "Production Runs" that atomically consume raw stock, produce finished stock, and update the finished good's weighted-average cost from the components consumed.

---

## Goal

Priya and Amit need raw-material consumption tracked for COGS without manual stock adjustments. A BOM pins the recipe version; a Production Run is the atomic execution event. All inventory changes happen in a single Prisma `$transaction` — partial runs never exist in the database.

---

## Personas

| Persona | Use case | Key pain |
|---------|----------|----------|
| Priya (2-5 staff wholesaler) | Gift basket kitting: 2× chocolate + 1× wrapping → 1 basket | Loses track of raw stock consumed; COGS is guesswork |
| Amit (5-20 staff distributor) | Bulk → retail repacking: 1× 25 kg bag → 25× 1 kg packs | Needs audit trail of every re-pack run for reconciliation |

---

## User Stories

1. As Priya, I want to define a BOM for "Gift Basket" listing component products and quantities, so that running production automatically deducts raw stock and adds basket stock.
2. As Priya, I want the system to warn me if I don't have enough raw material before I confirm a run.
3. As Amit, I want to cancel a completed production run and see all stock movements reversed, so I can correct mistakes without manual adjustments.
4. As an Owner/Manager, I want to see a list of all production runs with date, BOM name, quantity, and status, so I can reconcile inventory.
5. As an Owner, I want BOM editing to be version-controlled: editing a BOM that has runs creates a new version rather than mutating history.

---

## Out of Scope (v1)

- Multi-level BOM (BOM referencing another BOM as a component) — future work
- Labour cost / manufacturing time — future
- BOM cost-rollup report — future (basic per-unit cost shown on detail page only)
- Multi-godown production (component pulled from specific godown) — single default godown only
- PDF export of production run — future
- Wastage / yield percentage — future
- GST on produced goods — deferred to Phase 2 GST expansion
- Scheduled / recurring production runs — future

---

## Assumptions

1. `Product.currentStock` is a `Float` (supports decimals) — quantities in BOM and production runs use `Float` matching this convention, NOT integer × 1000. The qty-scaling requirement in the brief is superseded by the actual schema which stores `currentStock` as `Float` directly.
2. `Product.weightedAvgCostPaise` is `BigInt` (paise). `computeWeightedAvg` in `server/src/services/stock/invoice-ops-purchase.ts` is reused for finished-good cost propagation.
3. Idempotency reuses the `IdempotencyLog` table with prefix `prod:{businessId}:{key}` following the same pattern as POS.
4. Stock validation mode is read from `InventorySetting.stockValidationMode` (business-level) but each component product's `Product.stockValidation` field (`GLOBAL | WARN_ONLY | HARD_BLOCK`) takes precedence when not `GLOBAL`.
5. Cancelling a run is only allowed when `status = COMPLETED`. DRAFT runs are simply deleted. Cancelled runs cannot be re-activated.
6. Only one godown is supported in v1; `batchId` and `godownId` on created `StockMovement` rows are `null` unless the business has exactly one godown, in which case that godown's id is used automatically.
7. A BOM with zero production runs may be hard-deleted; a BOM with any run (any status) is soft-deleted only.
8. `BomComponent.quantity` stored as `Float` (same decimal support as `Product.currentStock`). Minimum value 0.001.
9. A finished good product may have multiple BOMs but only one `isDefault = true` BOM at a time. The production run wizard defaults to the active default BOM.
10. Permissions follow the existing `Role` + `BusinessUser` RBAC system. New permission strings: `bom.read`, `bom.edit`, `production.run`. Owner and Manager get all three by default. Cashier gets none — Production menu hidden.

---

## Functional Requirements

### BOM Management

**FR-BOM-1** A BOM belongs to one business and references one finished-good `Product`.

**FR-BOM-2** A BOM has a `version` (Int, default 1). Version increments automatically when an edit is attempted on a BOM that has at least one `ProductionRun` referencing it; the old BOM is soft-deactivated (`isActive = false`), a new BOM is created with `version = old.version + 1`, and `isDefault` is transferred.

**FR-BOM-3** A BOM must have at least one `BomComponent`. Maximum 50 components per BOM.

**FR-BOM-4** A `BomComponent` must reference a different product than the BOM's `productId` (no self-reference). All component products must belong to the same business.

**FR-BOM-5** All component quantities must be > 0.

**FR-BOM-6** Duplicate component products within the same BOM are rejected (unique constraint `(bomId, componentProductId)`).

**FR-BOM-7** Soft delete: `isDeleted = true`. BOM with runs can only be soft-deleted.

**FR-BOM-8** `isDefault` is enforced as a single-active flag: setting a BOM as default automatically unsets the previous default for the same `productId` within the same business.

### Production Run Execution

**FR-PR-1** A production run references one BOM and records the finished product id, quantity produced, run date, and status.

**FR-PR-2** Execution is a single Prisma `$transaction`. Any error (stock insufficient in HARD_BLOCK mode, DB constraint, overflow) rolls back all changes. No partial state.

**FR-PR-3** Required qty per component = `bomComponent.quantity × productionRun.quantityProduced`. Overflow guard: reject if result exceeds `Number.MAX_SAFE_INTEGER`.

**FR-PR-4** Stock check per component:
  - Determine effective mode: if `Product.stockValidation = GLOBAL` → use `InventorySetting.stockValidationMode`; else use `Product.stockValidation`.
  - `HARD_BLOCK` + `currentStock < requiredQty` → reject with `400 INSUFFICIENT_STOCK`, include product name and shortfall.
  - `WARN_ONLY` + `currentStock < requiredQty` → proceed, attach `warnings[]` in response.

**FR-PR-5** Per component: create `StockMovement` (type `PRODUCTION_CONSUME`, quantity negative, `referenceType = PRODUCTION_RUN`, `referenceId = productionRun.id`). Update `Product.currentStock -= requiredQty`.

**FR-PR-6** For finished product: create `StockMovement` (type `PRODUCTION_PRODUCE`, quantity positive). Update `Product.currentStock += quantityProduced`.

**FR-PR-7** Weighted-average cost propagation for finished good:
  - `costSnapshot` per component = `Product.weightedAvgCostPaise` at moment of run (captured inside the transaction).
  - `totalComponentCostPaise = Σ(requiredQty × costSnapshot)`.
  - `perUnitCostPaise = totalComponentCostPaise / quantityProduced` (banker's rounding via `computeWeightedAvg`).
  - Update `Product.weightedAvgCostPaise` for finished good using `computeWeightedAvg(prevQty, prevAvg, quantityProduced, perUnitCostPaise)`.

**FR-PR-8** Idempotency: `X-Idempotency-Key` header (UUID v4). Scoped key `prod:{businessId}:{key}` stored in `IdempotencyLog`. TTL: 72 hours. Duplicate request within TTL returns original `ProductionRunDTO` with `201`.

**FR-PR-9** `ProductionRunComponent` rows are created with `quantityConsumed` and `costSnapshot` (BigInt, paise).

### Production Run Cancellation

**FR-CANCEL-1** Only `status = COMPLETED` runs can be cancelled. Attempting to cancel `DRAFT` or `CANCELLED` returns `400 INVALID_STATUS`.

**FR-CANCEL-2** Cancellation creates mirror `StockMovement` rows (type `PRODUCTION_REVERSE`) that exactly negate the original CONSUME and PRODUCE quantities.

**FR-CANCEL-3** `Product.currentStock` is updated for all affected products (components restored, finished good decremented).

**FR-CANCEL-4** `ProductionRun.status` is set to `CANCELLED`. No new `ProductionRunComponent` rows created (original rows remain for audit).

**FR-CANCEL-5** Weighted-average cost is NOT reversed on cancellation (matching existing pattern for purchase invoice reversals — cost is a directional accumulator).

**FR-CANCEL-6** If `Product.currentStock` of finished good would go below 0 after cancellation AND the product's effective mode is `HARD_BLOCK`, cancellation is rejected with `409 INSUFFICIENT_STOCK_TO_CANCEL`.

---

## API Contract

### BOM Endpoints

#### GET /api/bom
```ts
// Query params
interface BomListQuery {
  productId?: string
  isActive?: boolean   // default: true
  page?: number        // default: 1
  limit?: number       // default: 20, max: 100
}

// Response
interface BomListRes {
  success: true
  data: BomSummaryDTO[]
  pagination: { page: number; limit: number; total: number; hasMore: boolean }
}

interface BomSummaryDTO {
  id: string
  productId: string
  productName: string
  name: string
  version: number
  isActive: boolean
  isDefault: boolean
  componentCount: number
  createdAt: string // ISO 8601
}
```

#### GET /api/bom/:id
```ts
interface BomDetailRes {
  success: true
  data: BomDetailDTO
}

interface BomDetailDTO {
  id: string
  productId: string
  productName: string
  name: string
  version: number
  isActive: boolean
  isDefault: boolean
  notes: string | null
  components: BomComponentDTO[]
  productionRunCount: number // how many runs reference this BOM
  createdAt: string
  updatedAt: string
}

interface BomComponentDTO {
  id: string
  componentProductId: string
  componentProductName: string
  quantity: number
  unitId: string | null
  unitName: string | null
  notes: string | null
  currentStock: number // snapshot for UI stock-check preview
}
```

#### POST /api/bom
```ts
interface CreateBomReq {
  productId: string        // finished good
  name: string             // max 100 chars
  isDefault?: boolean      // default: false
  notes?: string
  components: {
    componentProductId: string
    quantity: number       // > 0, max 6 decimal places
    unitId?: string
    notes?: string
  }[]                      // 1–50 items
}

// Response: 201
interface CreateBomRes {
  success: true
  data: BomDetailDTO
}

// Errors
// 400 VALIDATION_ERROR — missing fields, qty ≤ 0, self-reference, duplicate component
// 404 PRODUCT_NOT_FOUND — productId or any componentProductId not found in business
// 401 / 403
```

#### PUT /api/bom/:id
```ts
// Same body shape as CreateBomReq (full replace of components)
// If productionRunCount > 0:
//   - Creates new BOM version, deactivates old
//   - Returns 201 with new BOM id in data
// If productionRunCount = 0:
//   - In-place update, returns 200

interface UpdateBomRes {
  success: true
  data: BomDetailDTO
  versioned: boolean // true when a new version was created
}
```

#### DELETE /api/bom/:id
```ts
// Soft delete (isDeleted = true, isActive = false)
// 200 { success: true }
// 409 CANNOT_DELETE — BOM has production runs (soft-delete enforced automatically, not an error condition — this code is never returned; BOM is always soft-deleted)
// Note: no hard-block on delete; soft-delete always succeeds
```

### Production Run Endpoints

#### GET /api/production-runs
```ts
interface ProductionRunListQuery {
  bomId?: string
  from?: string     // ISO date
  to?: string       // ISO date
  status?: 'DRAFT' | 'COMPLETED' | 'CANCELLED'
  page?: number
  limit?: number    // max 100
}

interface ProductionRunListRes {
  success: true
  data: ProductionRunSummaryDTO[]
  pagination: { page: number; limit: number; total: number; hasMore: boolean }
}

interface ProductionRunSummaryDTO {
  id: string
  bomId: string
  bomName: string
  bomVersion: number
  finishedProductId: string
  finishedProductName: string
  quantityProduced: number
  runDate: string
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED'
  totalCostPaise: number    // Σ costSnapshot × qtyConsumed (BigInt serialised as number)
  perUnitCostPaise: number
  createdAt: string
}
```

#### GET /api/production-runs/:id
```ts
interface ProductionRunDetailRes {
  success: true
  data: ProductionRunDetailDTO
}

interface ProductionRunDetailDTO extends ProductionRunSummaryDTO {
  notes: string | null
  warnings: string[]          // non-empty only for WARN_ONLY runs with insufficient stock
  components: ProductionRunComponentDTO[]
  createdBy: string           // user id
  createdByName: string
}

interface ProductionRunComponentDTO {
  componentProductId: string
  componentProductName: string
  quantityConsumed: number
  costSnapshotPaise: number   // BigInt → number
  lineTotalPaise: number      // quantityConsumed × costSnapshotPaise
}
```

#### POST /api/production-runs
```ts
// Header: X-Idempotency-Key: <uuid-v4> (required)

interface CreateProductionRunReq {
  bomId: string
  quantityProduced: number    // > 0, integer or decimal matching Product qty precision
  runDate: string             // ISO 8601 date
  notes?: string
}

// Response: 201
interface CreateProductionRunRes {
  success: true
  data: ProductionRunDetailDTO
  warnings: string[]          // stock shortfalls that were warn-only
}

// Errors
// 400 VALIDATION_ERROR — missing fields, qty ≤ 0
// 400 INSUFFICIENT_STOCK — { code, message, details: [{ productId, productName, required, available, shortfall }] }
// 400 BOM_NOT_ACTIVE — BOM is soft-deleted or isActive=false
// 400 OVERFLOW — computed required qty exceeds safe integer
// 404 BOM_NOT_FOUND
// 409 DUPLICATE_KEY — X-Idempotency-Key missing (treat as 400 MISSING_IDEMPOTENCY_KEY)
// 401 / 403
```

#### POST /api/production-runs/:id/cancel
```ts
// No body required
// Response: 200
interface CancelProductionRunRes {
  success: true
  data: { id: string; status: 'CANCELLED' }
}

// Errors
// 400 INVALID_STATUS — run is not COMPLETED
// 409 INSUFFICIENT_STOCK_TO_CANCEL — finished good stock would go negative in HARD_BLOCK mode
// 404 RUN_NOT_FOUND
// 401 / 403
```

---

## Data Model

### New Prisma models (additive migration — no NOT NULL added to existing columns)

```prisma
model Bom {
  id          String   @id @default(cuid())
  businessId  String
  productId   String   // finished good
  name        String   @db.VarChar(100)
  version     Int      @default(1)
  isActive    Boolean  @default(true)
  isDefault   Boolean  @default(false)
  notes       String?  @db.Text
  isDeleted   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   String
  updatedBy   String?

  business       Business         @relation(fields: [businessId], references: [id], onDelete: Cascade)
  product        Product          @relation("BomFinishedGood", fields: [productId], references: [id], onDelete: Restrict)
  createdByUser  User             @relation("BomCreator", fields: [createdBy], references: [id], onDelete: Restrict)
  components     BomComponent[]
  productionRuns ProductionRun[]

  @@unique([businessId, productId, version])
  @@index([businessId, productId])
  @@index([businessId, isDeleted])
}

model BomComponent {
  id                 String  @id @default(cuid())
  bomId              String
  componentProductId String
  quantity           Float   // > 0; same Float convention as Product.currentStock
  unitId             String?
  notes              String?

  bom              Bom      @relation(fields: [bomId], references: [id], onDelete: Cascade)
  componentProduct Product  @relation("BomComponentProduct", fields: [componentProductId], references: [id], onDelete: Restrict)
  unit             Unit?    @relation(fields: [unitId], references: [id], onDelete: SetNull)

  @@unique([bomId, componentProductId])
  @@index([bomId])
}

model ProductionRun {
  id                String   @id @default(cuid())
  businessId        String
  bomId             String
  finishedProductId String
  quantityProduced  Float
  runDate           DateTime
  status            String   @default("COMPLETED") // DRAFT | COMPLETED | CANCELLED
  notes             String?  @db.Text
  warnings          Json?    // string[] — warn-only stock shortfalls
  isDeleted         Boolean  @default(false)
  createdBy         String
  createdAt         DateTime @default(now())

  business        Business                  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  bom             Bom                       @relation(fields: [bomId], references: [id], onDelete: Restrict)
  finishedProduct Product                   @relation("ProductionRunFinished", fields: [finishedProductId], references: [id], onDelete: Restrict)
  createdByUser   User                      @relation("ProductionRunCreator", fields: [createdBy], references: [id], onDelete: Restrict)
  components      ProductionRunComponent[]

  @@index([businessId, runDate])
  @@index([businessId, status])
  @@index([businessId, isDeleted])
}

model ProductionRunComponent {
  id                  String @id @default(cuid())
  productionRunId     String
  componentProductId  String
  quantityConsumed    Float
  costSnapshotPaise   BigInt @default(0) // weightedAvgCostPaise at run time

  productionRun    ProductionRun @relation(fields: [productionRunId], references: [id], onDelete: Cascade)
  componentProduct Product       @relation("ProductionRunComponents", fields: [componentProductId], references: [id], onDelete: Restrict)

  @@index([productionRunId])
}
```

### StockMovement type additions (string enum in comment — no enum type change needed)

Extend the comment on `StockMovement.type` field:
```
// Existing: OPENING, SALE, PURCHASE, ADJUSTMENT_IN, ADJUSTMENT_OUT, RETURN_IN, RETURN_OUT, REVERSAL
// Phase 4 BOM: PRODUCTION_CONSUME, PRODUCTION_PRODUCE, PRODUCTION_REVERSE
```

No migration column change needed — `type` is already a plain `String`.

### Business relation additions

Add to `Business` model:
```prisma
boms           Bom[]
productionRuns ProductionRun[]
```

### Product relation additions

Add to `Product` model:
```prisma
bomsAsFinishedGood         Bom[]                    @relation("BomFinishedGood")
bomComponents              BomComponent[]           @relation("BomComponentProduct")
productionRunsAsFinished   ProductionRun[]          @relation("ProductionRunFinished")
productionRunComponents    ProductionRunComponent[] @relation("ProductionRunComponents")
```

### User relation additions

Add to `User` model:
```prisma
bomsCreated          Bom[]           @relation("BomCreator")
productionRunsCreated ProductionRun[] @relation("ProductionRunCreator")
```

---

## Migration Sequence

All migrations are additive. Sequence:

1. `20260508_bom_tables` — Create `Bom`, `BomComponent`, `ProductionRun`, `ProductionRunComponent`. Add relation fields to `Business`, `Product`, `User`. All new columns have defaults or are nullable. No NOT NULL constraint on existing columns.
2. `20260508_bom_gin_index` (optional, separate raw SQL migration) — GIN trigram index on `Bom.name` for search if needed (follow existing pattern from PRISMA_MIGRATION_RULES.md).

---

## Backend File Structure

```
server/src/
  routes/
    bom.route.ts                     ≤250 LOC
    production-runs.route.ts         ≤250 LOC
  services/bom/
    bom.crud.service.ts              ≤250 LOC  (create/update/delete/list/get)
    bom.validators.ts                ≤150 LOC
    bom.types.ts                     ≤80 LOC
    production-run.execute.service.ts ≤250 LOC (the atomic transaction)
    production-run.cancel.service.ts ≤150 LOC
    production-run.idempotency.ts    ≤120 LOC  (mirrors pos-checkout.idempotency.ts)
    production-run.types.ts          ≤80 LOC
```

---

## Frontend Structure

```
src/features/bom/
  pages/
    BomListPage.tsx                  ≤250 LOC
    BomFormPage.tsx                  ≤250 LOC
    BomDetailPage.tsx                ≤200 LOC
    ProductionRunListPage.tsx        ≤250 LOC
    ProductionRunFormPage.tsx        ≤250 LOC  (wizard shell — delegates to steps)
    ProductionRunDetailPage.tsx      ≤200 LOC
  components/
    BomCard.tsx                      ≤120 LOC
    BomComponentRow.tsx              ≤80 LOC
    ProductionRunCard.tsx            ≤120 LOC
    ProductionWizardStep1.tsx        ≤150 LOC  (pick BOM)
    ProductionWizardStep2.tsx        ≤150 LOC  (qty + date)
    ProductionWizardStep3.tsx        ≤200 LOC  (preview + stock check)
    ProductionWizardStep4.tsx        ≤120 LOC  (confirm)
    StockWarningBadge.tsx            ≤60 LOC
  hooks/
    useBomList.ts
    useBomDetail.ts
    useProductionRuns.ts
    useProductionRunDetail.ts
    useCreateBom.ts
    useUpdateBom.ts
    useExecuteProductionRun.ts
    useCancelProductionRun.ts
  services/
    bom.service.ts                   ≤200 LOC
    production-run.service.ts        ≤200 LOC
```

Routes added to `src/routes.tsx`:
```
/bom                          → BomListPage
/bom/new                      → BomFormPage
/bom/:id/edit                 → BomFormPage
/bom/:id                      → BomDetailPage
/production-runs              → ProductionRunListPage
/production-runs/new          → ProductionRunFormPage
/production-runs/:id          → ProductionRunDetailPage
```

---

## UI States (all 4 required per screen)

### BomListPage

| State | Behaviour |
|-------|-----------|
| Loading | Skeleton cards (3 rows), shimmer animation |
| Empty | Illustration + "No recipes yet" + "Create BOM" CTA button |
| Error | "Could not load recipes. Tap to retry." + retry button |
| Success | List of BomCards with product name, version badge, component count, default badge |

### BomFormPage

| State | Behaviour |
|-------|-----------|
| Loading (edit mode) | Skeleton form fields |
| Error (load) | "Could not load BOM. Tap to retry." |
| Saving | Submit button shows spinner, "Saving..." label, inputs disabled |
| Success | Toast "Recipe saved" → navigate to BomDetailPage |

Inline validation:
- Empty name → "Recipe name is required"
- No components → "Add at least one component"
- Component qty ≤ 0 → "Quantity must be greater than 0"
- Self-reference → "Component cannot be the same as the finished product"
- Duplicate component → "This product is already added"

### BomDetailPage

| State | Behaviour |
|-------|-----------|
| Loading | Skeleton header + component list |
| Error | "Could not load recipe. Tap to retry." |
| Empty (0 components) | Not possible — enforced on create/edit |
| Success | Product name, version, components table with current stock, Edit / Start Run CTAs |

### ProductionRunListPage

| State | Behaviour |
|-------|-----------|
| Loading | 3 skeleton run cards |
| Empty | "No production runs yet" + "Start a Run" CTA |
| Error | "Could not load runs. Tap to retry." |
| Success | Paginated run cards with status chip (green=COMPLETED, yellow=DRAFT, red=CANCELLED), qty, date |

### ProductionRunFormPage (wizard)

| State | Behaviour |
|-------|-----------|
| Loading (BOM data) | Step 3 preview shows skeleton rows |
| Insufficient stock (HARD_BLOCK) | Step 3 red warning per component, "Cannot proceed — insufficient stock", Next disabled |
| Insufficient stock (WARN_ONLY) | Step 3 amber warning per component, "Stock low — run will proceed with warning", Next enabled |
| Submitting | Step 4 confirm button shows spinner "Starting run...", all inputs disabled |
| Error | Toast "Production run failed: [reason]" + stay on Step 4 |
| Success | Toast "Production run completed" → navigate to ProductionRunDetailPage |

### ProductionRunDetailPage

| State | Behaviour |
|-------|-----------|
| Loading | Skeleton header + component rows |
| Error | "Could not load run. Tap to retry." |
| Cancelled (no action available) | Status chip "Cancelled", no cancel button |
| Success (COMPLETED) | Full detail with "Cancel Run" button (destructive, bottom of page) |

Cancel confirmation dialog:
- Title: "Cancel Production Run?"
- Body: "This will reverse all stock movements. Finished goods will be deducted and raw materials restored. This cannot be undone."
- Buttons: "Keep Run" (dismiss) · "Cancel Run" (destructive red)

---

## UX Copy

| Element | Copy |
|---------|------|
| Nav label | Production |
| BOM list page title | Recipes |
| BOM form page title (new) | New Recipe |
| BOM form page title (edit) | Edit Recipe |
| Production run list title | Production Runs |
| New run CTA | + Start Run |
| New BOM CTA | + New Recipe |
| Wizard step 1 heading | Choose Recipe |
| Wizard step 2 heading | Quantity & Date |
| Wizard step 3 heading | Review Components |
| Wizard step 4 heading | Confirm Run |
| Wizard step 4 confirm button | Start Production Run |
| Submit loading text | Starting run... |
| Success toast (run) | Production run completed |
| Success toast (BOM save) | Recipe saved |
| Success toast (BOM versioned) | New recipe version created (v{n}) |
| Success toast (cancel) | Production run cancelled |
| Error — insufficient stock | Not enough stock: [product name] needs [X], available [Y] |
| Error — BOM not active | This recipe is no longer active |
| Error — network fail | Could not complete run. Check connection and try again. |
| Empty BOM list | No recipes yet |
| Empty run list | No production runs yet |
| Cancel confirm title | Cancel Production Run? |
| Cancel confirm body | This will reverse all stock movements. Finished goods will be deducted and raw materials restored. This cannot be undone. |
| Cancel confirm dismiss | Keep Run |
| Cancel confirm action | Cancel Run |
| Warn-only banner | Some materials are low on stock. Run will proceed with warnings recorded. |

---

## Mobile Layout

- 375px primary layout. 320px minimum — no horizontal scroll.
- BOM card: product name (truncate 1 line), version badge (pill), component count, default badge — all within card padding 16px.
- Wizard: full-screen steps, back chevron top-left, step indicator (dots or 1/4 text) top-right, sticky bottom CTA.
- Step 3 component preview: scrollable list (not table) with product name, required qty, current stock, and a coloured availability indicator (green / amber / red).
- Amounts in Indian format: ₹1,00,000 (via existing `formatCurrency` helper).
- Cancel button on detail page: destructive red, positioned below all detail content, requires scroll-to-see (prevents accidental tap).
- Minimum touch target: 44×44px.

---

## Offline Behaviour

- BOM reads: `cacheReads: true` (BOM list and detail are PII-safe reference data).
- Production run list: `cacheReads: true`.
- Production run execution: mutation via `api()` with `entityType: 'productionRun'`, `entityLabel: 'Run: [bomName] × [qty]'`. Offline queue will hold until reconnection.
- Production run cancel: mutation via `api()` with `entityType: 'productionRun'`, `entityLabel: 'Cancel: [bomName]'`.
- BOM create/update: `entityType: 'bom'`, `entityLabel: bomName`.
- All mutation success handlers tolerate `{}` return (optimistic update + invalidate query).

---

## Permissions

| Permission | Owner | Manager | Cashier | Staff |
|------------|-------|---------|---------|-------|
| `bom.read` | Yes | Yes | No | No |
| `bom.edit` | Yes | Yes | No | No |
| `production.run` | Yes | Yes | No | No |

- Production nav entry hidden when user has no `bom.read`.
- Edit button on BomDetailPage hidden when no `bom.edit`.
- "Start Run" button hidden when no `production.run`.
- Cancel button hidden when no `production.run`.

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Component product deleted after BOM created | `BomComponent → Product` relation is `Restrict` — product cannot be deleted while referenced; soft-delete of product still works (show "(deleted)" label in UI) |
| Finished product deleted after BOM created | Same Restrict constraint |
| Two concurrent runs on same BOM, same components | Prisma `$transaction` with serialisable isolation on stock update. Second transaction will see updated stock. If HARD_BLOCK, second run may fail. |
| `quantityProduced = 0` | Rejected at validation with 400 |
| `quantityProduced` is fractional when product expects integer | Allowed — `Float` stored; product's `decimalPrecisionQty` setting shown as advisory in wizard step 2 |
| BOM has no default | Wizard step 1 shows all active BOMs for selected product; no auto-selection |
| Multiple active BOM versions for same product | Only `isActive = true` BOMs appear in wizard. Old versions remain queryable via BOM list with `isActive=false` filter |
| Run attempted on CANCELLED run id | 404 or 400 depending on existence; not re-runnable |
| `X-Idempotency-Key` absent | 400 MISSING_IDEMPOTENCY_KEY |
| BOM edit with 0 components sent | 400 VALIDATION_ERROR "Add at least one component" |
| Cancellation of run where finished-good stock already zero (WARN_ONLY mode) | Allowed — stock goes negative, recorded |
| Very large quantityProduced causing overflow in cost calc | Overflow guard: reject 400 OVERFLOW before transaction begins |
| Business has no `InventorySetting` row | Default to WARN_ONLY |

---

## Security

- All endpoints require valid session cookie (existing `requireAuth` middleware).
- All endpoints require `bom.read` or `bom.edit` or `production.run` permission check via existing `requirePermission` middleware.
- `businessId` is always taken from the authenticated session, never from request body.
- `productId` and `componentProductId` ownership validated against `businessId` before use.
- Rate limit: 30 req/min per user on production run execute endpoint (production runs are heavy writes).
- Idempotency key is stored scoped to `businessId` — cross-business key collision impossible.

---

## Rollout Plan

**Phase A — BOM Read-Only (deploy first)**
- Migration + schema
- GET /api/bom routes
- BomListPage + BomDetailPage (read only)
- Permissions applied
- No production run routes yet

**Phase B — BOM Write**
- POST /api/bom, PUT /api/bom/:id, DELETE /api/bom/:id
- BomFormPage
- Regression: existing inventory not affected

**Phase C — Production Runs**
- Full production run routes + execute service
- ProductionRunListPage + wizard + detail
- Idempotency + stock check

**Phase D — Cancellation**
- POST /api/production-runs/:id/cancel
- Cancel button on detail page
- Reversal stock movements

---

## Acceptance Criteria

### Backend

- [ ] `tsc --noEmit` passes with zero errors after migration
- [ ] Migration is additive: no NOT NULL added to existing columns, no existing column removed
- [ ] `curl -X GET /api/bom` without auth cookie → `{ success: false, error: { code: "UNAUTHENTICATED" } }` (401)
- [ ] `curl -X GET /api/bom` with cashier session → 403
- [ ] `curl -X GET /api/bom` with manager session → 200 `{ success: true, data: [], pagination: {...} }`
- [ ] `curl -X POST /api/bom` with missing `productId` → 400 `VALIDATION_ERROR`
- [ ] `curl -X POST /api/bom` with self-referencing component → 400 `VALIDATION_ERROR`
- [ ] `curl -X POST /api/bom` with valid payload → 201 `{ success: true, data: { id, version: 1, ... } }`
- [ ] `curl -X PUT /api/bom/:id` on BOM with 0 runs → 200, same id, in-place update
- [ ] `curl -X PUT /api/bom/:id` on BOM with 1+ runs → 201, new BOM id, `versioned: true`, old BOM `isActive=false`
- [ ] `curl -X POST /api/production-runs` without `X-Idempotency-Key` → 400 `MISSING_IDEMPOTENCY_KEY`
- [ ] `curl -X POST /api/production-runs` with component stock = 0, HARD_BLOCK mode → 400 `INSUFFICIENT_STOCK`, zero DB changes (verify StockMovement count unchanged, Product.currentStock unchanged)
- [ ] `curl -X POST /api/production-runs` with valid payload → 201, `ProductionRunComponent` rows created, component stocks decremented, finished-good stock incremented, `Product.weightedAvgCostPaise` updated
- [ ] Same idempotency key sent twice → second response identical to first, exactly one `ProductionRun` row in DB
- [ ] `curl -X POST /api/production-runs/:id/cancel` on COMPLETED run → 200, status=CANCELLED, `PRODUCTION_REVERSE` StockMovements created, component stocks restored, finished-good stock decremented
- [ ] `curl -X POST /api/production-runs/:id/cancel` on CANCELLED run → 400 `INVALID_STATUS`
- [ ] Concurrent run simulation (two requests with different idempotency keys, overlapping component, HARD_BLOCK) → exactly one succeeds, one fails; no partial state

### Frontend

- [ ] BomListPage: loading skeleton visible before data; empty state shows "No recipes yet" + "New Recipe" button; error state shows retry button; success renders BomCard list
- [ ] BomFormPage: validation errors shown inline before submit; saving state disables inputs; success navigates to detail
- [ ] BomDetailPage: version badge visible; component list shows current stock for each row; Edit button absent for cashier
- [ ] ProductionRunListPage: 4 UI states all present
- [ ] Production wizard: step transitions work (back/forward); step 3 shows green/amber/red stock availability per component; HARD_BLOCK components disable the Next button; WARN_ONLY shows amber banner
- [ ] ProductionRunDetailPage: Cancel button visible only for COMPLETED runs and only for users with `production.run`; confirmation dialog appears before cancel
- [ ] Cancel confirmation: dismissing "Keep Run" leaves run COMPLETED; confirming "Cancel Run" calls cancel endpoint
- [ ] Nav "Production" entry absent when logged in as cashier
- [ ] All pages: 375px — no overflow, all CTAs reachable; 320px — no horizontal scroll
- [ ] Screenshots: all 4 UI states captured for each of the 6 pages

### QA Checklist

- [ ] BOM create happy path: create BOM → verify DB row → open detail → all components shown
- [ ] BOM edit (no runs): edit BOM → verify same id in DB → version still 1
- [ ] BOM edit (with runs): edit BOM → verify new id in DB → version = 2 → old BOM isActive=false
- [ ] Production run wizard: select BOM → enter qty → step 3 shows correct required qtys → confirm → verify stock movements in DB
- [ ] Insufficient stock (HARD_BLOCK) wizard: step 3 shows error, cannot proceed → fix qty or select different BOM → can proceed
- [ ] Warn-only run: amber banner visible → run completes → warnings stored in DB on ProductionRun.warnings
- [ ] Cancel happy path: run detail → Cancel Run → confirm → status CANCELLED → stock restored
- [ ] Cancel blocked: attempt cancel on already-CANCELLED run → 400 error toast shown
- [ ] Idempotency: submit same run twice rapidly (same key) → toast shows only once → one DB row
- [ ] Permissions: cashier cannot see Production in nav; direct URL to /bom returns 403 or redirect
- [ ] Weighted-avg cost: create run with known component costs → verify finished-good `weightedAvgCostPaise` updated correctly (manual calculation cross-check)
- [ ] 320px test: all wizard steps usable on 320px-wide device (no overflow, CTA visible)

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Concurrent runs on shared components leading to oversell in HARD_BLOCK mode | Medium | High | Prisma `$transaction` with select-for-update pattern; stock check inside transaction, not before |
| Weighted-avg cost rounding error accumulating over many runs | Low | Medium | Use `computeWeightedAvg` (banker's rounding, BigInt) consistently; store per-component `costSnapshot` for audit |
| Float qty precision mismatch between BOM component qty and Product.currentStock | Low | Medium | Both use `Float`; no conversion; document that max 6 decimal places enforced at API layer |
| Performance: large BOM (50 components) × large qty run | Low | Low | Overflow guard + 50-component cap; all ops within one transaction; no N+1 (batch select before transaction) |
| Version confusion: user edits old BOM version unintentionally | Medium | Medium | UI shows version badge prominently; PUT always creates new version when runs exist; old versions shown as "Inactive" |
| Cancel after finished-good stock already sold | Medium | High | If WARN_ONLY, cancel proceeds (stock goes negative, flagged); if HARD_BLOCK, 409 returned — user must first fix finished-good stock |
