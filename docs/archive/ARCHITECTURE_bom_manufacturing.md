# ARCHITECTURE — BOM / Manufacturing (Phase 4)

**Feature #115 · HisaabPro**
**Companion to:** `docs/SCOPE_bom_manufacturing.md`
**Created:** 2026-05-08
**Owner:** architect

---

## 0. Guiding constraints (locked from scope)

- `Product.currentStock` is `Float`. All BOM component qty and run qty stored as `Float`. **No** `qty × 1000` integer convention.
- `Product.weightedAvgCostPaise` is `BigInt` paise. Reuse `computeWeightedAvg` from `server/src/services/stock/invoice-ops-purchase.ts` — do **not** reimplement.
- `StockMovement.type` is a plain `String`. New values `PRODUCTION_CONSUME`, `PRODUCTION_PRODUCE`, `PRODUCTION_REVERSE` are added without any schema change.
- Idempotency reuses `IdempotencyLog` with key prefix `prod:{businessId}:{key}` (mirror `pos-checkout.idempotency.ts`).
- Effective stock-validation mode resolves per component: `Product.stockValidation` if not `GLOBAL`, else `InventorySetting.stockValidationMode`. Default fallback `WARN_ONLY`.
- Multi-godown deferred: `godownId`/`batchId` on movement rows = `null` in v1.
- Cancellation reverses stock movements only — weighted-avg cost is **not** reversed (matches existing purchase-reversal behaviour).
- Mobile-first 320px+. Files ≤250 LOC. All four UI states (loading / error / empty / success) on every screen. No `any`. All FE network calls via `api()` from `@/lib/api` with `entityType` + `entityLabel`.

---

## 1. Module map

All paths are absolute under repo root. Each file ≤250 LOC.

### Backend — `server/src/`

```
prisma/
  schema.prisma                                       (4 new models, 4 relation backrefs)
  migrations/20260508_bom_tables/migration.sql       (additive, all FKs onDelete listed in §4)

schemas/bom/
  bom.schemas.ts                                      Zod input schemas (CreateBomReq, UpdateBomReq)        ~120
  production-run.schemas.ts                           Zod CreateProductionRunReq, query schemas              ~80

services/bom/
  bom.service.ts                                      CRUD + list + get + soft-delete + version-bump         ~230
  bom.validators.ts                                   recursive guard, qty>0, dup, same-business, ≤100 cmp   ~150
  bom.types.ts                                        DTO + internal types (no `any`)                        ~80
  production-run.service.ts                           atomic execute() — see §3                              ~240
  production-run-cancel.service.ts                    cancel() reversal + status guard                       ~170
  production-run.idempotency.ts                       prefix `prod:{businessId}:` (mirror POS)               ~120
  production-run.types.ts                             DTO + result envelopes                                 ~80
  production-run.cost.ts                              cost-snapshot helpers (delegates to computeWeightedAvg)~80

routes/
  bom.ts                                              GET/POST/PUT/DELETE /api/bom                            ~200
  production-runs.ts                                  GET/POST + cancel; idempotency middleware              ~220

services/permissions/
  registry.ts                                         REGISTER `bom.read`, `bom.edit`, `production.run`
  seeds/manager.ts                                    add the 3 strings to Manager seed role
```

### Frontend — `src/features/`

6-layer split per feature. Each layer ≤250 LOC.

```
src/features/bom/
  bom.types.ts                                        DTO mirrors of API contracts                            ~90
  bom.constants.ts                                    statuses, max-components=100, qty-precision=3          ~40
  bom.utils.ts                                        formatVersionBadge, sumComponentCost, classifyStock    ~120
  bom.service.ts                                      api<T>('/bom') wrappers w/ entityType                  ~140
  hooks/
    useBom.ts                                         list + detail (TanStack Query)                         ~120
    useBomForm.ts                                     react-hook-form + Zod resolver                         ~180
  pages/
    BomListPage.tsx                                   4 UI states, paginated list                            ~220
    BomFormPage.tsx                                   create + edit shell                                    ~230
    BomDetailPage.tsx                                 components table, "Start Run" CTA                      ~210
  components/
    BomFormHeader.tsx                                 product picker + name + isDefault                       ~140
    BomComponentsTable.tsx                            sortable rows, mobile card fallback @ <640px           ~200
    BomComponentRow.tsx                               product picker + qty + unit + delete                    ~180

src/features/production-runs/
  production-run.types.ts                                                                                   ~90
  production-run.constants.ts                         WIZARD_STEPS, MIN_QTY                                  ~40
  production-run.utils.ts                             formatRunNumber, classifyAvailability                  ~110
  production-run.service.ts                           api<T>(...) with entityType: 'productionRun'           ~150
  hooks/
    useProductionRuns.ts                              list + detail + filters                                ~140
    useProductionRunForm.ts                           wizard state machine (step1 → step3)                   ~200
    useExecuteProductionRun.ts                        useMutation, generates X-Idempotency-Key (uuidv4)      ~110
    useCancelProductionRun.ts                                                                                ~80
  pages/
    ProductionRunListPage.tsx                                                                                ~210
    ProductionRunFormPage.tsx                         wizard shell, routes to Step1/2/3                      ~190
    ProductionRunDetailPage.tsx                       detail + cancel button (gated)                         ~220
  components/
    ProductionRunWizardStep1.tsx                      pick product + BOM (radio of active BOMs)              ~200
    ProductionRunWizardStep2.tsx                      qty + date + notes; live qty validation                ~190
    ProductionRunWizardStep3.tsx                      stock-availability preview, warn/block banner          ~230
    ProductionRunCancelButton.tsx                     destructive button + ConfirmDialog                     ~120
    StockAvailabilityRow.tsx                          green/amber/red badge + qty needed/available           ~110

src/components/Sidebar.tsx                            +1 nav entry "Production" gated on `bom.read`
src/components/MoreMenu.tsx                           +1 entry on the mobile more-menu
src/i18n/{en,hi}.ts                                   +keys per UX-Copy table in scope §UX
```

### Permissions registry

`server/src/services/permissions/registry.ts` registers:

```ts
'bom.read'          // see Production menu, list/detail
'bom.edit'          // create / update / soft-delete BOMs
'production.run'    // execute + cancel runs
```

Manager seed gains all three. Owner already wildcards. Cashier/Staff get none.

---

## 2. API contracts (typed)

All responses follow the standard `{ success, data, ... } | { success: false, error: { code, message, details? } }` shape. Error codes used:

| Code | HTTP | When |
|------|------|------|
| `VALIDATION_ERROR` | 400 | Zod failure, qty ≤ 0, name length |
| `BOM_NOT_FOUND` | 404 | id not in business |
| `PRODUCT_NOT_FOUND` | 404 | finished or component product missing |
| `COMPONENT_INVALID` | 400 | self-reference, cross-business, ≥2 same component |
| `RECURSIVE_BOM` | 400 | future-proof: component already references this product as finished — currently flat, returned only on multi-level guard |
| `BOM_HAS_RUNS` | 409 | tried to hard-delete a BOM with runs (we soft-delete instead, so this is currently informational only) |
| `BOM_NOT_ACTIVE` | 400 | run attempted against `isActive=false` BOM |
| `INSUFFICIENT_STOCK` | 400 | HARD_BLOCK component shortfall, with `details: [{ productId, productName, required, available, shortfall }]` |
| `INSUFFICIENT_STOCK_TO_CANCEL` | 409 | finished-good would go negative on cancel under HARD_BLOCK |
| `INVALID_STATUS` | 400 | cancel on non-COMPLETED run |
| `ALREADY_CANCELLED` | 400 | cancel on already-CANCELLED run (subset of INVALID_STATUS, surfaced separately for UX) |
| `OVERFLOW` | 400 | required qty or cost exceeds `Number.MAX_SAFE_INTEGER` |
| `MISSING_IDEMPOTENCY_KEY` | 400 | header absent on POST /production-runs |
| `IDEMPOTENT_REPLAY` | 200/201 | not an error — original payload returned; logged with header `X-Idempotent-Replay: true` |

Request / response types are listed exhaustively in `docs/SCOPE_bom_manufacturing.md` §API Contract. The typed Zod schemas live in `server/src/schemas/bom/`.

### Endpoint summary

| Method | Path | Permission | Idempotent? |
|--------|------|------------|-------------|
| GET | /api/bom | bom.read | n/a |
| GET | /api/bom/:id | bom.read | n/a |
| POST | /api/bom | bom.edit | no (creates new) |
| PUT | /api/bom/:id | bom.edit | no (versioning) |
| DELETE | /api/bom/:id | bom.edit | yes (soft-delete) |
| GET | /api/production-runs | bom.read | n/a |
| GET | /api/production-runs/:id | bom.read | n/a |
| POST | /api/production-runs | production.run | **yes** — `X-Idempotency-Key` required |
| POST | /api/production-runs/:id/cancel | production.run | yes (status-guarded) |

---

## 3. Data flow & atomic transaction

### 3.1 Concurrency strategy — chosen approach

**Read Committed + explicit row locks via `SELECT … FOR UPDATE`** on the affected `Product` rows.

**Rationale:** Postgres' default `READ COMMITTED` is what every other writer in HP uses (`invoice-ops*`, `pos-checkout`). Switching to `SERIALIZABLE` for one route forces clients to handle 40001 retries that nothing else in the codebase emits, and serialisation conflicts cascade unpredictably under heavy POS write traffic. Explicit row locks are deterministic, contained to the BOM transaction, and align with how `pos-checkout` handles concurrent stock decrements. Locks are taken in a **stable sort order (`productId ASC`)** to prevent deadlock between two parallel runs that share components.

### 3.2 Pseudocode — `productionRun.execute()`

```ts
// services/bom/production-run.service.ts
export async function executeProductionRun(args: {
  businessId: string
  bomId: string
  quantityProduced: number  // > 0, rounded to 3 dp before persist
  runDate: Date
  notes?: string
  userId: string
  idempotencyKey: string
}): Promise<ProductionRunDetailDTO> {

  // (a) idempotency hit-check (outside tx) — see §3.3
  const replay = await idem.checkReplay(`prod:${args.businessId}:${args.idempotencyKey}`)
  if (replay) return replay.payload

  // (b) precheck (outside tx, cheap) — fail fast on bad input/missing BOM
  const bom = await prisma.bom.findFirst({ where: { id: args.bomId, businessId: args.businessId, isDeleted: false }, include: { components: true } })
  if (!bom) throw httpErr('BOM_NOT_FOUND', 404)
  if (!bom.isActive) throw httpErr('BOM_NOT_ACTIVE', 400)
  if (bom.components.length === 0) throw httpErr('VALIDATION_ERROR', 400)

  // overflow guard before tx
  for (const c of bom.components) {
    const req = c.quantity * args.quantityProduced
    if (!Number.isFinite(req) || req > Number.MAX_SAFE_INTEGER) throw httpErr('OVERFLOW', 400)
  }

  // (c) atomic transaction
  const result = await prisma.$transaction(async (tx) => {

    // c1. lock all involved Product rows in stable order (deadlock-free)
    const productIds = [
      bom.finishedProductId,
      ...bom.components.map(c => c.componentProductId),
    ].sort()
    // raw SQL because Prisma has no native FOR UPDATE
    await tx.$queryRawUnsafe(
      `SELECT id FROM "Product" WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
      productIds,
    )

    // c2. inventory setting (single read, cached for component loop)
    const setting = await tx.inventorySetting.findUnique({ where: { businessId: args.businessId }, select: { stockValidationMode: true } })
    const businessMode = (setting?.stockValidationMode as Mode) ?? 'WARN_ONLY'

    // c3. fetch products WITH LOCKED snapshots
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, businessId: args.businessId },
      select: { id: true, name: true, currentStock: true, weightedAvgCostPaise: true, stockValidation: true },
    })
    const byId = new Map(products.map(p => [p.id, p]))

    // c4. per-component HARD_BLOCK check + collect warnings
    const warnings: string[] = []
    const insufficient: ShortfallDetail[] = []
    for (const c of bom.components) {
      const p = byId.get(c.componentProductId)!
      const required = round3(c.quantity * args.quantityProduced)
      const effectiveMode = p.stockValidation === 'GLOBAL' ? businessMode : p.stockValidation
      if (p.currentStock < required) {
        if (effectiveMode === 'HARD_BLOCK') {
          insufficient.push({ productId: p.id, productName: p.name, required, available: p.currentStock, shortfall: required - p.currentStock })
        } else {
          warnings.push(`${p.name}: low stock (need ${required}, have ${p.currentStock})`)
        }
      }
    }
    if (insufficient.length) throw httpErr('INSUFFICIENT_STOCK', 400, { details: insufficient })

    // c5. create ProductionRun row first (so movements can FK to it)
    const run = await tx.productionRun.create({
      data: {
        businessId: args.businessId,
        bomId: bom.id,
        finishedProductId: bom.finishedProductId,
        quantityProduced: round3(args.quantityProduced),
        runDate: args.runDate,
        status: 'COMPLETED',
        notes: args.notes ?? null,
        warnings: warnings.length ? warnings : Prisma.JsonNull,
        createdBy: args.userId,
      },
    })

    // c6. consume each component: snapshot cost, create movement, update stock + run-component
    let totalCostPaise = 0n
    for (const c of bom.components) {
      const p = byId.get(c.componentProductId)!
      const required = round3(c.quantity * args.quantityProduced)
      const cost = p.weightedAvgCostPaise // SNAPSHOT inside tx — never read before lock

      await tx.stockMovement.create({
        data: {
          businessId: args.businessId, productId: p.id,
          type: 'PRODUCTION_CONSUME', quantity: -required,
          referenceType: 'PRODUCTION_RUN', referenceId: run.id,
          godownId: null, batchId: null, userId: args.userId,
        },
      })
      await tx.product.update({
        where: { id: p.id },
        data: { currentStock: { decrement: required } },
      })
      await tx.productionRunComponent.create({
        data: {
          productionRunId: run.id,
          componentProductId: p.id,
          quantityConsumed: required,
          costSnapshotPaise: cost,
        },
      })
      totalCostPaise += BigInt(Math.round(required * Number(cost)))
    }

    // c7. produce finished good — movement + stock + WAC propagation
    const perUnitCostPaise = Math.round(Number(totalCostPaise) / args.quantityProduced)
    if (perUnitCostPaise > Number.MAX_SAFE_INTEGER) throw httpErr('OVERFLOW', 400)

    await tx.stockMovement.create({
      data: {
        businessId: args.businessId, productId: bom.finishedProductId,
        type: 'PRODUCTION_PRODUCE', quantity: args.quantityProduced,
        referenceType: 'PRODUCTION_RUN', referenceId: run.id,
        userId: args.userId, godownId: null, batchId: null,
      },
    })
    const finished = byId.get(bom.finishedProductId)!
    const newWAC = computeWeightedAvg(
      finished.currentStock,            // prevQty (locked snapshot)
      finished.weightedAvgCostPaise,    // prevAvgPaise
      args.quantityProduced,            // inQty
      perUnitCostPaise,                 // unitCostPaise
    )
    await tx.product.update({
      where: { id: bom.finishedProductId },
      data: {
        currentStock: { increment: args.quantityProduced },
        weightedAvgCostPaise: newWAC,
      },
    })

    // c8. record idempotency BEFORE tx commits
    const detail = await loadProductionRunDetail(tx, run.id) // single-tx helper
    await idem.persist(tx, `prod:${args.businessId}:${args.idempotencyKey}`, detail)
    return detail
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 })

  // (d) post-commit: schedule alert checks (never inside tx)
  scheduleAlertChecks(args.businessId, [bom.finishedProductId, ...bom.components.map(c => c.componentProductId)])

  return result
}
```

### 3.3 Idempotency

`production-run.idempotency.ts` mirrors `pos-checkout.idempotency.ts`:

- `checkReplay(key)` — pre-tx lookup. Returns stored payload + sets `X-Idempotent-Replay: true` response header. TTL 72h.
- `persist(tx, key, payload)` — writes a row to `IdempotencyLog` *inside* the transaction so the lookup-then-insert pair is atomic with the run write.
- Missing `X-Idempotency-Key` header → `400 MISSING_IDEMPOTENCY_KEY`.
- Header must be UUID v4 — Zod-validated at the route layer.

### 3.4 Cancellation flow

```ts
// services/bom/production-run-cancel.service.ts
export async function cancelProductionRun(args: { businessId: string; runId: string; userId: string }) {
  return prisma.$transaction(async (tx) => {
    const run = await tx.productionRun.findFirst({
      where: { id: args.runId, businessId: args.businessId },
      include: { components: true },
    })
    if (!run) throw httpErr('RUN_NOT_FOUND', 404)
    if (run.status === 'CANCELLED') throw httpErr('ALREADY_CANCELLED', 400)
    if (run.status !== 'COMPLETED') throw httpErr('INVALID_STATUS', 400)

    // lock involved products in stable order
    const productIds = [run.finishedProductId, ...run.components.map(c => c.componentProductId)].sort()
    await tx.$queryRawUnsafe(`SELECT id FROM "Product" WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`, productIds)

    // resolve modes
    const setting = await tx.inventorySetting.findUnique({ where: { businessId: args.businessId } })
    const businessMode = (setting?.stockValidationMode as Mode) ?? 'WARN_ONLY'
    const finished = await tx.product.findUniqueOrThrow({ where: { id: run.finishedProductId } })
    const effFinishedMode = finished.stockValidation === 'GLOBAL' ? businessMode : finished.stockValidation

    // guard: finished-good cannot go negative under HARD_BLOCK
    if (effFinishedMode === 'HARD_BLOCK' && finished.currentStock < run.quantityProduced) {
      throw httpErr('INSUFFICIENT_STOCK_TO_CANCEL', 409)
    }

    // reverse: component +qty, finished -qty, all PRODUCTION_REVERSE
    for (const c of run.components) {
      await tx.stockMovement.create({ data: { ...mov, productId: c.componentProductId, type: 'PRODUCTION_REVERSE', quantity: c.quantityConsumed, referenceId: run.id, referenceType: 'PRODUCTION_RUN' } })
      await tx.product.update({ where: { id: c.componentProductId }, data: { currentStock: { increment: c.quantityConsumed } } })
    }
    await tx.stockMovement.create({ data: { ...mov, productId: run.finishedProductId, type: 'PRODUCTION_REVERSE', quantity: -run.quantityProduced, referenceId: run.id, referenceType: 'PRODUCTION_RUN' } })
    await tx.product.update({ where: { id: run.finishedProductId }, data: { currentStock: { decrement: run.quantityProduced } } })
    // weightedAvgCostPaise NOT reversed — directional accumulator (matches purchase-reversal pattern)

    await tx.productionRun.update({ where: { id: run.id }, data: { status: 'CANCELLED' } })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10_000 })
}
```

### 3.5 Concurrency proof (two parallel runs sharing component X)

1. T1 begins, locks `Product` rows for `{X, finishedA}` (sorted).
2. T2 begins, attempts to lock `{X, finishedB}` — blocks on X.
3. T1 reads `X.currentStock = 10`, decrements by 7, commits → X = 3.
4. T2 unblocks, sees `X.currentStock = 3` (locked snapshot), required = 5, HARD_BLOCK → 400 `INSUFFICIENT_STOCK`.
5. No partial state. No oversell.

Stable lock order (`productIds.sort()`) eliminates the AB/BA deadlock between two transactions that share two products.

---

## 4. Migration sequence

**One additive migration:** `server/prisma/migrations/20260508_bom_tables/migration.sql`.

- Creates 4 tables: `Bom`, `BomComponent`, `ProductionRun`, `ProductionRunComponent`.
- Adds the 4 relation backrefs on `Business`, `Product`, `User`, `Unit` — these are Prisma-relation-only; no SQL columns added to existing tables.
- All FKs:
  - `Bom.businessId → Business.id` `onDelete: Cascade`
  - `Bom.productId → Product.id` `onDelete: Restrict` (block product hard-delete while BOMs reference it)
  - `Bom.createdBy → User.id` `onDelete: Restrict`
  - `BomComponent.bomId → Bom.id` `onDelete: Cascade`
  - `BomComponent.componentProductId → Product.id` `onDelete: Restrict`
  - `BomComponent.unitId → Unit.id` `onDelete: SetNull`
  - `ProductionRun.businessId → Business.id` `onDelete: Cascade`
  - `ProductionRun.bomId → Bom.id` `onDelete: Restrict`
  - `ProductionRun.finishedProductId → Product.id` `onDelete: Restrict`
  - `ProductionRun.createdBy → User.id` `onDelete: Restrict`
  - `ProductionRunComponent.productionRunId → ProductionRun.id` `onDelete: Cascade`
  - `ProductionRunComponent.componentProductId → Product.id` `onDelete: Restrict`
- Indexes: `(businessId, productId)`, `(businessId, isDeleted)` on `Bom`; `(businessId, runDate)`, `(businessId, status)`, `(businessId, isDeleted)` on `ProductionRun`; `(productionRunId)` on `ProductionRunComponent`; `(bomId)` on `BomComponent`.
- Unique constraints: `(businessId, productId, version)` on `Bom`; `(bomId, componentProductId)` on `BomComponent`.
- **No NOT NULL added to any pre-existing column.** **No column dropped.**
- No GIN/trigram index in v1 — list paginates by `(createdAt DESC, id)`.

---

## 5. Cost propagation (exact)

Inside the transaction, for each component:

```
required_i  = round3(bomComponent[i].quantity * quantityProduced)
costSnap_i  = product[i].weightedAvgCostPaise               // BigInt paise, locked snapshot
lineCost_i  = round( required_i * Number(costSnap_i) )      // paise (Number — safe under MAX_SAFE_INTEGER guard)
```

Then:

```
totalComponentCostPaise   = Σ lineCost_i                        (BigInt)
perUnitCostPaise          = round( Number(total) / quantityProduced )
```

Finished-good WAC update — delegate to existing helper, do NOT reimplement:

```ts
import { computeWeightedAvg } from '@/services/stock/invoice-ops-purchase'

newWAC = computeWeightedAvg(
  finished.currentStock,             // prevQty (Float, pre-update)
  finished.weightedAvgCostPaise,     // prevAvgPaise (BigInt)
  quantityProduced,                  // inQty
  perUnitCostPaise,                  // unitCostPaise
)
```

`computeWeightedAvg` already implements banker's rounding and the `prevQty <= 0` short-circuit; we do **not** duplicate that logic.

`perUnitCostPaise` is also persisted on `ProductionRun` virtually (computed in the detail DTO via `Σ lineCost / quantityProduced`) — it is not a stored column to avoid the drift class of bugs. The audit trail is `ProductionRunComponent.costSnapshotPaise`.

Cancellation does **not** call `computeWeightedAvg` again — WAC is a directional accumulator (matching `reverseForInvoice` behaviour).

---

## 6. PR sequence

| PR | Scope | Files (max) | Gate |
|----|-------|-------------|------|
| **PR1** | Schema migration only | `prisma/schema.prisma`, 1 migration dir, relation backrefs | `tsc clean`, `prisma migrate diff` empty after apply |
| **PR2** | BOM service + routes + permission registry + Manager seed | `services/bom/bom.service.ts`, `bom.validators.ts`, `bom.types.ts`, `routes/bom.ts`, `schemas/bom/bom.schemas.ts`, `services/permissions/registry.ts` | curl 200/400/403 paths; tsc clean |
| **PR3** | ProductionRun execute + cancel + idempotency + routes | `services/bom/production-run.service.ts`, `production-run-cancel.service.ts`, `production-run.idempotency.ts`, `production-run.cost.ts`, `routes/production-runs.ts` | curl: success, INSUFFICIENT_STOCK, INVALID_STATUS, replay; load-test 2 parallel runs |
| **PR4** | FE BOM list/form/detail + 6-layer split | `src/features/bom/**` | screenshots: 4 UI states × 3 pages; 320px proof |
| **PR5** | FE ProductionRun wizard + list + detail + cancel | `src/features/production-runs/**` | screenshots: 4 UI states × 3 pages; warn-banner + block-banner proofs |
| **PR6** | Nav entry + permission gating + i18n (en/hi) | `Sidebar.tsx`, `MoreMenu.tsx`, `i18n/{en,hi}.ts` | cashier/manager nav diff screenshots |
| **PR7** | Verifier offline tests, QA proofs, ratchet baseline bump | `scripts/enforce*` updates if any new patterns | enforce.js green; system-health green |

Each PR must independently pass pre-commit (`enforce.js`) and `tsc --noEmit`.

---

## 7. Test strategy

### Unit — `server/src/services/bom/__tests__/`

| File | Coverage |
|------|----------|
| `bom.validators.test.ts` | qty>0, ≤100 components, no self-reference, dup component, cross-business component, recursive guard (component.productId === bom.productId) |
| `production-run.cost.test.ts` | perUnitCostPaise rounding, overflow guard, weightedAvgCostPaise propagation matches `computeWeightedAvg` golden cases |
| `production-run.execute.test.ts` | (a) happy path → movements + stock deltas + WAC; (b) HARD_BLOCK with stock=0 → throws + zero rows written (verify count via `tx.stockMovement.count` before/after — should be equal); (c) WARN_ONLY shortfall → run completes, `warnings[]` populated; (d) Float qty rounding to 3dp; (e) idempotency replay returns identical detail, `ProductionRun.count` exactly 1 |
| `production-run-cancel.test.ts` | (a) status guard rejects DRAFT/CANCELLED; (b) reversal: each PRODUCTION_CONSUME has matching PRODUCTION_REVERSE row, stocks restored exactly; (c) `weightedAvgCostPaise` UNCHANGED post-cancel (regression guard); (d) HARD_BLOCK + finished stock < produced → 409 |
| `production-run.idempotency.test.ts` | missing key → 400; replay within 72h → 200/201 with same body; key with different body → still returns original (replay-by-key, not by-body) |

### Integration — `server/test/integration/bom-flow.test.ts`

End-to-end through Express: create BOM → run → cancel; verify DB invariants between each step.

### Concurrency — `server/test/integration/bom-concurrency.test.ts`

Two parallel `Promise.all` POSTs sharing one component; assert exactly one succeeds, one returns INSUFFICIENT_STOCK; total stock change matches the winner's run only.

### Permission gates — `server/src/middleware/__tests__/perm-bom.test.ts`

Cashier hits each route → 403; Manager → 200; Owner → 200.

### FE component tests — `src/features/{bom,production-runs}/**/__tests__/`

Wizard step transitions, ConfirmDialog flow, queue-tolerant mutation handlers (assert no `created.id` deref when offline returns `{}`).

---

## 8. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Concurrent runs on shared components → oversell | Medium | High | `SELECT … FOR UPDATE` on `Product` rows in stable id-sorted order; stock check inside tx; integration test enforces invariant |
| Float qty drift across many runs | Medium | Medium | `round3()` helper applied to every computed `required` and `quantityProduced` before persist; document `decimalPrecisionQty` advisory in wizard |
| Large BOM × large qty overflows `Number.MAX_SAFE_INTEGER` | Low | High | Pre-tx overflow guard rejects with 400 OVERFLOW; ≤100 components hard cap (server-side, not just FE) |
| WAC stale if read before tx | High if naive | High | Cost snapshot is read **inside** the transaction, AFTER the row lock — never before |
| Deadlock between two parallel runs sharing two products | Medium | Medium | All `FOR UPDATE` calls use `productIds.sort()` for a deterministic global lock order |
| Cancel reverses cost incorrectly | Medium | High | Cost is intentionally NOT reversed; covered by regression test asserting `weightedAvgCostPaise` equality pre/post cancel |
| Idempotency replay returns stale body if BOM mutated mid-replay | Low | Low | Replay returns the **stored** detail snapshot (from `IdempotencyLog`), not a re-query — safe by construction |
| Offline FE submits run with idempotency key, then app reopens and resends | Medium | Low | Same key → same response (replay window 72h); user sees one run in detail page, no duplicate |
| Migration ordering breaks if applied to a DB with custom `Product` extensions | Low | Medium | Migration is purely additive, no ALTER on `Product` — safe |
| Float comparison in HARD_BLOCK check (`p.currentStock < required`) misclassifies due to fp epsilon | Low | Medium | Compare after `round3` on both sides — `Math.round(x*1000)` integer compare in helper |

---

## 9. Performance strategy

- All heavy reads inside the transaction are batched (`findMany` over the locked id list — no N+1).
- Outside the tx: `scheduleAlertChecks` is fire-and-forget (existing pattern).
- FE: routes lazy-loaded (`React.lazy(() => import('./features/bom/pages/BomListPage'))`); BOM list and run list use cursor-style pagination via `(createdAt DESC, id)` — no offset on large tables.
- BOM list and run list opt into `cacheReads: true` (PII-safe — no party/customer data).
- Mutation success handlers tolerate `{}` return; toast distinguishes `navigator.onLine` vs offline-queued.

---

## 10. Acceptance gates (proof-driven)

Backend:
- [ ] `tsc --noEmit` zero errors
- [ ] `prisma migrate diff` empty after migration
- [ ] curl proofs for: 401 unauth · 403 cashier · 200 manager · 400 VALIDATION_ERROR · 400 INSUFFICIENT_STOCK (HARD_BLOCK) · 400 MISSING_IDEMPOTENCY_KEY · 201 happy run · 201 idempotent replay (header `X-Idempotent-Replay: true`) · 200 cancel · 400 INVALID_STATUS · 409 INSUFFICIENT_STOCK_TO_CANCEL
- [ ] Concurrency integration test green

Frontend:
- [ ] Screenshots: 4 UI states × 6 pages (24 total)
- [ ] 320px no-overflow proof on all 6 pages
- [ ] Cashier nav screenshot showing no Production entry
- [ ] Wizard step3 amber-banner (WARN_ONLY) and red-block (HARD_BLOCK) screenshots

QA:
- [ ] Manual cost cross-check: known component costs → verify WAC math vs spreadsheet
- [ ] Cancel regression: assert `weightedAvgCostPaise` unchanged
- [ ] Offline submit → reconnect → verify single run created (idempotency key reused)

---

End of architecture.
