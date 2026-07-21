# ARCHITECTURE — `scoped-prisma-shadow`

> Technical design for the shadow-diff harness over the tenant-isolation layer.
> Under `SCOPED_PRISMA_ENFORCE=shadow`, sampled scoped-model **row-returning reads**
> run on both the scoped and unscoped clients, row-id sets are diffed, PII-free
> divergence records go to a durable Postgres sink, and the **unscoped result is
> returned** so runtime behaviour is unchanged.
>
> Status: DESIGN · **rev 4** (2026-07-21) · Owner: Sawan
> SCOPE ref: `docs/SCOPE_scoped-prisma-shadow.md` (rev 3)
> SCOPE audit ref: `docs/SCOPE_AUDIT_scoped-prisma-shadow.md` (SR-1/2/3/4)
> Architecture audit ref: `docs/ARCHITECTURE_AUDIT_scoped-prisma-shadow.md` (BLOCK — closed in rev 2; rev 2 verdict **PASS**)
> **Security audit ref: `docs/SECURITY_AUDIT_scoped-prisma-shadow.md` (REJECTED — 6 blocking / 5 medium, closed in rev 3; rev-3 re-audit **APPROVED WITH CONDITIONS**, conditions C1/C2/N-3/C4 applied in rev 4, see §20)**
> Roadmap ref: `docs/GOLD_STANDARD.md` §P0.1 (Option A step 1) · §3 Wave "Now" · gates G1

**⚠️ High-risk trust anchors touched.** `server/src/lib/prisma.ts`,
`server/src/lib/prisma-scoped.ts`, `server/prisma/schema.prisma` + migration,
`server/src/middleware/auth.ts`. Every edit requires an approved
`.claude/design-plan-active.md` with `agents_invoked: architect, security`.
This document is step 2 of that sequence; it does not authorise the edits by itself.

**⛔ `server/src/lib/env.ts` is owned by a concurrent session and is NOT in this
epic's `files_planned`.** It appears nowhere in the File Plan. See §8.4 and D-10.

---

## 0. Verification of the tree (re-checked 2026-07-21, at `78f6dce`)

Everything below was read, not inferred. Where the SCOPE or the audit is wrong,
the correction is stated and carried into the design.

| Claim | Verdict | Evidence |
|---|---|---|
| `prisma.ts` is a two-way ternary; `shadow` falls through to unscoped | TRUE | `prisma.ts:110-111` |
| `createScopingExtension` is attached ONLY to `clients.scoped` | TRUE | `prisma.ts:70-72` |
| `__basePrismaUnsafe` exported at `:101`, `prisma` at `:110` | TRUE | `prisma.ts:101,110` — the nine lines AA-6 depends on |
| **`prisma.ts:76-86` fires `unscopedAccessLog.create()` with a terminal `.catch`** | TRUE | the in-repo fire-and-forget precedent B-1 requires the harness to copy |
| `clients` memoised on `globalThis.__hpPrismaClients` when `NODE_ENV !== 'production'` | TRUE | `prisma.ts:94-97` — the SS-3 hazard |
| Env split landed; `env.ts` is a 65-line named-re-export barrel | TRUE | `env.ts:1-65`; scoped-prisma block at `env.ts:59-64` |
| Accessors live in `env.scoped-prisma.ts` (46 lines) | TRUE | `env.scoped-prisma.ts:13,21,33`; garbage-value throw at `:34-37` |
| `validateScopedPrismaBoot()` has zero call sites | TRUE | defined `env.scoped-prisma.ts:33`, re-exported `env.ts:62`; `index.ts` calls only `validateNicEnv()` (`index.ts:3,11`) |
| `scopedContext` middleware is mounted nowhere | TRUE | grep → `middleware/scoped-context.ts` only |
| `scoped-context.ts` skips the frame when `businessId` is empty | TRUE | `scoped-context.ts:21-24` — the AA-3 premise |
| Auth seam is `auth`, per-router, not global | TRUE | `middleware/auth.ts:27`; `app.ts` global chain ends before `mountFeatureRoutes` |
| `auth` queries `prisma.user` before `req.user` exists | TRUE | `auth.ts:61`; benign — `User` ∈ `GLOBAL_ALLOWLIST` (`scoped-models.ts:65`) |
| `auth.ts:75` sets `businessId: payload.businessId ?? ''` | TRUE | verbatim |
| `txSlot` is module-private | TRUE | `prisma-scoped.ts:49` |
| `READ_MERGE_OPS` contains `count`/`aggregate`/`groupBy` | TRUE | `prisma-scoped.rewrite.ts:10-17` |
| Every read plan is `noGuards(...)` ⇒ `plan.guards` empty ⇒ `runGuards` a no-op | TRUE | `prisma-scoped.inject.ts:133-138` |
| `executePlan` issues REAL writes for `twoStep`/`upsert` | TRUE | `prisma-scoped.ts:96-121` |
| Every `executePlan` branch awaits **inside** the `runReentry` callback | TRUE | `prisma-scoped.ts:96-121` — the SS-1 precedent |
| `SCOPED_MODELS` is DMMF-derived by `businessId` scalar presence | TRUE | `scoped-models.ts:19-23` |
| `UnscopedAccessLog.subjectBusinessId` is the naming precedent | TRUE | `prisma.ts:76-86` writes it on the raw base client |
| `render.yaml` is `plan: free`, `autoDeploy: true`, ephemeral FS | TRUE | `render.yaml:8,27` |
| Prisma pool is `connection_limit=10` | TRUE | `prisma.ts:30` |
| Crons run in-process via `node-cron`, IST timezone | TRUE | `lib/cron-scheduler.ts:10,114,119` |
| Admin surface is `/api/admin` + `requireAdmin` + `auditAdminAction` | TRUE | `app.routes.ts:160`; `middleware/admin-auth.ts:104,183,205` |
| **`scripts/scoped/lint-raw-client.mjs` is "wired into CI + pre-commit"** | **FALSE — a fourth landed-dark component** | The file's own header (`:21`) claims it. `.githooks/pre-commit` contains only `node scripts/ssot/check.mjs`; no `lint-raw-client` script in root or `server/package.json`. Independently confirmed by both auditors. See §15.4. |
| **`.githooks/pre-commit` is invoked only via `core.hooksPath`, which is LOCAL git config** | **TRUE — and it is not committed** | Security audit B-4. A clone without `git config core.hooksPath .githooks` never runs the hook, so the hook line alone is not an invoker. §15.4 |
| **`lint-raw-client.mjs` walks only `server/src`** | TRUE | `:30` `SERVER_SRC`. Anything under `scripts/`, `server/scripts/`, `server/prisma/` is invisible to it — M-4a. |
| **`RAW_CLIENT_ALLOWLIST:36` names `server/scripts/cron/cleanup-unscoped-log.ts`, outside the walk root** | TRUE | a dead row that can never be flagged; evidence the allowlist already drifts unnoticed — B-5 |
| `render.yaml:15-17` "accumulated type errors" | STALE — FALSE | `tsc -b --noEmit` exits 0 |

**Correction to SCOPE rev 3 (SR-2 residue).** Rev 3's premise table still cites
`env.ts:267` for `getScopedPrismaShadowSample()` and File Plan #11 still targets
`env.ts` for accessor bodies. Both are wrong post-`62f6297`. The correct target is
`env.scoped-prisma.ts:21`. §15.2 carries the gate-coverage consequence; §8.4 and D-10
carry the import consequence.

---

## 1. The problem this design exists to solve, restated

Three components of this layer are written and **unreachable**: `scopedContext`
(mounted nowhere), the scoping extension (attached to a client nothing uses under
`shadow`), and `validateScopedPrismaBoot()` (zero callers). §0 adds a fourth
(`lint-raw-client.mjs`). The common cause, named by the SCOPE auditor:

> every artifact here is a *definition*, and a definition typechecks, tests and
> greps identically whether or not anything calls it.

So this architecture has two deliverables, not one:

1. **The harness** (§3–§9).
2. **A mechanical control against landing dark** (§12): an *adoption assertion*
   per component — a test that fails when the **call site** is removed, not merely
   when the definition is. Every component this epic adds or wires carries one.

**Rev-2 note.** The architecture auditor found this same pathology reproduced *inside*
those controls three times: A9 asserted the linter's definition rather than its call
site (AA-4); the D-1 exit gate was unfalsifiable rather than merely unreachable
(AA-3); and the `observe()` path silently certified every context-free read as clean
(AA-5). All three are closed below. The lesson generalises past this epic and is
appended to `~/.claude/learnings/architecture-blindspots-*.md`: **a control built to
detect dark components is itself a component, and needs its own call-site assertion
and its own falsifiability check.** A gate that cannot return non-zero is not a
weaker gate than an unreachable one — it is strictly worse, because unreachable gets
noticed and unfalsifiable reports success forever.

**Rev-3 note — the same shape, one layer lower.** The security audit found that all
three prior rounds audited the **read/probe path** and stopped at its first
fire-and-forget boundary. `void sink.write(record)` survived three reviews because it
*reads* as a terminal statement; it is in fact a promise nobody owns. Five of six
blocking findings live on the **sink write path** (B-1 process death, B-2 unbudgeted
concurrency, B-3 an invisible failure that greens the promotion gate, B-5 a control
that cannot see the new consumer, B-6 a dropped id cap), and the sixth (B-4) is the
same "no real invoker" defect one level above A9. §5.2 now exists as a first-class
section for that path, and the generalised lesson is appended alongside the rev-2 one:
**a fire-and-forget boundary is an unaudited subsystem, not a statement.** Audit what
happens *after* the interesting function returns.

---

## 2. Module map and dependency direction

```
                        ┌──────────────────────────────────────────────┐
                        │ prisma.ts  (composition root)                │
                        │  off     → clients.softDeleted               │
                        │  shadow  → clients.scoped                    │
                        │            + setShadowPort(createShadowPort( │
                        │                { db: clients.base }))        │
                        │  enforce → clients.scoped                    │
                        └───────────────┬──────────────────────────────┘
                                        │ injects BOTH the port and the base client
                                        │  (ONLY when mode === 'shadow')
                                        ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │ prisma-scoped.ts  (TRUST ANCHOR — extension transport)            │
   │   • shadowPort: ShadowPort | null   (module-private)              │
   │   • setShadowPort() — mode-guarded, one-shot (M-2)                │
   │   • shouldShadow()  — reads private txSlot (SS-1 of SCOPE audit)  │
   │   • runScopedProbe() — injectScope → plan-kind GUARD → executePlan│
   │   • $allOperations: shadow branch FIRST                           │
   └────────┬──────────────────────────────────────┬───────────────────┘
            │ imports TYPES only                    │ imports (existing)
            ▼                                       ▼
   ┌────────────────────────┐            prisma-scoped.inject.ts
   │ prisma-shadow.types.ts │            prisma-scoped.rewrite.ts
   │  ShadowPort            │            prisma-scoped.merge.ts
   │  ShadowDb  (narrow)    │            business-context.ts
   │  ShadowObserveInput    │            scoped-models.ts
   │  ScopedShadowDivergence│
   │  RequestMeta           │
   └────────▲───────────────┘
            │ implements
   ┌────────┴────────────────────────────────────────────────────────┐
   │ prisma-shadow.ts   createShadowPort({ db })                     │
   │   diff.ts · classify.ts · redact.ts · throttle.ts   (pure)      │
   │   sink.ts    createShadowSink(db)     ─┐                        │
   │   stats.ts   createShadowStats(db)    ─┴─ db ARRIVES as an arg  │
   │   emit()  — the ONLY fire-and-forget boundary (§5.2, B-1/B-2/B-3)│
   └─────────────────────────────────────────────────────────────────┘

   NOTHING under prisma-shadow.* imports prisma.ts. The graph is acyclic.
```

**Two cycles are broken here, both by the same technique — inject at the composition
root, never reach upward.**

1. **`prisma-scoped ↔ prisma-shadow`.** `prisma-shadow.ts` must not import
   `prisma-scoped.ts` (the extension calls the harness). Instead `prisma-scoped.ts`
   owns the `executePlan` call and passes a **`runScoped` thunk** into `observe()`.
2. **`prisma-shadow → prisma.ts` (AA-6).** The sink writes on the raw base client. In
   rev 1 `sink.ts` imported `__basePrismaUnsafe` from `prisma.ts`, closing the loop
   `prisma.ts → prisma-shadow.ts → sink.ts → prisma.ts`. That resolved *only* because
   `__basePrismaUnsafe` is exported at `prisma.ts:101` and the wiring line sits at
   ~`:110` — nine lines apart, and only while `sink.ts` dereferences the binding
   inside a function body. Move the wiring line above `:101`, or let `sink.ts` write
   `const db = __basePrismaUnsafe` at module scope, and boot throws a **TDZ
   `ReferenceError` in the composition root, under `shadow` only** — invisible in
   `off` and `enforce`, i.e. invisible everywhere except the one mode that ships.
   Fixed by passing the client: `createShadowPort({ db: clients.base })`;
   `createShadowSink(db)` / `createShadowStats(db)` take it as an argument and import
   nothing from `prisma.ts`.

`ShadowDb` is a narrow structural type in `prisma-shadow.types.ts` exposing only the
two delegates the sink needs (`scopedShadowDivergence`, `scopedShadowStat`), so the
harness cannot reach the tenant models even by accident, and the type does not drag
`prisma.ts` back in as a type-only import.

**The injected-client shape has a control consequence (B-5).** Because the sink
*receives* the client rather than importing `__basePrismaUnsafe`, the existing
`lint-raw-client.mjs` rule — which matches on the import/identifier — cannot see it.
That is not a reason to revert to the import; it is a reason to extend the linter.
§7.6 states the gap plainly and File #18 closes it.

Dependency direction is now genuinely one-way. A builder scaffolding from this
diagram writes the acyclic version.

---

## 3. Dispatch design for `prisma.ts`

### 3.1 Three-way resolution (G-1, MS-1)

```
off      → clients.softDeleted     unchanged; extension not on the path
shadow   → clients.scoped          extension on the LIVE path; harness branch active
enforce  → clients.scoped          extension on the live path; injection load-bearing
```

`prisma.ts` gains one conditional wiring statement, executed **after**
`clients.base` is constructed and **before** the `prisma` export is evaluated:

```
if (scopedMode === 'shadow') setShadowPort(createShadowPort({ db: clients.base }))
export const prisma = scopedMode === 'off' ? clients.softDeleted : clients.scoped
```

Two structural consequences, both intentional:

- Under `off` and `enforce`, `shadowPort` is `null`. `shouldShadow()` returns `false`
  on its first line. The harness is not "disabled by a flag check inside the hot
  path" — it is **absent**, one null-check deep.
- Under `shadow`, the port is non-null *and* `prisma` is the scoped client. Neither
  half is useful alone, and the §12 adoption assertion fails if **either** line is
  removed. That is the direct mechanical answer to the epic's near-miss failure.

The statement references `clients.base` (a local const), not the
`__basePrismaUnsafe` export, so it is order-independent with respect to the export
statements around it — the AA-6 fragility is removed at its source rather than
documented as a constraint the next editor must remember.

`prisma` stays typed as `SoftDeletedClient` (`prisma.ts:110`'s existing cast). The
scoping extension is query-only and does not change the delegate surface, so no
call site anywhere in the 186 services sees a type change. **Zero downstream files
change.**

### 3.1a `setShadowPort()` is mode-guarded and one-shot (M-2)

`setShadowPort` is a **new exported mutable-state setter on a trust anchor**. Left
unguarded it is a supply-chain-shaped hazard: any module that can import
`prisma-scoped.ts` could install its own port under any mode, and the "harness is
absent, not flag-disabled" property of §3.1 would hold only by convention. It is
structurally true only if nothing else can set the port.

```ts
// server/src/lib/prisma-scoped.ts
let shadowPort: ShadowPort | null = null

export function setShadowPort(port: ShadowPort): void {
  const mode = getScopedPrismaMode()                       // direct import, D-10
  if (mode !== 'shadow') throw new ShadowPortModeError(mode)   // not installable off/enforce
  if (shadowPort !== null) throw new ShadowPortAlreadySetError() // one-shot
  shadowPort = port
}
```

The shadow branch additionally asserts the mode as a belt (`if (shadowPort && mode
=== 'shadow')`), so a port installed by any future path that bypasses the setter
still cannot put the harness on the `enforce` hot path. There is deliberately **no**
`clearShadowPort()`: tests that need the unset state use the fresh-module-registry
mechanism of §12.1 (`pool: 'forks'`, `isolate: true`), not a reset export.
**AC-29** asserts both throws.

This is the structural half of the security auditor's "harness absent rather than
flag-disabled" confirmation; that finding was confirmed sound *subject to* this guard.

### 3.2 Boot log (UX copy, per SCOPE)

`Database connection initialized (soft-delete active, scoped-prisma mode=shadow, client=scoped, shadow-sample=0.01)`

The `client=` token is load-bearing operator evidence: it is the one line that
distinguishes "shadow wired" from "shadow parsed and ignored", and the runbook's
first triage step reads it.

---

## 4. The shadow branch in `prisma-scoped.ts` (D-2, MS-1, G-5)

```
async $allOperations({ model, operation, args, query }) {
  const q = query as Continuation

  // ── SHADOW BRANCH — first statement, above the fail-closed guard chain ──
  if (shadowPort && model) {
    const real = Promise.resolve(q(args))          // (1) caller's value, bound first
    try {
      if (shouldShadow(model, operation)) {
        void shadowPort
          .observe({ … , real, businessId: getBusinessContext()?.businessId })
          .catch(() => { try { shadowPort!.countHarnessError() } catch { /* N-2 total */ } })  // (2b) B-1 terminal catch
      }
    } catch { try { shadowPort.countHarnessError() } catch { /* N-2 total */ } }   // (2a) sync throw in shouldShadow
    return real                                    // (3) the sole exit
  }

  // ── existing enforce path, byte-identical to today ──
  if (!model || isReentrant() || !isTenantModel(model) || getUnscopedReason()) return q(args)
  const ctx = getBusinessContext()
  if (!ctx) throw new ScopedContextError(model)
  …
}
```

`businessId` is passed **explicitly and possibly `undefined`** into `observe()`, and
`observe()` branches on it before any probe runs (§5.1). It is never allowed to reach
`injectScope` — see AA-5 / §4.3.

`observe()` is specified never to reject (§5.1 wraps its body). The `.catch` at (2b)
is not redundant belt-and-braces prose — it is the **enforcement** of that
specification. On Node ≥ 15 an unhandled rejection terminates the process by default;
a `void`-ed promise with no terminal handler converts any future editing mistake
inside `observe()` from "a counted harness error" into "the API exits". See §5.2.

### 4.1 Why a bug in the harness cannot reach the caller

| Property | Mechanism | Proof obligation |
|---|---|---|
| `real` is bound before any harness code runs | statement (1) precedes everything | AC-4 point 1 |
| A sync throw is contained | try/catch at (2a) | AC-4 point 1 |
| An async rejection is contained | `observe()` returns `void`, is `async`, wraps its body in try/catch **and** carries a terminal `.catch()` at its call site (2b) **and** races a timeout | AC-4 points 2–4 |
| **A rejected sink or stats write cannot terminate the process** | **every fire-and-forget inside the harness goes through `emit()` (§5.2), which attaches a terminal `.catch` — the `prisma.ts:76-86` pattern. No `void promise` without a handler exists anywhere in the harness.** | **AC-26** |
| There is no path returning the shadow result | statement (3) is the only `return` in the branch; `observe` has no return value the branch reads | code review + AC-4 |
| `ScopedContextError` is never thrown under shadow | the branch returns above line `139` | AC-1, AC-3 |

**`Promise.resolve(q(args))` is deliberate, not incidental.** Prisma promises are
lazy — this layer has already been burned by it (`prisma-scoped.ts:14-17`;
memory `project_scoped_prisma_mechanism`). `Promise.resolve` on a thenable
subscribes **once** and yields a native promise both consumers share, which is what
makes the SR-4 budget ("at most one extra read per sampled read") true rather than
hoped-for. Phase 0 (§13) proves it with a filtered SQL-statement count before
anything else is built.

### 4.2 `shouldShadow()` — read-only by construction (G-4, MS-2, FM-1, FM-16)

Lives in `prisma-scoped.ts` so it can read the module-private `txSlot` without
exporting it (SCOPE-audit SS-1, RD-14). Returns `true` only when **all** hold:

1. `shadowPort !== null` **and** `getScopedPrismaMode() === 'shadow'` (M-2 belt)
2. `isTenantModel(model)`
3. `operation ∈ SHADOW_READ_OPS`
4. `!isReentrant()`
5. `!getUnscopedReason()`
6. `txSlot.getStore() === undefined` (FM-4)
7. `shadowPort.shouldSample()` — sample × throttle × inflight × breaker

Condition 8 of rev 1 ("context present **or** it is a no-context record") is
**deleted**. It admitted a read into sampling without specifying what happened next,
and §5.1 had no matching branch — the AA-5 defect. Context-presence is now decided in
exactly one place, `observe()`, which has both branches written.

`SHADOW_READ_OPS` is an explicit **subtraction** over *imported* sets, never re-typed:

```
SHADOW_UNCOMPARABLE_OPS = { 'count', 'aggregate', 'groupBy' }
SHADOW_READ_OPS = (READ_MERGE_OPS ∪ FIND_UNIQUE_OPS) \ SHADOW_UNCOMPARABLE_OPS
                = { findFirst, findFirstOrThrow, findMany, findUnique, findUniqueOrThrow }
```

Both source sets are imported from `prisma-scoped.rewrite.ts`. A future op added
upstream therefore lands here **automatically, in the included position** — which is
the correct default only because §12's read-only adoption test (A10) enumerates every
Prisma op against a spy delegate and fails on any newly-sampled op that has no
comparator. Constant + test together, not constant alone.

### 4.3 `runScopedProbe()` — the scoped side runs the real mechanism (SCOPE-audit SS-2, RD-15)

```
runScopedProbe(model, operation, args, businessId: string)     // NOT optional
  if (!businessId) throw new ShadowProbeNoContext(model)       // belt (AA-5)
  plan = injectScope(model, operation, args, businessId)
  if plan.exec.kind is 'twoStep' | 'upsert' | 'passthrough':
      throw ShadowPlanRefused(plan.exec.kind)                  // hard refusal, counted
  return executePlan(innerClient, model, businessId, plan, probeContinuation, args)
```

Three defences in depth:

1. `SHADOW_READ_OPS` can never produce a write plan kind (reads map to `sameOp` /
   `findFirst` only — `prisma-scoped.inject.ts:133-138`, every read via `noGuards`).
2. `runScopedProbe` **hard-refuses** `twoStep`/`upsert` before `executePlan` is
   entered. `executePlan` issues real writes for those kinds
   (`prisma-scoped.ts:96-121`); the guard makes "shadow never writes" a property of
   the code rather than of the constant's current contents.
3. **`businessId` is a required `string` with a runtime throw** (AA-5). A missing
   context can no longer silently become `where: { businessId: undefined }`, which
   Prisma drops — the repo's own recorded footgun
   (`feedback_auth_req_user_shape`: *"undefined causes cross-tenant IDOR via Prisma's
   drop-undefined semantics"*). The primary control is `observe()`'s branch (§5.1);
   this throw exists so that a future caller who bypasses that branch gets a counted
   `shadow-error` rather than a fabricated clean diff.

`probeContinuation` is a synthetic continuation supplied by the probe:

```
(a) => runReentry(async () => await innerClient[model][operation](a))
```

The `await` sits **inside** the `runReentry` callback (SS-1 of the architecture
audit). A non-awaiting callback tears the ALS store down before the lazy Prisma
promise fires — `prisma-scoped.ts:14-17` and memory `project_scoped_prisma_mechanism`
both record this, and every existing branch of `executePlan` (`:96-121`) has the
awaiting form. The snippet above is the form to copy.

`executePlan`'s `sameOp` branch calls this continuation with the scoped args.

**Fidelity note, stated honestly.** Under `enforce`, a read's `sameOp` branch calls
the *extension's own* continuation `q`; the probe calls a re-dispatch on the inner
soft-delete client instead. Both traverse the soft-delete extension exactly once and
both bottom out on the same connection pool, so the diff is apples-to-apples on the
axis that matters. The residual difference is composition-order inside Prisma's
extension stack. Re-invoking the caller's continuation `q` a second time within one
`$allOperations` call would be exact parity, but whether Prisma supports that is
**unproven** — so Phase 0 tests it, and if it holds it becomes a follow-up fidelity
improvement, never a Phase-3 blocker.

---

## 5. Harness module boundaries

| Module | Owns | Never does |
|---|---|---|
| `prisma-shadow.types.ts` | `ShadowPort`, `ShadowDb`, `ShadowObserveInput`, `ScopedShadowDivergenceRecord`, `ShadowKind`, `RequestMeta` | import anything from `prisma-scoped*` or `prisma.ts` |
| `prisma-shadow.constants.ts` | `SHADOW_READ_OPS` (subtraction), caps (incl. `SHADOW_MAX_IDS = 20`), timeouts, breaker + sink-gauge thresholds, kind literals | contain logic |
| `prisma-shadow.diff.ts` | id extraction, symmetric difference, `SHADOW_MAX_ROWS` truncation, **`SHADOW_MAX_IDS` id-array cap (B-6)**, `unsupported-shape` detection | touch DB, ALS, clock |
| `prisma-shadow.classify.ts` | `diverged` vs `unstable-window` vs `skew-suspect` decision | touch DB, ALS |
| `prisma-shadow.redact.ts` | build the record from a **key allowlist**; `shapeHash`; stack trimming; re-assert the id cap before persistence | read `args`, `err.message`, `originalUrl` |
| `prisma-shadow.throttle.ts` | sampler, probe inflight gauge, **sink inflight gauge (B-2)**, latency EWMA, error breaker + cooldown | touch DB |
| `prisma-shadow.sink.ts` | `createShadowSink(db)`; dedupe upsert; hourly-cap enforcement | import `prisma.ts`; be awaited by a caller |
| `prisma-shadow.stats.ts` | `createShadowStats(db)`; hourly rollup (incl. the `routeHint`-keyed `observed-framed` rollup, §7.2a) + the watch-window read queries | import `prisma.ts`; write divergence rows; use `$queryRaw` (M-4) |
| `prisma-shadow.ts` | `createShadowPort({ db })` / `observe()` orchestration + timeout race + **`emit()`, the single fire-and-forget boundary (§5.2)** | contain diff/classify/redact logic |

`diff`, `classify`, `redact` are **pure functions over fixtures** — they take both
result sets as inputs and return a record. That is what lets 4 of the unit test files
run with no database at all.

### 5.1 `observe()` control flow — with the no-context branch (AA-5)

```
observe(input):                                  // async, void-returned, never throws
  t0 = now()
  try:
    unscopedRows = await input.real              // reuse; may reject → caller's problem
  catch: return                                  // real query failed ⇒ shadow never runs

  // ── NO-CONTEXT BRANCH — before inflight++, before any probe ──────────
  if (!input.businessId):
      meta   = getRequestMeta()                  // ALS slot; undefined on the job path
      record = buildNoContextRecord({
                 model, operation,
                 provenance: meta ? 'http' : 'job',
                 hadBusinessOnToken: meta?.hadBusinessOnToken ?? false,
                 routeHint: meta?.getRouteHint() ?? '',
               })
      emit(record, ['sampled', 'no-context'])    // §5.2 — NEVER a bare `void promise`
      return                                     // NO probe. NO pool slot. NO diff.

  inflight++
  try:
    scopedRows = await race(input.runScoped(input.businessId), timeout(SHADOW_TIMEOUT_MS))
    interval   = now() - t0
    diff       = diffIds(unscopedRows, scopedRows)          // caps ids at 20 (B-6)
    kind       = classify(diff, argFlags, interval)
    meta       = getRequestMeta()
    if (kind === 'clean'):
        // no divergence row — the divergence table holds anomalies only (§7.2a)
        emitStatsOnly(['sampled', 'observed-framed'], meta?.getRouteHint() ?? '')
    else:
        record   = buildRecord(kind, diff, meta)            // key allowlist
        emit(record, ['sampled', kind])
  catch e:
    breaker.record(e)
    emit(buildErrorRecord(e), ['sampled', 'shadow-error'])  // errorName only
  finally: inflight--
```

**`clean` is now an explicit classifier outcome.** Rev 2's pseudocode wrote a record
for every compared read while §9.1 listed only anomaly kinds — an ambiguity the
security audit flagged as RS-1's root. The resolution is stated once, here: a
non-divergent comparison produces **no divergence row and one stat bump**
(`observed-framed`, keyed by `routeHint`). That is what keeps §7.2's cap arithmetic
valid, keeps the divergence table an anomaly table, and gives exit criterion 2 a
population to count (§7.2a, §11).

**Why the no-context branch is the highest-severity fix in rev 2.** Without it, a
context-free read reached `runScopedProbe` with `businessId === undefined`,
`injectScope` built `where: { AND: [..., { businessId: undefined }] }`, **Prisma
dropped the undefined key**, the probe ran unscoped, the diff was empty, and the
record said *verified non-divergent*. Since `runUnscoped` has zero adopters today,
that is ~100% of cron, webhook, and pre-business traffic silently certifying itself
clean — and the `diverged = 0 for 72 consecutive hours` exit criterion would then be
partly satisfied by queries that were never compared. That is precisely the epic's
stated catastrophic outcome (b): a harness that reports zero divergences and gives
false confidence.

`observe` never awaits the sink, never returns a value, and its only interaction with
the caller's path is the `await input.real` it shares.

### 5.2 The sink write path — `emit()` (B-1, B-2, B-3)

Three prior audit rounds read `void sink.write(record)` as a terminal statement. It is
a promise nobody owns. The harness therefore has exactly **one** fire-and-forget
boundary, and it is a named function with three responsibilities.

```ts
// prisma-shadow.ts
function emit(record: ScopedShadowDivergenceRecord, statKinds: ShadowStatKind[]): void {
  if (sinkInflight >= SHADOW_SINK_MAX_INFLIGHT) {          // B-2 — default 2
    onSinkShed()                                           // N-1 — backpressure, NOT failure
    return
  }
  sinkInflight++
  void sink.write(record)                                  // B-1 — terminal chain
    .then(() => stats.bump(statKinds))
    .catch(onSinkFailure)
    .finally(() => { sinkInflight-- })
}

function emitStatsOnly(statKinds: ShadowStatKind[], routeHint: string): void {
  if (sinkInflight >= SHADOW_SINK_MAX_INFLIGHT) { onSinkShed(); return }
  sinkInflight++
  void stats.bump(statKinds, routeHint).catch(onSinkFailure).finally(() => { sinkInflight-- })
}

// N-1 — saturation is benign backpressure: its own counter, its own Sentry group,
// NOT an exit-criterion gate. It still latches the breaker, because sustained
// saturation is a degraded sink.
function onSinkShed(): void {
  try {
    sinkShed++                                             // N-1 — IN-PROCESS counter
    breaker.record(new ShadowSinkSaturated())
    logger.warn('[shadow] sink shed', { inflight: sinkInflight })
  } catch { /* N-2 — total: a handler that throws re-raises what B-1 closed */ }
}

// N-2 — every statement inside a terminal handler is itself wrapped. `.catch(fn)`
// contains a rejection only if `fn` cannot throw; `logger.error` and
// `captureException` are third-party calls carrying no such guarantee.
function onSinkFailure(err: unknown): void {
  try {
    sinkWriteFailed++                                      // B-3 — write REJECTION only
    breaker.record(err)                                    // B-2 — sink failures latch too
    logger.error('[shadow] sink write failed', { errorName: nameOf(err) })  // no payload
    captureException(err, { fingerprint: ['shadow', 'sink-write-failed'] })
  } catch { /* swallow — last handler in the harness; nothing above it can recover */ }
}
```

**B-1 — process death.** `prisma.ts:76-86` already does this correctly nine lines
from the code this epic edits: `void base.unscopedAccessLog.create({…}).catch(err =>
logger.error(…))`. On Node ≥ 15 the default unhandled-rejection mode is `throw`,
which terminates the process. A design that documents itself as *"fail open silently
with a counter"* (§4.1) but leaves `void sink.write(record)` unhandled crashes the
API on the first transient sink write failure — a Postgres blip, a unique-constraint
race on the dedupe upsert, a pool timeout. **Every** promise the harness abandons
goes through `emit`/`emitStatsOnly`; there is no bare `void promise` anywhere in the
harness, and AC-26 asserts it with an injected rejecting `ShadowDb`.

**B-2 — the sink was outside the concurrency budget.** §11's rev-2 claim that a
no-context read consumes *"zero pool slots"* was false: it skipped the probe and then
issued a sink upsert on the same 10-connection pool. On the job path — where
`runUnscoped` has no adopters and effectively every read is `no-context` — that is one
extra write per sampled read, unbudgeted, precisely where the probe budget said zero.
`SHADOW_SINK_MAX_INFLIGHT` (default **2**) gauges it, sheds rather than queues on
saturation, and sink failures feed the same breaker as probe failures, so a degraded
Postgres latches the whole harness instead of only half of it. §11's budget line is
corrected to *"zero probe slots, at most one in-flight sink write, ≤ 2 concurrent"*.

**B-3 — the failure was invisible, and it greens the promotion gate.** This is the
finding that decides whether the epic is trustworthy. If sink writes fail silently,
the divergence table is empty; `kind='diverged' = 0 for 72 consecutive hours` is then
satisfied **by the absence of the recording mechanism**, and the `enforce` epic is
authorised by a broken pipe. That is the epic's own catastrophic outcome (b),
reintroduced one layer below where AA-5 closed it.

The counter is therefore reported on a **different path from the one that failed** —
the §15.1 counter-independence rule, reapplied:

- `sinkWriteFailed` is an **in-process** integer, not a `ScopedShadowStat` row.
  Writing the "the DB write failed" signal *to the DB* is the same defect one level
  down.
- It is surfaced on the status payload (§8.2) beside `shadowError`, is logged at
  `error`, and is fingerprinted `['shadow','sink-write-failed']` in Sentry so it
  groups by classification rather than by message.
- It is an **exit criterion at 0** (§11) — and, per N-1 below, *only* genuine write
  rejection is. A watch window that ends with a non-zero `sinkWriteFailed` does not
  qualify the `enforce` epic, regardless of how clean the divergence table looks.
- The §15.1 watchdog already pages on `sampled = 0` in the current hour bucket — the
  durable-row twin of this signal, which catches the case where the process restarts
  and loses the in-process counter.

**N-1 — shedding and rejection are not the same integer.** Rev 3 incremented
`sinkWriteFailed` on gauge saturation as well as on a rejected write. These are
different events: saturation is *benign backpressure* — the sink is healthy, the
harness is busy, and the design's own answer is to drop the record — whereas rejection
is a *broken pipe*. Sharing one integer makes the exit criterion either unachievable at
stage-1 sample 1.0, where saturation is expected, or something the operator learns to
wave through — which is exactly B-3's failure, a signal that stops meaning anything,
recurring one level up. So: **`sinkShed`** is its own in-process counter, reported on
the status payload (§8.2), logged at `warn`, and fingerprinted `['shadow','sink-shed']`;
**`sinkWriteFailed`** counts write rejection only; and **only `sinkWriteFailed` is
gated at 0** in §11. `sinkShed` is *reported* in the exit-criteria block, because a
window that shed heavily saw less than its `sampled` count suggests — a volume-floor
question, not an integrity failure.

**N-2 — the handlers are total.** `.catch(fn)` contains a rejection only if `fn` cannot
itself throw. Rev 3's `onSinkFailure` called `logger.error` and `captureException`
unwrapped, and §4's sync `catch` called `countHarnessError` unwrapped; a throwing
handler re-raises the unhandled rejection B-1 was raised to eliminate — the fix
reintroducing the failure it closed. Every terminal handler in the harness
(`onSinkFailure`, `onSinkShed`, and §4's `(2a)`/`(2b)`) therefore wraps its entire body
in `try { … } catch {}`. Nothing above the last handler could recover, so swallowing
there is correct rather than lazy. **AC-26 is extended accordingly**: rev 3 exercised
the handler being *called*; rev 4 also injects a `logger.error` that *throws* and
requires the `unhandledRejection` spy to stay silent.

---

## 6. Data flow

### 6.1 Request path (`provenance: 'http'`)

```
HTTP request
  → per-router `auth` (middleware/auth.ts:27)
      verifies token, loads user, sets req.user
      → enterTenantFrame(req, next)                       ← NEW (G-2, MS-5, FM-17)
          runWithRequestMeta({ method, getRouteHint,
                               hadBusinessOnToken: Boolean(req.user?.businessId) })
            └─ runInBusinessContext({businessId,userId})   ← only when businessId is non-empty
                 └─ next()  → router → handler
                      → service → prisma.<model>.findMany()
                          → $allOperations shadow branch
                              real = q(args)  ──────────► caller
                              observe() ──► [no-context branch]  OR
                                            runScopedProbe ──► injectScope ──► executePlan
                                          ──► diff ──► classify ──► redact ──► emit (§5.2)
```

`runWithRequestMeta` runs **unconditionally**, outside the business-frame condition.
That is what makes the AA-3 gate falsifiable: `hadBusinessOnToken` is recorded even
when — especially when — no tenant frame opens.

### 6.2 Why the frame opens inside `auth`, and how `routeHint` is obtained

`app.use(scopedContext)` runs **before** router-level middleware, so `req.user` is
undefined and `scoped-context.ts:22` takes the no-frame branch — 100% `no-context`,
shielded by a passing grep (FM-17). The frame therefore opens in the same function
that sets `req.user`. One file covers all 138 route files and 26 mount sites, and
the ordering bug becomes structurally impossible.

**`routeHint` cannot be captured at `auth` time.** `req.route` is populated when the
matched handler runs, which is after `auth`. The design therefore stores a **thunk**,
not a value:

```ts
export interface RequestMeta {
  method: string
  getRouteHint: () => string | null
  hadBusinessOnToken: boolean        // ← AA-3: gives the gate a producer
}
```

`getRouteHint = () => req.route ? \`${req.method} ${req.baseUrl}${req.route.path}\` : null`.
The harness evaluates it at **record-build time** — inside the handler, where
`req.route` exists. This yields the matched Express **template** only
(`GET /api/parties/:id`), never `originalUrl`, `params`, or `query` (MS-8, RD-13).

`hadBusinessOnToken` is set once, in `enterTenantFrame`, from
`Boolean(req.user?.businessId)`. Rev 1 declared the derived field `noBusinessOnToken`
on the Prisma model, in the API contract, and in the exit gate — **with no producer**,
because `RequestMeta` carried no token signal and `req` is not in scope inside
`prisma-shadow.redact.ts`. Rev 2 records the positive form at its source.

`RequestMeta` lives in its own ALS slot in a new `server/src/lib/request-meta.ts`,
not in `business-context.ts`. Reason: `business-context.ts` is framework-agnostic and
is the SSOT-registered tenant-context canon; threading an Express `Request` through
it would couple the tenant SSOT to Express and widen a guarded module for an
observability concern.

`enterTenantFrame(req, next)` — the composed helper — lives in
`middleware/scoped-context.ts` (the file the SCOPE already allocates for it), so
`auth.ts`'s diff is ~8 lines and the trust anchor stays small.

### 6.3 The `no-context` record and what it distinguishes (D-8, MS-4)

| Frame state | `provenance` | `hadBusinessOnToken` | Meaning |
|---|---|---|---|
| tenant frame open | n/a — a real diff runs | n/a | compared |
| no frame, RequestMeta present, token **had** a businessId | `http` | **`true`** | **the frame was lost between `auth` and the query — a genuine defect** |
| no frame, RequestMeta present, token had **no** businessId | `http` | `false` | pre-business signup traffic — benign |
| no frame, no RequestMeta | `job` | `false` | cron / webhook / continuation — the `runUnscoped` backlog |

**Deviation from SCOPE (§16, D-1), rewritten in rev 2.** SCOPE D-8 gates HTTP-path
`no-context` at exactly 0. Rev 1 correctly identified that as unreachable
(`auth.ts:75`'s `?? ''` means fresh signups legitimately have no tenant) but replaced
it with `NOT noBusinessOnToken` — which, traced against this design's own control
flow, is **empty by construction**: the frame opens only when `businessId` is
non-empty, so `no-context ∧ http ⟹ businessId was empty ⟹ noBusinessOnToken = true`.
The predicate could not return non-zero for *any* traffic pattern, including deleting
`enterTenantFrame` from `auth.ts` outright. An unreachable gate gets noticed and
relaxed, visibly; an unfalsifiable one reports success forever.

Rev 2 replaces it with two criteria, both reachable, in §11:

1. **`no-context ∧ provenance='http' ∧ hadBusinessOnToken` = 0.** Non-empty means a
   request arrived with a tenant on its token and lost the frame before the query — a
   continuation leak. This is a real defect class this epic should catch, and the
   predicate reddens when it occurs.
2. **`count(DISTINCT routeHint)` over framed, compared reads ≥ 20** over the watch
   window — the durable, production-traffic analogue of adoption assertion A3.
   If `enterTenantFrame` stops opening frames, this collapses toward 0 and the gate
   fails.

**Rev-3 correction to criterion 2's source (RS-1).** Rev 2 computed it from
`ScopedShadowDivergence WHERE subjectBusinessId IS NOT NULL`. That table holds
**anomalies only** — a healthy watch window populates it with almost nothing, so the
criterion would read near-0 during exactly the outcome it is meant to certify, and an
operator would be pushed to relax it. It is re-based on the `routeHint`-keyed
`observed-framed` rollup in `ScopedShadowStat` (§7.2a), which every clean framed
comparison bumps. Criterion 2 now rises with healthy traffic and collapses only when
frames actually stop opening.

The `hadBusinessOnToken=false` HTTP population and the whole `job` population are
counted backlogs handed to the `enforce` epic — those call sites need `runUnscoped`
adoption. Neither is a threshold.

---

## 7. Prisma models + migration sequence

### 7.1 Models

Both are added to `GLOBAL_ALLOWLIST` in `scoped-models.ts` with the reason
`"platform observability — no tenant"`. Neither carries a `businessId` scalar, so
neither is DMMF-classified into `SCOPED_MODELS` (`scoped-models.ts:19-23`) and
`scoped-models.complete.test.ts` passes **unmodified** (MR-1 closed in SCOPE rev 3).

```prisma
model ScopedShadowDivergence {
  id                    String   @id @default(cuid())
  kind                  String
  model                 String
  operation             String
  // NEVER `businessId` — that name is the DMMF classifier input
  // (scoped-models.ts:19-23). Matches UnscopedAccessLog.subjectBusinessId.
  subjectBusinessId     String?
  unscopedCount         Int
  scopedCount           Int
  // B-6: HARD CAP 20 ids each (SCOPE:244-245, SHADOW_MAX_IDS). Enforced in
  // diff.ts and re-asserted in redact.ts before persistence. `truncated`
  // records that the cap bit. unscopedCount/scopedCount carry the magnitude,
  // so the cap costs no diagnostic power. See §9.3 (linkage, not content).
  onlyUnscoped          String[]     // ≤ 20 ids
  onlyScoped            String[]     // ≤ 20 ids
  truncated             Boolean  @default(false)
  shapeHash             String
  suppressed            Int      @default(0)
  routeHint             String   @default("")   // NOT NULL — see §7.3
  provenance            String
  hadBusinessOnToken    Boolean  @default(false) // §6.3 — positive form, has a producer
  hasInclude            Boolean  @default(false)
  hasBoundedWindow      Boolean  @default(false)
  observationIntervalMs Int
  stackHint             String?
  errorName             String?
  createdAt             DateTime @default(now())
  lastSeenAt            DateTime @default(now()) @updatedAt   // see §7.4

  // AA-2: the group key carries the CLASSIFICATION, not only the payload signature.
  @@unique([kind, model, operation, shapeHash, routeHint])
  @@index([lastSeenAt])
  @@index([createdAt])                          // M-5 absolute-age retention ceiling
  @@index([kind, lastSeenAt])
  @@index([kind, provenance, lastSeenAt])       // D-8 backlog query
}

model ScopedShadowStat {
  id         String   @id @default(cuid())
  hourBucket DateTime
  kind       String
  // D-13 / RS-1: only kind='observed-framed' carries a non-empty routeHint;
  // every other kind writes ''. Keeps cardinality bounded (§7.2a).
  routeHint  String   @default("")
  count      Int      @default(0)
  createdAt  DateTime @default(now())

  @@unique([hourBucket, kind, routeHint])
  @@index([hourBucket])
  @@index([kind, hourBucket])                   // criterion-2 rollup query
}
```

`ScopedShadowStat` is written **only** through `stats.bump()` using the Prisma query
API (`upsert` + `increment`). It uses no `$queryRaw`/`$executeRaw` — see M-4 in §7.6.

### 7.2 The dedupe key includes the classification — AA-2

SCOPE D-6 defines `shapeHash = sha256(sorted(onlyUnscoped ++ onlyScoped))`. That
definition is kept. But for every kind with an **empty diff** — `no-context`,
`unsupported-shape`, `shadow-error` — both arrays are `[]`, so `shapeHash` is a single
constant. Combined with `routeHint = ''` on the job path, rev 1's
`@@unique([shapeHash, routeHint])` made the key `('<hash-of-empty>', '')` identical
for every `no-context` record from every cron, every webhook, every continuation,
every model, every operation — **and** for every `unsupported-shape` and
`shadow-error` record. All of them upserted into **one row**, keeping the
`kind`/`model`/`operation` of whichever arrived first.

The consequence is not a reporting nuisance; it destroys this epic's primary
deliverable. SCOPE D-8's job-path query —

```sql
SELECT model, operation, sum(1 + suppressed) AS n FROM "ScopedShadowDivergence"
WHERE kind = 'no-context' AND provenance = 'job' AND "lastSeenAt" > now() - interval '7 days'
GROUP BY 1, 2 ORDER BY n DESC;
```

— is the `runUnscoped` adoption backlog the 7-day watch exists to produce (G-14,
FM-3). Under rev 1's key it returns exactly **one** row, forever, naming one
arbitrary model/operation pair. It would also merge `shadow-error` counts into
`no-context` if a `shadow-error` landed first, corrupting the
`shadow-error < 0.1% of sampled` exit criterion.

**Fix (auditor's option 1, preferred):**
`@@unique([kind, model, operation, shapeHash, routeHint])`. The dedupe upsert's
`where` uses the full composite. `shapeHash` keeps the meaning SCOPE gives it, and
the grouping is explicit in the schema where a reviewer sees it — rather than folded
into a hash preimage where it is invisible. This is the Sentry/Rollbar fingerprinting
convention: the group key always carries the classification (error type, culprit),
never only the payload signature.

**Cap re-check (required by the fix).** Distinct keys are now bounded by
`kind × model × operation × shapeHash × routeHint` rather than by `shapeHash` alone.
Worst case for the empty-diff kinds on the job path (`routeHint = ''`):
3 kinds × 96 scoped models × 5 ops = **1 440** distinct rows, bounded and stable. (96
is the live DMMF count — models carrying a `businessId` scalar, per
`scoped-models.ts:19-23` — measured, not estimated.) On
the HTTP path, `routeHint` multiplies in, but each route touches few models in
practice; the realistic ceiling is low hundreds. Genuine `diverged` records still key
on real id sets and remain the unbounded population the cap exists for. The
5 000-distinct-key-inserts/hour cap is therefore retained unchanged — it now bites on
the population it was designed for instead of never being approached. §19 open-risk 2
is revised accordingly: rev 1 worried about *hitting* the cap; rev 1's actual
behaviour was the opposite and worse.

**The cap arithmetic depends on clean comparisons NOT landing here.** §5.1's `clean`
branch writes no divergence row. If a future editor "simplifies" `observe()` to record
every comparison, this table becomes a traffic log, the 5 000/hour cap starts shedding
real divergences, and the bound above is void. The invariant — *the divergence table
holds anomalies only* — is stated here and asserted by **AC-30**.

### 7.2a The `observed-framed` rollup (D-13, RS-1, criterion 2's source)

Every clean, framed comparison bumps one `ScopedShadowStat` row:

```
kind       = 'observed-framed'
routeHint  = meta?.getRouteHint() ?? ''          // '' on the job path
hourBucket = truncate(now(), 'hour')
```

Exit criterion 2 then reads:

```sql
SELECT count(DISTINCT "routeHint") FROM "ScopedShadowStat"
WHERE kind = 'observed-framed' AND "routeHint" <> ''
  AND "hourBucket" > now() - interval '7 days';
```

and the same query backs `distinctFramedRoutes` on the status payload (§8.2), which
rev 2 declared with no stated derivation.

**Cardinality.** `hourBucket × kind × routeHint`, with `routeHint` non-empty for one
kind only: 168 hours × ~200 route templates ≈ 34 k rows per 7-day window at the
ceiling, on an integer-counter table with a 180-day retention — the same order as the
divergence table's own bound and far below anything that stresses Render Postgres.
All other kinds keep the rev-2 cardinality (`168 × kinds`).

**Why not reuse the divergence table.** Because it must stay an anomaly table (§7.2).
Splitting the "healthy volume" signal into the counter table is what lets both
populations keep their own retention and their own bounds.

### 7.3 `routeHint` is NOT NULL — a correction to SCOPE D-7

The SCOPE declares `routeHint String?` inside the unique index. **Postgres treats
NULLs as distinct in a unique index**, so every job-path row (`routeHint = NULL`)
would be unique and the dedupe upsert would never collapse anything — the population
dedupe exists to bound (a cron loop hammering one scoped model) is precisely the one
that would defeat it.

Fix: `routeHint String @default("")`, empty string meaning "no matched route". The
API layer maps `''` → `null` in the response so the external contract in the SCOPE is
preserved exactly. The same reasoning applies to `ScopedShadowStat.routeHint`.

### 7.4 `lastSeenAt` — a second correction to SCOPE D-7

The dedupe upsert increments `suppressed` on an existing row, so `createdAt` stays
pinned at first-sight. A retention cron deleting on `createdAt > 30 days` would
delete a row that is **still actively firing** — silently erasing the hottest
divergence in the system on day 31. `lastSeenAt @updatedAt` is added, retention runs
on `lastSeenAt`, and the runbook's watch-window SQL uses `lastSeenAt` (not `createdAt`
as written in SCOPE D-8).

**Rev-3 addition — an absolute-age ceiling (M-5, D-14).** `lastSeenAt`-only retention
means a continuously-firing row is **never** deleted. Since a row can hold
`subjectBusinessId` plus up to 20 ids belonging to other tenants (§9.3), an
indefinitely-retained row is an indefinitely-retained cross-tenant identifier linkage —
a DPDP erasure problem, not just a bloat problem. Retention therefore deletes on
**either** predicate:

```sql
DELETE FROM "ScopedShadowDivergence"
WHERE "lastSeenAt" < now() - interval '30 days'
   OR "createdAt"  < now() - interval '180 days';   -- absolute ceiling, M-5
```

A row still firing at day 180 has been an open incident for six months; deleting it
loses nothing an operator does not already know, and the next occurrence re-creates it
with a fresh `createdAt`. `ScopedShadowStat` keeps its 180-day rule on `hourBucket`
and holds no identifiers at all. Both tables are added to the DPDP erasure inventory
in the runbook (File #48) so a future deletion request has a documented location.

### 7.5 Migration sequence

Purely additive — two new tables, no column added to an existing table, no backfill,
no NOT-NULL promotion. The three-step rule (add nullable → backfill → NOT NULL) does
**not** apply because no existing row exists to backfill.

| Step | Command | Gate |
|---|---|---|
| 1 | `npx prisma migrate dev --name scoped_shadow_sink` (dev) | never `db push` (blocked by pre-tool-gate) |
| 2 | commit the generated migration directory | `prisma migrate status` clean |
| 3 | `npx prisma migrate deploy` on Render | already in `render.yaml:18` buildCommand |
| 4 | add the two `GLOBAL_ALLOWLIST` rows in the **same commit** as the schema | `scoped-models.complete.test.ts` green |

Step 4 in the same commit is not stylistic: the completeness test fails the moment
DMMF sees an unclassified model, so a schema-only commit is a red CI commit.

**Rollback:** the kill switch is `SCOPED_PRISMA_ENFORCE=off` + restart. The migration
is left in place (two inert, empty tables); the retention cron drains them. There is
no data to reverse and no down-migration on the critical path.

### 7.6 Sink write path — and the control that must be able to see it (B-5, M-4)

Writes go through the **injected** base client (§2, §3.1) — never the scoped client,
because a shadow write re-entering the extension is an infinite loop, and never via
an import of `prisma.ts`, because that closes the AA-6 cycle. `createShadowSink(db)`
receives the client and holds it in a closure.

**Stated plainly: the File #18 allowlist row is NOT coverage.** Rev 2 said
`prisma-shadow.sink.ts` "still needs a `RAW_CLIENT_ALLOWLIST` row … because the
linter's rule is about which files may hold an unscoped client at all." That row is a
**no-op**. `lint-raw-client.mjs:93` skips any file that does not contain the
`__basePrismaUnsafe` token; `sink.ts` never contains it, because the client arrives as
an argument. Allowlisting a file the linter already ignores documents an intent the
tool does not enforce — and §0 shows this already happened once
(`RAW_CLIENT_ALLOWLIST:36` names a file outside the walk root, dead and unnoticed).

The injected-client shape is the right design (it removed the AA-6 cycle) and it is
**also** the shape that escapes the linter. The escape happens on the
`createShadowPort({ db: clients.base })` line inside `prisma.ts` — an allowlisted
file — so the control sees nothing on either side. Three things close it, all in
Phase 2:

1. **Extend the rule (File #18) — call sites only.** In addition to the
   import/identifier match, flag **any call site that passes `clients.base` /
   `__basePrismaUnsafe` as an argument out of an allowlisted file**. That makes the
   escape visible at the composition root, where a reviewer can judge it.
   `prisma-shadow.sink.ts` / `stats.ts` are then allowlisted **against a reviewed
   tenant-safety note**, which is real coverage rather than a dead row.

   **Rev 4 drops rev 3's other half of this rule** (N-3) — "flag any function that
   accepts a `PrismaClient`-shaped parameter (`db`, `client`, `prisma`) in a
   non-allowlisted file". Security measured it: **56 of 1 094 `server/src` files**
   reference `ExtendedPrismaClient`/`TransactionClient`, and **every one of them
   receives the *scoped* client**. The rule would fire 56 false positives on day one,
   and the predictable response is to bulk-fill the allowlist — leaving B2 *weaker*
   than it is today. **False-positive rate is a control-integrity property, not a
   usability nicety: a control that produces noise gets neutralised by the people it
   interrupts.** The call-site rule is precise and sufficient on its own.
2. **Stale-row reporting for `RAW_CLIENT_ALLOWLIST` (B2).** The B7 ratchet already
   reports allowlist rows whose files show no raw SQL (`lint-raw-client.mjs:143-145`);
   B2 has no equivalent, which is why `:36` rotted silently. Same treatment: report
   rows whose file no longer matches the rule, and **remove the dead
   `server/scripts/cron/cleanup-unscoped-log.ts` row** in the same change.
3. **Widen the walk root (M-4a).** `SERVER_SRC = server/src` (`:30`) leaves
   `scripts/`, `server/scripts/` and `server/prisma/` unlinted — the exact directories
   where an unscoped-client helper is most likely to be written and least likely to be
   reviewed. Walk the repo with an ignore list instead of a single include root.

**M-4b — `stats.ts` raw-SQL posture.** `prisma-shadow.stats.ts` is declared
**Prisma-query-API-only**: `upsert`, `increment`, `groupBy`, `findMany`. It must not
use `$queryRaw`/`$executeRaw`. If the criterion-2 rollup or the watch queries turn out
to need raw SQL during the build, a reviewed `raw-sql-audit.allowlist.json` row lands
in the **same commit** with a written tenant-safety note (File #55) — never afterwards,
and never as an unexplained entry.

And per §0/§15.4, the linter must actually run — which today it does not, in either
CI or a fresh clone.

---

## 8. API contract — admin status endpoint (G-11)

### 8.1 Route and mount

**Deviation from SCOPE (§16, D-2).** SCOPE specifies
`GET /api/internal/scoped-shadow/status`. There is no `/api/internal` namespace in
this codebase (verified: `server/src/routes/internal/**` does not exist). Creating
one means hand-rolling admin auth, the rate limiter, and the audit row that
`/api/admin` already provides via `requireAdmin` + `auditAdminAction`
(`middleware/admin-auth.ts:104,205`). The endpoint mounts at:

```
GET /api/admin/scoped-shadow/status      (requireAdmin)
```

Same auth posture, same audit guarantee, one fewer bespoke surface.

**M-1 — the status service reads under `runUnscoped('platform.admin')`.** Both sink
tables sit in `GLOBAL_ALLOWLIST`, so the scoped extension lets the read through
without a tenant frame and nothing breaks if the wrapper is absent. That is exactly
why it must be explicit: `shadow-status.service.ts` (File #37) reads a
platform-global, cross-tenant table from an admin request, and the M2 precedent in
`SECURITY_AUDIT_tenant-isolation.md` requires every deliberate cross-tenant read to
declare itself so it lands in `UnscopedAccessLog` with a reason. A more sensitive
table than the ones that precedent was written for should not get weaker treatment
because an allowlist happens to make the wrapper optional.

**M-3 — the audit half of FM-13 gets an acceptance criterion.** FM-13's mitigation is
"admin-gated, hashed businessId, audit row", but rev 2 had ACs for the auth codes
(AC-12) and none for the audit row — so `auditAdminAction` could be omitted from the
handler and every test still passed. **AC-27**: one authorised status read writes
exactly one `AdminAction` row naming the actor and the action.

### 8.2 Typed contract

```ts
// server/src/routes/admin/scoped-shadow.admin.ts  —  response
export interface ScopedShadowStatusRes {
  success: true
  data: {
    mode: 'off' | 'shadow' | 'enforce'
    boundClient: 'softDeleted' | 'scoped'      // MS-1 operator evidence
    configuredSample: number
    effectiveSample: number
    breakerOpen: boolean
    rawSqlSitesUnaudited: true                 // FM-5 honesty flag
    canaryLastSeenAt: string | null            // ISO | null
    includeBlindFraction: number               // 0..1
    // §7.2a: count(DISTINCT routeHint) over ScopedShadowStat
    //        WHERE kind='observed-framed' AND routeHint <> '' in the window
    distinctFramedRoutes: number               // §6.3 criterion 2 — the A3 analogue
    windowHours: number
    windowCounts: {
      sampled: number
      observedFramed: number                   // §7.2a clean framed comparisons
      diverged: number                         // excludes unstableWindow + skewSuspect
      unstableWindow: number
      skewSuspect: number
      noContextHttpFrameLost: number           // hadBusinessOnToken=true → GATED at 0
      noContextHttpPreBusiness: number         // hadBusinessOnToken=false → backlog
      noContextJob: number                     // backlog
      shadowError: number
      sinkWriteFailed: number                  // B-3 — IN-PROCESS, write REJECTION only
      sinkShed: number                         // N-1 — IN-PROCESS, benign backpressure
      timedOut: number
      throttled: number
      unsupportedShape: number
    }
    recent: ScopedShadowRecentRow[]            // cap 50, newest by lastSeenAt
  }
}

export interface ScopedShadowRecentRow {
  kind: ShadowKind
  model: string
  operation: string
  businessIdHash: string | null                // sha256(subjectBusinessId).slice(0,12)
  unscopedCount: number
  scopedCount: number
  onlyUnscoped: string[]                       // ≤ 20 (B-6)
  onlyScoped: string[]                         // ≤ 20 (B-6)
  truncated: boolean
  suppressed: number
  routeHint: string | null                     // '' mapped to null
  provenance: 'http' | 'job'
  hadBusinessOnToken: boolean
  hasInclude: boolean
  hasBoundedWindow: boolean
  observationIntervalMs: number
  stackHint: string | null
  errorName: string | null
  lastSeenAt: string
}

export interface ApiErrorRes {
  success: false
  error: { code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'SHADOW_DISABLED' | 'INTERNAL'; message: string }
}
```

No `any`. `subjectBusinessId` never leaves the process unhashed (FM-13).

**`sinkWriteFailed` and `sinkShed` are deliberately the two counters that do not come
from the database** (B-3, N-1, §5.2). Both are process-local and reset on restart; the
durable twin of the same signal is the watchdog's `sampled = 0` page (§15.1). Reporting
a DB-write failure by reading the DB is the counter-dependence defect §15.1 exists to
forbid. The two are reported side by side and **never summed**: one is backpressure,
the other is a broken pipe, and only the second gates promotion (§11).

### 8.3 Status codes and the 4 states

| Case | Status | Body |
|---|---|---|
| platform admin, mode `shadow` | 200 | `ScopedShadowStatusRes` |
| unauthenticated | 401 | `{ code: 'UNAUTHORIZED' }` |
| authenticated non-admin | 403 | `{ code: 'FORBIDDEN' }` |
| mode !== `shadow` | 404 | `{ code: 'SHADOW_DISABLED', message: 'Shadow mode is not enabled' }` |
| sink read throws | 500 | `{ code: 'INTERNAL', message: 'Could not read shadow status' }` |

**4 UI states** (server-only epic; these are the response states an operator UI would
bind to): **Loading** — n/a, single DB read, no streaming; **Empty** — 200 with all
`windowCounts` at `0` and `recent: []`, copy `No shadow samples yet.`; **Error** — the
500 shape above; **Success** — counts + rows. No inputs exist, so no `autocomplete`
attributes apply. No client/mobile files are touched at any breakpoint.

### 8.4 New env knobs — and why they are imported directly (AA-1, D-10)

| Var | Default | Prod initial | Meaning |
|---|---|---|---|
| `SCOPED_PRISMA_ENFORCE` | unset ⇒ `off` | `shadow` | mode (exists) |
| `SCOPED_PRISMA_SHADOW_SAMPLE` | `1` | **`0.01`** | base rate 0..1 (exists) |
| `SCOPED_PRISMA_SHADOW_TIMEOUT_MS` | `250` | `250` | per-probe timeout |
| `SCOPED_PRISMA_SHADOW_MAX_INFLIGHT` | `2` | `2` | concurrent probe cap (≤20% of pool) |
| `SCOPED_PRISMA_SHADOW_SINK_MAX_INFLIGHT` | `2` | `2` | concurrent **sink write** cap (B-2) |
| `SCOPED_PRISMA_SHADOW_CANARY_BUSINESS_ID` | unset | set in staging + prod | fixture tenant; canary disabled when unset |

The four new accessors' **bodies** land in `server/src/lib/env.scoped-prisma.ts`
(File #24). They are **not** re-exported through `server/src/lib/env.ts`.

`env.ts` is owned by a concurrent session and is excluded from this epic's
`files_planned`, so the file-scope lock will mechanically refuse that edit. Rev 1
planned a `~+4` barrel row anyway, on the correct observation that the barrel uses
named lists and never `export *` — accurate reasoning that does not survive the
constraint. The three consumers (`prisma.ts` for the canary/mode wiring,
`prisma-scoped.ts` for `getScopedPrismaMode()` in the M-2 setter guard, and
`prisma-shadow.throttle.ts` for timeout/inflight/sink-inflight/sample) therefore
`import { … } from './env.scoped-prisma.js'` **directly**, each with:

```
// barrel row deferred — env.ts is owned by a concurrent session (epic: scoped-prisma-shadow)
```

This deviates from `env.ts`'s stated "import from the barrel" convention. It is
recorded as **D-10** in §16 and carries a follow-up row so the barrel rows land once
the concurrent session's write settles. `env.ts` appears nowhere in the File Plan.

---

## 9. Comparison, classification, and the PII wall

### 9.1 Record kinds (D-5)

| kind | Meaning | Writes a divergence row? | Gated at 0? |
|---|---|---|---|
| `clean` | symmetric difference empty, frame present | **no** — stat bump only (§5.1, §7.2a) | n/a |
| `diverged` | genuine symmetric difference | yes | **yes** |
| `unstable-window` | query carried `take`/`skip`/`cursor` | yes | no — counted, reported |
| `skew-suspect` | small, directionally-consistent-with-skew diff within the observation interval | yes | no — counted, reported |
| `no-context` | no ALS frame; split by provenance + `hadBusinessOnToken` (§6.3) | yes | frame-lost sub-population only |
| `shadow-error` | harness threw or timed out; `errorName` only | yes | no (< 0.1% of sampled) |
| `unsupported-shape` | `select` omitted `id`, or rows lack an `id` scalar | yes | no |
| `canary` | the positive control | yes | must be **present** |

The `clean` row is rev 3's disambiguation of §5.1 vs §9.1 (RS-1): rev 2's pseudocode
implied a row per comparison while this table listed anomalies only. The divergence
table holds anomalies; healthy volume lives in `ScopedShadowStat` (**AC-30**).

**Directional skew is systematic, not random.** Promise-reuse fixes the control first
and the candidate second, so an insert in the interval surfaces as `onlyScoped` and a
delete as `onlyUnscoped`. Scientist randomises execution order to avoid exactly this;
promise-reuse forecloses that remedy. Accepted (halved load, real divergences still
diverge regardless of order). The compensating control is `observationIntervalMs` on
every record plus the runbook's triage signature: *small, one-directional, on a hot
write endpoint, non-reproducible* = skew; *whole-tenant-shaped, reproducible,
`onlyUnscoped` containing another tenant's ids* = a real missing filter.

### 9.2 PII wall (MS-8) — enforced by construction

`prisma-shadow.redact.ts` builds the record from a **key allowlist**: it constructs
a fresh object with exactly the declared keys. It cannot leak a field it never reads.
Prohibited in any record, log line, metric label, DB row, or API response:

- any field of any returned row other than `id`
- the query `args` (a `where` routinely holds a phone number or a name) — `args` is
  read **only** to compute the booleans `hasInclude` / `hasBoundedWindow`, and those
  booleans, never the args, cross the module boundary
- `err.message` (Prisma embeds failing field values) — `errorName` only
- `req.originalUrl`, `req.params`, `req.query` — `routeHint` is the matched Express
  template only
- `businessId` as a metric **label** (cardinality + tenant-identifying in aggregate)

The PII test asserts on the **bytes emitted by the winston format chain** (a memory
transport capturing post-`piiMaskFormat`/`scrubPii` output — `logger.ts:41-58`), not
on the pre-serialization object, **and** on the persisted DB row. It must also cover
`scrubPii` mangling id-like fields, since ids are the one thing we do want intact.

### 9.3 The risk is linkage, not content (B-6)

The wall above is a wall against *content*. It is correct and it is not the whole
threat. Stated plainly, because rev 2 never did:

> `ScopedShadowDivergence` is a durable, platform-global, **cross-tenant
> identifier-linkage store**. Each row pairs `subjectBusinessId` (the querying tenant)
> with row ids belonging to **other** tenants — that is the payload the epic exists to
> produce, and the runbook's own triage signature says so.

Row ids are pseudonymous under DPDP, but they re-identify trivially by joining back to
the live DB, which every reader of this table already has. Four controls bound it:

1. **Volume — cap 20 ids per array** (`SHADOW_MAX_IDS`, SCOPE:244-245). Rev 2 lost
   this between documents: `onlyUnscoped String[]` / `onlyScoped String[]` were
   declared uncapped, and `SHADOW_MAX_ROWS = 5000` is a *different* quantity (the
   comparison ceiling, not the persistence cap). A whole-tenant-shaped divergence would
   otherwise persist every id it touched. `unscopedCount`/`scopedCount` keep the
   magnitude and `truncated` records that the cap bit, so nothing diagnostic is lost.
   Enforced in `diff.ts`, re-asserted in `redact.ts`, asserted by **AC-28**.
2. **Time — dual retention ceiling** (§7.4, M-5): 30 days on `lastSeenAt` **or** 180
   days on `createdAt`, so no linkage row is retained indefinitely.
3. **Access — platform admin only**, `requireAdmin` + `auditAdminAction` (AC-27), with
   `subjectBusinessId` hashed at the API boundary.
4. **The canary must not manufacture linkage.** SCOPE:413-416 specifies the canary as
   an unbounded `findMany` with no tenant predicate, which by design returns other
   tenants' rows and would persist a 20-id sample of real production ids every 15
   minutes, forever, as its *steady state*. The canary is therefore constrained to a
   **bounded synthetic fixture**: the canary business holds a small fixed set of seeded
   rows, and the probe reads `findMany({ where: { id: { in: CANARY_FIXTURE_IDS } } })`.
   It still fails loudly if scoping stops working — the point of a positive control —
   without turning the control itself into a recurring linkage source. Recorded as
   **D-15**.

Both tables are listed in the DPDP erasure inventory section of the runbook (File #48).

---

## 10. State machine — one sampled read

```
States:   PASSTHROUGH | SAMPLING | NO_CONTEXT | PROBING | COMPARING | RECORDED
          | CLEAN | SKIPPED | TIMED_OUT | ERRORED | BREAKER_OPEN | SINK_SHED
Initial:  PASSTHROUGH  (every $allOperations entry)
Terminal: RECORDED · CLEAN · SKIPPED · TIMED_OUT · ERRORED · SINK_SHED  (all reset to PASSTHROUGH)

PASSTHROUGH --shouldShadow() true--------------> SAMPLING
PASSTHROUGH --shouldShadow() false-------------> SKIPPED     (write / count / tx / reentrant / unscoped / not sampled)
SAMPLING    --real rejects---------------------> SKIPPED     (caller's error propagates untouched)
SAMPLING    --real resolves, businessId absent-> NO_CONTEXT  (AA-5: no probe, no pool slot)
SAMPLING    --real resolves, businessId present> PROBING
NO_CONTEXT  --record emitted-------------------> RECORDED
PROBING     --scoped resolves < timeout--------> COMPARING
PROBING     --timeout (250ms)------------------> TIMED_OUT   → breaker.record()
PROBING     --scoped throws--------------------> ERRORED     → breaker.record()
COMPARING   --diff empty-----------------------> CLEAN       → stat bump only (§7.2a)
COMPARING   --diff classified------------------> RECORDED    → emit() (§5.2)
RECORDED    --sink gauge saturated-------------> SINK_SHED   → sinkShed++ , breaker.record()            (N-1: benign)
RECORDED    --sink write rejects---------------> SINK_FAILED → sinkWriteFailed++ , breaker.record(), log+Sentry
ERRORED|TIMED_OUT|SINK_SHED|SINK_FAILED --20 errors / 60s--> BREAKER_OPEN
BREAKER_OPEN --5 min cooldown------------------> PASSTHROUGH (resume at throttleFactor 0.1)
BREAKER_OPEN --canary absent 45 min------------> PAGE        (D-9; the latch is visible)
```

The caller's promise is bound at `PASSTHROUGH` and returned regardless of which
terminal state the harness reaches. There is no transition in which the caller's
value changes. **`SINK_SHED` and `SINK_FAILED` are terminal states, never an unhandled
rejection** — that is B-1 expressed as a state-machine property. Their separation is
N-1: the machine distinguishes backpressure from a broken pipe rather than collapsing
both into one counter.

---

## 11. Rollout / flag sequence

| Stage | Audience | Flags | Verify before advancing |
|---|---|---|---|
| 0 · Merge dark | none | `SCOPED_PRISMA_ENFORCE` unset (`off`) | migration applied; both suites green; boot log shows `mode=off, client=softDeleted` |
| 1 · Staging | staging only | `shadow`, sample `1`, canary business set | canary row present; `sampled` non-zero; `distinctFramedRoutes` ≥ 20; frame-lost count 0; **`sinkWriteFailed` = 0** (`sinkShed` reported, not gated — N-1); p95 within +10% at sample 1.0 |
| 2 · Pre-ramp gate | — | — | **Neon pooler connection limit** (not `max_connections`) read from the dashboard and recorded in the runbook |
| 3 · Prod toe-dip | all prod traffic | `shadow`, sample `0.01` | 24h latency watch, p95 within +10% |
| 4 · Ramp | all | `0.01 → 0.05 → 0.25 → 1.0` | ≥24h per step, advance only while p95 ≤ +10% |
| 5 · Watch | all | `shadow`, sample ≥ `0.25` | 7 days; exit criteria below |
| 6 · `enforce` | — | — | **separate epic; not authorised by this document** |

**Exit criteria for the `enforce` epic** — all computed from the durable sink using
the runbook's SQL (over `lastSeenAt`, §7.4):

- **volume floor:** `sampled ≥ 50 000` over `≥ 20` distinct scoped models, covering
  the top-20 read endpoints;
- **frame coverage (AA-3 criterion 2, re-based in rev 3):**
  `count(DISTINCT routeHint)` over `ScopedShadowStat WHERE kind='observed-framed' AND
  routeHint <> ''` **≥ 20** over the watch window (§7.2a) — the durable production
  analogue of A3; collapses toward 0 if `enterTenantFrame` stops opening frames;
- **frame-loss (AA-3 criterion 1):** `no-context ∧ provenance='http' ∧
  hadBusinessOnToken` = **0** — a request that arrived with a tenant and lost it;
- **recording integrity (B-3, split per N-1):** `sinkWriteFailed` — **genuine write
  rejection only** — = **0** across the watch window, and no
  `['shadow','sink-write-failed']` Sentry group in the same period. **A window ending
  with a non-zero value does not qualify the `enforce` epic, however clean the
  divergence table looks** — an empty table and a broken pipe are indistinguishable
  without this criterion. **`sinkShed` is reported alongside it and NOT gated**: it is
  backpressure, and gating it would either be unachievable at sample 1.0 or train the
  operator to wave the pair through. A high `sinkShed` bears on the **volume floor**
  (the window observed less than `sampled` suggests), not on integrity;
- canary present in every 45-minute window of the watch;
- `kind='diverged'` (excluding `unstable-window` + `skew-suspect`) = **0 for 72
  consecutive hours**, both excluded populations reported by count;
- every divergence in the window classified *missing service filter* (fixed) or
  *legitimately global* (passthrough list);
- `no-context` pre-business and job-path populations: written backlogs from the D-8
  `GROUP BY model, operation` query (which AA-2's key fix makes meaningful), no
  threshold;
- `shadow-error` < 0.1% of `sampled`.

**Kill switch:** `SCOPED_PRISMA_ENFORCE=off` + restart. `prisma` returns to
`clients.softDeleted`, the port is never set, tables go inert. Env change only — no
deploy, no migration reversal.

**Performance budget.** Frontend budgets (LCP/INP/CLS/bundle KB) are **not
applicable** — this epic touches zero files under `src/`, at any breakpoint. Server
budgets, enforced at stages 3–4: p95 ≤ **+10%** on the top-5 scoped read endpoints vs
the 24h pre-deploy baseline, hard ceiling +20%; TTFB p95 < 300ms unchanged; DB query
p95 < 100ms unchanged; **≤ 2 of 10 pool connections** held by probes at any instant
(`SHADOW_MAX_INFLIGHT`) **and ≤ 2 more by sink writes** (`SHADOW_SINK_MAX_INFLIGHT`,
B-2) — a worst-case harness footprint of 4 of 10, which is why both gauges shed rather
than queue; at most **one** extra `SELECT` per sampled read (SR-4, asserted by filtered
statement count, §13); a no-context read consumes **zero probe slots and at most one
sink write** (§5.1 — rev 2's "zero pool slots" was false: it skipped the probe and then
wrote to the same pool); sink writes bounded by the dedupe upsert, the sink gauge, and
a 5 000-distinct-key/hour cap (§7.2). Breach response: sample `0.001`, then `off` — env
change + restart, no deploy.

---

## 12. Adoption-assertion test strategy (the epic's second deliverable)

**The rule.** Every component this epic adds or wires carries one test that fails
when the **call site** is deleted, even though the definition still typechecks,
still has unit tests, and still greps. Grep-based QA items are banned as adoption
proof — a mount that opens no frame satisfies a grep (FM-17). **A test that spawns
the artifact directly is testing the definition**; the adoption test must spawn or
exercise whatever is supposed to *invoke* it (AA-4). **And the invoker itself must be
one that cannot be un-configured** (B-4) — see A9/A9b.

| # | Component | Call site | Assertion that fails when the CALL SITE is removed | Test file |
|---|---|---|---|---|
| A1 | shadow port wiring | `prisma.ts` `setShadowPort(...)` | boot with `shadow`+sample 1, open a frame, `findMany` a scoped model → a `sampled` `ScopedShadowStat` row exists | `scoped-shadow.integration.test.ts` |
| A2 | `prisma` binds to `clients.scoped` under shadow | `prisma.ts` ternary | same test — if bound to `softDeleted`, `$allOperations` never runs and A1's row is absent | same |
| A3a | tenant frame in `auth` | `auth.ts` → `enterTenantFrame` | supertest against the **real** `createApp()`, hitting ≥20 distinct routers; **every** record carries non-null `subjectBusinessId` | `auth-scope-frame.test.ts` |
| A3b | route-hint capture | `runWithRequestMeta` thunk | of those ≥20 routers, **≥ 15** produce a non-empty `routeHint`; the shortfall is enumerated by name into File #49 | same |
| A4 | `validateScopedPrismaBoot()` | `index.ts` | **child-process spawn** of the real entrypoint with `SCOPED_PRISMA_ENFORCE=shadown` → non-zero exit + the guard's message on stderr | `boot-guard.spawn.test.ts` |
| A5 | retention cron registered | `cron-scheduler.ts` | `initCronJobs()` with `node-cron` mocked → assert a `15 3 * * *` registration exists **and** invoking the captured callback runs the retention pass | `shadow-adoption.test.ts` |
| A6 | canary cron registered | `cron-scheduler.ts` | same shape, `*/15 * * * *` | same |
| A7 | watchdog cron registered | `cron-scheduler.ts` | same shape, and registered **unconditionally** (asserted with mode `off`) — SR-1 | same |
| A8 | status route mounted | `routes/admin/index.ts` | `GET /api/admin/scoped-shadow/status` unauthenticated returns **401, not 404** — 404 would mean unmounted | same |
| **A9** | **raw-client lint is invoked by the hook** | `.githooks/pre-commit` + `package.json` script | stage a file containing `__basePrismaUnsafe.invoice.findMany()`, then **spawn `.githooks/pre-commit` as a child process**. Assert non-zero exit AND the lint's message on stderr | `pre-commit-gate.spawn.test.ts` |
| **A9b** | **raw-client lint is invoked by CI** (B-4) | `.github/workflows/qa.yml` step | parse `qa.yml`, extract the `run:` commands of the qa job, require **one to reference `lint:raw-client`**, then **execute that extracted command string verbatim** in a child process against a planted violation and require non-zero exit. Reddens if the step is deleted (nothing to extract), renamed, or if the script stops working | `ci-lint-invocation.test.ts` |
| A10 | read-only by construction | `shouldShadow` op set | enumerate **every** Prisma op against a spy delegate; assert zero probe invocations for all writes and all of `count`/`aggregate`/`groupBy` | `scoped-shadow.readonly.test.ts` |
| A11 | no-context branch taken | `observe()` early branch | a sampled read with no ALS frame issues **zero** scoped queries (spy delegate) and produces exactly one `no-context` record | `scoped-shadow.readonly.test.ts` |
| **A12** | **no un-owned promise on the sink path, and totality of every handler** (B-1, N-2, N-1) | `emit()` / `onSinkFailure` / `onSinkShed` in `prisma-shadow.ts` | **(a)** inject a `ShadowDb` whose `upsert` rejects; register a `process.on('unhandledRejection')` spy; drive 50 sampled reads → spy **never fires**, `sinkWriteFailed === 50`, one error log per failure, caller values all correct. **(b)** additionally inject a `logger.error` that **itself throws** → spy still never fires, callers still correct (N-2 — a throwing handler must not re-raise what B-1 closed). **(c)** saturate the gauge → `sinkShed` increments while `sinkWriteFailed` stays **0** (N-1) | `prisma-shadow.sink-failure.test.ts` |

**A9 was the one row that violated §12's own rule (AA-4).** Rev 1 asserted "executing
the lint script with a planted fixture exits non-zero" — which proves the script
*works* and proves nothing *invokes* it. Rev 2 spawned the hook instead.

**A9's invoker was still not an invoker (B-4).** `.githooks/pre-commit` runs only when
`git config core.hooksPath .githooks` is set — **local git config, not committed**. A
fresh clone, a CI runner, and any machine where that config was never set all skip the
hook entirely, so rev 2's "wired into CI + pre-commit" remained false after the epic
shipped, and A9 passed anyway by spawning a file that git never invokes. That is AA-4's
defect class one level up: the adoption test's invoker was itself dark.

Rev 3 closes it with three parts, all required:

1. **`.github/workflows/qa.yml` gains a `npm run lint:raw-client` step** (File #54).
   GitHub Actions runs it on every PR with no per-machine configuration — this is the
   invoker that cannot be un-configured, and it is what makes the header claim at
   `lint-raw-client.mjs:21` true.
2. **A `prepare` script installs the hooks path** (`"prepare": "git config
   core.hooksPath .githooks"`, File #19), so `npm install` wires the local hook for
   every developer instead of relying on tribal knowledge.
3. **The hook line stays** as defence-in-depth (fast local feedback), with A9
   unchanged, and **A9b** covers the CI invocation.

A4's child-process spawn is deliberately the expensive option (~2–3s of CI). A
same-process assertion would test the exported function — precisely the thing that
already passes today while being uncalled. A9/A9b share that shape.

### 12.1 Controlling boot-time env in A1/A2 (SS-3)

`const scopedMode = getScopedPrismaMode()` is evaluated at `prisma.ts:103` at module
load, and `clients` is memoised onto `globalThis.__hpPrismaClients` whenever
`NODE_ENV !== 'production'` (`prisma.ts:94-97`) — which includes the test run. A
vitest file that sets `process.env.SCOPED_PRISMA_ENFORCE` in `beforeAll` and then
imports `prisma` gets whatever the first importer in that worker already cached. A1
and A2 are the two assertions that prove the epic's headline wiring; leaving their
setup to improvisation produces a test that passes for the wrong reason, or that
passes in the suite-wide shadow pass and fails alone — which reads as flake and gets
skipped.

**Specified mechanism (the auditor's cleanest option).** `scoped-shadow.integration.test.ts`,
`scoped-shadow.readonly.test.ts` and `prisma-shadow.sink-failure.test.ts` run **only in
the shadow-mode CI pass** (§12.2 item 6), declared via a dedicated vitest project
(File #47) whose config sets `env: { SCOPED_PRISMA_ENFORCE: 'shadow',
SCOPED_PRISMA_SHADOW_SAMPLE: '1' }` and `pool: 'forks'` with `isolate: true`, so each
file gets a fresh module registry and a fresh `globalThis`. That isolation is also what
makes M-2's one-shot `setShadowPort` testable without a reset export (§3.1a). The
**default** pass asserts the inverse in a sibling describe block of File #46, guarded
to run only when the var is unset: `boundClient` is `softDeleted` and a scoped read
produces **zero** shadow rows. Neither pass depends on mutating env mid-process.

### 12.2 Other test layers

1. **Phase 0 spike** (§13) — mechanism proof before any construction.
2. **Unit, no DB** — `diff`, `classify`, `redact`, `throttle` over fixtures.
   A divergence is asserted by handing `diff` `unscoped=[{id:'a'},{id:'b'}]`,
   `scoped=[{id:'a'}]` and expecting `onlyUnscoped:['b']`. The id cap is asserted here
   too (AC-28): 500 divergent ids in ⇒ 20 out, `truncated: true`, counts intact.
3. **Harness** — throw injected at **each** of the four points (shouldShadow, observe
   entry, plan build, scoped execution) leaves the caller's value correct (AC-4); plus
   the sink-rejection path (A12/AC-26).
4. **PII** — post-winston bytes + persisted row, with a `GET /api/parties?q=Raju+Traders`
   case proving `routeHint` is `GET /api/parties` and contains neither fixture string.
5. **Integration, real Postgres, two tenants** — deliberately-unscoped `findMany`
   writes exactly one `diverged` row holding B's ids; canary produces its row; the
   dedupe key is exercised by emitting `no-context` records for two different
   model/operation pairs and asserting **two** rows, not one (AA-2 regression); and a
   clean framed read writes **zero** divergence rows and one `observed-framed` stat
   (AC-30).
6. **Suite-wide** — CI runs the server suite a second time with
   `SCOPED_PRISMA_ENFORCE=shadow SCOPED_PRISMA_SHADOW_SAMPLE=1` and asserts the same
   1269 passes.

   **What this run does and does not prove (corrected in rev 3).** Rev 2 claimed it is
   *"meaningful only because A2 puts the scoped client on the path"*, which reads as
   evidence that the scoped client behaves correctly end-to-end. It is not. A2 does put
   `clients.scoped` on the path, but the `$allOperations` **shadow branch returns at
   statement (3)** (§4) before the fail-closed guard chain, so `injectScope` never runs
   for the caller and the caller's rows are the unscoped rows. What the second pass
   proves is exactly the epic's own claim — **the harness is transparent**: adding the
   probe, the diff, and the sink changes no observable behaviour in 1269 tests. It is
   **not** evidence that `enforce` works; the injector is exercised for the *probe*
   only, on a path whose result is discarded. Validating the enforce injector against
   the suite is the `enforce` epic's job and its own audit gate.

---

## 13. Build phases (the builder reads this order)

| Phase | Name | Gate to advance |
|---|---|---|
| **0** | **Spike** | Counting **only `$on('query')` events whose `query` matches `^SELECT`** (SS-4): `Promise.resolve(q(args))` yields exactly **1** SELECT for the caller side; the re-dispatch probe yields exactly **1** more, asserted as an exact count on both sides. If either fails, STOP and redesign §4.1/§4.3 before writing anything else. |
| 1 | Pure core | 4 unit suites green, no DB; id-cap unit assertions (AC-28) |
| 2 | Schema + sink | migration applied; `scoped-models.complete.test.ts` green unmodified; **linter extended (B-5), dead row removed, walk root widened**; lint wired into `qa.yml` + hook + `prepare`; A9 **and A9b** red-on-removal demonstrated |
| 3 | Harness wiring (HIGH RISK) | AC-4 four-point injection; **AC-26 sink-rejection (A12)**; A10 read-only; A11 no-context; M-2 setter guards (AC-29); suite-wide shadow run green |
| 4 | Request frame | A3a hard across ≥20 routers; A3b ≥15 with the shortfall enumerated |
| 5 | Jobs, boot guard, endpoint | A4–A9b; M-1 `runUnscoped` wrapper; AC-27 audit row |
| 6 | Adoption + integration | A1, A2, A12, AC-3, AC-15/16/18, AA-2 regression, AC-30 |
| 7 | Docs + config | runbook (incl. **DPDP erasure inventory**, M-5), continuation sites, `render.yaml`, GOLD_STANDARD (incl. the SR-2 backlog row) |

**Why the `^SELECT` filter is not a detail.** `base.$on('query')` also emits
`BEGIN`/`COMMIT` events for batched operations and does not distinguish them from the
statement under test. "Exactly 1" without a filter is flaky, and a flaky gate gets
loosened to "≤ 2" on its second red run — at which point it has stopped
distinguishing one query from two, which is the only thing it exists to measure.
The premise itself checks out: every read plan is `noGuards(...)`
(`prisma-scoped.inject.ts:133-138`), so `executePlan`'s `runGuards` loop is a genuine
no-op and "exactly one more" is the right expected value.

Phase 0 is not optional and is not a formality. Two mechanism assumptions
(lazy-promise reuse; double execution of a read within one extension invocation)
carry this epic's entire performance budget and its read-only guarantee. This layer
has already been burned once by lazy Prisma promises.

---

## 14. Failure-Mode Implementation

| Failure mode (SCOPE) | SCOPE mitigation | Architecture site |
|---|---|---|
| FM-1 double-executed write | imported op sets + plan-kind refusal | `prisma-shadow.constants.ts` (subtraction) + `runScopedProbe` guard (§4.3) + A10 |
| FM-2 no ALS frame anywhere | frame inside `auth` | `middleware/auth.ts` → `enterTenantFrame` (§6.2) + A3a |
| FM-3 legitimately context-free paths | provenance backlog, never a gate | §6.3 four-way split; D-8 backlog query made meaningful by §7.2; `docs/CONTINUATION_SITES_scoped-prisma.md` |
| FM-4 transactions | `txSlot` set ⇒ skip | `shouldShadow()` cond. 6 (§4.2) |
| FM-5 raw SQL invisible | `rawSqlSitesUnaudited` honesty flag | status payload §8.2 + runbook header |
| FM-6 nested `include`s | `hasInclude` recorded, fraction reported | `prisma-shadow.redact.ts`; `includeBlindFraction` §8.2 |
| FM-7 huge result sets | `SHADOW_MAX_ROWS = 5000`, count-only + `truncated` | `prisma-shadow.diff.ts` |
| FM-8 pool starvation | probe inflight cap 2/10 **+ sink inflight cap 2/10**, latency breaker, prod 0.01, pre-ramp pooler read | `prisma-shadow.throttle.ts`; §5.2; §11 stage 2 |
| FM-9 Postgres degraded | 250ms `Promise.race`; breaker 20 err/60s (**probe + sink**), 5-min cooldown | `prisma-shadow.ts` race + `throttle.ts` breaker |
| FM-10 abuse spike 100× | EWMA arm decays `throttleFactor` to 0 | `prisma-shadow.throttle.ts` |
| FM-11 cost runaway | dedupe upsert on the full composite key + 5 000/hour cap; +25% WoW alert | `prisma-shadow.sink.ts` (§7.2) |
| FM-12 DPDP inquiry | key allowlist, provable on post-winston bytes + DB row; **id cap + dual retention ceiling + erasure inventory** | `prisma-shadow.redact.ts` + §9.3 + §7.4 |
| FM-13 insider abuse | admin-gated, hashed businessId, audit row **asserted (AC-27)**, status reads under `runUnscoped` (M-1) | `routes/admin/scoped-shadow.admin.ts` + `services/shadow/shadow-status.service.ts` |
| FM-14 client-version lag | no tenant-facing contract change | none needed — zero `src/` files touched |
| FM-15 table bloat | daily cron, 30-day `lastSeenAt` **+ 180-day `createdAt` ceiling**, indexed | `jobs/shadow-retention.cron.ts` (§7.4) |
| FM-16 safety mechanism causes the silent death | `count` etc. excluded by subtraction | `prisma-shadow.constants.ts` + A10 + zero-sample alert |
| FM-17 mount that satisfies the grep | frame inside `auth`, asserted across ≥20 routers | A3a |
| FM-18 skew/window exhaust triage | separate kinds, structural classification | `prisma-shadow.classify.ts` + runbook triage tree |
| **SR-1 env var lost at redeploy** | *(open in SCOPE)* | `jobs/shadow-watchdog.cron.ts` — §15.1 |
| **SR-2 gate coverage regression** | *(open in SCOPE)* | §15.2 — durable backlog row in `GOLD_STANDARD.md` (File #51) + blocked row #53 |
| **SR-3 boot guard uncalled** | *(open in SCOPE)* | `lib/boot-guards.ts` + `index.ts` + A4 — §15.3 |
| **SR-4 promise reuse unasserted** | *(open in SCOPE)* | Phase 0 spike with `^SELECT` filter (§13) + AC-19 |
| **`lint-raw-client.mjs` never runs** | *(not in SCOPE)* | §15.4 — Files #18/#19/#20/#54 + **A9 (hook spawn) + A9b (CI invocation)** |
| **silent clean-certification of context-free reads** | *(not in SCOPE — AA-5)* | `observe()` no-context branch (§5.1) + non-optional `businessId` (§4.3) + A11 + AC-23 |
| **TDZ at boot under `shadow` only** | *(not in SCOPE — AA-6)* | injected `db` (§2, §3.1, §7.6) |
| **NEW: unhandled rejection on the sink path kills the API** | *(not in SCOPE — B-1)* | `emit()` terminal `.catch` (§5.2), modelled on `prisma.ts:76-86` + **A12/AC-26** |
| **NEW: sink writes outside the connection budget** | *(not in SCOPE — B-2)* | `SHADOW_SINK_MAX_INFLIGHT` gauge + breaker participation (§5.2, §11) |
| **NEW: a broken sink greens the promotion gate** | *(not in SCOPE — B-3)* | in-process `sinkWriteFailed` reported off-path (log + Sentry + status) and gated at 0 (§5.2, §11) |
| **NEW: the control cannot see an injected raw client** | *(not in SCOPE — B-5)* | extended linter rule + stale-row reporting + widened walk root (§7.6, File #18) |
| **NEW: cross-tenant identifier-linkage store** | *(partially in SCOPE — B-6)* | id cap 20, dual retention ceiling, bounded canary fixture, erasure inventory (§9.3, §7.4) |

---

## 15. The four open SHOULD_SHIP items, resolved

### 15.1 SR-1 — alerts that self-disable under the failure they detect

SCOPE alerts 1 and 2 are conditioned `while mode is 'shadow'`, and `mode` is
`getScopedPrismaMode()` reading the same `SCOPED_PRISMA_ENFORCE` whose loss is the
failure. On Render these are hand-set `sync: false` vars. A typo (`shadown`) or a
dropped var reads as `off` (`env.scoped-prisma.ts:14-18`), the harness goes inert, and
both pages are silent **by construction**. The 7-day watch then burns to completion
for nothing.

**Design: `server/src/jobs/shadow-watchdog.cron.ts`, registered unconditionally.**

```
every 10 min, regardless of mode:
  recentActivity = ScopedShadowStat rows with kind ∈ {sampled, watch-active}
                   in the last 24h
  if recentActivity is empty          → silent (no watch in progress; correct)
  if current-or-previous hour bucket has sampled = 0
                                      → PAGE "shadow harness went silent"
  if canaryLastSeenAt older than 45m  → PAGE "canary MISSING"
```

The predicate is over **durable rows**, never over a live env read, so it survives the
exact failure it exists to catch. Under `shadow`, boot writes a `watch-active` stat
row for the current hour so the watchdog arms from the first minute rather than from
the first sampled query. When the watch is intentionally ended, the 24h window drains
and the watchdog goes quiet on its own.

Considered and declined: an explicit `SHADOW_WATCH_ACTIVE` env var set at watch start.
It is one more hand-set Render var — the same class of artifact whose loss is the
failure being mitigated.

**The rule this section establishes is reused in rev 3 (B-3): an alert must not be
emitted on the path whose failure it detects.** That is why `sinkWriteFailed` is an
in-process counter surfaced via log/Sentry/status rather than a `ScopedShadowStat`
row — and why the watchdog's durable `sampled = 0` page is its complement, covering the
restart that clears the in-process counter.

Adoption assertion: **A7** — the registration is asserted with mode `off`, which is
what proves it is unconditional.

### 15.2 SR-2 — gate coverage regression (security-relevant)

`~/.claude/rules/HIGH_RISK_PATHS.md` matches `**/lib/env.ts`. It does **not** match
`env.scoped-prisma.ts`. Commit `62f6297` therefore moved the tenant-isolation mode
parser (`getScopedPrismaMode`) and the M3 boot guard (`validateScopedPrismaBoot`) —
the two functions that decide whether tenant isolation is on at all — **out of gate
coverage**. Edits to them no longer trip `check-plan-required.cjs`.

**Proposed fix:** change the Environment & secrets row pattern from `**/lib/env.ts`
to `**/lib/env.*.ts` (keeping `**/lib/env.ts`), so every domain sibling produced by
the split is covered. Consider also an explicit
`**/lib/env.scoped-prisma.ts | architect, security` row, since that file is a
tenant-isolation trust anchor rather than a generic env module.

**This architecture does not make that edit.** `HIGH_RISK_PATHS.md` is itself a
declared trust anchor (HIGH_RISK_PATHS.md → "Hook chain & gate SSOT") requiring
`architect, security` and its own approved `design-plan-active.md`. It is also a
global rules file, not a HisaabPro file — outside this epic's blast radius.
**File Plan row #53** is listed as blocked / not-this-epic.

**Durable ownership (SS-6, rev 2).** A gap recorded only in this document is the
process-level version of landing dark — this doc closes when the epic closes.
**File #51 writes the SR-2 pattern change into `docs/GOLD_STANDARD.md`'s backlog in
the same commit**, with the exact pattern (`**/lib/env.*.ts`), the reason, and the
required agent pair. `GOLD_STANDARD.md` is the roadmap SSOT and outlives the epic.

**On the stated interim mitigation.** Rev 1 offered "this epic's own design plan lists
`env.scoped-prisma.ts` in `high_risk_paths_touched`, so the file is reviewed under
this epic." That is accurate but **is not a control** and must not read as coverage.
`check-plan-required.cjs` decides whether to *block* by matching the edited path
against `HIGH_RISK_PATHS.md`; listing a path in a plan grants review for *this* edit
and creates no enforcement for the next editor. **The gap stays open until row #53
lands.**

### 15.3 SR-3 — the boot guard has zero callers

Verified: `validateScopedPrismaBoot()` is defined (`env.scoped-prisma.ts:33`),
re-exported (`env.ts:62`), and called by **nothing**. `index.ts:11` calls only
`validateNicEnv()`. Its garbage-value branch (`env.scoped-prisma.ts:34-37`) does throw
on `SCOPED_PRISMA_ENFORCE=shadown`.

It is **not load-bearing for this epic** — the rollout drives the flag by hand, the
kill switch is `off`, `SCOPED_PRISMA_CUTOVER_DONE` is not set during the watch, and no
AC references it. It is wired here anyway for two reasons:

1. Its garbage-value branch is the **only** mechanical defense against SR-1's typo
   path. Today `SCOPED_PRISMA_ENFORCE=shadown` boots silently in `off`. Wiring it
   converts SR-1's worst case from "a silently wasted week" to "refuses to boot".
2. The `enforce` epic inherits it as a *satisfied precondition*
   (`SECURITY_AUDIT_tenant-isolation.md:207`, M3) — and for that epic it **is**
   load-bearing. `docs/GOLD_STANDARD.md` P0.1 (line 77) and its exit criteria (line
   110) both already describe it as present and active. Leaving that sentence
   true-sounding and false sets the next epic up to skip the only thing standing
   between a mis-set prod flag and silent loss of tenant isolation post-cutover.

**Design.** `server/src/lib/boot-guards.ts` exports `runBootGuards()` calling
`validateNicEnv()` then `validateScopedPrismaBoot()`; `index.ts` replaces its
`validateNicEnv()` call with `runBootGuards()` (net ~+4 lines). The extraction exists
so the guard sequence is one testable unit and so a future guard has an obvious home.
Adoption assertion **A4** spawns the real entrypoint — a same-process test of
`runBootGuards()` would pass today, against an uncalled function.

`docs/GOLD_STANDARD.md` is corrected in the same commit (File #51).

### 15.4 New finding — `lint-raw-client.mjs` is a fourth landed-dark component

`scripts/scoped/lint-raw-client.mjs:21` states it is "Wired into CI + .githooks/pre-commit".
Independently confirmed by both auditors: `.githooks/pre-commit` contains only
`node scripts/ssot/check.mjs`, no `lint-raw-client` script exists in root or
`server/package.json`, `.github/workflows/qa.yml` has no such step, and repo-wide grep
finds only documentation references. The B2 control that
`SECURITY_AUDIT_tenant-isolation.md:84` names as the gate condition for
`__basePrismaUnsafe` has never executed.

This is directly in scope here because §7.6 adds a **new** raw-client consumer. Adding
a row to an allowlist that nothing reads is theatre — and per B-5 the row rev 2 planned
was a no-op even if the linter had run.

**Rev-3 correction to the wiring (B-4).** Rev 2 wired the hook (Files #19/#20) and
called it done. `.githooks/pre-commit` is invoked only via `core.hooksPath`, which is
**local git config and is not committed** — so on a fresh clone and on every CI runner
the hook does not exist, and the header's "wired into CI" claim stayed false after the
epic shipped. Four files now wire it, and two assertions cover it:

- **#54 `.github/workflows/qa.yml`** — the `npm run lint:raw-client` step. This is the
  invoker that cannot be un-configured, and A9b asserts it (§12).
- **#19 `package.json`** — the `lint:raw-client` script **and** a `prepare` script
  setting `core.hooksPath`, so `npm install` configures the hook for every developer.
- **#20 `.githooks/pre-commit`** — kept for fast local feedback, asserted by A9.
- **#18 the linter itself** — extended per B-5 so it can see an injected client, with
  stale-row reporting and a widened walk root (§7.6).

If wiring it surfaces pre-existing violations, they are baselined in the same commit
and the ratchet takes it from there. The ratchet mechanism itself (monotone-down,
per-file, with stale-row reporting) was confirmed sound by the security audit and is
unchanged.

---

## 16. Deviations from SCOPE

Every deviation is listed; none is silent.

| # | SCOPE says | Architecture does | Reason |
|---|---|---|---|
| D-1 | HTTP-path `no-context` gated at 0 | two reachable criteria: `hadBusinessOnToken` frame-loss = 0, **and** `count(DISTINCT routeHint)` over the `observed-framed` rollup ≥ 20 | `auth.ts:75`'s `?? ''` makes SCOPE's gate unreachable. Rev 1's `NOT noBusinessOnToken` replacement was **unfalsifiable** (empty by construction) — strictly worse. §6.3, AA-3; source re-based in rev 3 per RS-1 |
| D-2 | `GET /api/internal/scoped-shadow/status` | `GET /api/admin/scoped-shadow/status` | No `/api/internal` namespace exists. `/api/admin` already carries `requireAdmin`, the admin limiter, and `auditAdminAction`. §8.1 |
| D-3 | *(global rule)* `FEATURES.<NAME>` flag | gates on `SCOPED_PRISMA_ENFORCE`, read once at boot | The mode selects which client object is exported at module load. A per-request flag creates a half-applied window — the exact state the M3 guard forbids. §8.4 |
| D-4 | `routeHint String?` inside the unique index | `routeHint String @default("")` (NOT NULL); `''`→`null` at the API boundary | Postgres treats NULLs as distinct in unique indexes, so job-path rows would never dedupe. §7.3 |
| D-5 | retention + watch queries on `createdAt` | adds `lastSeenAt @updatedAt`; retention and all watch SQL on `lastSeenAt` | The dedupe upsert pins `createdAt` at first-sight, so a 30-day cleanup deletes still-firing divergences. §7.4 |
| D-6 | File Plan #11 `env.ts` (~+40, bodies) | `env.scoped-prisma.ts` bodies only | The env split landed at `62f6297`; `env.ts` is a named-re-export barrel. SR-2. |
| D-7 | shadow side calls `executePlan` (implicitly with the caller's continuation) | calls `executePlan` with a **synthetic** continuation re-dispatching on the inner client, awaiting inside `runReentry` | Re-invoking the caller's continuation twice in one `$allOperations` call is an unproven Prisma mechanism. `executePlan` is still the executing function (SS-2 intact). §4.3 |
| D-8 | *(not mentioned)* | adds `boundClient` to the status payload and `client=` to the boot log | One-glance operator evidence for MS-1. §3.2 |
| D-9 | 2 required alerts, both gated on live mode | watchdog cron over durable rows, registered unconditionally | An alert predicated on the same env var whose loss it detects is not a control. §15.1 |
| D-10 | *(convention)* `env.ts` is the barrel; siblings are imported through it | the three consumers import `./env.scoped-prisma.js` **directly**, with an inline deferral comment + a follow-up row | `env.ts` is owned by a concurrent session and excluded from this epic's `files_planned`; the file-scope lock would refuse the edit mid-Phase-3. §8.4, AA-1 |
| D-11 | D-6 group key is `shapeHash` (payload signature) alone | dedupe key is `[kind, model, operation, shapeHash, routeHint]`; `shapeHash`'s own definition unchanged | Every empty-diff kind shares one `shapeHash`, collapsing the entire `no-context`/`unsupported-shape`/`shadow-error` population into one row and reducing D-8's backlog query to a single fabricated row. §7.2, AA-2 |
| D-12 | D-6 record field (rev-1 architecture) `noBusinessOnToken` | `hadBusinessOnToken` (positive form), produced in `enterTenantFrame` | Rev 1's field had **no producer** — `RequestMeta` carried no token signal and `req` is out of scope in `redact.ts`. §6.2, AA-3 |
| **D-13** | `ScopedShadowStat` keyed `[hourBucket, kind]`; a divergence row per comparison implied | stat gains `routeHint` (non-empty for `kind='observed-framed'` only), key `[hourBucket, kind, routeHint]`; **clean comparisons write no divergence row** | The divergence table must stay an anomaly table or §7.2's cap arithmetic is void; and exit criterion 2 needs a population that *grows* with healthy traffic. §5.1, §7.2a, RS-1 |
| **D-14** | cleanup spec: 30-day retention on one timestamp | retention deletes on `lastSeenAt < 30d` **OR** `createdAt < 180d` | `lastSeenAt`-only retention keeps a continuously-firing cross-tenant id-linkage row forever — a DPDP erasure problem, not just bloat. §7.4, §9.3, M-5 |
| **D-15** | canary is an unbounded `findMany` with no tenant predicate (SCOPE:413-416) | canary reads a **bounded synthetic fixture** (`where: { id: { in: CANARY_FIXTURE_IDS } }`) in the canary business | The SCOPE form makes the positive control a recurring source of real cross-tenant id linkage, persisted every 15 minutes forever. The bounded form fails just as loudly if scoping breaks. §9.3, B-6 |

---

## 17. File Plan

SSOT read before this table: `.claude/ssot-index.json` + `docs/SSOT.md` +
`ssot.config.mjs`. Relevant existing canon: **`server/src/lib/business-context.ts`**
(tenant context, guarded — regex `new AsyncLocalStorage<[^>]*[Bb]usiness`) and
**`server/src/lib/prisma-scoped.inject.ts`** (scoping injector, discovery). No module
in the repo provides query-level shadow diffing. Rows 2–11 and 15–16 constitute one
new capability, `shadow-diff`, registered in `ssot.config.mjs` (row #52) with a
`forbidden` regex against re-implemented id-set diffing.

**`request-meta.ts` (#26) is a new ALS slot** and therefore near the business-context
guard. It is deliberately **not** business-keyed (it carries `method`, a route thunk,
and a boolean — no tenant identity), so it does not trip the regex and does not
duplicate the canon. Its registry note says so explicitly.

**`server/src/lib/env.ts` appears nowhere in this table** (AA-1, D-10).

Rev-3 rows are appended as **#54–#57** rather than inserted, so every `File #n`
reference elsewhere in this document and in the security/architecture audits stays
valid.

| # | Path | Action | Est. Lines | Layer | SSOT | Build phase |
|---|------|--------|-----------|-------|------|-------------|
| 1 | `server/src/lib/__tests__/prisma-shadow.spike.test.ts` | create | ~130 | test | — | **0 Spike** |
| 2 | `server/src/lib/prisma-shadow.types.ts` | create | ~115 | types | new-ssot: shadow-diff | 1 Pure core |
| 3 | `server/src/lib/prisma-shadow.constants.ts` | create | ~80 | constants | reuses: `prisma-scoped.rewrite.ts` (op sets imported) | 1 |
| 4 | `server/src/lib/prisma-shadow.diff.ts` | create | ~150 | utils (pure) | new-ssot: shadow-diff | 1 (incl. `SHADOW_MAX_IDS`, B-6) |
| 5 | `server/src/lib/prisma-shadow.classify.ts` | create | ~125 | utils (pure) | new-ssot: shadow-diff | 1 (incl. the `clean` outcome) |
| 6 | `server/src/lib/prisma-shadow.redact.ts` | create | ~135 | utils (pure) | new-ssot: shadow-diff | 1 |
| 7 | `server/src/lib/prisma-shadow.throttle.ts` | create | ~150 | utils | reuses: `env.scoped-prisma.ts` (direct import, D-10) | 1 (probe + **sink** gauges, B-2) |
| 8 | `server/src/lib/__tests__/prisma-shadow.diff.test.ts` | create | ~175 | test | — | 1 (incl. AC-28) |
| 9 | `server/src/lib/__tests__/prisma-shadow.classify.test.ts` | create | ~150 | test | — | 1 |
| 10 | `server/src/lib/__tests__/prisma-shadow.redact.test.ts` | create | ~180 | test | — | 1 |
| 11 | `server/src/lib/__tests__/prisma-shadow.throttle.test.ts` | create | ~160 | test | — | 1 |
| 12 | `server/prisma/schema.prisma` | modify | ~+58 | schema | — | **2 Schema** · HIGH-RISK (architect) |
| 13 | `server/prisma/migrations/*_scoped_shadow_sink/migration.sql` | create | ~54 | migration | — | 2 · HIGH-RISK |
| 14 | `server/src/lib/scoped-models.ts` | modify | ~+4 | constants | reuses: `scoped-models` canon | 2 |
| 15 | `server/src/lib/prisma-shadow.sink.ts` | create | ~165 | transport | reuses: injected `ShadowDb` (no `prisma.ts` import) | 2 |
| 16 | `server/src/lib/prisma-shadow.stats.ts` | create | ~140 | transport | reuses: injected `ShadowDb`; **Prisma query API only (M-4b)** | 2 (incl. §7.2a rollup) |
| 17 | `server/src/lib/__tests__/prisma-shadow.sink.test.ts` | create | ~170 | test | — | 2 (incl. AA-2 key regression) |
| 18 | `scripts/scoped/lint-raw-client.mjs` | modify | ~+35 | script | reuses: existing linter | 2 · §7.6 **B-5** (call-site rule **only**, per **N-3**; stale-row reporting; dead row removed; walk root widened) |
| 19 | `package.json` | modify | ~+3 | config | — | 2 · `lint:raw-client` + **`prepare` hooksPath (B-4)** |
| 20 | `.githooks/pre-commit` | modify | ~+3 | config | — | 2 · §15.4 (local defence-in-depth) |
| 21 | `server/src/lib/prisma-shadow.ts` | create | ~230 | service | new-ssot: shadow-diff | **3 Harness** (incl. `emit()`, §5.2) |
| 22 | `server/src/lib/prisma-scoped.ts` | modify | ~+85 | transport | reuses: `injectScope`, `executePlan` | 3 · **HIGH-RISK (architect, security)** (incl. M-2 setter) |
| 23 | `server/src/lib/prisma.ts` | modify | ~+35 | transport | reuses: scoped/softDelete/base clients | 3 · **HIGH-RISK (architect, security)** |
| 24 | `server/src/lib/env.scoped-prisma.ts` | modify | ~+50 | constants | reuses: env accessor pattern | 3 · **HIGH-RISK** (see §15.2) |
| 25 | `server/src/lib/__tests__/prisma-shadow.harness.test.ts` | create | ~235 | test | — | 3 (AC-4 four-point injection) |
| 26 | `server/src/lib/request-meta.ts` | create | ~95 | transport | new-ssot: request-meta (not tenant-keyed — §17 note) | **4 Frame** |
| 27 | `server/src/middleware/scoped-context.ts` | modify | ~+45 | transport | reuses: `business-context` canon | 4 |
| 28 | `server/src/middleware/auth.ts` | modify | ~+8 | transport | reuses: `enterTenantFrame` | 4 · **HIGH-RISK (architect, security)** |
| 29 | `server/src/lib/__tests__/request-meta.test.ts` | create | ~95 | test | — | 4 |
| 30 | `server/src/middleware/__tests__/auth-scope-frame.test.ts` | create | ~190 | test | — | 4 · **A3a / A3b / AC-25** |
| 31 | `server/src/jobs/shadow-retention.cron.ts` | create | ~110 | job | reuses: `import-retention.cron.ts` shape | **5 Jobs** (dual ceiling, D-14) |
| 32 | `server/src/jobs/shadow-canary.cron.ts` | create | ~130 | job | reuses: `runInBusinessContext` | 5 (bounded fixture, D-15) |
| 33 | `server/src/jobs/shadow-watchdog.cron.ts` | create | ~110 | job | reuses: `prisma-shadow.stats.ts` | 5 · **SR-1** |
| 34 | `server/src/lib/cron-scheduler.ts` | modify | ~+20 | transport | reuses: existing scheduler | 5 |
| 35 | `server/src/lib/boot-guards.ts` | create | ~45 | service | reuses: `validateNicEnv`, `validateScopedPrismaBoot` | 5 · **SR-3** · **C4** boot assertion `retentionDays ≥ 4 × watchWindowDays` under mode `shadow` |
| 36 | `server/src/index.ts` | modify | ~+4 | entrypoint | reuses: `runBootGuards` | 5 · **SR-3** |
| 37 | `server/src/services/shadow/shadow-status.service.ts` | create | ~165 | service | reuses: `prisma-shadow.stats.ts`, **`runUnscoped` (M-1)** | 5 |
| 38 | `server/src/routes/admin/scoped-shadow.admin.ts` | create | ~120 | route | reuses: `requireAdmin`, `auditAdminAction` | 5 |
| 39 | `server/src/routes/admin/index.ts` | modify | ~+2 | route | reuses: admin barrel | 5 |
| 40 | `server/src/routes/admin/__tests__/scoped-shadow.admin.test.ts` | create | ~165 | test | — | 5 (AC-12, **AC-27**) |
| 41 | `server/src/__tests__/adoption/shadow-adoption.test.ts` | create | ~200 | test | — | **6 Adoption** · A5–A8 |
| 42 | `server/src/__tests__/adoption/boot-guard.spawn.test.ts` | create | ~90 | test | — | 6 · **A4** |
| 43 | `server/src/__tests__/adoption/pre-commit-gate.spawn.test.ts` | create | ~110 | test | — | 6 · **A9** (spawns the hook, not the script) |
| 44 | `scripts/scoped/__tests__/lint-raw-client.rule.test.ts` | create | ~110 | test | — | 6 (rule unit test incl. the new injected-client rule — **not** adoption proof) |
| 45 | `server/src/__tests__/scoped-shadow.readonly.test.ts` | create | ~185 | test | — | 6 · **A10 + A11** (AC-5, AC-9, AC-14, AC-23) |
| 46 | `server/src/__tests__/scoped-shadow.integration.test.ts` | create | ~245 | test | — | 6 · **A1, A2** (AC-3, AC-13, AC-15/16/18, AC-24, AC-30) |
| 47 | `server/vitest.shadow.config.ts` | create | ~50 | config | — | 6 · **SS-3** (shadow-mode CI project) |
| 48 | `docs/RUNBOOK_scoped-shadow.md` | create | ~240 | docs | — | **7 Docs** (incl. DPDP erasure inventory, M-5) |
| 49 | `docs/CONTINUATION_SITES_scoped-prisma.md` | create | ~95 | docs | — | 7 (G-14 + A3b shortfall list) |
| 50 | `render.yaml` | modify | ~+18 | config | — | 7 (env knobs incl. sink gauge + stale-comment fix) |
| 51 | `docs/GOLD_STANDARD.md` | modify | ~+18 | docs | — | 7 (SR-3 correction lines 77/110 **+ the SR-2 backlog row**, SS-6) · **C4** durable record of the retention/watch-window disjointness precondition |
| 52 | `ssot.config.mjs` | modify | ~+16 | config | new-ssot rows: shadow-diff, request-meta | 7 |
| 53 | `~/.claude/rules/HIGH_RISK_PATHS.md` | **BLOCKED — not this epic** | ~+2 | rules | — | **hand-off** · §15.2 (durable owner = row #51) |
| **54** | `.github/workflows/qa.yml` | modify | ~+8 | config | — | 2 · **B-4** — the `lint:raw-client` step; the invoker that cannot be un-configured |
| **55** | `scripts/scoped/raw-sql-audit.allowlist.json` | modify | ~+6 | config | — | 2 · **M-4b** — only if `stats.ts` needs raw SQL; lands in the same commit with a tenant-safety note, else this row is dropped |
| **56** | `server/src/lib/__tests__/prisma-shadow.sink-failure.test.ts` | create | ~140 | test | — | 3 · **A12 / AC-26** (rejecting `ShadowDb`, `unhandledRejection` spy) |
| **57** | `server/src/__tests__/adoption/ci-lint-invocation.test.ts` | create | ~95 | test | — | 6 · **A9b** (parse `qa.yml`, execute the extracted command) |

**57 rows. No row estimates > 250 lines.** Row #53 is listed deliberately as
blocked-with-owner; its durable record lives in `GOLD_STANDARD.md` via row #51, not
only in this document. Row #55 is conditional by design — it lands **only** with a
reviewed note, and its absence is itself the M-4b assertion that `stats.ts` stayed on
the Prisma query API.

---

## 18. SCOPE Conformance Map

### Goals

| SCOPE decision | Architecture artifact | Status |
|---|---|---|
| **G-1** shadow ⇒ `prisma` is `clients.scoped`; caller gets unscoped result | §3.1 three-way + §4 branch · File #22, #23 · A1/A2 | OK |
| **G-2** ALS frame opens inside `auth` | §6.2 · File #26, #27, #28 · A3a (#30) | OK |
| **G-3** PII-free divergence record | §9.2 + **§9.3 linkage controls** · File #6 (key allowlist) · test #10 | OK |
| **G-4** writes never double-executed; scalars never sampled | §4.2 subtraction + §4.3 plan-kind refusal · File #3, #22 · A10 (#45) | OK |
| **G-5** any throw caught+counted; caller unaffected | §4.1 table (incl. the sink row) · File #21 · #25 four-point injection · **#56 A12** | OK |
| **G-6** sample honours env + self-throttle | §4.2 cond. 7 · File #7, #24 | OK |
| **G-7** durable sink survives restart/cold start/redeploy | §7 Postgres models · File #12, #13, #15, #16 · AC-15 in #46 | OK |
| **G-8** positive control: canary + zero-sample alert + volume floor | §15.1 · File #32, #33 · §11 exit criteria · A6/A7 | OK (canary bounded per D-15) |
| **G-9** false-divergence classes structural, not threshold | §9.1 · File #5 · test #9 | OK |
| **G-10** both suites green with shadow on; tsc clean | §12.2 item 6 (second CI run, File #47) · §13 phase-3 gate | OK — **claim corrected in rev 3** (transparency, not enforce-validation) |
| **G-11** platform-admin read-only status endpoint | §8 · File #37–#40 · M-1 + AC-27 | OK (path deviation D-2) |
| **G-12** shape-keyed dedupe with `suppressedCount` | §7.2 `@@unique([kind, model, operation, shapeHash, routeHint])` · File #15, #17 | OK — **AA-2 closed** (D-11) |
| **G-13** triage runbook incl. directional skew signature | §9.1 · File #48 | OK |
| **G-14** enumerate async-continuation sites + strategy each | File #49, fed by the D-8 backlog query | OK |
| **G-15** scalar comparator (`count`/`aggregate`/`groupBy`) | not built; §4.2 subtraction is the guard | MISSING — `FUTURE_EPIC`, SCOPE-declared `NICE_TO_HAVE` (P2) |
| **G-16** Sentry rules/dashboards beyond the 2 required alerts | §15.1 delivers the required alerts; extras deferred | MISSING — `FUTURE_EPIC`, SCOPE-declared `NICE_TO_HAVE` (P2) |
| **G-17** raw-SQL tenant audit | §14 FM-5 honesty flag only | MISSING — `FUTURE_EPIC` per SCOPE; gates `enforce`, not shadow |

All three `MISSING` rows are SCOPE-declared `NICE_TO_HAVE` / `FUTURE_EPIC`. **No
MUST_SHIP or SHOULD_SHIP goal is MISSING.**

### Design decisions, failure modes, resolved decisions

| SCOPE decision | Architecture artifact | Status |
|---|---|---|
| D-1 three-way client resolution | §3.1 · File #23 | OK |
| D-2 harness first in `$allOperations`, `real` bound first | §4 + §4.1 · File #22 | OK |
| D-3 `SHADOW_READ_OPS` explicit subtraction, imported sets | §4.2 · File #3 | OK |
| D-4 shadow side calls `executePlan`; `shouldShadow` in `prisma-scoped.ts` | §4.3 · File #22 | DEVIATED — D-7 (synthetic continuation, awaiting inside `runReentry`); `executePlan` still the executing function |
| D-5 kinds + directional-skew classification | §9.1 · File #5 | OK (adds the explicit `clean` outcome — D-13) |
| **D-6 record shape incl. id arrays capped at 20 (SCOPE:244-245)** | §7.1 model + §9.3 · File #4 (`SHADOW_MAX_IDS`), #6 re-assert · **AC-28** | **OK — B-6 closed in rev 3** (rev 2 declared both arrays uncapped) |
| D-6 record shape (other fields) | §7.1 + §8.2 · File #2, #6 | DEVIATED — D-11 (group key), D-12 (`hadBusinessOnToken`), D-5 (`lastSeenAt`) |
| D-7 durable Postgres sink, 2 models, cleanup spec | §7 · File #12–#17, #31 | OK (D-4/D-5/D-11/D-13/D-14 corrections) |
| D-8 provenance split; HTTP-path gate; 3 SQL queries | §6.3 + §11 · File #48 | DEVIATED — D-1 (two reachable criteria); criterion 2 re-based on §7.2a (RS-1); SQL on `lastSeenAt` |
| D-9 positive control (canary, zero-sample alert, volume floor) | §15.1 · File #32, #33 · §11 | DEVIATED — D-15 (bounded canary fixture; SCOPE's unbounded `findMany` manufactures linkage) |
| D-10 `shouldShadow()` predicate list | §4.2 (7 conditions; rev-1 cond. 8 deleted; cond. 1 now includes the M-2 mode belt) | OK — **AA-5 closed** |
| FM-1 … FM-18 + 8 new modes | §14 table, one implementation site each | OK |
| RD-1 … RD-15 | RD-1 §4; RD-2 §4; RD-3 §3.1; RD-4 §6.2; RD-5 §9.2; RD-6 §4.1; RD-7 §5 throttle; RD-8 §7; RD-9 §4.2; RD-10 §6.3; RD-11 §15.1; RD-12 §9.1; RD-13 §6.2; RD-14 §4.2; RD-15 §4.3 | OK (RD-15 per D-7) |
| Cleanup spec (script, daily 03:15 IST, 30/180d, indexed column, write cap) | §7.1 indexes · §7.4 dual ceiling · File #31 · #34 registration | OK (D-14) |
| Observability: 5 metrics, no `businessId` label | §9.2 · File #21, #16 · §8.2 (+`sinkWriteFailed`, B-3) | OK |
| Required alerts 1–5 | §15.1 (1,2 hardened) · File #33 · #48 (3,4,5) · **B-3 Sentry group** | OK |
| Performance budget (p95 +10%, pool ≤2/10, 1 extra read) | §11 · Phase 0 gate §13 with `^SELECT` filter · **sink gauge added (B-2)** | OK — **SS-4 closed; §11's "zero pool slots" corrected** |
| Rollout stages 1–7 + kill switch | §11 (+ `sinkWriteFailed` = 0 at stage 1 and in the exit criteria) | OK |
| Security §: admin auth, limiter, IDOR, CSRF, audit, PII, blast radius | §8.1 (reuse of `/api/admin`) + §9.2 + §9.3 + §4.1 + M-1/M-3 | OK (D-2) |
| UI states / Mobile / UX copy | §8.3 (4 response states) · §3.2 boot log · zero `src/` files | OK |

### Acceptance criteria

| AC | Architecture home | Status |
|---|---|---|
| AC-1 20 fixture reads deep-equal under shadow vs off | #46; §4.1 property 1 | OK |
| AC-2 non-null businessId from ≥20 distinct routers | #30 (**A3a**), real `createApp()` | OK |
| AC-3 two-tenant unscoped `findMany` ⇒ exactly one `diverged` row | #46 | OK |
| AC-4 throw at each of 4 harness points ⇒ caller correct | #25 | OK |
| AC-5 zero shadow invocations for every write op | #45 (**A10**) | OK |
| AC-6 no PII in post-winston bytes **and** DB row | #10 + #46 | OK |
| AC-7 server suite green with shadow + sample 1 | §12.2 item 6, File #47 | OK |
| AC-8 tsc 0 · enforce.js no new errors · `npm run ssot` 0 | §13 phase gates; #50 fixes the stale `render.yaml` comment | OK |
| AC-9 zero shadow queries inside `scopedTransaction` | §4.2 cond. 6 · #45 | OK |
| AC-10 sample 0 ⇒ zero extra queries over 100 reads; zero-sample alert fires | #11 + #41 | OK |
| AC-11 20 errors/60s opens breaker; canary alert while latched | #11 + #41 | OK |
| AC-12 status endpoint 200/401/403/404 | #40 · §8.3 | OK (path per D-2) |
| AC-13 under `off`, emitted SQL byte-identical to pre-epic HEAD | #46 default-pass describe block via `base.$on('query')` | OK |
| AC-14 `count` ⇒ zero shadow queries, zero records | #45 (**A10**) | OK |
| AC-15 rows survive restart; stat counters monotonic | #46 | OK |
| AC-16 retention deletes >30d, keeps newer; stats 180d | #46 (retention on `lastSeenAt` **+ the `createdAt` ceiling**, D-5/D-14) | OK |
| AC-17 bounded-window divergence ⇒ `unstable-window`, excluded from gate | #9 + #46 | OK |
| AC-18 canary row every 15 min; absence pages within 45 min | #46 + File #33 | OK |
| AC-19 exactly one extra **`^SELECT`** per sampled read (SR-4, SS-4) | #1 spike + #46 filtered statement count | OK |
| AC-20 boot refuses `SCOPED_PRISMA_ENFORCE=shadown` (SR-3) | #42 (**A4**) child-process spawn | OK |
| AC-21 `.githooks/pre-commit` **spawned** fails on a planted raw-client violation (AA-4) | #43 (**A9**) | OK |
| AC-22 both new models in `GLOBAL_ALLOWLIST`, in neither `SCOPED_MODELS` nor `CHILD_SCOPED`; `scoped-models.complete.test.ts` passes **unmodified** | #14 + existing test, unedited | OK |
| AC-23 a sampled read with **no ALS frame** issues **zero** scoped queries and produces exactly one `no-context` record (AA-5) | #45 (**A11**), spy delegate | OK |
| AC-24 two `no-context` records differing only in `model`/`operation` produce **two** rows, not one (AA-2) | #17 + #46 | OK |
| AC-25 `no-context ∧ http ∧ hadBusinessOnToken` is **non-zero** when the tenant frame is stubbed out of `enterTenantFrame` — the gate's own falsifiability proof (AA-3) | #30 | OK |
| **AC-26** a rejecting `ShadowDb` over 50 sampled reads fires **no** `unhandledRejection`, leaves every caller value correct, increments `sinkWriteFailed` to 50, and logs once per failure (B-1) — **and, with a `logger.error` that itself throws, still fires no `unhandledRejection` and still leaves callers correct (N-2)** | #56 (**A12a/A12b**) | OK |
| **AC-27** one authorised status read writes **exactly one** `AdminAction` row naming actor + action (M-3, FM-13) | #40 | OK |
| **AC-28** a 500-id divergence persists **20** ids per array with `truncated: true` and full `unscopedCount`/`scopedCount` (B-6, SCOPE:244-245) | #8 + #46 | OK |
| **AC-29** `setShadowPort` throws under mode `off`/`enforce`, and throws on a second call under `shadow` (M-2) | #25 (shadow project, File #47 isolation) | OK |
| **AC-30** a clean framed comparison writes **zero** `ScopedShadowDivergence` rows and exactly one `observed-framed` `ScopedShadowStat` row for its `routeHint` (D-13, RS-1) | #46 | OK |
| **AC-31** the extracted `qa.yml` lint command exits non-zero on a planted raw-client violation, and the test fails when the step is removed from the workflow (B-4) | #57 (**A9b**) | OK |
| **AC-32** gauge saturation increments **`sinkShed`** and leaves **`sinkWriteFailed` at 0**; the status payload reports the two separately and the exit-criteria query gates only the latter (N-1) | #56 (**A12c**) + #37 | OK |

AC-25 exists because the rev-1 gate's defect was that it could never fail. A gate now
ships with a test proving it *can* — the falsifiability check that §1's revised lesson
demands of every control this epic adds. AC-26 and AC-31 extend the same discipline to
the write path and to CI: a containment claim ships with an injected failure, and an
invoker claim ships with a test that reddens when the invocation is deleted.

### QA checklist coverage

Every row of the SCOPE's §QA Checklist maps to an artifact above: dual-mode suite runs
(§12.2 item 6, File #47) · tsc transcript (§13) · curl transcripts (#40) · a persisted
row pasted (#46) · post-winston byte capture (#10) · ≥20-router frame evidence, not a
grep (#30/A3a) · spy-client output (#45/A10, A11) · **injected-rejection transcript
(#56/A12)** · `migrate dev` + `migrate status` (§7.5) · retention cron exercised (#46) ·
canary visible in staging (§11 stage 1) · **Neon pooler limit recorded before any ramp
step** (§11 stage 2) · latency table (§11) · kill switch + AC-13 SQL diff (#46) · both
docs exist (#48, #49) · `render.yaml` comment corrected (#50) · design plan shows
`architect, security` with live artifact paths (§0 header).

---

## 19. Open risks carried into build

1. **Phase 0 could fail.** If `Promise.resolve(q(args))` does not collapse to one
   `SELECT`, the performance budget is wrong and §4.1 needs redesign. This is why
   Phase 0 is a gate, not a task.
2. **`no-context` volume at stage 1 is unknown — and the risk is the opposite of what
   rev 1 stated.** Rev 1 worried about *hitting* the 5 000/hour cap. Under rev 1's
   dedupe key the actual behaviour was the opposite and worse: one row, cap never
   approached, backlog destroyed. With D-11's key the job-path population is bounded
   at `3 kinds × 96 models × 5 ops = 1 440` distinct rows (§7.2) — well inside
   the cap and genuinely informative. The remaining unknown is the HTTP-path
   `routeHint` multiplier; the runbook tells the operator that a large but *stable*
   distinct-key count on the job path is expected, not an incident.
3. **`req.route` may be undefined for some mounts.** Routers terminating in
   `router.use(handler)` rather than `router.get(path, handler)` produce a null
   `routeHint`. A3a (`subjectBusinessId` non-null on **all** ≥20 routers) stays hard —
   that is the frame assertion. A3b (`routeHint` non-empty on **≥15** of the 20) is
   the measured one, and the shortfall is enumerated by router name into File #49.
   The same shortfall bounds exit criterion 2 from below: if fewer than 20 route
   templates ever produce a non-empty hint, the criterion must be re-cut on the
   enumerated list rather than relaxed to a smaller number without a written reason.
4. **SR-2 hand-off could be dropped.** Row #53 is blocked-with-owner, and its durable
   record now lives in `GOLD_STANDARD.md` (row #51) rather than only in this document,
   which closes with the epic. The gate coverage gap remains open until #53 lands, and
   §15.2 states plainly that the interim "listed in the design plan" arrangement is
   review for this edit only, not enforcement for the next editor.
5. **The retention and rollup crons are the next unaudited layer** (the security
   auditor's own note for the next round). Files #31/#32/#33 run unattended, hold the
   base client, and #31 **deletes from the table the cutover decision reads**.

   **The window/retention relationship is arithmetic, not an argument (rev 4, C4).**
   Retention deletes on `lastSeenAt < 30d`; every exit query runs over `lastSeenAt`
   inside a **7-day** window. The two sets are **disjoint by construction** — a row
   that fired *during* the window has a `lastSeenAt` inside 7 days and cannot satisfy
   the 30-day delete predicate. Rev 3 called this "an argument, not a control" and
   thereby named the wrong exposure.

   **The real exposure is constant drift.** File #50 puts the 30-day and 180-day
   ceilings into `render.yaml` as env knobs. If either is edited down — to 1 day in a
   disk-pressure incident, say — disjointness silently ends, and the `diverged = 0`
   window starts reading clean for a reason unrelated to the code. §19 risk 4's own
   standard applies here: *listed in the design plan is not a control*. Two things
   close it:
   - **Keep 30/180 as constants, or assert them at boot.** The preferred shape is a
     boot assertion in `lib/boot-guards.ts` (File #35): under mode `shadow`, refuse to
     boot unless `retentionDays ≥ 4 × watchWindowDays`. That turns a silent config
     edit into a failed deploy, which *is* a control.
   - **Record the precondition durably.** It goes into `GOLD_STANDARD.md` (File #51)
     beside the SR-2 hand-off — not only into §19, which closes with this epic. The
     `enforce` epic reads `GOLD_STANDARD.md`; it does not necessarily read this
     document.

   **The `enforce` epic must still audit these three crons before it uses this table's
   emptiness as evidence**, and the runbook records the retention cron's last-run
   timestamp alongside every exit-criteria query so the two are never read in
   isolation.

---

## 20. Revision Log

### rev 4 — 2026-07-21 · closes the rev-3 security re-audit (APPROVED WITH CONDITIONS)

The re-audit verified all six blocking and all five medium findings genuinely closed —
it swept `void ` exhaustively (three occurrences, all with terminal handlers),
confirmed the 4-of-10 pool footprint against `connection_limit=10`, and confirmed A9b
is tied to the invoker. **No further revision cycle is required.** This pass applies
the four conditions and **reopens nothing**. Explicitly untouched: the
`subjectBusinessId` naming rationale, the B7 ratchet design, "harness absent rather
than flag-disabled", the `prisma.ts` three-way dispatch, D-7's synthetic continuation,
§7.2's model count (96) and job-path bound (1 440) as hand-corrected, File #55's
conditional row (adjudicated by the B7 ratchet plus stale-row reporting, not by builder
discretion), and every AA-1…AA-6 / SS-1…SS-7 / B-1…B-6 / M-1…M-5 closure.

| ID | Condition | Closure |
|---|---|---|
| **C1 / N-1** | B-2's shedding and B-3's rejection incremented the **same integer** (rev 3, §5.2 + §10), so the `= 0` exit criterion was either unachievable at stage-1 sample 1.0 or something the operator learns to wave through — B-3's own failure, a signal that stops meaning anything, recurring one level up | Counters **split**: **`sinkShed`** (benign backpressure; own `warn` log, own `['shadow','sink-shed']` group) vs **`sinkWriteFailed`** (write rejection only). §5.2 gains `onSinkShed()`; §8.2 reports both and never sums them; §10 splits `SINK_SHED` from `SINK_FAILED`; **§11 gates only `sinkWriteFailed` at 0** and reports `sinkShed` against the volume floor. New **AC-32**, new A12(c) |
| **C2 / N-2** | `.catch(fn)` contains a rejection only if `fn` cannot throw. `onSinkFailure` called `logger.error`/`captureException` unwrapped (rev 3 §5.2), as did §4's sync catch — a throwing handler re-raises the unhandled rejection B-1 was raised to eliminate | **All terminal handlers are total**: `onSinkFailure`, `onSinkShed`, and §4's `(2a)`/`(2b)` wrap their entire body in `try { … } catch {}`. **AC-26 extended** from "the handler is called" to "the handler throws": A12(b) injects a throwing `logger.error` and requires the `unhandledRejection` spy to stay silent |
| **N-3 (LOW)** | §7.6's parameter-shape heuristic would fire on **56 of 1 094** `server/src` files, all of which receive the *scoped* client; bulk-filling the allowlist in response leaves B2 weaker than today | Heuristic **dropped**. §7.6 item 1 keeps only the call-site rule (`clients.base` passed as an argument out of an allowlisted file), which security judged precise and sufficient. File #18 estimate ~+55 → ~+35. Recorded as a principle: **false-positive rate is a control-integrity property** — a noisy control gets neutralised by the people it interrupts |
| **C4** | §19 risk 5 undersold its own reasoning by calling the retention/watch relationship "an argument, not a control", and named the wrong exposure | Re-framed as **disjointness by construction** (deletes on `lastSeenAt < 30d`; exit queries run over a 7-day `lastSeenAt` window — the sets cannot intersect). The real exposure is **constant drift** once File #50 makes 30/180 env knobs. Closed by a **boot assertion** in File #35 (`retentionDays ≥ 4 × watchWindowDays` under mode `shadow`) and a **durable record in `GOLD_STANDARD.md`** (File #51), meeting the standard §19 risk 4 already sets |

**File Plan: 57 rows, unchanged.** No condition implies a new file — the C4 boot
assertion lands in the existing `lib/boot-guards.ts` (#35), and the C4 precondition in
the existing `GOLD_STANDARD.md` row (#51). One new acceptance criterion: **AC-32**.
`server/src/lib/env.ts` appears in no row (§15.2 — that file is owned by a concurrent
session; this epic's target is `env.scoped-prisma.ts`).

### rev 3 — 2026-07-21 · closes `SECURITY_AUDIT_scoped-prisma-shadow.md` (REJECTED)

Targeted pass on **the sink write path and the promotion gate**. Rev 2's
architecture-audit closures were verified PASS and are not churned; the sections below
are the only ones touched, plus the two mandated corrections.

**Six blocking findings — all closed.**

| ID | Finding | Closure |
|---|---|---|
| **B-1** | `void sink.write(record)` at §5.1 had no terminal handler. On Node ≥ 15 an unhandled rejection **terminates the process** — so the design documented as "fail open silently with a counter" actually crashes the API on the first transient sink failure. The correct pattern sits nine lines away in the file this epic edits (`prisma.ts:76-86`) | All fire-and-forget now goes through **`emit()` / `emitStatsOnly()`** (§5.2), each with `.catch(onSinkFailure).finally(...)`, adopting `prisma.ts:76-86` verbatim. **No bare `void promise` exists anywhere in the harness.** §4.1's containment table gains a fifth row; §4 adds a terminal `.catch` on the `observe()` call itself; §10 makes `SINK_SHED` a terminal state. New **A12 / AC-26** (rejecting `ShadowDb` + `unhandledRejection` spy) and File #56 |
| **B-2** | Sink writes sat outside the connection budget; §11's "no-context reads consume zero pool slots" was false — the branch skips the probe and then writes on the same 10-connection pool, on the job path where nearly every read is `no-context` | `SHADOW_SINK_MAX_INFLIGHT` (default 2) gauges sink writes, sheds rather than queues, and **sink failures feed the same breaker** as probe failures. §11 corrected to "zero probe slots, at most one sink write, ≤ 2 concurrent", with the worst-case harness footprint stated as 4 of 10. New env knob (§8.4), `render.yaml` row (#50) |
| **B-3** | A failing sink was invisible, and an empty divergence table is indistinguishable from a working one — so `diverged = 0 for 72 hours` could be satisfied **by the recording mechanism being broken**. The epic's own catastrophic outcome (b), one layer below where AA-5 closed it | `sinkWriteFailed` is an **in-process** counter incremented in `onSinkFailure` and reported on a **different path** from the one that failed — error log + Sentry group `['shadow','sink-write-failed']` + status payload (§8.2) — never as a `ScopedShadowStat` row. Added to §11 stage 1 **and** to the exit criteria **at 0**, with the explicit statement that a window ending non-zero does not qualify `enforce`. §15.1's counter-independence rule is cited as the precedent and the watchdog's durable `sampled = 0` page is named as its restart-proof twin. Folds in **RS-1**: exit criterion 2 and `distinctFramedRoutes` are re-based on a new `routeHint`-keyed `observed-framed` rollup in `ScopedShadowStat` (§7.2a), which also resolves the §5.1-vs-§9.1 "is there a clean kind?" ambiguity — **clean comparisons write no divergence row** (AC-30), so §7.2's cap arithmetic stays valid and the divergence table stays an anomaly table. Recorded as **D-13** |
| **B-4** | A9 spawned `.githooks/pre-commit`, but the hook runs only under `core.hooksPath` — **local git config, uncommitted**. No `qa.yml` row existed, so "wired into CI" stayed false after the epic shipped, and A9 passed on machines where git never invokes the hook: AA-4's defect class one level up | **File #54 `.github/workflows/qa.yml`** gains the `npm run lint:raw-client` step — an invoker that cannot be un-configured. **File #19** gains a `prepare` script installing `core.hooksPath` so `npm install` wires the local hook. The hook line stays as defence-in-depth (A9 unchanged), and **A9b / AC-31 / File #57** assert the CI invocation by parsing `qa.yml`, extracting the command, and **executing the extracted string** against a planted violation — reddening on deletion, rename, or rule breakage. §12, §15.4 |
| **B-5** | §7.6's claim that `sink.ts` "still needs a `RAW_CLIENT_ALLOWLIST` row" described a **no-op row**: the linter skips files without the `__basePrismaUnsafe` token (`:93`), and `sink.ts` receives the client as an argument. The escape happens inside allowlisted `prisma.ts`. `RAW_CLIENT_ALLOWLIST:36` already proves such rows rot unnoticed (it names a file outside the walk root) | §7.6 **states plainly that File #18's row is not coverage**. File #18 grows to ~+55 lines: (1) flag `PrismaClient`-shaped parameters in non-allowlisted files **and** call sites passing `clients.base` out of allowlisted files, so the escape is visible at the composition root; (2) **stale-row reporting for `RAW_CLIENT_ALLOWLIST`** matching the B7 ratchet's existing treatment, and **removal of the dead `server/scripts/...` row**; (3) **walk root widened** past `server/src` (M-4a). §0 gains three verification rows |
| **B-6** | SCOPE:244-245 caps both id arrays at **20**; rev 2 declared `onlyUnscoped String[]` / `onlyScoped String[]` uncapped. `SHADOW_MAX_ROWS = 5000` is a different quantity. The design also never stated that the table is a cross-tenant **identifier-linkage** store — the PII wall is a wall against *content* | `SHADOW_MAX_IDS = 20` restated in §7.1 next to both arrays, enforced in `diff.ts`, re-asserted in `redact.ts`, asserted by **AC-28** and in `ScopedShadowRecentRow`. New **§9.3 "The risk is linkage, not content"** states the threat in the auditor's own terms and lists four bounds: the id cap, the dual retention ceiling (M-5/D-14), admin-only hashed access (M-1/AC-27), and a **bounded synthetic canary fixture** replacing SCOPE:413-416's unbounded `findMany`, which would otherwise persist a 20-id sample of real production ids every 15 minutes as its steady state (**D-15**) |

**Five medium findings — all closed.**

| ID | Closure |
|---|---|
| **M-1** | `shadow-status.service.ts` (#37) reads under `runUnscoped('platform.admin')`. The `GLOBAL_ALLOWLIST` makes the wrapper optional, which is exactly why it is stated: a cross-tenant platform table read from an admin request must land in `UnscopedAccessLog` per the M2 precedent. §8.1 |
| **M-2** *(mandated)* | `setShadowPort()` **throws** unless `getScopedPrismaMode() === 'shadow'`, and **throws on a second non-null call**; the shadow branch asserts the mode as a belt (`shouldShadow` cond. 1). No `clearShadowPort()` — File #47's `pool: 'forks'` / `isolate: true` provides the fresh registry tests need. **AC-29**. New §3.1a; this is the structural condition the auditor's "harness absent rather than flag-disabled" confirmation was subject to |
| **M-3** | **AC-27** — one authorised status read writes exactly one `AdminAction` row (#40). FM-13's audit half previously had no AC, so `auditAdminAction` could be dropped with every test still green |
| **M-4** | `stats.ts` declared **Prisma-query-API-only** (§5 table, §7.1, §7.6). If raw SQL proves necessary, the reviewed `raw-sql-audit.allowlist.json` row (File #55) lands in the **same commit** with a tenant-safety note — the row is conditional by design and its absence is the assertion. Walk root widened (M-4a, File #18) |
| **M-5** | Retention gains an absolute `createdAt < 180 days` ceiling alongside the 30-day `lastSeenAt` rule (§7.4, **D-14**), so no cross-tenant linkage row is retained indefinitely; `@@index([createdAt])` added; both tables listed in the DPDP erasure inventory in the runbook (#48) |

**Two mandated corrections.**

1. **§12.2 item 6 over-claim.** Rev 2 said the dual-mode suite run is "meaningful only
   because A2 puts the scoped client on the path", which reads as evidence that
   `enforce` works. Corrected: A2 does bind `clients.scoped`, but the shadow branch
   **returns at statement (3) before the fail-closed guard chain**, so `injectScope`
   never runs for the caller. The second pass proves **transparency** — 1269 tests
   unchanged by the harness — and is **not** evidence for the enforce injector, which
   is the `enforce` epic's own gate.
2. **§7.2's model count** was corrected by the coordinator (96 live DMMF models;
   1 440 job-path distinct rows). **Left exactly as written**, and §19 risk 2 already
   quotes the corrected figures.

**Low findings.** The audit's §9 gate checklist does not enumerate the three low items
separately; the ground they cover is closed by the B-5 linter hygiene work (dead row,
stale-row reporting), M-4a's walk root, and the §12.2 correction. No separate design
change was required.

**Not churned** (verified sound by one or both prior audits, deliberately untouched):
the `subjectBusinessId` naming rationale; the B7 ratchet mechanism; "harness absent
rather than flag-disabled" (now structurally enforced by M-2 rather than by
convention); the `prisma.ts` three-way dispatch; `SHADOW_READ_OPS` read-only-ness by
construction; D-7's synthetic continuation; the D-4 / D-5 diagnoses; AA-1…AA-6 and
SS-1…SS-7 closures.

**Declined:** nothing. All six blocking, all five medium, and both mandated corrections
are closed.

**File Plan:** 53 rows → **57** (appended #54 `qa.yml`, #55 conditional raw-SQL
allowlist, #56 sink-failure test, #57 CI-invocation adoption test; existing numbers
deliberately unchanged so audit references stay valid). New ACs: **AC-26 … AC-31**.
New deviations: **D-13, D-14, D-15**.

**Cross-session learning appended** to `~/.claude/learnings/architecture-blindspots-*.md`
under *Observability & controls*, beside the rev-2 entry: **a fire-and-forget boundary
is an unaudited subsystem, not a statement.** `void doThing()` reads as terminal and
gets skimmed by every reviewer, but it is a promise nobody owns — it can kill the
process (unhandled rejection), consume an unbudgeted resource, and fail silently in a
way that *greens the very gate it feeds*. Three review rounds passed over the same
line. The rule: at every fire-and-forget, ask the three questions — **who catches it,
what does it consume, and who learns that it failed** — and require the third answer to
name a path different from the one that failed.

### rev 2 — 2026-07-21 · closes `ARCHITECTURE_AUDIT_scoped-prisma-shadow.md` (BLOCK)

**Six MUST_SHIP gaps — all closed.**

| Audit ID | Gap | Closure |
|---|---|---|
| **AA-1** | File Plan row #24 edited `server/src/lib/env.ts`, owned by a concurrent session and excluded from `files_planned` | Row deleted; `env.ts` appears nowhere in the File Plan. Consumers import `./env.scoped-prisma.js` directly with a deferral comment + follow-up row. Recorded as **D-10** in §16, not left for the builder to discover. §8.4 |
| **AA-2** | Dedupe key `[shapeHash, routeHint]` collapsed every empty-diff record into one row, reducing D-8's `runUnscoped` backlog query — this epic's primary deliverable to `enforce` — to one fabricated row | Key widened to `@@unique([kind, model, operation, shapeHash, routeHint])` (auditor's preferred option 1; `shapeHash` keeps SCOPE's definition). Cap re-checked against the new distinct-key bound (1 440 job-path, using the measured DMMF count of 96 scoped models). Recorded as **D-11**. New index `[kind, provenance, lastSeenAt]`. AC-24 + §12.2 item 5 regression. §7.2 |
| **AA-3** | The D-1 replacement gate was **unfalsifiable** — `no-context ∧ http ⟹ noBusinessOnToken=true`, so it read 0 even with `enterTenantFrame` deleted; and `noBusinessOnToken` had **no producer** | `RequestMeta` gains `hadBusinessOnToken`, set in `enterTenantFrame` from `Boolean(req.user?.businessId)`; `runWithRequestMeta` runs unconditionally so the field is recorded when no frame opens. Gate replaced with two reachable criteria: frame-loss = 0, and a distinct-`routeHint` count ≥ 20. **AC-25 proves the gate can redden.** Recorded as **D-12**. §6.2, §6.3, §11 |
| **AA-4** | A9 spawned the lint *script*, so it stayed green whether or not anything invoked it — the epic's own failure mode inside the row that closes it | A9 now stages a violating file and **spawns `.githooks/pre-commit`**. Direct-script invocation demoted to a separate rule unit test (File #44), explicitly *not* adoption proof. §12, AC-21. *(Rev 3 note: the hook itself turned out not to be an unconditional invoker — see B-4.)* |
| **AA-5** | `observe()` had no no-context branch; the probe ran with `businessId: undefined`, Prisma dropped the key, the probe went unscoped, and ~100% of job-path traffic recorded as *verified non-divergent* | `observe()` gains an explicit early branch before `inflight++` and before any probe: build the `no-context` record, sink it, bump stats, return — no probe, no pool slot, no sample budget. `runScopedProbe`'s `businessId` is a required `string` with a runtime `ShadowProbeNoContext` throw as belt. `shouldShadow()`'s rev-1 condition 8 deleted. New **A11** + **AC-23**. §5.1, §4.2, §4.3 |
| **AA-6** | `prisma.ts → prisma-shadow.ts → sink.ts → prisma.ts` was cyclic, resolving only on nine lines of export ordering; TDZ `ReferenceError` at boot under `shadow` only | Base client injected at the composition root: `createShadowPort({ db: clients.base })`; `createShadowSink(db)` / `createShadowStats(db)` import nothing from `prisma.ts`. New narrow `ShadowDb` type. §2 diagram redrawn. *(Rev 3 note: this shape is also what escapes the raw-client linter — see B-5.)* |

**Seven SHOULD_SHIP gaps — all closed.**

| Audit ID | Closure |
|---|---|
| SS-1 | `probeContinuation` snippet corrected to `runReentry(async () => await …)`, matching `executePlan`'s existing branches (`prisma-scoped.ts:96-121`). §4.3 |
| SS-2 | A3 split into **A3a** (`subjectBusinessId` non-null on **all** ≥20 — hard) and **A3b** (`routeHint` non-empty on **≥15**, shortfall enumerated into File #49). |
| SS-3 | A1/A2 env control specified: dedicated `vitest.shadow.config.ts` (File #47) with `env` set in config and `pool: 'forks'` / `isolate: true`; default pass asserts the inverse. §12.1 |
| SS-4 | Phase 0 gate counts only `$on('query')` events matching **`^SELECT`**, exact count on both sides. §13, AC-19 |
| SS-5 | §15.2's pointer corrected from row #49 to the blocked hand-off row (now **#53**). |
| SS-6 | SR-2's pattern change written into `docs/GOLD_STANDARD.md`'s backlog (File #51); §15.2 states plainly that "listed in the design plan" **is not a control**. |
| SS-7 | File Plan row #19 split into #19 (`package.json`) and #20 (`.githooks/pre-commit`), one file per row. |

**Not changed** (auditor verified as correct): the `prisma.ts` three-way dispatch,
`SHADOW_READ_OPS` read-only-ness by construction, D-7's synthetic continuation with
SS-2 intact, and the D-4 / D-5 diagnoses and fixes.

**Declined:** nothing. All thirteen audit findings closed. **File Plan:** 51 → **53**.

**Cross-session learning appended** to `~/.claude/learnings/architecture-blindspots-*.md`
under *Observability & controls*: **a control built to detect dark components is itself
a component.** It needs (a) its own call-site adoption assertion — spawn what is
supposed to *invoke* it, never the artifact itself — and (b) its own falsifiability
proof, a test that makes the gate redden. An unfalsifiable gate is strictly worse than
an unreachable one: unreachable gets noticed and relaxed visibly; unfalsifiable reports
success forever. Three of that rev's six MUST_SHIPs were instances of this single
class.

### rev 1 — 2026-07-21 · initial design

Closed SCOPE-audit SR-1 (watchdog over durable rows), SR-3 (boot-guard wiring + A4),
SR-4 (Phase 0 statement count); documented SR-2 as a blocked hand-off. Found a fourth
landed-dark component (`lint-raw-client.mjs`, §15.4) and four SCOPE defects (D-1, D-4,
D-5, D-7). Verdict: **BLOCK** on 6 MUST_SHIP / 7 SHOULD_SHIP / 2 conformance breaks.
