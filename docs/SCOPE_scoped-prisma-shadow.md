# SCOPE — `scoped-prisma-shadow`

> Shadow-diff harness for the tenant-isolation layer. Runs scoped-model **row-returning
> reads** on both the scoped and unscoped clients, diffs the returned row-id sets, emits a
> PII-free divergence record to a **durable** sink, and returns the unscoped result so
> runtime behaviour is unchanged.
>
> Status: REVISED (rev 2, post-audit) · Created 2026-07-21 · Owner: Sawan
> Roadmap ref: `docs/GOLD_STANDARD.md` §P0.1 (Option A, step 1) · Gates G1.
> Audit ref: `docs/SCOPE_AUDIT_scoped-prisma-shadow.md` (BLOCK, 8 MUST_SHIP / 7 SHOULD_SHIP).
> See §Revision Log for what changed and what was declined.

**⚠️ High-risk trust anchors.** `server/src/lib/prisma.ts`,
`server/src/lib/prisma-scoped.ts`, `server/src/lib/env.ts`, and — new in rev 2 —
`server/prisma/schema.prisma` + a migration are declared high-risk in
`~/.claude/rules/HIGH_RISK_PATHS.md`. Every edit requires an approved
`.claude/design-plan-active.md` with `agents_invoked: architect, security`
(schema requires `architect`). This SCOPE is step 1 of that sequence; it does
**not** authorise the edits by itself.

---

## Summary

Wire `SCOPED_PRISMA_ENFORCE=shadow` so that the exported `prisma` client is the
**scoped** client running in observation-only mode: each sampled row-returning read
on one of the tenant-scoped models is also executed through the scoping injector,
the two row-id sets are diffed, and any divergence is written to a durable Postgres
sink with row ids and counts but never row contents. The caller always receives the
unscoped result, produced before any harness code can run.

---

## Verification of premises (re-checked against code, 2026-07-21, rev 2)

| Claim | Verdict | Evidence |
|---|---|---|
| `prisma.ts:110` is a two-way ternary; `shadow` falls through to unscoped | TRUE | `scopedMode === 'enforce' ? clients.scoped : clients.softDeleted` |
| The scoping extension is attached **only** to `clients.scoped` | TRUE | `prisma.ts:69-72` |
| `scopedTransaction` has zero production call sites | TRUE | grep → `lib/prisma.ts` + `__tests__/setup.ts` only |
| `getScopedPrismaShadowSample()` has no consumer | TRUE | `env.ts:267`; grep finds only its definition + docs |
| `READ_MERGE_OPS` contains `count`, `aggregate`, `groupBy` | TRUE | `prisma-scoped.rewrite.ts:10-17` |
| `scopedContext` middleware is mounted nowhere | TRUE | grep → its own definition file only |
| The auth middleware is exported as **`auth`**, not `authenticate` | TRUE | `middleware/auth.ts:27` — **the audit's MS-5 uses the wrong symbol name; the seam it identifies is correct** |
| `auth` is per-router, not global; `app.ts` global chain ends at `conflictDetection` | TRUE | 444 `auth` occurrences across 138 route files |
| `auth` queries `prisma.user` **before** `req.user` is set | TRUE | `auth.ts:61` — benign: `User` is in `GLOBAL_ALLOWLIST` (`scoped-models.ts:65`), so it is a passthrough, not a no-context record |
| `runUnscoped` has zero production adopters | TRUE | grep → definition + doc comments only |
| Logger is 2 winston File transports, 5 MB × 5, prod only; no aggregator | TRUE | `logger.ts:84-97` |
| `piiMaskFormat`/`scrubPii` run **after** the caller's object is handed to winston | TRUE | `logger.ts:41-58` |
| `render.yaml` is `plan: free`, `autoDeploy: true`, ephemeral FS | TRUE | `render.yaml:8,27` |
| `render.yaml:15-17` claims the server has "accumulated type errors" | **STALE — FALSE** | `npx tsc -b --noEmit` exits 0. Corrected in this epic (File Plan #22) |
| `txSlot` is module-private, not exported | TRUE | `prisma-scoped.ts:49` |
| Raw-SQL surface | 178 occurrences / 72 files (~100 non-test) | `grep -c` |
| No Redis or external cache is wired | TRUE | `lib/cache.ts`, `lib/token-blacklist.ts` are in-memory |

---

## Goals

### P0 — required to call this epic done

- **G-1** Under `shadow`, the exported `prisma` **is** `clients.scoped`, and each
  sampled row-returning read is diffed scoped-vs-unscoped while the caller receives
  the unscoped result. `[MUST_SHIP]`
- **G-2** Open the ALS tenant frame **inside the `auth` middleware itself**, so the
  frame exists wherever `req.user` does. `[MUST_SHIP]`
- **G-3** Emit a PII-free divergence record (model, operation, businessId, both
  counts, capped symmetric-difference row ids, matched-route template hint) — never
  row contents, never `args`, never `err.message`, never a resolved URL. `[MUST_SHIP]`
- **G-4** Writes are never double-executed; scalar-returning reads are never sampled.
  Both by construction, not convention. `[MUST_SHIP]`
- **G-5** Any throw, rejection, or timeout in the harness is caught and counted; the
  caller's result is computed before harness code runs and is never altered. `[MUST_SHIP]`
- **G-6** Sampling honours `getScopedPrismaShadowSample()` plus a measurable
  self-throttle (§Performance budget). `[MUST_SHIP]`
- **G-7** A **durable** sink survives restart, cold start, and redeploy, so every
  exit criterion in §Rollout is computable. `[MUST_SHIP]`
- **G-8** A **positive control**: a scheduled canary that must appear in the sink, a
  zero-sample alert, and a volume floor on the watch window. `[MUST_SHIP]`
- **G-9** False-divergence classes (`unstable-window`, `skew-suspect`) are classified
  out of `diverged` structurally, not by relaxing a threshold. `[MUST_SHIP]`
- **G-10** Both suites green with `shadow` on (1269 server / 1409 client);
  `npx tsc -b --noEmit` clean. `[MUST_SHIP]`

### P1

- **G-11** Platform-admin read-only status endpoint over the durable sink. `[SHOULD_SHIP]`
- **G-12** Shape-keyed de-duplication with `suppressedCount`. `[SHOULD_SHIP]`
- **G-13** Triage runbook incl. the directional signature of skew. `[SHOULD_SHIP]`
- **G-14** Enumerate the async-continuation sites and assign each a strategy. `[SHOULD_SHIP]`

### P2

- **G-15** Scalar comparator, widening the allowlist to `count`/`aggregate`/`groupBy`. `[NICE_TO_HAVE]`
- **G-16** Sentry alert rules + dashboard panels beyond the two required alerts. `[NICE_TO_HAVE]`
- **G-17** Raw-SQL tenant audit. `[FUTURE_EPIC]` (gates `enforce`, not shadow)

---

## Non-goals

- Flipping to `enforce`. `[FUTURE_EPIC]`
- Migrating the 186 services off hand-written `where: { businessId }`. `[FUTURE_EPIC]`
- Changing `SCOPED_MODELS` / `CHILD_SCOPED` membership. **Amended in rev 2:** the two
  new observability models MUST be added to `GLOBAL_ALLOWLIST`, or the completeness
  test (§5.3) fails. That is the only permitted `scoped-models.ts` edit. `[FUTURE_EPIC]`
- Auditing the raw-SQL surface. `[FUTURE_EPIC]`
- Adopting `runUnscoped` at cron/webhook/auth call sites — this epic *produces the
  list*, the `enforce` epic fixes them. `[FUTURE_EPIC]`
- Nested-relation divergence detection. `[FUTURE_EPIC]`
- Shadow inside interactive transactions. `[FUTURE_EPIC]`
- Any client/UI work. `[FUTURE_EPIC]`
- Shadow-diffing writes. Permanently out of scope (FM-1). `[FUTURE_EPIC]`

---

## Design

### D-1 The client wiring (rev 2 — MS-1)

`prisma.ts` resolves three ways:

```
off      → clients.softDeleted     (unchanged)
shadow   → clients.scoped          (extension attached, harness branch active)
enforce  → clients.scoped          (extension attached, injection load-bearing)
```

Under `shadow` the scoping extension **is on the live call path**. There is no
architecture in which the observed path is bypassed — an extension attached to a
client nobody uses observes nothing. This is a real risk increase over rev 1's
(inert, and therefore useless) wiring, and it is bought down by D-2's structure
rather than by avoidance.

### D-2 Where the harness sits, and why a bug in it cannot reach the caller (MS-1)

The shadow branch is the **first** statement in `$allOperations`, above the existing
fail-closed context check:

```ts
async $allOperations({ model, operation, args, query }) {
  const q = query as Continuation
  if (shadowMode) {
    const real = q(args)                       // (1) caller's value, computed first
    try {
      if (shouldShadow(model, operation)) void observe(model, operation, args, real)
    } catch { countHarnessError() }            // (2) sync throw in shouldShadow
    return real                                // (3) only reachable statement
  }
  ... existing enforce path unchanged ...
}
```

Three structural properties, each with an AC:

1. `real` is bound before any harness code executes. Nothing after line (1) can
   change what the caller receives.
2. `observe()` is `void`-ed, is `async`, and wraps its whole body in try/catch plus
   `.catch()` plus a timeout — an async rejection cannot become an unhandled
   rejection or reach the caller.
3. The `return real` is the sole exit. There is no branch in which the shadow result
   is returned. AC-4 injects a throw at **each** of the four points (shouldShadow,
   observe entry, plan build, scoped execution) and asserts the caller still gets
   the correct body.

Under `shadow`, `getBusinessContext()` returning `undefined` must **not** hit the
`throw new ScopedContextError(model)` on line 139 — the shadow branch returns before
it. Shadow never fail-closes; that is the whole point of the mode.

### D-3 Read-only and comparable by construction (MS-2, FM-1)

```ts
// prisma-shadow.constants.ts
// Explicit SUBTRACTION, not a union: count/aggregate/groupBy are in READ_MERGE_OPS
// but return scalars/shapes with no row ids. Sampling them makes id extraction throw,
// which latches the error breaker (see FM-16). Widening this set REQUIRES a comparator
// for the added op — see G-15.
export const SHADOW_UNCOMPARABLE_OPS = new Set(['count', 'aggregate', 'groupBy'])
export const SHADOW_READ_OPS = new Set(
  [...READ_MERGE_OPS, ...FIND_UNIQUE_OPS].filter((op) => !SHADOW_UNCOMPARABLE_OPS.has(op)),
)
// → findFirst, findFirstOrThrow, findMany, findUnique, findUniqueOrThrow
```

Both sets are **imported** from `prisma-scoped.rewrite.ts`, never re-typed, so a
future op added upstream lands here automatically — and lands in the *excluded*
position only if explicitly named. Every write op takes the passthrough path with
zero shadow invocations (AC-5), and every uncomparable read produces zero shadow
queries and zero records (AC-14).

### D-4 The scoped side runs the real mechanism (SS-2)

`observe()` calls `injectScope(...)` and then **`executePlan`** — the same function
the `enforce` path will use — with a plan-kind guard that hard-refuses `twoStep` and
`upsert` before execution. A parallel re-implementation would validate a code path
production never runs, which defeats the epic's purpose. The guard, not a separate
code path, is what makes this safe.

`shouldShadow()` lives **inside `prisma-scoped.ts`** so it can read the module-private
`txSlot` without exporting it (SS-1). Exporting `txSlot` would widen a declared
trust anchor's public surface and require additional security sign-off for no benefit.

### D-5 Comparison and the false-divergence classes (MS-7)

Compare row-id sets, never contents. Record `kind` is one of:

| kind | Meaning |
|---|---|
| `diverged` | Genuine symmetric difference. **The only kind gated at zero.** |
| `unstable-window` | The query carried `take`, `skip`, or `cursor`. Two executions of a bounded window over a tied `orderBy` legitimately return different subsets. Counted, reported, never gated. |
| `skew-suspect` | Symmetric difference size ≤ the observation interval's plausible write volume, **and** directionally consistent with skew. Counted, reported, never gated. |
| `no-context` | No ALS frame. Split by provenance — see D-8. |
| `shadow-error` | Harness threw or timed out. `errorName` only. |
| `unsupported-shape` | `select` omitted `id`, or rows lack an `id` scalar. |
| `canary` | The positive control (D-9). |

**Directional skew (MS-7).** Because promise-reuse fixes the control first and the
candidate second, skew bias is *systematic*, not random: a row inserted between the
two executions appears as `onlyScoped`; a row deleted appears as `onlyUnscoped`.
GitHub Scientist randomizes execution order to avoid exactly this, and promise-reuse
forecloses that remedy — accepted, because the alternative doubles DB load and does
not mask real divergences. The compensating control is classification: each record
carries `observationIntervalMs` (time between the real promise resolving and the
scoped query returning), and the runbook teaches triage the signature —
*small, one-directional, on a hot write endpoint, non-reproducible* = skew;
*whole-tenant-shaped, reproducible, `onlyUnscoped` containing another tenant's ids*
= a real missing filter.

Exit criteria are stated over `diverged` **excluding** `unstable-window` and
`skew-suspect`, and both excluded populations must be reported with counts in the
watch report so nobody can hide a real divergence inside them.

### D-6 The divergence record (rev 2 shape)

```ts
interface ScopedShadowDivergence {
  kind: 'diverged' | 'unstable-window' | 'skew-suspect' | 'no-context'
      | 'shadow-error' | 'unsupported-shape' | 'canary'
  model: string
  operation: string
  subjectBusinessId: string | null   // see the Prisma model — never `businessId`
  unscopedCount: number
  scopedCount: number
  onlyUnscoped: string[]        // row ids, cap 20
  onlyScoped: string[]          // row ids, cap 20
  truncated: boolean
  shapeHash: string             // sha256 of sorted(onlyUnscoped ++ onlyScoped), 16 chars — dedupe key (G-12)
  suppressedCount: number       // how many identical-shape records this one stands for
  routeHint: string | null      // MATCHED TEMPLATE ONLY: `${req.method} ${req.route.path}` (MS-8)
  provenance: 'http' | 'job'    // routeHint !== null ? 'http' : 'job'  (MS-4)
  hasInclude: boolean           // SS-3 — nested relations the diff cannot see (FM-6)
  hasBoundedWindow: boolean     // take/skip/cursor present (MS-7)
  observationIntervalMs: number // MS-7 skew classification input
  stackHint: string | null      // ≤3 frames under src/services/**, file:line only
  errorName: string | null      // constructor name only
  at: string                    // ISO timestamp
}
```

**PII wall (hard, MS-8).** Prohibited in any record, log line, metric label, DB row,
or API response:

- any field of any returned row other than `id`
- the query `args` (a `where` routinely holds a phone number or a name)
- `err.message` (Prisma embeds failing field values)
- `req.originalUrl`, `req.params`, `req.query` — a search endpoint's
  `?q=Raju+Traders` or `?phone=9876543210` is precisely the fixture AC-6 uses.
  `routeHint` is the **matched Express route template only**
  (`GET /api/parties/:id`), matching standard APM practice.
- `businessId` as a metric **label** (cardinality + tenant-identifying in aggregate)

AC-6 asserts on the **serialized output of the winston format chain**, not on the
pre-serialization object — `logger.ts:41-58` runs `piiMaskFormat`/`scrubPii` after
the caller hands over the meta, so an assertion on `JSON.stringify(record)` proves
nothing about what reaches the sink (and `scrubPii` may itself mangle id-like
fields, which the test must also cover).

### D-7 Durable sink (MS-3 — the trade-off, owned)

Rev 1 specified a log file plus an in-memory ring buffer. That is structurally
insufficient here: `render.yaml:8` is `plan: free` (ephemeral FS, idle spin-down,
`autoDeploy: true` on push) and `logger.ts:84-97` is a 25 MB rotating ring shared
with all application logging. There is no aggregator, no Redis, no external drain.
Ring buffer, counters, and log files are all destroyed several times a day, so every
7-day rate in §Rollout would be computed over state nothing preserves.

**Decision: a durable Postgres sink.** This puts a migration on the critical path and
pulls in the high-risk schema gate. That cost is accepted explicitly, because the
alternative is an epic whose deliverable is *evidence* and which cannot produce any.

Two models (both added to `GLOBAL_ALLOWLIST` — they are platform observability data
with no tenant, and the completeness test forbids an unclassified model):

```prisma
model ScopedShadowDivergence {
  id            String   @id @default(cuid())
  kind          String
  model         String
  operation     String
  // MUST NOT be named `businessId`. `scoped-models.ts:19-23` derives
  // SCOPED_MODELS from DMMF by the presence of a `businessId` scalar, so that
  // name would auto-classify the harness's own sink as a tenant-scoped model —
  // failing the completeness test, and under `enforce` throwing
  // ScopedContextError on the admin status endpoint (no business frame).
  // Matches `UnscopedAccessLog.subjectBusinessId` (schema.prisma:4635), the
  // previous tenant-isolation observability table, for the same reason.
  subjectBusinessId String?      // body field, never an index label
  unscopedCount Int
  scopedCount   Int
  onlyUnscoped  String[]
  onlyScoped    String[]
  truncated     Boolean  @default(false)
  shapeHash     String
  suppressed    Int      @default(0)
  routeHint     String?
  provenance    String
  hasInclude    Boolean  @default(false)
  hasBoundedWindow Boolean @default(false)
  observationIntervalMs Int
  stackHint     String?
  errorName     String?
  createdAt     DateTime @default(now())

  @@index([createdAt])                 // cleanup column (mandatory)
  @@index([kind, createdAt])           // watch-window queries
  @@unique([shapeHash, routeHint])     // dedupe target for the upsert
}

model ScopedShadowStat {
  id         String   @id @default(cuid())
  hourBucket DateTime                  // truncated to the hour
  kind       String
  count      Int      @default(0)
  createdAt  DateTime @default(now())

  @@unique([hourBucket, kind])
  @@index([hourBucket])
}
```

- **Divergence rows** are written by a fire-and-forget upsert on `shapeHash` that
  increments `suppressed` — so a hot loop produces one row, not 10⁵ (G-12).
- **Counters** live in `ScopedShadowStat`, upserted hourly per kind. Monotonic across
  restarts, which is what makes the exit criteria computable. `sampled` is a kind
  here too — that is what powers the zero-sample alert (D-9).
- Writes go through `__basePrismaUnsafe` (never the scoped client — a shadow write
  re-entering the extension is an infinite loop), and are never awaited by the caller.

**Cleanup spec (mandatory, FM-15 now applies for real):**

| Item | Value |
|---|---|
| Script | `server/src/jobs/shadow-retention.cron.ts` |
| Frequency | daily, 03:15 IST, alongside the existing `import-retention.cron.ts` |
| Retention | `ScopedShadowDivergence` 30 days · `ScopedShadowStat` 180 days (rollups are tiny and are the watch-window evidence) |
| Index on cleanup column | `@@index([createdAt])` / `@@index([hourBucket])` — both declared above |
| Write bound | dedupe upsert + a hard cap of 5 000 distinct `shapeHash` rows/hour; beyond it, only `ScopedShadowStat` increments (counters never stop) |

The log line stays as a secondary sink for tailing during active triage. It is
explicitly **not** the evidence store.

### D-8 Provenance split (MS-4)

Rev 1's `no-context rate < 5% of sampled authenticated requests` was uncomputable:
the harness samples *queries*, not requests, and nothing distinguishes authenticated
traffic. Worse, `runUnscoped` has **zero adopters**, so the "skip when
`getUnscopedReason()` is set" rule never fires and 100% of cron/webhook/pre-business
auth queries land as `no-context`. A single global threshold would have been relaxed
under deadline pressure — the rubber-stamp failure.

Rev 2 splits by provenance, computed from the same ALS frame that yields `routeHint`:

- **`provenance: 'http'`** — a matched route template exists. Gate: the count of
  `no-context` records with `provenance='http'` must be **exactly 0** across the
  watch window. This is the criterion that actually proves the `auth` wrapper opened
  the frame on every router.
- **`provenance: 'job'`** — cron, webhook, continuation. Not gated. It becomes a
  **triage backlog with a count**, and is the deliverable handed to the `enforce`
  epic as its `runUnscoped` adoption list.

Exact queries (these go in the runbook verbatim):

```sql
-- HTTP-path no-context — MUST return 0
SELECT count(*) FROM "ScopedShadowDivergence"
WHERE kind='no-context' AND provenance='http' AND "createdAt" > now() - interval '7 days';

-- Job-path backlog — a list, not a threshold
SELECT model, operation, sum(1+suppressed) AS n FROM "ScopedShadowDivergence"
WHERE kind='no-context' AND provenance='job' AND "createdAt" > now() - interval '7 days'
GROUP BY 1,2 ORDER BY n DESC;

-- Gated divergences, excluding the two false-positive classes
SELECT count(*) FROM "ScopedShadowDivergence"
WHERE kind='diverged' AND "createdAt" > now() - interval '72 hours';
```

**Known limitation (SS-5).** `routeHint` comes from the same ALS frame as
`businessId`, so a query on a lost-frame continuation (`res.on('finish')`,
`setImmediate`, streaming/PDF export, detached promise) has *both* null — it is
bucketed as `job`, not `http`. A genuine HTTP-path frame loss therefore hides in the
job bucket. G-14 enumerates the continuation sites in this epic and assigns each
`re-enter frame` or `runUnscoped('response.continuation', …)`; until that list is
closed, the HTTP-path-zero gate reads "every query that reached a route handler
inside its own frame", not "every query originating from HTTP". Stated so the gate is
not over-claimed.

### D-9 Positive control (MS-6, G-8)

"Ran and found nothing" and "never ran" produce identical output. Three additions,
all MUST_SHIP:

1. **Canary.** `server/src/jobs/shadow-canary.cron.ts` runs every 15 minutes: enters
   a frame for a seeded fixture tenant and issues a read that is *known* to diverge
   (a `findMany` with no tenant predicate over a fixture where a second fixture
   tenant holds rows). It must produce a `kind: 'canary'` row. **Absence pages.**
   The alert is on *non-appearance*, not on failure.
2. **Zero-sample alert.** `ScopedShadowStat` kind `sampled` must be non-zero for
   every hour bucket while `mode === 'shadow'`. A zero bucket pages.
3. **Volume floor in the exit criteria.** The watch window only counts if
   `sampled ≥ 50 000` across `≥ 20` distinct scoped models and covering the top-20
   read endpoints. A quiet week is not a clean week.

Each of the five silent-death paths the audit enumerated is caught by at least one:
latched breaker (1,2,3), throttle decay to 0 (1,2,3), missing env var after redeploy
(1,2), cold-start counter reset (durable stat rows, D-7), MS-1/MS-2 (1,3).

### D-10 Sampling and self-throttle

`shouldShadow()` returns true only when: mode is `shadow`; `isTenantModel(model)`;
`operation ∈ SHADOW_READ_OPS`; not `isReentrant()`; no `getUnscopedReason()`;
`txSlot.getStore()` is unset (FM-4); `Math.random() < effectiveSampleRate()`;
`inflightShadowQueries < SHADOW_MAX_INFLIGHT`; breaker closed.

---

## Failure Mode Walkthrough

**FM-1 — Shadow double-executes a write.** Widening the op allowlist to `update`
makes `executePlan`'s `twoStep` branch issue a real resolve+write: sampled updates
run twice, sampled deletes delete twice. *Mitigation:* allowlist derived from
imported op sets (D-3); `observe()` hard-refuses `twoStep`/`upsert` plan kinds before
execution (D-4); AC-5 enumerates every Prisma op against a spy client.

**FM-2 — No ALS frame anywhere.** `scopedContext` is mounted nowhere today, so
`getBusinessContext()` is `undefined` on 100% of requests. Wiring shadow without
fixing that yields 100% `no-context`, zero signal, and a false "ship enforce".
*Mitigation:* G-2 opens the frame inside `auth` itself (FM-17); the HTTP-path
`no-context` gate is **0**, not a rate (D-8); AC-2 requires non-null `businessId`
across ≥20 distinct routers.

**FM-3 — Legitimately context-free paths.** Cron, webhooks, pre-business auth query
scoped models with no frame by design, and `runUnscoped` has zero adopters.
*Mitigation:* `provenance: 'job'` is a counted backlog, never a gate (D-8). The list
is this epic's deliverable to the `enforce` epic.

**FM-4 — Transactions.** A shadow query on the tx client adds statements to the
caller's transaction, inflating it against the 20s timeout and — on error — rolling
back real work. *Mitigation:* `shouldShadow()` returns false when `txSlot` is set;
`shouldShadow()` lives inside `prisma-scoped.ts` so it can read the private slot
without exporting it (SS-1). Currently moot (zero `scopedTransaction` consumers) but
implemented anyway, since AC-9 is otherwise untestable.

**FM-5 — Raw SQL is invisible.** 178 occurrences never reach `$allOperations`.
*Mitigation:* `rawSqlSitesUnaudited: true` in the status payload and in the watch
report header, so silence is never read as coverage.

**FM-6 — Nested `include`s.** The diff compares top-level ids only, so a leak in an
`include`d child reports as no divergence. *Mitigation:* `hasInclude` is now a
recorded field (SS-3) and the report header states the fraction of sampled reads that
carried nested relations — the blind spot is measured, not merely admitted.

**FM-7 — Huge result sets.** Two 250k-id sets per sample burns CPU and memory.
*Mitigation:* `SHADOW_MAX_ROWS = 5_000`; above it, count-only comparison with
`truncated: true` and empty id arrays.

**FM-8 — Under-provisioned DB / double load.** Pool is `connection_limit=10`;
shadow queries can starve real ones. *Mitigation:* `SHADOW_MAX_INFLIGHT = 2`,
latency breaker, prod start at sample **0.01** (lowered from 0.05 per SS-6), and a
pre-ramp QA gate that verifies the Neon-side pooler limit (§Performance).

**FM-9 — Postgres degraded 30 min.** Shadow queries each hold a pool slot for their
full timeout. *Mitigation:* 250ms timeout via `Promise.race`; breaker opens after 20
errors/60s with a 5-minute cooldown, so shadow self-disables within ~20 requests.

**FM-10 — Abuse spike, 100×.** *Mitigation:* the latency arm decays
`throttleFactor` to 0 before the app degrades; shadow adds no unauthenticated surface.

**FM-11 — Cost runaway.** Added read IOPS plus the new sink's writes.
*Mitigation:* bounded by `sample × scopedReadRate`; sink writes bounded by the
dedupe upsert and the 5 000 shapeHash/hour cap. Alert at +25% DB compute WoW;
response is `SCOPED_PRISMA_SHADOW_SAMPLE=0`, one restart.

**FM-12 — DPDP inquiry.** *Mitigation:* the answer is "row ids, counts, model names,
matched route templates, timestamps", provable by the D-6 key allowlist test asserted
on post-winston bytes (MS-8). Rev 1's version of this answer was **false**, because
an unpinned `routeHint` could carry `?q=Raju+Traders`. The 30-day retention and the
cleanup cron are now the erasure story for the new table.

**FM-13 — Insider abuse.** *Mitigation:* status endpoint is platform-admin-gated,
read-only, hashes `businessId` in responses, and writes an admin audit row. Full
values exist only in the DB and log, both access-controlled.

**FM-14 — Client-version lag.** No API contract, response shape, or status code
changes. Old clients unaffected by construction.

**FM-15 — Table bloat.** *Now live:* the divergence table is real. At the 5 000
shapeHash/hour cap the ceiling is ~3.6M rows before the 30-day cleanup, and realistic
volume is orders of magnitude lower thanks to the dedupe upsert. *Mitigation:* the
D-7 cleanup spec — daily cron, 30/180-day retention, indexed cleanup columns, hourly
write cap.

**FM-16 — The safety mechanism causes the silent death (new, MS-2).** `count` is
among the hottest ops on a billing dashboard and is in `READ_MERGE_OPS`. Sampling it
makes id extraction throw → `shadow-error` → at 20 errors/60s the breaker opens →
re-opens at 0.1 into the same storm → effectively latched. The harness stops
sampling, the report is clean, and the `shadow-error < 0.1%` criterion is blown by
design. *Mitigation:* D-3's explicit subtraction removes the cause; D-9's zero-sample
alert and canary catch a latched breaker from any *other* cause.

**FM-17 — The mount that satisfies the grep but opens no frame (new, MS-5).**
`app.use(scopedContext)` runs before router-level middleware, so `req.user` is
undefined, `scoped-context.ts:22` takes the `!user?.businessId` branch, and `next()`
is called with no frame — 100% `no-context`, shielded by a QA grep that passes.
*Mitigation:* G-2 wraps the frame around `next()` **inside `middleware/auth.ts`**,
the same function that sets `req.user`. One file covers all 138 route files and makes
the ordering bug structurally impossible. Note `auth` queries `prisma.user` before
the frame exists — benign, `User` is in `GLOBAL_ALLOWLIST`. AC-2 asserts across ≥20
routers, because one record proves one router.

**FM-18 — Skew and unstable windows exhaust triage's attention (new, MS-7).** A
steady drip of benign divergences makes the 72h-zero criterion unreachable, so it
gets relaxed; worse, triage learns divergences are usually noise, which is how the
one real leak gets waved through. *Mitigation:* D-5's separate kinds, classified
structurally, with both populations reported by count.

---

## API Contract

No tenant-facing API change. One internal operator endpoint (P1, G-11):

```ts
// GET /api/internal/scoped-shadow/status   (platform-admin only)
interface ScopedShadowStatusRes {
  success: true
  data: {
    mode: 'off' | 'shadow' | 'enforce'
    configuredSample: number
    effectiveSample: number
    breakerOpen: boolean
    rawSqlSitesUnaudited: true
    canaryLastSeenAt: string | null       // D-9 liveness
    includeBlindFraction: number          // SS-3
    windowCounts: {                       // from ScopedShadowStat, durable
      sampled: number
      diverged: number                    // excludes the two false-positive kinds
      unstableWindow: number
      skewSuspect: number
      noContextHttp: number               // gated at 0
      noContextJob: number                // backlog, not gated
      shadowError: number
      timedOut: number
      throttled: number
      unsupportedShape: number
    }
    recent: Array<Omit<ScopedShadowDivergence, 'subjectBusinessId'> & { businessIdHash: string }>
  }
}
// Error: { success: false, error: { code, message } }
// 401 unauthenticated · 403 non-platform-admin · 404 when mode !== 'shadow'
```

New env knobs (added to `env.ts` and to `render.yaml`):

| Var | Default | Meaning |
|---|---|---|
| `SCOPED_PRISMA_SHADOW_SAMPLE` | `1` (exists) | base rate 0..1 — **prod starts at `0.01`** |
| `SCOPED_PRISMA_SHADOW_TIMEOUT_MS` | `250` | per-shadow-query timeout |
| `SCOPED_PRISMA_SHADOW_MAX_INFLIGHT` | `2` | concurrent shadow-query cap |
| `SCOPED_PRISMA_SHADOW_CANARY_BUSINESS_ID` | unset | fixture tenant for D-9; canary disabled when unset |

---

## Data Model

**Two new models** (rev 2, MS-3): `ScopedShadowDivergence` and `ScopedShadowStat` —
full Prisma definitions, indexes, and the mandatory cleanup spec are in D-7. One
migration via `npx prisma migrate dev --name scoped_shadow_sink` (never `db push` —
blocked by pre-tool-gate). Both models are added to `GLOBAL_ALLOWLIST` in
`scoped-models.ts` with the reason `"platform observability — no tenant"`, or the
completeness test fails.

---

## File Plan

| # | Path | Action | Est. Lines | Layer | Notes |
|---|---|---|---|---|---|
| 1 | `server/src/lib/prisma-shadow.types.ts` | create | ~90 | types | rev-2 record shape incl. provenance/shapeHash/hasInclude |
| 2 | `server/src/lib/prisma-shadow.constants.ts` | create | ~70 | constants | `SHADOW_READ_OPS` as explicit subtraction (MS-2) |
| 3 | `server/src/lib/prisma-shadow.diff.ts` | create | ~140 | utils (pure) | id sets, symmetric diff, truncation |
| 4 | `server/src/lib/prisma-shadow.classify.ts` | create | ~120 | utils (pure) | `unstable-window` / `skew-suspect` classification (MS-7) |
| 5 | `server/src/lib/prisma-shadow.redact.ts` | create | ~100 | utils (pure) | record builder + key allowlist; PII wall (MS-8) |
| 6 | `server/src/lib/prisma-shadow.throttle.ts` | create | ~120 | utils | sampler, inflight, EWMA, breaker |
| 7 | `server/src/lib/prisma-shadow.sink.ts` | create | ~150 | transport | durable upsert + stat rollup on `__basePrismaUnsafe` (MS-3) |
| 8 | `server/src/lib/prisma-shadow.ts` | create | ~190 | service | `observe()` via `executePlan` + plan-kind guard (SS-2) |
| 9 | `server/src/lib/prisma-scoped.ts` | modify | ~+55 | transport | shadow branch first in `$allOperations`; `shouldShadow` here for `txSlot` (MS-1, SS-1) · **HIGH-RISK** |
| 10 | `server/src/lib/prisma.ts` | modify | ~+35 | transport | three-way: `shadow → clients.scoped` (MS-1) · **HIGH-RISK** |
| 11 | `server/src/lib/env.ts` | modify | ~+40 | constants | 3 new knobs + validation · **HIGH-RISK** |
| 12 | `server/prisma/schema.prisma` | modify | ~+45 | schema | 2 observability models (MS-3) · **HIGH-RISK (architect)** |
| 13 | `server/prisma/migrations/*_scoped_shadow_sink/` | create | ~40 | migration | `migrate dev`, never `db push` |
| 14 | `server/src/lib/scoped-models.ts` | modify | ~+4 | constants | 2 rows into `GLOBAL_ALLOWLIST` (completeness test) |
| 15 | `server/src/middleware/auth.ts` | modify | ~+25 | transport | open ALS frame + route slot around `next()` (MS-5, MS-8) |
| 16 | `server/src/middleware/scoped-context.ts` | modify | ~+15 | transport | keep as the explicit-frame helper; add route slot; document that `auth` is now the mount point |
| 17 | `server/src/jobs/shadow-retention.cron.ts` | create | ~90 | job | daily cleanup, 30/180-day retention (D-7) |
| 18 | `server/src/jobs/shadow-canary.cron.ts` | create | ~110 | job | 15-min positive control (D-9) |
| 19 | `server/src/routes/internal/scoped-shadow.routes.ts` | create | ~100 | route | admin-gated status endpoint |
| 20 | `docs/RUNBOOK_scoped-shadow.md` | create | ~180 | docs | triage tree, skew signature, the 3 SQL queries, ramp, kill switch |
| 21 | `docs/CONTINUATION_SITES_scoped-prisma.md` | create | ~80 | docs | G-14 enumeration + per-site strategy (SS-5) |
| 22 | `render.yaml` | modify | ~+12 | config | new env vars; **fix the stale "accumulated type errors" comment** (SS-7) |
| 23 | `server/src/lib/__tests__/prisma-shadow.diff.test.ts` | create | ~160 | test | diff, truncation, unsupported shape |
| 24 | `server/src/lib/__tests__/prisma-shadow.classify.test.ts` | create | ~150 | test | window/skew classification boundaries |
| 25 | `server/src/lib/__tests__/prisma-shadow.redact.test.ts` | create | ~160 | test | PII wall on **post-winston bytes**; `?q=Raju+Traders` route case |
| 26 | `server/src/lib/__tests__/prisma-shadow.throttle.test.ts` | create | ~150 | test | sampling, inflight, breaker, cooldown |
| 27 | `server/src/lib/__tests__/prisma-shadow.harness.test.ts` | create | ~230 | test | 4-point throw injection, write refusal, uncomparable-op refusal, tx refusal |
| 28 | `server/src/lib/__tests__/prisma-shadow.sink.test.ts` | create | ~140 | test | dedupe upsert, suppressedCount, hourly rollup |
| 29 | `server/src/__tests__/scoped-shadow.integration.test.ts` | create | ~200 | test | two-tenant divergence + canary against real Postgres |
| 30 | `server/src/middleware/__tests__/auth-scope-frame.test.ts` | create | ~140 | test | frame opens for every router shape; MS-5 ordering regression |

No row exceeds 250 lines. **SSOT:** `.claude/ssot-index.json` + `docs/SSOT.md` read;
no module provides query-level shadow diffing. Rows 1-8 register capability
`shadow-diff` in `ssot.config.mjs` with a `forbidden` regex on re-implemented id-set
diffing. Rows 9-16 `reuses:` the existing scoped-prisma modules — injector, merge,
rewrite, and `executePlan` are imported, never re-derived (SS-2).

---

## UI States

Server-only epic. Status endpoint states: **Loading** n/a (single DB read);
**Error** `{ success: false, error: { code: 'INTERNAL', message: 'Could not read shadow status' } }` 500;
**Empty** counters `0`, `recent: []`, copy `No shadow samples yet.`;
**Success** counters + recent rows; **Not enabled** 404
`{ code: 'SHADOW_DISABLED', message: 'Shadow mode is not enabled' }`. No inputs, so no
`autocomplete` attributes apply.

## Mobile

Not applicable — zero files under `src/` are touched, at any breakpoint.

## UX Copy

Operator-facing only: boot log
`Database connection initialized (scoped-prisma mode=shadow, client=scoped, shadow-sample=0.01)`;
divergence log `scoped-shadow-divergence`; breaker
`scoped-shadow throttled: circuit open (errors=%d, cooldown=300s)` /
`scoped-shadow resumed: circuit closed`; canary alert
`scoped-shadow canary MISSING for %d minutes — harness may be dead`.

---

## Edge Cases

| Scenario | Handling |
|---|---|
| No ALS frame | `no-context`, split `http` (gated 0) / `job` (backlog) |
| Inside `runUnscoped` | Skipped — sanctioned window |
| Inside `runReentry` | Skipped — extension-internal |
| Inside `scopedTransaction` | Skipped (FM-4) |
| Write operation | Passthrough, no second execution, no record |
| `count` / `aggregate` / `groupBy` | Not sampled at all (D-3) — zero queries, zero records |
| Non-tenant model | Passthrough |
| `select` omits `id` | `unsupported-shape`, dropped, counted |
| `take`/`skip`/`cursor` present | `unstable-window`, counted, not gated |
| Small directional diff on a hot write path | `skew-suspect`, counted, not gated |
| Rows > 5 000 | Count-only, `truncated: true` |
| Shadow throws (any of 4 points) | Caught, counted, caller unaffected (AC-4) |
| Shadow > 250ms | Abandoned via `Promise.race`, counted |
| Real query throws | Shadow never runs; caller's error propagates unchanged |
| ≥20 shadow errors/60s | Breaker opens 5 min; canary + zero-sample alert catch a latch |
| Sample `0` | Zero shadow queries; zero-sample alert fires (intended) |
| Sink write fails | Swallowed + counted; never blocks the request |
| >5 000 distinct shapes/hour | Only `ScopedShadowStat` increments; counters never stop |
| `include`d children | Not compared; `hasInclude` recorded (FM-6) |
| Lost-frame continuation | `provenance: 'job'` — known limitation, stated in D-8 |
| `$queryRaw` | Invisible (FM-5) |
| Cold start / redeploy | Durable sink survives; in-process counters are derived, not authoritative |

---

## Security

- **Auth:** platform-admin (`lib/admin-auth.ts`) on the status endpoint only.
- **Rate limit / lockout:** 30 req/min per admin (existing limiter). No new credential
  is introduced; the platform-admin session's existing failed-login lockout policy
  applies unchanged.
- **IDOR:** endpoint takes no id input and returns process-global aggregates;
  `businessId` hashed (`sha256(...).slice(0,12)`) in responses.
- **CSRF:** GET-only; existing middleware on the admin router unchanged.
- **Audit log:** every status-endpoint hit writes an admin audit row.
- **PII:** D-6 allowlist, asserted on post-winston bytes and on the DB row (AC-6).
- **New attack surface:** the sink is a write path reachable from any request.
  Bounded by the dedupe upsert, the hourly shape cap, and fire-and-forget semantics;
  it writes on `__basePrismaUnsafe` and can never re-enter the extension.
- **Blast radius:** the caller's value is bound before harness code runs (D-2).

---

## Observability

Five metrics (≤7): `scoped_shadow.sampled {model, operation}` ·
`scoped_shadow.diverged {model, operation, kind}` ·
`scoped_shadow.no_context {provenance, routeHint}` ·
`scoped_shadow.error {model, operation, errorName, timedOut}` ·
`scoped_shadow.throttled {reason}`. No metric carries `businessId` as a label.

**Required alerts (MUST_SHIP):**
1. `canaryLastSeenAt` older than 45 min while mode is `shadow` → page (D-9).
2. `ScopedShadowStat` kind `sampled` = 0 for any hour bucket while mode is `shadow` → page.
3. First 48h: any `kind='diverged'` → notify. After 48h: >50/5min → notify.
4. `shadow-error` > 100/5min → notify.
5. DB compute or read IOPS +25% WoW → page (cost).

Dashboards: sampled/min, divergence rate by kind, HTTP vs job `no-context`, breaker
state, canary freshness, p95 on the top-5 scoped read endpoints (before/after).

---

## Performance budget

- **Ceiling:** at most one extra DB read per sampled row-returning read (the unscoped
  side reuses the real promise), plus at most one bounded sink upsert per distinct
  divergence shape per hour.
- **p95:** ≤ +10% on the top-5 scoped read endpoints vs the 24h pre-deploy baseline;
  hard ceiling +20%.
- **Pool:** ≤2 of the 10 pool connections at any instant.
- **Self-throttle:** 30s sliding window. EWMA p95 > 400ms → `throttleFactor ×= 0.5`
  (floor 0.01 → 0); < 250ms for two consecutive windows → `×= 2` (cap 1); ≥20
  errors/timeouts in 60s → breaker opens, factor 0, 5-min cooldown, reopen at 0.1.
- **SS-6 partial adoption:** prod starts at **0.01** (not 0.05), and a **pre-ramp QA
  gate** requires the Neon pooler's connection limit to be read from the dashboard and
  recorded in the runbook before any ramp step. A dedicated shadow Prisma
  client/pool — the auditor's preferred fix — is **declined for this epic**: a second
  client doubles Neon connection consumption on a free-tier instance whose pooler
  limit is currently unverified, which is a worse and less reversible failure than
  in-pool starvation that the inflight cap already bounds. Revisit if the pre-ramp
  reading shows headroom.
- **If exceeded:** `SCOPED_PRISMA_SHADOW_SAMPLE=0.001`, then
  `SCOPED_PRISMA_ENFORCE=off`. Env change + restart, no deploy.

---

## Test Infrastructure

1. **Unit (23-28) — no DB.** Diff, classify, redact, throttle, and sink-shape modules
   are pure functions over fixtures; a divergence is asserted by handing the diff
   module `unscoped=[{id:'a'},{id:'b'}]`, `scoped=[{id:'a'}]` and expecting
   `onlyUnscoped:['b']`. The harness test (27) uses a spy `Delegate` to prove: writes
   never call it, uncomparable ops never call it, a `txSlot`-set context never calls
   it, and a throw injected at **each of the four points** in D-2 leaves the caller's
   value untouched.
2. **PII (25)** asserts on the bytes emitted by the winston format chain (a memory
   transport capturing post-`piiMaskFormat` output), not on the record object — plus
   a case where the request was `GET /api/parties?q=Raju+Traders` and the record's
   `routeHint` is `GET /api/parties`, containing neither fixture string.
3. **Frame (30)** mounts a miniature app for each router shape in use and asserts the
   ALS frame is open inside the handler — the MS-5/FM-17 regression test.
4. **Integration (29) — one real Postgres, two tenants.** Seeds businesses A and B,
   opens a frame for A, issues a deliberately-unscoped `findMany`, and asserts exactly
   one `kind:'diverged'` row in `ScopedShadowDivergence` with B's ids in
   `onlyUnscoped`. A second case asserts the canary produces its row and that
   disabling the harness makes the canary alert fire.
5. **Suite-wide:** CI runs the server suite a second time with
   `SCOPED_PRISMA_ENFORCE=shadow SCOPED_PRISMA_SHADOW_SAMPLE=1` and asserts the same
   1269 passes — proof that shadow changes no behaviour, now meaningful because the
   scoped client is actually on the path (MS-1).
6. No external provider and no money is involved, so no reserved test numbers or
   sandbox keys are needed. The only shared resource is the CI Postgres, already
   provisioned by `server/src/__tests__/integration/setup.ts`.

---

## Rollout

1. Merge with `SCOPED_PRISMA_ENFORCE` unset (`off`) — `prisma` still resolves to
   `clients.softDeleted`, harness inert, migration applied but unused.
2. Staging: `shadow`, sample `1`. Run the full manual journey. Confirm the canary
   appears, `sampled` is non-zero, and HTTP-path `no-context` is 0. Triage everything
   else.
3. **Pre-ramp gate:** record the Neon pooler connection limit in the runbook (SS-6).
4. Production: `shadow`, `SCOPED_PRISMA_SHADOW_SAMPLE=0.01`. Watch latency 24h.
5. Ramp `0.01 → 0.05 → 0.25 → 1.0`, ≥24h per step, only while p95 stays within +10%.
6. **Watch 7 days at sample ≥ 0.25.** Exit criteria for the `enforce` epic — all must
   hold, computed from the durable sink with the D-8 queries:
   - **volume floor met:** `sampled ≥ 50 000` over `≥ 20` distinct scoped models,
     covering the top-20 read endpoints (D-9);
   - **canary present** in every 45-minute window of the watch;
   - `kind='diverged'` (excluding `unstable-window` and `skew-suspect`) = **0 for 72
     consecutive hours**, with both excluded populations reported by count;
   - every divergence observed during the window classified as *missing service
     filter* (fixed) or *legitimately global* (passthrough list);
   - `no-context` with `provenance='http'` = **0**;
   - `no-context` with `provenance='job'` — a written backlog handed to the `enforce`
     epic, no threshold;
   - `shadow-error` < 0.1% of `sampled`.
7. Flipping to `enforce` is a **separate epic**, not authorised by this document.

**Kill switch:** `SCOPED_PRISMA_ENFORCE=off` + restart — returns `prisma` to
`clients.softDeleted`. The migration stays (inert tables); the cleanup cron drains
them. No data to reverse.

---

## Accepted Trade-offs

| Decision | Reason |
|---|---|
| Under `shadow` the scoping extension is load-bearing on the live path | The only alternative observes nothing (MS-1). Bought down by D-2's structure + AC-4's 4-point throw injection, not by avoidance. |
| A migration is on the critical path | Rev 1's log+ring sink cannot survive a free-tier cold start, making every exit criterion uncomputable (MS-3). Priced honestly rather than avoided. |
| Reads only; writes never shadowed | Double-executing writes is destructive (FM-1). |
| `count`/`aggregate`/`groupBy` not sampled | No comparator exists; sampling them latches the breaker (FM-16). Widening requires G-15. |
| Promise reuse (control always first) | Halves added load and does not mask real divergences; the cost is directional skew, classified out via `skew-suspect` (MS-7). |
| No shadow inside transactions | Would risk rolling back real work (FM-4). Currently moot. |
| Top-level ids only, not nested `include`s | Needs a schema-aware walk; disproportionate here. Now *measured* via `hasInclude` (SS-3). |
| Shared connection pool, sample starts at 0.01 | A dedicated client doubles Neon connections on free tier with an unverified pooler limit (SS-6, partial adoption). |
| Lost-frame continuations bucket as `job` | `routeHint` shares the ALS frame; the gate is scoped to what it can actually prove (D-8), with G-14 closing the list. |
| Raw SQL not covered | Structurally impossible for an `$extends` harness (FM-5). |

---

## Resolved Decisions

| # | Decision | Rationale |
|---|---|---|
| RD-1 | Shadow returns the unscoped result | Definition of observation-only. |
| RD-2 | Harness is the first statement in `$allOperations` | Only place with model+operation+args; first position guarantees `real` is bound before harness code. |
| RD-3 | **(rewritten, MS-1)** Under `shadow`, `prisma` = `clients.scoped` | Rev 1 kept it on `softDeleted`, which made the harness dead code — a silent no-op producing a fabricated safety signal. The legitimate concern behind rev 1's RD-3 (shadow makes the extension load-bearing) is real and has no zero-cost resolution; it is answered by D-2's structure and AC-4, not by disconnecting the harness. |
| RD-4 | Open the frame inside `auth`, not via `app.use` | App-level middleware runs before `req.user` exists (FM-17). One file covers 138 route files. |
| RD-5 | Row ids, never row contents | Divergent rows belong to other tenants. |
| RD-6 | Fail open, silently, with a counter | A harness bug must never become an incident. |
| RD-7 | Self-throttle = inflight cap + latency EWMA + error breaker | Measurable in-process without external metrics. |
| RD-8 | **(reversed, MS-3)** Durable Postgres sink, not log+ring | No aggregator exists; free-tier FS is ephemeral and cold-starts daily. |
| RD-9 | `SHADOW_READ_OPS` by explicit subtraction | A set union asserts coverage, not comparability (learnings gap class 3). |
| RD-10 | Provenance split, HTTP-path gated at 0 | A single relaxable rate is a rubber stamp (MS-4). |
| RD-11 | Positive control is MUST_SHIP | Every harness failure converges on the same output as success (MS-6). |
| RD-12 | False-positive classes get their own `kind` | Scientist's `ignore`-block pattern: exclude structurally, keep the remaining threshold at zero (MS-7). |
| RD-13 | `routeHint` = matched route template only | Standard APM practice; `originalUrl` carries the exact PII the test fixtures use (MS-8). |
| RD-14 | `shouldShadow()` stays in `prisma-scoped.ts` | Avoids exporting `txSlot` from a trust anchor (SS-1). |
| RD-15 | Shadow side calls `executePlan` | Validates the path `enforce` will run, not a parallel one (SS-2). |

---

## Out of Scope

- Flipping to `enforce` and its 48h watch. `[FUTURE_EPIC]`
- Migrating the 186 services. `[FUTURE_EPIC]`
- Auditing the 178 raw-SQL occurrences. `[FUTURE_EPIC]`
- Adopting `runUnscoped` at cron/webhook/auth sites (this epic produces the list). `[FUTURE_EPIC]`
- Nested-relation divergence detection. `[FUTURE_EPIC]`
- Shadow inside interactive transactions. `[FUTURE_EPIC]`
- Scalar comparator for `count`/`aggregate`/`groupBy`. `[NICE_TO_HAVE]` (G-15)
- A dedicated shadow connection pool. `[FUTURE_EPIC]` (revisit post pre-ramp reading)
- Any client/UI/mobile work. `[FUTURE_EPIC]`

---

## Acceptance Criteria

- [ ] **AC-1** With `shadow`, each of **20 fixture reads** covering the top-20 read
      endpoints returns a result deep-equal to the same read under `off`.
- [ ] **AC-2** Live requests produce records with non-null `businessId` originating
      from **≥20 distinct routers** covering the top-20 read endpoints (MS-5).
- [ ] **AC-3** A deliberately-unscoped `findMany` in a two-tenant fixture writes
      exactly one `kind='diverged'` row whose `onlyUnscoped` holds the other tenant's ids.
- [ ] **AC-4** A throw injected at **each** of the four harness points (shouldShadow,
      observe entry, plan build, scoped execution) leaves the response body correct
      and increments `scoped_shadow.error` (MS-1).
- [ ] **AC-5** Zero shadow invocations for every write op against a spy client.
- [ ] **AC-6** No PII in the **post-winston serialized bytes** and in the persisted DB
      row, for a fixture containing `9876543210` / `Raju Traders`, including a request
      to `GET /api/parties?q=Raju+Traders`; record key set equals the D-6 allowlist (MS-8).
- [ ] **AC-7** Server suite green with `shadow` + sample `1` (≥1269 pass, 0 fail);
      client suite unaffected (1409).
- [ ] **AC-8** `npx tsc -b --noEmit` exits 0; `node scripts/enforce.js` no new errors;
      `npm run ssot` exit 0. (The `render.yaml` "accumulated type errors" comment is
      stale and is corrected in File Plan #22 — AC-8 must not be read against it.)
- [ ] **AC-9** Inside `scopedTransaction`, zero shadow queries are issued.
- [ ] **AC-10** With sample `0`, zero extra queries over 100 reads — and the
      zero-sample alert fires.
- [ ] **AC-11** 20 induced errors in 60s opens the breaker; no shadow queries during
      cooldown; the canary alert fires while it stays latched (MS-6).
- [ ] **AC-12** `curl GET /api/internal/scoped-shadow/status` → 200 as platform-admin,
      401 unauthenticated, 403 as a normal user, 404 when mode is `off`.
- [ ] **AC-13** Kill switch: under `off`, the SQL emitted via `base.$on('query')` for
      the 20 fixture reads is byte-identical to the same capture on pre-epic HEAD (SS-7).
- [ ] **AC-14** A `count` on a scoped model issues zero shadow queries and produces
      zero records of any kind (MS-2).
- [ ] **AC-15** Divergence rows survive a process restart, and `ScopedShadowStat`
      counters are monotonic across it (MS-3).
- [ ] **AC-16** The retention cron deletes rows older than 30 days and leaves newer
      ones; `ScopedShadowStat` retained 180 days.
- [ ] **AC-17** A `findMany` carrying `take`/`cursor` that diverges is recorded as
      `unstable-window`, not `diverged`, and is excluded from the gated count (MS-7).
- [ ] **AC-18** The canary produces a `kind='canary'` row every 15 min; with the
      harness disabled, its absence pages within 45 min (MS-6).

---

## QA Checklist

- [ ] Both suites run twice (`off`, `shadow`) — pass counts identical
- [ ] `tsc -b --noEmit` output pasted, exit 0
- [ ] curl transcripts for AC-12's four cases
- [ ] A persisted `ScopedShadowDivergence` row pasted, confirming no row contents and
      a template-only `routeHint`
- [ ] Post-winston byte capture from the PII test pasted (not the record object)
- [ ] Evidence the ALS frame opens for ≥20 distinct routers (AC-2), not a grep
- [ ] Spy-client output proving zero write-path and zero `count` shadow calls
- [ ] Migration applied via `prisma migrate dev` (never `db push`); `migrate status` clean
- [ ] Retention cron exercised against seeded old rows
- [ ] Canary row visible in staging; alert fires when the harness is disabled
- [ ] Neon pooler connection limit read from the dashboard and recorded in the runbook
      **before** any ramp step (SS-6)
- [ ] Latency table: p95 top-5 scoped read endpoints, before vs after, at sample 1.0
      in staging — within +10%
- [ ] Kill switch exercised on staging, with the AC-13 SQL diff
- [ ] `docs/RUNBOOK_scoped-shadow.md` and `docs/CONTINUATION_SITES_scoped-prisma.md` exist
- [ ] `render.yaml` stale type-errors comment corrected
- [ ] `.claude/design-plan-active.md` shows `architect, security` with live artifact
      paths (File Plan #9-#13 are high-risk trust anchors, incl. schema)

---

## Revision Log

**rev 3 — 2026-07-21** · closes MR-1, the sole rev-2 blocker. Applied by the
epic orchestrator rather than a scope-writer loop: the auditor prescribed the
exact fix and the precedent already existed, so there was no design judgment
left to make. `ScopedShadowDivergence.businessId` → `subjectBusinessId` in the
Prisma model, the TS record interface, and the admin-endpoint `Omit<>`
projection. Verified before applying: `scoped-models.ts:19-23` does derive
`SCOPED_MODELS` from DMMF by `businessId` scalar presence, and
`UnscopedAccessLog.subjectBusinessId` (`schema.prisma:4635`) is the precedent.

**rev 2 — 2026-07-21** · audit: `docs/SCOPE_AUDIT_scoped-prisma-shadow.md` (BLOCK).

Gaps closed:

| ID | Change |
|---|---|
| MS-1 | RD-3 rewritten: `shadow → clients.scoped` (D-1). Harness moved to first statement in `$allOperations` with `real` bound before any harness code (D-2). File Plan #10 updated; AC-4 now injects a throw at each of four points. |
| MS-2 | `SHADOW_READ_OPS` is an explicit **subtraction** of `count`/`aggregate`/`groupBy` with a comment naming why (D-3). New FM-16 documents the latched-breaker storm. AC-14 added. |
| MS-3 | Durable Postgres sink: 2 models, migration, indexes, dedupe upsert, hourly stat rollups, 30/180-day retention cron (D-7). Trade-off owned in §Accepted Trade-offs. File Plan #12, #13, #14, #17. AC-15, AC-16 added. |
| MS-4 | `provenance` split; HTTP-path `no-context` gated at **0**; job-path is a counted backlog. Three exact SQL queries given (D-8). |
| MS-5 | Frame opens inside `middleware/auth.ts` (File Plan #15), not `app.use`. New FM-17. AC-2 strengthened to ≥20 routers. Test row #30 added. *Correction: the export is `auth`, not `authenticate`.* |
| MS-6 | Positive control (D-9): 15-min canary cron (#18), zero-sample alert, volume floor in the exit criteria. AC-11, AC-18. |
| MS-7 | `unstable-window` and `skew-suspect` kinds; `hasBoundedWindow` + `observationIntervalMs` recorded; exit criterion restated over `diverged` excluding both, both reported by count; runbook teaches the directional signature. New FM-18. AC-17. |
| MS-8 | `routeHint` pinned to `${req.method} ${req.route.path}`; `originalUrl`/`params`/`query` added to the prohibited list; route slot added in #15/#16; AC-6 moved to post-winston bytes + a `?q=Raju+Traders` case. |
| SS-1 | `shouldShadow()` stays inside `prisma-scoped.ts`; `txSlot` not exported (RD-14). |
| SS-2 | Shadow side calls `executePlan` with a plan-kind guard (D-4, RD-15). |
| SS-3 | `hasInclude` added to the record, the endpoint payload (`includeBlindFraction`), and the report header. |
| SS-4 | Dedupe keyed on `shapeHash` with `suppressedCount`, not `(model, operation, routeHint)`. |
| SS-5 | G-14 + File Plan #21 enumerate continuation sites; D-8 states the resulting limitation on the gate honestly. |
| SS-7 | AC-1 given fixture breadth (20 endpoints); AC-13 given a mechanism (`base.$on('query')` SQL diff vs pre-epic HEAD); stale `render.yaml` comment fixed in #22 and called out in AC-8. |

Gaps partially declined, with reason:

| ID | Position |
|---|---|
| SS-6 | **Partial.** Adopted: prod starts at `0.01`, plus a pre-ramp gate requiring the Neon pooler limit to be read and recorded. Declined for this epic: a dedicated shadow Prisma client/pool — a second client doubles Neon connection consumption on a free-tier instance whose pooler limit is unverified, a worse and less reversible failure than the in-pool starvation the inflight cap already bounds. Listed in §Out of Scope for revisit after the pre-ramp reading. |

Auditor rulings accepted without change: keep promise reuse (Q1); ring buffer
replaced (Q2). The four future-epic recommendations are unchanged, except that
"durable divergence history" has moved onto this epic's critical path per MS-3.
