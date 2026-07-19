---
feature: tenant-isolation
scope_ref: docs/SCOPE_tenant-isolation.md
scope_audit_ref: docs/SCOPE_AUDIT_tenant-isolation.md (verdict PASS)
architect: architect
created: 2026-07-19T00:00:00Z
status: draft-for-audit
high_risk_paths_touched:
  - server/src/lib/prisma.ts
  - server/src/lib/prisma-scoped.ts
  - server/src/lib/prisma-scoped.inject.ts
  - server/src/lib/scoped-models.ts
  - server/src/lib/env.ts
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
---

# ARCHITECTURE — Data-Layer Tenant Isolation (Scoped Prisma)

> Design phase only. Implements the six closed MUST_SHIP gaps and honors both
> carry-forwards (CF-1, CF-2) from `SCOPE_AUDIT_tenant-isolation.md`. The SCOPE
> settled WHAT; this doc settles HOW, grounded in live code
> (`server/src/lib/prisma.ts`, `soft-delete/{index,middleware,models}.ts`,
> `middleware/resolve-scoped.ts`, `lib/env.ts`, `__tests__/setup.ts`,
> `prisma/schema.prisma`). Backend-only, mobile-transparent (response shapes
> byte-identical), so the mobile-first / 4-UI-state / bundle-budget gates are
> N/A and explicitly waived in §11.

---

## 0. Load-bearing facts re-verified against live code

| Fact | Evidence | Consequence for design |
|------|----------|------------------------|
| Soft-delete is ALREADY a `$allModels.$allOperations` **query extension** (not per-op) | `soft-delete/middleware.ts:43` | Scoping composes as a SECOND `$extends` layer; same shape. |
| Soft-delete only mutates `where` and always calls `query(args)` — it NEVER re-dispatches a different op | `soft-delete/middleware.ts:49-61` | Its own doc-comment (lines 8-11) states query extensions "cannot reliably change the operation type" — this is why the spike (#17) is a hard gate before wiring. |
| `prisma` is built `base.$extends(createSoftDeleteExtension())`; `base` is a raw `PrismaClient` | `prisma.ts:31-57` | `base` becomes `__basePrismaUnsafe`; we insert a scoping layer OUTSIDE soft-delete. |
| `transactionOptions: { timeout: 20_000, maxWait: 5_000 }` already set | `prisma.ts:39-42` | Two-step resolve + write fits inside the existing interactive-tx budget. |
| `req.user = { userId, phone, businessId }`, `businessId ?? ''` | `auth.ts:12,75` | ALS frame opens from `req.user` AFTER `requireAuth`; empty `businessId` must be treated as "no context" (fail closed), NOT a scope of `''`. |
| `resolve-scoped.ts` is ID-resolver **helpers**, not an ALS store | `resolve-scoped.ts:20-76` | Confirms the SCOPE decision: new ALS store in `business-context.ts`. |
| Test harness wholesale-mocks `../lib/prisma.js` via a Proxy returning `{}` | `__tests__/setup.ts:11-56` | Injector must be unit-tested via `vi.importActual` (real module), never through the mock; setup.ts gains `__basePrismaUnsafe` + `runUnscoped` stubs (File #20). |
| `PayslipSnapshot` has `businessId` (line 4210) but only `@unique payrollId` — **no `@@index(businessId)`** | `schema.prisma:4208-4218` | SS-1 index migration required before enforce. |
| `ImportJobRow` FK is **`jobId`** (`job ImportJob @relation(fields:[jobId])`), NOT `importJobId` | `schema.prisma:4318-4319` | **CF-1 fix** — corrected map §7. |
| `GodownStock` carries its OWN `businessId` (line 2856) | `schema.prisma:2854-2870` | **Second FK-map correction** — it is directly-scoped (one of the 96), NOT a child. Removed from `CHILD_SCOPED` → child map is 27 rows. See §7 + Deviations. |
| `CouponRedemption.coupon → Coupon` and `Coupon` has NO `businessId` (createdBy → AdminUser) | `schema.prisma:2626-2671` | `CouponRedemption` is a platform/user-owned global → `GLOBAL_ALLOWLIST` with `globalReason`, NOT `CHILD_SCOPED`. |
| `SubscriptionEvent` HAS `businessId` (line 2941) | `schema.prisma:2939-2958` | Directly-scoped (one of the 96), NOT a child. |

---

## 1. System overview

```
 ┌────────── request ──────────────────────────────────────────────┐
 │ requireAuth            → req.user = {userId, phone, businessId}   │
 │ scoped-context (NEW)   → if businessId: runInBusinessContext(...) │  File #9
 │    └─ AsyncLocalStorage frame wraps next() AND res 'finish'/'close'│
 │ route handler → service → prisma.<model>.<op>()                   │
 └──────────────────────────────┬───────────────────────────────────┘
                                 ▼
        prisma (flag-gated re-export)                 prisma.ts (edit, File #7)
   ┌───────────────────────────────────────────────────────────┐
   │ scoping $extends  (OUTER — runs FIRST)          File #6    │
   │   query.$allModels.$allOperations:                         │
   │     ctx = getBusinessContext()                             │
   │     if scoped(model) && !ctx → THROW  (fail closed)        │
   │     plan = injectScope(model, op, args, ctx.businessId)    │  pure, File #5
   │     execute(plan) — merge / rewrite / two-step / child /   │  File #6
   │                     connect-guard, re-dispatch via getInner│
   ├───────────────────────────────────────────────────────────┤
   │ soft-delete $extends (INNER — runs SECOND)  existing       │
   │   adds isDeleted:false to reads                            │
   ├───────────────────────────────────────────────────────────┤
   │ base = new PrismaClient()  == __basePrismaUnsafe           │
   └───────────────────────────────────────────────────────────┘
```

The scoping extension is the **outer** layer. Prisma runs the **last-declared**
query extension first, so `base.$extends(softDelete).$extends(scoping)` runs
scoping → soft-delete → DB. When scoping must re-issue an op (findUnique→findFirst,
two-step), it re-dispatches through a **late-bound reference to the soft-delete-
extended client** (`getInner()`), so soft-delete STILL composes onto the rewritten
op. Composition order + re-dispatch are the two things the Phase-0 spike proves
before any of this is wired (§5, §8).

---

## 2. API / internal contracts

### 2.1 `business-context.ts` (File #2) — AsyncLocalStorage store + escape hatch

```ts
import { AsyncLocalStorage } from 'node:async_hooks'

export interface BusinessContext { businessId: string; userId: string }

const als = new AsyncLocalStorage<BusinessContext>()

/** Open a tenant frame. Empty businessId is rejected here — never store ''. */
export function runInBusinessContext<T>(ctx: BusinessContext, fn: () => T): T {
  if (!ctx.businessId) throw new ScopedContextError('empty businessId')
  return als.run(ctx, fn)
}

/** undefined when outside any frame (unauth routes, cron, pre-context). */
export function getBusinessContext(): BusinessContext | undefined {
  return als.getStore()
}

export type UnscopedReason =
  | 'auth.login-by-phone' | 'auth.audit-write' | 'business.create'
  | 'business.switch-resolve' | 'platform.admin' | `cron.${string}`
  | 'webhook.provider' | 'response.continuation'

/**
 * The ONLY sanctioned cross-tenant path. Runs `fn` with NO business frame
 * (getBusinessContext() → undefined inside), writes one append-only
 * UnscopedAccessLog row via __basePrismaUnsafe, emits SCOPED_PRISMA_UNSCOPED_USED.
 * `reason` is required — no reason = throw at call site (no audit row = no run).
 */
export function runUnscoped<T>(reason: UnscopedReason, fn: () => Promise<T>): Promise<T>

export class ScopedContextError extends Error {}   // maps to AppError(INTERNAL,500) at handler
```

`runUnscoped` clears the frame with `als.run(undefined as never, fn)`-equivalent
(actually `als.exit(fn)`), so a nested scoped query inside it fails closed unless it
opens its own frame. The audit write uses `__basePrismaUnsafe` directly to avoid
recursion into the scoping layer.

### 2.2 `prisma-scoped.inject.ts` (File #5) — PURE injector

```ts
type Args = Record<string, unknown>

export type InjectPlan =
  // reads/aggregates/create/createMany + updateMany/deleteMany on a DIRECTLY-scoped model
  | { kind: 'merged'; operation: string; args: Args }
  // findUnique/findUniqueOrThrow → findFirst with merged predicate
  | { kind: 'rewriteFindFirst'; args: Args }
  // update/delete/upsert BY UNIQUE on a scoped model → resolve id, then act by id
  | { kind: 'twoStep'; resolve: Args; then: 'update' | 'delete' | 'upsert'
    ; onModel: string; buildThenArgs: (row: { id: string }) => Args
    ; onMissing: 'NOT_FOUND' | 'upsertCreate' }
  // updateMany/deleteMany on a CHILD (no businessId) → resolve in-scope parent ids
  | { kind: 'childMany'; operation: 'updateMany' | 'deleteMany'
    ; parentModel: string; fk: string; resolveParents: Args
    ; buildArgs: (allowedParentIds: string[]) => Args }
  // create/update carrying nested connect/connectOrCreate OR a scalar child FK
  | { kind: 'guarded'; base: InjectPlan; guards: FkGuard[] }

export interface FkGuard {
  parentModel: string          // scoped model to resolve against
  value: string                // candidate parent id (from connect or scalar FK)
  relationLabel: string        // for CONNECT_REJECT metric
  onCreateBranch?: 'reject'     // connectOrCreate create-branch → reject (fail closed)
}

/**
 * PURE — no DB, no ALS read. Caller passes businessId explicitly so this is
 * fully unit-testable (File #13). Throws ScopedContextError when businessId==''.
 * The transport (File #6) EXECUTES the returned plan (resolve queries + tx).
 */
export function injectScope(
  model: string, operation: string, args: Args, businessId: string,
): InjectPlan
```

### 2.3 Operation coverage matrix (what each path does)

| Prisma op | Directly-scoped model (has `businessId`) | Child-scoped model (FK → parent) |
|-----------|------------------------------------------|----------------------------------|
| `findMany` `findFirst(OrThrow)` `count` `aggregate` `groupBy` | `merged`: `where:{AND:[caller,{businessId}]}` | `merged` with **relation filter**: `where:{AND:[caller,{<rel>:{businessId}}]}` (reads allow relation filters) |
| `findUnique(OrThrow)` | `rewriteFindFirst`: findUnique→findFirst + `{businessId}` (foreign id → null) | `rewriteFindFirst` + relation filter |
| `create` | `merged`: inject `data.businessId = ctx`; **guard** any nested `connect`/`connectOrCreate` on scoped relations | child has no `businessId`: `guarded` — validate the scalar FK (e.g. `paymentId`) AND any nested connect resolve in-tenant (B3 hole closed, §3.4) |
| `createMany` | `merged`: inject `businessId` into every `data[]` row | `guarded` per-row FK validation |
| `update` `upsert` `delete` (by unique) | `twoStep`: `findFirst({unique, businessId})→id`; null→NOT_FOUND; act by `id` **in caller's tx if active, else new tx**; plus **data-guard** on `data` (see below) | `twoStep` with relation filter to resolve; act by `id`; **data-guard** on `data` |
| `updateMany` `deleteMany` | `merged`: `where:{AND:[caller,{businessId}]}` (scalar, allowed); **data-guard** on `data` | **`childMany`**: resolve in-scope parent ids → `where:{AND:[caller,{<fk>:{in:allowedIds}}]}` (Prisma forbids relation filters here — B9); **data-guard** on `data` |

Empty `businessId` at any path → `ScopedContextError` (thrown by injector).
`upsert` two-step: resolve → found → `update({where:{id}})`; not found →
`create` under ctx (with data-guard); this is the `onMissing:'upsertCreate'` branch.

**Data-payload guard (H1 — closes the write-side re-parent leak).** The
`where`-side injection stops cross-tenant *reads*, but a write `data` payload can
still *move* an in-tenant row into another tenant. The injector MUST run
`guardWriteData(model, data, ctx)` on every mutating op (`update`, `updateMany`,
`upsert.update`+`.create`, and — defensively — `create`/`createMany`, though those
already overwrite):

1. **`businessId` immutability.** On a directly-scoped model, if `data.businessId`
   (or `data.businessId.set`) is present AND `≠ ctx.businessId` → throw
   `ScopedWriteViolation` (`SCOPED_PRISMA_DATA_BUSINESSID_REJECT`). Never silently
   strip — a caller trying to re-parent a row is a bug or an attack; fail loud. A
   value *equal* to `ctx` is allowed (harmless no-op).
2. **Scalar-FK reassignment.** For every scoped relation FK on the model
   (`partyId`, `paymentId`, … — the same FK set the connect-guard already knows),
   if `data.<fk>` names a **new** id, resolve it in-tenant exactly like a nested
   `connect` (`parent.findFirst({id, businessId:ctx})`); null → `NOT_FOUND`
   (`SCOPED_PRISMA_DATA_FK_REJECT`). This covers the `data:{partyId:'<B-party>'}`
   reassignment vector, which the connect-guard (nested-write only) missed.
3. **Nested `connect`/`connectOrCreate`/`disconnect`/`set`** on scoped relations →
   resolve targets in-tenant (existing B13 connect-guard — unchanged).

`guardWriteData` shares the FK map with the connect-guard (one SSOT, `scoped-models.ts`),
so the directly-scoped `businessId` field and each model's scoped-relation FK columns
are DMMF-derived, not transcribed. Completeness is asserted by test #14 (§5.3).

### 2.4 Transport / dispatch surface (File #6)

```ts
export function createScopingExtension(getInner: () => PrismaInner) {
  return Prisma.defineExtension({
    name: 'tenant-scoping',
    query: { $allModels: { async $allOperations({ model, operation, args, query }) {
      if (!model || !isTenantModel(model)) return query(args)   // global model: passthrough
      const ctx = getBusinessContext()
      if (!ctx) { emit('SCOPED_PRISMA_CONTEXT_UNSET', {model, operation}); throw new ScopedContextError() }
      const plan = injectScope(model, operation, args, ctx.businessId)
      return executePlan(plan, { model, query, getInner })     // see below
    }}},
  })
}
```

`executePlan`:
- `merged` → `query(args)` (stays in chain: soft-delete + DB; same op).
- `rewriteFindFirst` → `getInner().<model>.findFirst(args)` (re-dispatch → soft-delete applies).
- `twoStep`/`childMany`/`guarded` → run resolve queries + the final write. **Tx rule:**
  if `getBusinessContext()` is inside an active interactive `$transaction`, the
  extension operation is already bound to the tx client; the resolve + write
  re-dispatch on the **same tx client** (never a nested `$transaction`). Otherwise
  `executePlan` opens ONE `getInner().$transaction(...)` so resolve+write are atomic.
  §5.1 resolves exactly how the extension obtains the active tx client (spike gate).

### 2.5 `prisma.ts` exports (File #7)

```ts
export const __basePrismaUnsafe = base            // raw client — CI-lint-guarded, runUnscoped + raw-SQL only
export type BasePrismaClient = typeof base
const softDeleted = base.$extends(createSoftDeleteExtension())
const scoped = softDeleted.$extends(createScopingExtension(() => softDeleted))
export const prisma =
  getScopedPrismaEnforce() === 'enforce' ? scoped : softDeleted   // shadow uses softDeleted + shadow harness (§10)
export type ExtendedPrismaClient = typeof prisma  // unchanged public type — services untouched
```

`getInner = () => softDeleted` is a **lazy getter** to break the definition-time
cycle (scoped needs softDeleted, built one line above). At call-time it is always
assigned.

---

## 3. Data flow (detailed)

### 3.1 Happy read
`req` → `requireAuth` sets `businessId` → `scoped-context` opens frame →
`service: prisma.invoice.findMany({where:{status:'PAID'}})` → scoping reads ALS →
`injectScope('Document','findMany',…,ctx)` → `merged where:{AND:[{status:'PAID'},{businessId:ctx}]}`
→ `query(args)` → soft-delete adds `isDeleted:false` → DB → only this tenant's live rows.

### 3.2 findUnique by PK
`prisma.payment.findUnique({where:{id:'<B-id>'}})` → `rewriteFindFirst`
`{where:{id:'<B-id>', businessId:ctx}}` → re-dispatch `getInner().payment.findFirst`
→ soft-delete adds `isDeleted:false` → foreign id → `null`. No leak.

### 3.3 update/delete by unique (two-step)
`prisma.product.update({where:{id:'<B-id>'}, data})` → `twoStep`:
`findFirst({where:{id:'<B-id>', businessId:ctx}, select:{id}})` → null →
`AppError(NOT_FOUND,404)` (SCOPED_PRISMA_TWOSTEP_MISS). If found → `update({where:{id}, data})`.
Inside a caller's open `$transaction`, both steps run on the tx client (§5.1).

### 3.4 Child create with a scalar FK (B3 hole — closed here)
`prisma.paymentAllocation.create({data:{paymentId:'<B-payment>', amount}})` →
model is CHILD_SCOPED, no `businessId` to inject → `guarded` with
`FkGuard{parentModel:'Payment', value:'<B-payment>', relationLabel:'payment'}` →
resolve `payment.findFirst({where:{id:'<B-payment>', businessId:ctx}})` → null →
`NOT_FOUND` (SCOPED_PRISMA_CONNECT_REJECT), no write. This closes the gap where a
standalone child `create` with a raw scalar FK (not a nested connect under a scoped
parent) could otherwise cross tenants — the SCOPE's B3 only covered nested-write
inheritance; §3.4 covers the standalone-scalar-FK case explicitly.

### 3.5 Child updateMany/deleteMany (two-step child planner — B9)
`prisma.paymentAllocation.deleteMany({where:{paymentId:'<B-payment>'}})` →
`childMany`: resolve `payment.findMany({where:{businessId:ctx, id:{in: candidateParentIds}}, select:{id}})`
where `candidateParentIds` = the parent ids named in the caller `where` if any,
else `undefined` (resolve ALL in-scope parent ids for an empty-`where` child
deleteMany — see §5.3 candidate extraction) → rewrite
`where:{AND:[caller,{paymentId:{in: allowedIds}}]}` → foreign parent excluded → 0 rows.

### 3.6 Nested connect (B13)
`prisma.document.update({where:{id:'<A-doc>'}, data:{party:{connect:{id:'<B-party>'}}}})`
→ base plan `twoStep` (update by unique) + `guards:[{parentModel:'Party', value:'<B-party>'}]`
→ resolve `party.findFirst({id:'<B-party>', businessId:ctx})` → null → NOT_FOUND, no write.
`connectOrCreate` create-branch defaults to **reject** (fail closed) unless a future
per-relation allowlist opts in.

### 3.6a Write-side re-parent (H1 — data-guard)
`prisma.invoice.update({where:{id:'<A-doc>'}, data:{businessId:'<B>'}})` → base plan
`twoStep` resolves `<A-doc>` under ctx=A (passes — it IS A's row) → **`guardWriteData`**
sees `data.businessId='<B>' ≠ ctx` → throw `ScopedWriteViolation`
(`SCOPED_PRISMA_DATA_BUSINESSID_REJECT`), no write. The row cannot be donated to B.
Scalar-FK variant `data:{partyId:'<B-party>'}` → `guardWriteData` resolves
`party.findFirst({id:'<B-party>', businessId:A})` → null → `NOT_FOUND`
(`SCOPED_PRISMA_DATA_FK_REJECT`). `updateMany({data:{businessId:'<B>'}})` is guarded
identically before the `merged` where-scoped bulk write runs.

### 3.7 Fail-closed path (ALS unset)
Any scoped op with `getBusinessContext() === undefined` (unauth route that forgot
the frame, or a post-response continuation that escaped it) → emit
`SCOPED_PRISMA_CONTEXT_UNSET {model,op}` → **throw** `ScopedContextError` →
global handler → `{success:false, error:{code:'INTERNAL', message:'Tenant context missing'}}`,
HTTP 500. Never returns another tenant's rows. In prod this is a P1 Sentry alert
(a path escaped the middleware — usually a Gap-6 continuation).

### 3.8 Continuation strategy (Gap 6 / SS-2)
`scoped-context` middleware wraps `next()` inside the ALS frame. Node's
AsyncLocalStorage propagates across `await` chains automatically, BUT NOT across
`res.on('finish'|'close')` listeners registered outside the frame, nor across
`setImmediate`/queue fan-outs that outlive the response. Strategy per site (each
enumerated + tested in #16):
- **PDF/export streamed within the handler** (still awaited) → inherits frame, no change.
- **`res.on('finish')` post-response work** → the middleware registers the finish
  listener INSIDE the frame via `als.run` capture, so the callback re-enters the
  same `ctx`; OR the callback wraps its scoped query in `runInBusinessContext(captured, …)`.
- **Detached fan-out** (notification queue, cron-triggered) → no request frame →
  must use `runUnscoped('response.continuation'|'cron.<name>', …)` or open its own
  frame from a persisted businessId. A bare scoped query there → throws (fail closed).

---

## 4. Migration sequence

Two additive migrations via `prisma migrate dev` (never `db push` —
`.claude/rules/PRISMA_MIGRATION_RULES.md`). Both are create/index-only — no
add-column→backfill→NOT-NULL dance is needed because no existing column changes.

### Migration A — `add_unscoped_access_log`
```prisma
model UnscopedAccessLog {           // append-only; written via __basePrismaUnsafe
  id        String   @id @default(cuid())
  reason    String
  actor     String?
  detail    String?
  createdAt DateTime @default(now())
  @@index([createdAt])
  @@index([reason, createdAt])
}
```
New table, zero rows → `CREATE TABLE` + indexes, no lock on existing tables. Safe.

### Migration B — `add_payslip_snapshot_business_index` (SS-1)
Adds `@@index([businessId, createdAt])` to `PayslipSnapshot`. This is a plain
composite B-tree (NOT a trgm/GIN index, so the raw-SQL GIN caveat in
PRISMA_MIGRATION_RULES does not apply). PayslipSnapshot is low-volume
(one row per payroll run), so a standard `CREATE INDEX` (brief write-lock inside
the migration transaction) is acceptable. **If prod volume is non-trivial at
cutover time**, ship it instead as a hand-authored migration containing only
`CREATE INDEX CONCURRENTLY "PayslipSnapshot_businessId_createdAt_idx" …` with the
migration's implicit transaction disabled (CONCURRENTLY cannot run in a tx) — the
index must exist BEFORE Phase 2 (enforce), because injected `businessId` filters on
PayslipSnapshot would otherwise seq-scan.

Ordering: A and B are independent and additive; ship as two separate migrations for
clean per-change rollback. Neither blocks the other. Both land in Phase 0 (dark),
long before enforce.

---

## 5. Resolved open items (the three the SCOPE handed the architect)

### 5.1 Extension behavior inside `$transaction` (SS-2)

**Finding (verified against Prisma extension semantics + the live soft-delete
extension):** Prisma applies `query` extensions to the transaction client, so
`tx.payment.delete(...)` inside `prisma.$transaction(async tx => …)` DOES invoke
our `$allOperations` wrapper — B11 holds. The live soft-delete extension already
relies on this (it filters reads issued as `tx.*` today). What it does NOT prove is
**re-dispatch of a different op on the same tx**, because soft-delete never
re-dispatches.

**Design:** for `twoStep`/`childMany` inside a caller's open interactive tx, the
resolve query + the final write MUST run on the **same tx client** — opening a
nested `prisma.$transaction` inside an interactive callback is unsupported and would
deadlock on the caller's held connection. `$allOperations` gives us `query` (bound
to the current op on the current tx) but not a general tx-client handle. Two
mechanisms are on the table; the **Phase-0 spike (#17) picks the one that works on
the installed Prisma version**:

- **Primary — extension-context re-dispatch.** Prisma exposes the operating client
  to an extension via `Prisma.getExtensionContext(this)`; inside a tx the context is
  the tx-bound extended client. The two-step resolves and writes through that
  context, staying in the caller's tx. Spike part (d) asserts: a `delete` inside
  `$transaction` executes as resolve+delete on the SAME tx (one connection, rolls
  back together).
- **Fallback — client-level delegate Proxy.** If `getExtensionContext` cannot yield
  a usable tx delegate, replace the query extension with a JS `Proxy` over the
  extended client that intercepts `<model>.<op>` and, when `getBusinessContext()`
  is inside a tx frame, re-dispatches on the tx client threaded through a
  transaction-scoped ALS slot we set in a wrapping `$transaction` shim. This is the
  documented "client-level `$allOperations` component / delegate wrapper" fallback
  the SCOPE named. Chosen + re-proven before wiring if primary fails.

**Non-tx path:** when NOT inside a caller tx, `executePlan` opens exactly ONE
`getInner().$transaction([...])` so resolve+write are atomic and soft-delete-composed.

The spike is a **Phase -1 hard gate**: if neither mechanism can re-dispatch on an
active tx, the design is abandoned per Rollout Phase -1 rollback and the FUTURE
denormalization fallback (a `businessId` column on the 27 children) is escalated.

**Phase -1 spike RESULT (2026-07-19, run against real Postgres — GO).** The spike
(`scratchpad/tenant-spike.cjs`, 8/8) resolves this item:
- **`getExtensionContext(this)` is NOT usable** as the primary — inside `$allOperations`
  it returns a plain object with no model delegates (`ec[model].findFirst` absent).
  Confirms the audit's S1: **the Fallback IS the mechanism.**
- **The Fallback works.** A tx-scoped ALS slot set by a `scopedTransaction(fn)` shim
  (`scoped.$transaction(tx => txSlot.run(tx, () => fn(tx)))`) threads the tx client to
  the extension; the two-step resolve `findFirst` + write both re-dispatch on that tx
  client and roll back together (T4 verified: update inside the caller's open tx;
  T8 verified: throw → zero residue). Re-entry is prevented by a `reentrySlot` flag
  (re-dispatched calls pass through scoping straight to inner soft-delete).
- **findUnique→findFirst rewrite, ctx-inject-on-create, scoped reads, H1 data-guard
  (re-parent → reject), cross-tenant two-step (→ NOT_FOUND), and fail-closed on unset
  ctx all pass.**
- **NEW hard constraint discovered — MUST codify in File #5/#6.** Prisma promises are
  **lazy**: the extension fires at *await*-time, not call-time. Every re-dispatched
  call therefore **must be `await`ed INSIDE the ALS `.run()` callback** (an
  `async () => await client[model].op(...)` shape). A non-awaiting `.run(true, () =>
  client.op())` tears the ALS store down before the query executes → the re-dispatch
  re-enters scoping and throws CTX_UNSET. `runReentry`/two-step helpers must always
  wrap an awaiting async fn. This also settles SHOULD_SHIP S3's continuation concern
  at the injector level.

**M5 note (open for implementation):** the extension cannot itself detect "am I inside
an un-shimmed tx." Safety therefore depends on `$transaction` ALWAYS being reached via
the `scopedTransaction` shim (which sets the slot). A raw `scoped.$transaction(...)`
call bypassing the shim leaves the slot unset → the two-step would run on `inner`
(outside the caller's tx). Mitigation per M5: a CI lint bans direct `.$transaction(`
on the scoped client outside the shim, mirroring lint #11; and when the slot is unset
while a write plan needs it, `executePlan` opens its own `getInner().$transaction`
(correct isolation, just not joined to a caller tx that the shim would have exposed) —
never dispatches a half-resolved write on a bare client.

### 5.2 Corrected CHILD_SCOPED FK map (CF-1 fixed; 27 rows — GodownStock removed)

Re-derived from `schema.prisma`. Every row: (a) child has NO `businessId` scalar,
(b) the FK column is a real relation scalar whose target is `businessId`-bearing.
**`ImportJobRow` FK corrected to `jobId` (CF-1).** **`GodownStock` REMOVED** — it
carries its own `businessId` (line 2856) so it is directly-scoped (one of the 96),
not a child; leaving it in CHILD_SCOPED would fail completeness test #14 assertion
(a). See Deviations §14.

| # | Child model | FK column (scalar) | Parent (scoped, has `businessId`) | schema line |
|---|-------------|--------------------|-----------------------------------|-------------|
| 1 | PartyAddress | `partyId` | Party | 548 |
| 2 | PartyCustomFieldValue | `partyId` | Party | 639 |
| 3 | OpeningBalance | `partyId` | Party | 654 |
| 4 | PartyPricing | `partyId` | Party | 669 |
| 5 | PriceListEntry | `priceListId` | PriceList | 716 |
| 6 | ProductCustomFieldValue | `productId` | Product | 953 |
| 7 | DocumentLineItem | `documentId` | Document | 1173 |
| 8 | DocumentAdditionalCharge | `documentId` | Document | 1219 |
| 9 | DocumentShareLog | `documentId` | Document | 1233 |
| 10 | PaymentAllocation | `paymentId` | Payment | 1398 |
| 11 | PaymentDiscount | `paymentId` | Payment | 1413 |
| 12 | GstReconciliationEntry | `reconciliationId` | GstReconciliation | 2118 |
| 13 | JournalEntryLine | `journalEntryId` | JournalEntry | 2322 |
| 14 | LoanTransaction | `loanAccountId` | LoanAccount | 2587 |
| 15 | StockVerificationItem | `verificationId` | StockVerification | 2740 |
| 16 | JobItem | `jobId` | Job | 3104 |
| 17 | CustomOrderItem | `customOrderId` | CustomOrder | 3212 |
| 18 | CustomOrderAdvance | `customOrderId` | CustomOrder | 3240 |
| 19 | CashEntryEvent | `cashEntryId` | CashEntry | 3326 |
| 20 | PosSaleItem | `posSaleId` | PosSale | 3576 |
| 21 | PosSaleEvent | `posSaleId` | PosSale | 3636 |
| 22 | BomComponent | `bomId` | Bom | 3697 |
| 23 | ProductionRunComponent | `productionRunId` | ProductionRun | 3738 |
| 24 | MarketingCampaignRecipient | `campaignId` | MarketingCampaign | 3848 |
| 25 | ReminderInstance | `ruleId` | ReminderRule | 3896 |
| 26 | AppointmentStatusEvent | `appointmentId` | Appointment | 4502 |
| 27 | ImportJobRow | **`jobId`** (was `importJobId`) | ImportJob | 4316 |

`CouponRedemption` and `SubscriptionEvent` are NOT children: `CouponRedemption`'s
parent `Coupon` has no `businessId` (platform-global, `createdBy → AdminUser`) → it
is a user-owned global → `GLOBAL_ALLOWLIST` with `globalReason:'user-owned billing
artifact; scoped by userId in service layer'`. `SubscriptionEvent` HAS `businessId`
→ directly-scoped (one of the 96). The completeness test forces both decisions.

The verified line numbers above are the DMMF-independent cross-check; the RUNTIME
truth is re-derived from DMMF by test #14 (§5.3) — the table is a human aid, the
test is authoritative.

### 5.3 Test #14 precision (CF-2)

For EVERY `CHILD_SCOPED` entry `{child, fk, parent}`, test #14 asserts (against the
generated DMMF, not the prose table):
1. `child` has **no `businessId` scalar field** (catches GodownStock-class errors).
2. `fk` **exists as a scalar field on `child`** AND is the `relationFromFields[0]`
   of a real relation on `child` (catches the CF-1 `importJobId` string typo — a
   non-existent column fails here).
3. That relation's target model === `parent`, AND `parent` has a `businessId`
   scalar (transitively resolving to a `businessId`-bearing ancestor).
4. Conversely: `businessId`-model set ⊆ `SCOPED_MODELS`; `GLOBAL_ALLOWLIST` ∩
   `businessId`-models === ∅ (no `businessId` model may be exempted); every
   `businessId`-free model resolves to EXACTLY one of `CHILD_SCOPED` or a documented
   `GLOBAL_ALLOWLIST.globalReason` (zero unclassified).

This turns CF-1 (and the GodownStock-class error) into a **guaranteed CI failure at
the column level**, not a possible runtime error in the child-many planner.

**Candidate-parent-id extraction (child-many, SCOPE Note #4):** `resolveParents`
builds its `where` from the caller's child `where`: if the caller filtered by the FK
(scalar `{fk:'x'}` or `{fk:{in:[…]}}`), those become the parent-id candidate set
intersected with `{businessId:ctx}`; if the caller filtered by other child scalars
or passed empty `where`, `resolveParents` resolves ALL in-scope parent ids
(`{where:{businessId:ctx}, select:{id}}`) and the rewrite constrains
`{fk:{in: allowedIds}}`. Empty-`where` child `deleteMany` therefore still deletes
only rows whose parent is in-tenant. The `IN` list is bounded to one tenant's parent
rows — a performance note (Notes), not a leak.

---

## 6. Extension composition order & rewrite mechanism (decided, spike-validated)

- **Composition order: soft-delete INNER, scoping OUTER.** Built as
  `base.$extends(softDelete).$extends(scoping)`. Prisma runs the last-declared query
  extension first → scoping merges `businessId` / rewrites the op, then re-dispatches
  through `getInner()` (the soft-delete-extended client), so soft-delete's
  `isDeleted:false` is applied to the FINAL op. Proof reference: **spike #17 part (c)**
  seeds a soft-deleted row of tenant A and asserts it is excluded AND scoped (both
  filters present on the executed query). The prior SCOPE's "OUTERMOST rewrites first"
  reasoning is not assumed — it is the spike's assertion.
- **Rewrite mechanism: client-level `$extends` with a `query.$allModels.$allOperations`
  component that re-dispatches via `getInner()`/extension-context — NOT a bare
  per-operation query extension.** A per-op query extension only exposes `query(args)`
  bound to the original op and cannot switch findUnique→findFirst (the exact limitation
  the live soft-delete doc-comment records). `$allOperations` + re-dispatch is the
  mechanism the spike validates.
- **Named fallback:** client-level delegate **Proxy** wrapper (§5.1 fallback). If the
  spike shows `$allOperations` re-dispatch cannot preserve the active tx, the Proxy
  wrapper threads the tx client through a tx-scoped ALS slot. Re-proven before wiring;
  Phase -1 "abandon → denormalize" rollback if neither works.

---

## 7. State machine — rollout enforcement

```
States:   OFF | SHADOW | ENFORCE | BOOT_LOCKED
Initial:  OFF
Terminal: BOOT_LOCKED (prod refuses to boot unless enforce)

  OFF     --tests+lint+raw-audit green--> SHADOW      (env SCOPED_PRISMA_ENFORCE=shadow)
  SHADOW  --1wk, 0 SHADOW_DIFF, 0 NO_MANUAL_SCOPE---> ENFORCE (env=enforce)
  SHADOW  --any divergence-------------> OFF          (env=off, no deploy) [rollback]
  ENFORCE --red-team green, raw-audit=0 unwaived-----> BOOT_LOCKED (validateScopedPrismaBoot)
  ENFORCE --incident-------------------> SHADOW       (env=shadow, no deploy) [rollback]
  BOOT_LOCKED --audited emergency------> ENFORCE      (CLAUDE_HIGHRISK_BYPASS-style override)
```
Every transition is env-flag-driven — rollback needs no code deploy at any phase.

---

## 8. Failure-Mode Implementation

| Failure mode (SCOPE §Failure Walkthrough) | SCOPE mitigation | Architecture site |
|-------------------------------------------|------------------|-------------------|
| A1 Provider/DB outage | in-memory merge + ALS read + ≤1 resolve; no new dep | `prisma-scoped.ts` executePlan (no external call) |
| A2 Abuse spike (100x) | reads add 0 round-trips; by-id/child-many add exactly 1 resolve | `injectScope` merged path (0 queries) / twoStep+childMany (1 query) |
| A3 DB bloat | only new writes = UnscopedAccessLog, 90-day cron | `scripts/cron/cleanup-unscoped-log.ts` (#18) + `@@index([createdAt])` |
| A4 Client-version lag | server-only, response-shape-preserving | scoping layer never changes returned rows/fields (§11) |
| A5 Regulatory (DPDP) | claim withheld until raw-SQL audit clears | `raw-sql-audit.allowlist.json` (#12) gates Phase 2 |
| A6 Cost runaway | ≤1 extra query per by-id/child-many write; shadow bounded 1wk | executePlan; shadow harness auto-throttle (§10) |
| A7 Insider abuse | runUnscoped audited; raw-client + new raw SQL CI-blocked | `lint-raw-client.mjs` (#11) + `UnscopedAccessLog` |
| B1–B14 leak vectors | per-vector coded defense + red-team case | `injectScope` (B1,B3,B4–B6,B9,B10,B12,B13) · `business-context` (B8) · lint (B2,B7) · red-team #15 (B11) · continuation #16 (B14) |

---

## 9. Observability (≤7 structured events — matches SCOPE)

`SCOPED_PRISMA_CONTEXT_UNSET{model,op}` (P1 in prod) ·
`SCOPED_PRISMA_SHADOW_DIFF{model,op,injected,manual}` ·
`SCOPED_PRISMA_NO_MANUAL_SCOPE{model,op}` ·
`SCOPED_PRISMA_UNSCOPED_USED{reason,actor}` ·
`SCOPED_PRISMA_TWOSTEP_MISS{model}` ·
`SCOPED_PRISMA_CONNECT_REJECT{model,relation}`. Emitted via existing `logger`;
`>0 SHADOW_DIFF` or `>0 NO_MANUAL_SCOPE` after the shadow week BLOCKS enforce.

---

## 10. Rollout (resolves the open shadow-sampling item)

| Phase | `SCOPED_PRISMA_ENFORCE` | Behaviour | Gate to advance | Rollback |
|-------|-------------------------|-----------|-----------------|----------|
| **-1 Spike** | n/a | Throwaway real-Postgres spike #17 proves op-rewrite + soft-delete composition + tx re-dispatch | spike green | abandon design → denormalize fallback (FUTURE) |
| 0 Land dark | `off` | scoping present; re-export returns `softDeleted` (un-scoped); all unit+integration tests green on CI Postgres | tests+tsc+lint green, **86 raw sites classified**, `npm run ssot` 0 | revert PR (no runtime effect) |
| 1 Shadow (prod) | `shadow` | authoritative op = manual/soft-deleted client; ALSO run injected query on base + diff; flag NO_MANUAL_SCOPE writes | 1 week, 0 diffs, 0 no-manual-scope, Sentry clean | env→`off` |
| 2 Enforce | `enforce` | `prisma` == scoped; base only via `runUnscoped`; fail-closed | red-team + full suite green on prod-mirror; **raw-audit 0 unwaived**; on-call briefed | env→`shadow` |
| 3 Boot-guard | `enforce` (locked) | `validateScopedPrismaBoot()` throws in prod if not `enforce` | stable ≥1wk at Phase 2 | audited emergency override |

**Shadow sampling — RESOLVED: default 100% for the bounded 1-week window, with an
auto-throttle floor.** Justification: reads add zero round-trips in enforce, but
shadow issues ONE extra base-client query per scoped read; at 100% that doubles read
query volume for one week against a Postgres pool of `connection_limit=10` (prisma.ts:19).
A *sampled* shadow (e.g. 10%) could miss the single endpoint that diverges — the
whole point of shadow is completeness before we make the layer authoritative, so a
partial sample defeats it. To protect the pool, expose
`SCOPED_PRISMA_SHADOW_SAMPLE` (0.0–1.0, default `1.0`); the shadow harness
auto-throttles to `0.1` for the remainder of the window if p95 mutation latency
rises +20% (the SCOPE's cost alert). Shadow doubles ONLY reads + flags
mutations-missing-manual-scope; it does NOT double-execute mutations (never runs a
write twice). Harness in `prisma-shadow.ts` (#10).

---

## 11. Non-applicable FE / perf gates (explicit waiver)

Backend-only, server-transparent. Response shapes are byte-identical (same rows/
fields, filtered), so: no LCP/INP/CLS/bundle impact (no client code), no 4-UI-state
matrix (no UI), no feature flag in `frontend/src/config/features.ts` (server env flag
`SCOPED_PRISMA_ENFORCE` is the gate). Server perf budget that DOES apply: DB query
p95 < 100ms — the two-step adds ≤1 indexed `findFirst`/`findMany(select id)` per
by-id/child-many write; reads add 0. PayslipSnapshot index (Migration B) keeps its
injected filter off a seq scan. Fail-closed surfaces the existing generic 500 toast /
offline banner (§UI States in SCOPE).

---

## 12. SSOT registration

New capability `tenant-scoping` — no existing HP module (`.claude/ssot-index.json`
clean; Flint's scoped-prisma is a different repo). Add one row to `ssot.config.mjs`
in the same change (a `new-ssot` build step):

```js
{
  capability: 'tenant-scoping',
  module: 'server/src/lib/prisma-scoped.inject.ts',
  exports: ['injectScope'],
  forbidden: [
    // hand-rolled per-service businessId injection that re-implements the injector
    /\.\$extends\(\s*\{\s*query[\s\S]*businessId/,
  ],
},
{
  capability: 'business-context',
  module: 'server/src/lib/business-context.ts',
  exports: ['runInBusinessContext', 'getBusinessContext', 'runUnscoped'],
  forbidden: [ /new AsyncLocalStorage<[^>]*[Bb]usiness/ ],  // second ALS store = drift
},
```

---

## File Plan

SSOT: all rows `new-ssot: tenant-scoping` or reuse existing (`soft-delete`,
`logger`, `errors`, `env`). No row > 250 lines. Build phases: **P-1** = spike gate,
**P0** = land-dark, **P1** = shadow, **P2** = enforce, **P3** = boot-guard.

| # | Path | Action | Est. Lines | Layer | SSOT | Build phase |
|---|------|--------|-----------|-------|------|-------------|
| 1 | `server/src/lib/scoped-models.ts` | create | ~140 | constants | new-ssot: tenant-scoping (SSOT of SCOPED_MODELS·CHILD_SCOPED·SCOPED_RELATION_FIELDS·GLOBAL_ALLOWLIST) | P0 |
| 2 | `server/src/lib/business-context.ts` | create | ~120 | lib | new-ssot: business-context (ALS store + runUnscoped) | P0 |
| 3 | `server/src/lib/prisma-scoped.merge.ts` | create | ~90 | utils (pure) | reuses: — (helper of tenant-scoping) | P0 |
| 4 | `server/src/lib/prisma-scoped.rewrite.ts` | create | ~170 | utils (pure) | reuses: — (findUnique→findFirst · two-step · child-many planner) | P0 |
| 5 | `server/src/lib/prisma-scoped.inject.ts` | create | ~180 | utils (pure) | new-ssot: tenant-scoping (injectScope dispatch + fk-guard) | P0 |
| 6 | `server/src/lib/prisma-scoped.ts` | create | ~170 | transport | reuses: soft-delete, business-context, tenant-scoping | P0 |
| 7 | `server/src/lib/prisma.ts` | **edit** | ~+45 | transport | reuses: soft-delete + tenant-scoping (export `__basePrismaUnsafe`, flag re-export) | P0 |
| 8 | `server/src/lib/env.ts` | **edit** | ~+40 | env | reuses: env | P0 (getters) / P3 (boot-guard) |
| 9 | `server/src/middleware/scoped-context.ts` | create | ~90 | middleware | reuses: business-context | P0 |
| 10 | `server/src/lib/prisma-shadow.ts` | create | ~140 | lib | reuses: tenant-scoping, business-context, logger | P1 |
| 11 | `scripts/scoped/lint-raw-client.mjs` | create | ~130 | script (CI) | reuses: scoped-models | P0 |
| 12 | `scripts/scoped/raw-sql-audit.allowlist.json` | create | ~90 | data | — | P0 (gate to P2) |
| 13 | `server/src/lib/__tests__/prisma-scoped.inject.test.ts` | create | ~220 | test | reuses: tenant-scoping | P0 |
| 14 | `server/src/lib/__tests__/scoped-models.complete.test.ts` | create | ~90 | test | reuses: scoped-models (DMMF partition) | P0 |
| 15 | `server/src/__tests__/integration/tenant-isolation.redteam.test.ts` | create | ~240 | test (real PG) | reuses: prisma, business-context | P0 (gate to P2) |
| 16 | `server/src/__tests__/integration/scoped-als-continuation.test.ts` | create | ~120 | test (real PG) | reuses: scoped-context | P0 |
| 17 | `server/src/__tests__/integration/scoped-mechanism.spike.test.ts` | create | ~170 | test (real PG) | reuses: prisma, soft-delete | **P-1 (hard gate)** |
| 18 | `server/scripts/cron/cleanup-unscoped-log.ts` | create | ~50 | script | reuses: __basePrismaUnsafe | P2 |
| 19 | `server/prisma/schema.prisma` | **edit** | ~+14 | schema | — (UnscopedAccessLog + PayslipSnapshot index) | P0 |
| 20 | `server/src/__tests__/setup.ts` | **edit** | ~+10 | test | — (stub `__basePrismaUnsafe` + `runUnscoped` passthrough) | P0 |
| 21 | `server/prisma/migrations/*_add_unscoped_access_log/` | create | ~12 | migration | — | P0 |
| 22 | `server/prisma/migrations/*_add_payslip_snapshot_business_index/` | create | ~6 | migration | — | P0 |
| 23 | `ssot.config.mjs` | **edit** | ~+16 | config | new-ssot rows (tenant-scoping, business-context) | P0 |

Row #4 (rewrite) at ~170 and #5 (inject) at ~180 stay under the 250 cap; the
merge/rewrite/inject three-way split (SCOPE #3/#4/#5) is what keeps them there. If
#4's child-many planner + two-step planner push past 250 during build, split the
child-many planner into `prisma-scoped.childplan.ts` (a pre-planned overflow row).

---

## SCOPE Conformance Map

| SCOPE decision (MUST_SHIP unless noted) | Architecture artifact | Status |
|-----------------------------------------|-----------------------|--------|
| Inject `businessId` into every `where` on 96 directly-scoped models, AND-intersect | `injectScope` merged path §2.3 · `andMergeWhere` (#3) | OK |
| Two-step parent-id planner for child `updateMany`/`deleteMany` (B9) | `childMany` plan §2.3/§3.5 · `prisma-scoped.rewrite.ts` (#4) | OK |
| Validate nested `connect`/`connectOrCreate` targets in-tenant (B13) | `FkGuard` + `guarded` plan §2.2/§3.6 · `prisma-scoped.merge.ts` (#3) | OK |
| Standalone child-create scalar FK validated (strengthens B3) | `guarded` §3.4 | OK (deepened) |
| Completeness test from DMMF; allowlist can't exempt `businessId` model (Gap 3) | test #14 §5.3 (#14) | OK |
| Phase-0 real-Postgres proof spike BEFORE wiring (Gap 4) | spike #17, Rollout Phase -1 §10 | OK |
| Fail closed when context unset (B8, GOLD G1) | `getBusinessContext()` undefined → throw §3.7 · `business-context.ts` (#2) | OK |
| Red-team integration on real ephemeral CI Postgres (hard gate) | test #15 §Test Infra | OK |
| ALS-continuation tests (finish/stream/PDF/fanout) (Gap 6) | §3.8 + test #16 | OK |
| One-time audit of all 86 raw-SQL sites (gate to enforce) | `raw-sql-audit.allowlist.json` (#12), Phase 0 gate §10 | OK |
| Audited `runUnscoped(reason)` for reads AND no-context writes | `runUnscoped` §2.1 · `UnscopedAccessLog` | OK |
| Keep 1245 tests green; injector unit-tested independent of prisma Proxy mock | `vi.importActual` for #13; setup.ts stubs (#20) | OK |
| Shadow logs inject-vs-manual diff + flags writes w/ no manual scope (SHOULD) | `prisma-shadow.ts` (#10) §10 | OK |
| CI lint: scoped model on `__basePrismaUnsafe` + new raw SQL banned (SHOULD) | `lint-raw-client.mjs` (#11) | OK |
| Boot-guard: prod refuses start unless `enforce` post-cutover (SHOULD) | `validateScopedPrismaBoot()` (#8) Phase 3 §7 | OK |
| Add `PayslipSnapshot` `@@index([businessId,createdAt])` (SS-1, SHOULD) | Migration B §4 (#22) | OK |
| Composition order soft-delete inner / scoping outer, proven | §6 + spike #17(c) | OK |
| Rewrite mechanism = client `$extends` re-dispatch, not bare query-ext; named fallback | §6, §5.1 | OK |
| `$transaction` two-step acts within caller tx, no nested tx (SS-2) | §5.1 primary+fallback | OK |
| Corrected 27-row CHILD_SCOPED map; ImportJobRow=`jobId` (CF-1) | §5.2 table | OK |
| Test #14 asserts FK column resolves as relation scalar → businessId ancestor (CF-2) | §5.3 assertions 1–4 | OK |
| `auth.audit-write` runUnscoped reason for `/api/auth/*` AuditLog (SS-3) | `UnscopedReason` §2.1 | OK |
| setup.ts stubs `__basePrismaUnsafe` (SS-4) | File #20 | OK |
| `UnscopedAccessLog` table + 90-day cleanup cron | Migration A §4 (#21) · cron (#18) | OK |
| Cron job name required in `cron.<name>` reason | `UnscopedReason` template-literal type §2.1 | OK |
| 406-service manual-scope migration | — | FUTURE_EPIC (SCOPE Out-of-Scope; intersection makes manual scope harmless) |
| Raw-SQL auto-parser | — | FUTURE_EPIC (audit is the MUST part) |
| Per-user scoping of user globals | — | FUTURE_EPIC |
| Child-model `businessId` denormalization | — | FUTURE_EPIC (planner is now-path; denorm is scale/spike-fail fallback) |

No MUST_SHIP or SHOULD_SHIP goal is `MISSING`.

---

## Deviations from SCOPE

1. **`GodownStock` removed from the CHILD_SCOPED map (28 → 27 rows).** The SCOPE's
   pinned FK map listed `GodownStock | godownId | Godown` as a child. Verified against
   `schema.prisma:2854-2870`: `GodownStock` carries its own `businessId String`
   (line 2856) and `@@index([businessId, godownId])` (line 2868). It is therefore
   directly-scoped — one of the 96 `SCOPED_MODELS` — not a child. Keeping it in
   `CHILD_SCOPED` would fail completeness test #14 assertion (a) ("child has no
   businessId scalar"). This is a second FK-map correction beyond CF-1, of exactly the
   class CF-2 was written to catch, and the SCOPE explicitly mandates the architect
   re-derive the map from the DMMF (SCOPE Data Model note + Notes #2). Reason:
   correctness + fail-closed at CI. Not a silent overrule — the SCOPE ordered the
   re-derivation; this is its result.

2. **B3 deepened to cover standalone child-create scalar FKs (§3.4).** The SCOPE's B3
   asserted children "inherit parent row scope via FK" — true only for nested writes
   under a scoped parent. A direct `child.create({data:{<scalarFk>}})` is not covered
   by top-level scoping (the child has no `businessId` to inject). The architecture
   adds explicit scalar-FK validation to the `guarded` plan. This is a strengthening,
   not a contradiction — the SCOPE's intent (child creates can't cross tenants) is
   preserved; the mechanism is made complete. Red-team #15 gains a standalone-child-
   create-with-foreign-FK case.

---

## Revision Log

(none yet — initial architecture, pre-audit)
