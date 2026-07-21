---
audit_of: SCOPE_scoped-prisma-shadow.md
auditor: scope-auditor
audited_at: 2026-07-21T05:16:35Z
reaudited_at: 2026-07-21T11:04:00Z
scope_rev_audited: 2
verdict: BLOCK
must_ship_gaps: 1
should_ship_gaps: 4
future_epic_recommendations: 4
rev1_must_ship_closed: 8
rev1_verdict: BLOCK (8 MUST_SHIP / 7 SHOULD_SHIP)
note: >-
  Rev-1 findings below are retained for the record. The binding verdict is the
  Rev-2 section at the end of this file. All eight rev-1 MUST_SHIP gaps are
  closed; one new MUST_SHIP (MR-1) was introduced by the MS-3 fix.
---

# SCOPE Audit — `scoped-prisma-shadow`

## Verdict

**BLOCK.** Eight MUST_SHIP gaps.

The headline finding is not a missing edge case — it is that **the harness as
specified cannot execute.** RD-2 places the shadow branch inside
`createScopingExtension`; RD-3 (restated by File Plan row #9) keeps the exported
`prisma` bound to `clients.softDeleted` under `shadow`. The scoping extension is
attached only to `clients.scoped`. Those two decisions are mutually exclusive, so
`$allOperations` is never in the call path for application traffic under `shadow`.
The epic would ship, pass all 1269 tests, pass CI, and produce "7 days, zero
divergences" — the exact false green light this SCOPE was written to prevent
(FM-2's own thesis, applied one level up).

Three further gaps (MS-2, MS-3, MS-6) each independently produce that same silent
no-op. The SCOPE defends against the deploy-time instance of this failure (AC-2)
and against nothing after that.

Everything below was verified against the code, not inferred from the SCOPE.

---

## Must-ship gaps (epic blocked until addressed)

### MS-1: RD-2 and RD-3 are mutually exclusive — the harness never runs

- **What's missing:** A coherent answer to "which client does `prisma` resolve to
  under `shadow`?"
  - `prisma.ts:110-111` — `prisma` is `clients.softDeleted` unless mode is `enforce`.
  - `prisma.ts:69-72` — `createScopingExtension` is attached only to `clients.scoped`.
  - The only other `clients.scoped` consumer is `scopedTransaction`, which has
    **zero production call sites** (verified: `grep -rn scopedTransaction server/src`
    returns `lib/prisma.ts` and `__tests__/setup.ts` only).

  So under `shadow`, `$allOperations` — where D-2/RD-2 put the harness — is dead
  code for all app traffic. RD-3 and File Plan row #9 ("`prisma` still resolves to
  unscoped under `shadow`") bake this in.
- **Failure mode:** Silent no-op. Ships green, watches for 7 days, reports zero
  divergences, and hands the `enforce` epic a fabricated safety signal. This is the
  single worst outcome the SCOPE names (FM-2), reached by a path FM-2 doesn't cover.
- **Industry pattern:** GitHub Scientist requires the experiment wrapper to sit on
  the *live* code path; the control is `use {}`, the candidate is `try {}`, and both
  are inside the same invocation. Envoy's `request_mirror_policies` likewise attach
  to the live route, not a parallel one. There is no shadow architecture in which the
  observed path is bypassed.
- **Recommended fix:** Under `shadow`, export `clients.scoped`. Make the shadow
  branch the **first** statement in `$allOperations`, structured so `q(args)` is
  evaluated before any harness code can throw, and every subsequent line is
  unreachable from the return value. Rewrite RD-3 to state plainly that shadow makes
  the extension load-bearing, and add the compensating controls: an outer
  `try/catch` returning `q(args)` on any harness failure, plus an AC that injects a
  throw at each point in the shadow branch and asserts the caller still gets the
  correct body. Do not delete RD-3's concern — it is legitimate; it just has no
  no-cost resolution.
- **Severity:** MUST_SHIP

### MS-2: `count` / `aggregate` / `groupBy` are in the op allowlist with no comparison strategy — guaranteed error storm

- **What's missing:** Exclusion of scalar-returning reads, or a comparison for them.
  D-1 defines `SHADOW_READ_OPS = READ_MERGE_OPS ∪ FIND_UNIQUE_OPS`. Verified
  `prisma-scoped.rewrite.ts:10-18`, `READ_MERGE_OPS` contains `count`, `aggregate`,
  and `groupBy`. D-4 defines only id-set comparison. Scalar comparison is G-11,
  tiered `[NICE_TO_HAVE]` / P2.
- **Failure mode:** `count` returns a `number`; id extraction against it throws →
  `kind: 'shadow-error'`. On a billing dashboard `count` is among the hottest
  operations. At the FM-9 threshold (≥20 errors/60s) the breaker opens, sets
  `throttleFactor = 0`, and re-opens at 0.1 into the same storm — the breaker sits
  effectively latched, the harness stops sampling, and the `shadow-error < 0.1%`
  exit criterion is blown by design. Second silent no-op, this one self-inflicted by
  the safety mechanism.
- **Industry pattern:** Scientist requires a `comparator` per experiment and refuses
  to publish a mismatch it cannot compare; it does not run experiments it cannot
  evaluate. Running a candidate whose result you have no way to compare is pure cost.
- **Recommended fix:** `SHADOW_READ_OPS = (READ_MERGE_OPS \ {count, aggregate,
  groupBy}) ∪ FIND_UNIQUE_OPS` as the MUST_SHIP baseline, **or** promote G-11 to
  MUST_SHIP with an explicit scalar comparator. Either way the constant must be
  written as an explicit subtraction with a comment naming why, so a future
  contributor widening it hits the same wall FM-1 built for writes. Add an AC:
  a `count` on a scoped model issues zero shadow queries (or produces a `kind`
  that is not `shadow-error`).
- **Severity:** MUST_SHIP

### MS-3: There is no durable sink — the 7-day watch and every exit criterion are uncomputable

- **What's missing:** A sink that survives a restart. D-6 asserts "Retention is
  whatever the log aggregator already enforces." There is no aggregator.
  - `server/src/lib/logger.ts:84-97` — production adds two winston **File**
    transports, `maxsize: 5242880`, `maxFiles: 5`. That is a **25 MB rotating ring
    shared with all other application logging**, not a retention policy.
  - `render.yaml` — `plan: free`. Render's free tier has an ephemeral filesystem
    (wiped on every deploy) and **spins down after idle**, cold-starting on the next
    request. `autoDeploy: true` on push compounds it.

  So the ring buffer, the counters, *and* the log files are all destroyed multiple
  times per day.
- **Failure mode:** Every §Rollout step-5 exit criterion is a **rate over a 7-day
  window** ("zero unexplained diverged for 72 consecutive hours", "`no-context` rate
  < 5%", "`shadow-error` rate < 0.1%") computed from in-process counters that reset
  on cold start. The epic cannot produce the evidence its own gate demands. The
  realistic outcome is that someone eyeballs a partial log tail and declares it
  clean.
- **Industry pattern:** Scientist's entire mismatch story is the `publish` hook into
  a durable store (GitHub used Redis/Graphite) precisely because in-process results
  are worthless across deploys. Datadog/CloudWatch Synthetics likewise externalize.
- **Recommended fix:** Pick one and add it to the File Plan as MUST_SHIP:
  (a) an external log drain with verified ≥14-day retention, wired and **proven
  receiving before the watch starts** (add a QA row); or (b) a durable divergence
  table — which then drags in FM-15's real cleanup spec, a migration, and the
  high-risk schema gate, and should be priced honestly rather than avoided. Counters
  must be monotonic and externally scraped either way. Until this is resolved, the
  "no schema migration" trade-off in §Accepted Trade-offs is not a trade-off, it is
  the thing that makes the epic unverifiable.
- **Severity:** MUST_SHIP

### MS-4: `no-context rate < 5%` is not measurable as written, and `runUnscoped` has zero adopters

- **What's missing:** Three things.
  1. **The denominator doesn't exist.** The harness samples *queries*; the criterion
     is a fraction of *"sampled authenticated requests."* Nothing in the design
     tracks requests, or distinguishes authenticated from unauthenticated.
  2. **`runUnscoped` has zero production call sites.** Verified: `grep -rn
     runUnscoped server/src` returns only doc comments in `scoped-context.ts:11` and
     `prisma.ts:13,74`. FM-3 claims `business-context.ts` "already reserves"
     `cron.${string}` / `webhook.provider` / `auth.login-by-phone` — reserving a
     union member is not adoption. D-7 rule 3 (`skip when getUnscopedReason()` is
     set) therefore never fires, and **100%** of cron, webhook, and pre-business auth
     scoped queries land as `no-context`.
  3. **5% is arbitrary.** No baseline measurement is cited. The true rate is a
     function of the app's job-to-request traffic mix, which nobody has measured.
- **Failure mode:** The FM-2 anti-false-green gate is the load-bearing protection in
  this entire epic, and it is stated in units that cannot be computed. The predictable
  resolution under deadline pressure is "the number came out at 22%, cron explains
  it, let's move the threshold" — which converts the gate into a rubber stamp.
- **Industry pattern:** Scientist's `ignore` blocks exist exactly so known-benign
  mismatch classes are excluded *structurally* rather than by relaxing a global
  threshold — the threshold on the remaining population stays at zero.
- **Recommended fix:** Split the metric by provenance: `routeHint !== null` (HTTP
  request path) vs `routeHint === null` (job / cron / continuation path). Gate:
  **`no-context` on the HTTP path must be 0** for the watch window — that is the
  criterion that actually proves `scopedContext` is mounted and ordered correctly.
  Job-path `no-context` becomes a triage backlog with a count, not a threshold.
  State the exact command/query that produces each number.
- **Severity:** MUST_SHIP

### MS-5: Mounting `scopedContext` is not a 6-line `app.ts` change, and the obvious implementation re-creates FM-2

- **What's missing:** An accurate account of where the seam is. Verified:
  - `app.ts` mounts no global `authenticate`. Global middleware ends at
    `conflictDetection` (line 107); everything else goes through
    `mountFeatureRoutes(app)` (line 138).
  - `authenticate` is applied per-router/per-route across **26 sites** in
    `server/src/routes/`.
  - Express runs `app.use(...)` middleware **before** router-level middleware.

  So `app.use(scopedContext)` at the app level executes while `req.user` is still
  undefined. `scoped-context.ts:21-24` then takes the `!user?.businessId` branch and
  calls `next()` **with no frame opened**.
- **Failure mode:** 100% `no-context` — precisely the failure G-2 exists to prevent —
  now shielded by a QA checklist item ("grep proof that `scopedContext` is mounted in
  `app.ts` after `authenticate`") that would pass on a mount that does nothing. The
  grep is satisfiable; the semantics are not. File Plan row #11's `~+6` lines is off
  by an order of magnitude.
- **Industry pattern:** Rails' `ActiveSupport::CurrentAttributes` and Django's
  request-local tenant middleware both bind the tenant frame at the *authentication*
  boundary, not at the app boundary, for this reason.
- **Recommended fix:** Wrap `authenticate` itself so the ALS frame opens in the same
  function that populates `req.user` — one file, covers all 26 sites, and makes the
  ordering bug structurally impossible instead of review-dependent. (Alternative:
  enumerate all 26 routers in the File Plan and price it honestly.) Strengthen AC-2
  from "at least one shadow record with non-null businessId" to "non-null
  `businessId` on reads originating from ≥N distinct routers covering the top-20
  read endpoints" — one record proves one router.
- **Severity:** MUST_SHIP

### MS-6: No positive control — "ran and found nothing" is indistinguishable from "never ran"

- **What's missing:** Any continuous liveness proof. AC-2 checks the harness works
  **once, at deploy time.** Nothing defends the following 7 days. All of these
  produce a clean report:
  - the breaker latched open (MS-2 makes this likely),
  - `throttleFactor` decayed to 0 by the latency arm and never recovering,
  - `SCOPED_PRISMA_SHADOW_SAMPLE` missing after a redeploy (`sync: false` env vars on
    Render are set by hand in the dashboard),
  - a cold start resetting counters (MS-3),
  - MS-1 or MS-2.

  There is no alert on `sampled == 0`, no minimum-volume floor in the exit criteria,
  and no canary.
- **Failure mode:** The false green light, six months in, at the moment of maximum
  consequence — the `enforce` flip.
- **Industry pattern:** This is exactly what synthetic canaries are for (AWS
  CloudWatch Synthetics, Datadog Synthetic Monitoring): a deliberately-failing probe
  on a schedule whose *absence* from the sink pages someone. Netflix's chaos tooling
  applies the same rule — an observability pipeline with no self-test is assumed
  dead.
- **Recommended fix:** Three additions, all MUST_SHIP:
  (a) a scheduled canary that issues a deliberately divergent read against a seeded
  fixture tenant and **must** appear in the sink; non-appearance pages;
  (b) exit criteria gain a volume floor — the watch window only counts if
  `sampled ≥ N` across `≥ M` distinct scoped models and the top-20 read endpoints;
  (c) an alert on `sampled/min == 0 while mode == shadow`.
  Add an AC: with the harness deliberately disabled, the canary alert fires.
- **Severity:** MUST_SHIP

### MS-7: An unclassified false-divergence floor makes the 72h-zero criterion unreachable

- **What's missing:** Recognition that two divergence sources have nothing to do with
  tenant isolation.
  1. **Systematic time skew.** Per D-2 the scoped side runs *after* the real promise
     resolves. Any row inserted, updated, or soft-deleted in that interval diverges.
     Because the control is **always first** and the candidate **always second**, the
     bias is directional: concurrent inserts surface as `onlyScoped`, concurrent
     deletes as `onlyUnscoped`. On hot list endpoints this is a steady drip, not a
     rarity.
  2. **Unstable result windows.** This project uses cursor pagination (CLAUDE.md).
     A `findMany` with `take`/`skip`/`cursor` and an `orderBy` containing ties
     returns a different N-subset per execution. Two separate executions → different
     subsets → non-empty symmetric difference with an *identical* predicate.

  Neither is a leak. Both are indistinguishable from one in the record shape as
  specified.
- **Failure mode:** Two compounding harms. (i) "Zero unexplained `diverged` records
  for 72 consecutive hours" becomes unreachable, so it gets relaxed — the strictest
  exit criterion is the first casualty. (ii) Worse, triage learns that divergences
  are usually noise, which is the mechanism by which the one real divergence gets
  waved through.
- **Industry pattern:** GitHub Scientist randomizes control/candidate execution
  order specifically to prevent directional skew bias, and provides `ignore` blocks
  so known-benign mismatch classes never reach the mismatch stream. This SCOPE has
  neither, and — because it reuses the real promise (the author's flagged trade-off
  #1) — it *cannot* randomize order.
- **Recommended fix:** Keep the promise-reuse optimization; it does not mask real
  divergences (a missing filter diverges regardless of ordering) and the load saving
  is real. But own the false-positive class explicitly:
  - record `take` / `skip` / `cursor` presence, and route bounded-window reads to a
    distinct kind (`unstable-window`) rather than `diverged`;
  - state the observation interval and classify divergences of size ≤ concurrent
    write rate × interval as `skew-suspect`, a separate kind;
  - restate the exit criterion over `diverged` **excluding** those kinds, and require
    both excluded populations to be reported with counts so nobody hides in them;
  - the runbook must teach triage the directional signature of skew.
- **Severity:** MUST_SHIP

### MS-8: `routeHint` is an unspecified live PII channel, and the PII test asserts on the wrong artifact

- **What's missing:** Two controls.
  1. **`routeHint` construction is unpinned.** D-5 describes it as
     `'GET /api/invoices'` "from ALS route slot" — but no route slot exists
     (`scoped-context.ts` sets `businessId` and `userId` only), no File Plan row adds
     one, and nothing forbids the obvious implementation. `req.originalUrl` carries
     path params (row ids) and, on search endpoints, query strings — `?q=Raju+Traders`,
     `?phone=9876543210`. Those are literally the two fixture strings AC-6 uses to
     prove the record is clean. The SCOPE's own PII wall has a hole shaped exactly
     like its own test fixture.
  2. **The PII test measures the wrong bytes.** AC-6 asserts on
     `JSON.stringify(record)` — the pre-serialization object. `lib/logger.ts:41-50`
     then applies `piiMaskFormat`/`scrubPii` to every meta key. So the test proves
     nothing about what reaches the sink, and conversely `scrubPii` may mangle record
     fields (masking id-like strings) in ways no test covers.
- **Failure mode:** A DPDP inquiry (FM-12) is answered "row ids, counts, model names,
  timestamps — no personal data," and the answer is false because a search endpoint's
  query string is in every `routeHint`. FM-12's mitigation is stated as *provable*;
  as specified it is not.
- **Industry pattern:** Standard APM practice (Datadog, New Relic, Sentry) is to tag
  spans with the **matched route template** (`/api/parties/:id`), never the resolved
  URL, for exactly this reason — plus cardinality.
- **Recommended fix:** Pin in D-5, as a MUST: `routeHint = req.method + ' ' +
  req.route.path` — matched template only; `originalUrl`, `req.params`, and
  `req.query` are added to the D-5 prohibited list alongside `args` and `err.message`.
  Add the route slot to `scoped-context.ts` in the File Plan (row #11 currently
  doesn't mention it). Move the AC-6 assertion to the **serialized output of the
  winston format chain**, not the record object, and add a case asserting a search
  endpoint with `?q=Raju+Traders` produces a clean record.
- **Severity:** MUST_SHIP

---

## Should-ship gaps (strongly recommended, defensible to defer)

### SS-1: FM-4's mitigation is not implementable from the module it's assigned to
`txSlot` is module-private (`prisma-scoped.ts:49`) and not exported;
`prisma-shadow.ts` (File Plan row #7) cannot call `txSlot.getStore()`. Either export
it — widening a declared trust anchor's public surface, which needs the security
agent's sign-off — or keep `shouldShadow()` inside `prisma-scoped.ts`. Not MUST_SHIP
only because `scopedTransaction` has **zero production consumers** today (verified),
so the tx path is currently unreachable. The File Plan must still say which of the
two it does, because AC-9 is untestable until it does.

### SS-2: Shadow doesn't exercise the path `enforce` will take
`executePlan` routes `passthrough`/`sameOp` through the **continuation** `q`
(`prisma-scoped.ts:88-92`), while D-3 has `observe()` run everything through the
inner delegate `client[model][op]`. Different mechanism, different composition with
the soft-delete extension. Since this epic's sole purpose is de-risking the
`enforce` flip, the shadow side should call `executePlan` itself with write kinds
refused at the plan-kind guard, rather than a parallel reimplementation that
validates a code path production will never run.

### SS-3: `hasInclude` is promised but not in the record type
FM-6 makes the nested-`include` blind spot "measurable" via a `hasInclude` field —
which does not appear in the D-5 `ScopedShadowDivergence` interface, the operator
endpoint payload, or any AC. An unmeasured measurable gap is just a gap. Add the
field to D-5 and surface the fraction in the report header.

### SS-4: G-9's dedupe key can swallow the distinct divergence
Deduping on `(model, operation, routeHint)` over 60s collapses **two different
missing filters on the same route** into one record. Key on the divergence shape
(e.g. sorted `onlyUnscoped` prefix hash) instead, and always emit a
`suppressedCount` so triage can see what it wasn't shown. As written the dedupe can
hide the second bug behind the first.

### SS-5: ALS-across-async-continuations is unaddressed (learnings gap class 6)
`res.on('finish')` handlers, `setImmediate`, streaming/PDF/export responses, and
detached promises run outside the ALS frame. Under `shadow` this is only noise — but
it is precisely the population that makes MS-4's HTTP-path-zero gate readable or
unreadable. Enumerate the continuation sites in this epic (the SCOPE already accepts
"producing the list" as a deliverable in §Out of Scope); assign each `re-enter frame`
or `runUnscoped('response.continuation', …)`.

### SS-6: Shadow shares the production connection pool; the exemplar pattern isolates it
`SHADOW_MAX_INFLIGHT = 2` is **20% of a 10-connection pool** (`prisma.ts:30`), on a
free-tier Render instance against a pooled Neon endpoint whose own limit is not
accounted for anywhere in the performance budget. Envoy's request-mirroring sends
shadow traffic to a separate `-shadow` cluster specifically so mirrored load can
never starve production. Recommend a dedicated small Prisma client/pool for shadow
queries, or — if that's too much for this epic — start prod at `0.01` rather than
`0.05` and state the pool math against the Neon-side limit.

### SS-7: Some acceptance criteria are commands; two are vibes
AC-2, AC-3, AC-5, AC-10, AC-11, AC-12 are falsifiable — good, and better than most
SCOPEs. But AC-1 ("deep-equal to the same read under `off`") specifies no fixture set
or breadth, and AC-13 ("restores the **exact** pre-epic code path") states no method
at all. Give AC-13 a mechanism (capture emitted SQL via the existing
`base.$on('query')` hook under `off` and diff against pre-epic HEAD) or drop the word
"exact." Separately: `render.yaml` claims the server has "accumulated type errors" —
stale, `npx tsc -b --noEmit` exits 0 today (verified). Fix the comment so AC-8 isn't
read against a contradictory deploy config.

---

## Future-epic recommendations (not for this scope)

- **Raw SQL audit (G-13).** Correctly deferred and correctly gated on `enforce`
  rather than on shadow. The `rawSqlSitesUnaudited: true` honesty flag is the right
  call — keep it.
- **Nested-relation / `include` divergence detection.** Correctly deferred; needs a
  schema-aware walk that is disproportionate for an observation-only harness.
- **Shadow coverage inside interactive transactions.** Correctly deferred, and
  currently moot (zero `scopedTransaction` consumers).
- **Durable divergence history.** Deferred in the SCOPE — but see MS-3: if the log
  drain in MS-3 option (a) isn't achievable, this stops being a future epic and
  becomes this epic's critical path.

---

## What the SCOPE got right

Preserve these through revision — they are above the bar for this repo:

- **FM-2 is the best thing in the document.** The author independently discovered
  that `scopedContext` is mounted nowhere, named the resulting false-pass as "the
  worst outcome of this entire epic," and promoted the fix to P0.0. That is the right
  instinct; MS-1/MS-5/MS-6 are extensions of the author's own argument, not
  contradictions of it.
- **FM-1's structural reasoning on writes.** Deriving the allowlist from *imported*
  op sets rather than re-typed literals, and hard-refusing `twoStep`/`upsert` plan
  kinds at `observe()`, is the correct defense-in-depth shape. (MS-2 is a membership
  bug in the imported set, not a flaw in the approach.)
- **The `rawSqlSitesUnaudited` flag.** Shipping a deliberate honesty flag so silence
  cannot be misread as coverage is a pattern worth copying into other epics.
- **RD-5 / D-5's PII posture.** Row-ids-not-contents, `errorName` not `err.message`,
  and `businessId` banned as a metric label are all correct and correctly reasoned.
  MS-8 is a hole in the implementation of a sound policy, not a bad policy.
- **The kill switch is real.** One env var plus a restart, no migration to reverse,
  no data to clean. Verified against `prisma.ts` — this actually works.
- **§Accepted Trade-offs is honest.** It names the coverage gaps rather than burying
  them, including the two the author explicitly asked to have attacked. That is why
  this audit could be specific.
- **§Test Infrastructure correctly avoids needing a second database.** Pure-function
  diff modules taking both result sets as inputs is the right decomposition.

---

## The author's two flagged trade-offs — direct answers

**Q1 — Does reusing the real query's promise still diff what we need?**
Mostly yes; keep the optimization. Both sides traverse the soft-delete extension, so
it is apples-to-apples on that axis, and a genuinely missing tenant filter diverges
regardless of execution order — the optimization does **not** mask real divergences.
The real cost is one the SCOPE doesn't name: because the control always runs first
and the candidate always second, skew bias is **systematic and directional**, not
random. GitHub Scientist randomizes order precisely to avoid this, and promise-reuse
forecloses that remedy. Verdict: keep the halved load, but MS-7 must land — the
false-positive class has to be classified out of `diverged` rather than left to
triage.

**Q2 — Is log + 500-entry ring buffer sufficient for a 7-day multi-restart watch?**
No. Not marginally — structurally. There is no log aggregator; the "durable" sink is
a 25 MB rotating file ring (`maxsize: 5242880 × maxFiles: 5`) shared with all other
application logs, on a `plan: free` Render instance with an ephemeral filesystem that
cold-starts on idle and redeploys on every push to main. The ring buffer, the
counters, and the log files are all destroyed several times a day. Every exit
criterion in §Rollout step 5 is a rate over a window that no surviving artifact can
support. See MS-3.

---

## Cross-session learnings applied

| Learning | Entry | Caught |
|---|---|---|
| `scope-writer-blindspots-2026-07-19-tenant-isolation.md` | Gap class 5 — "structural isolation" claim is false while raw SQL bypasses exist | Already addressed by the SCOPE (FM-5 + `rawSqlSitesUnaudited`). No gap. |
| same | Gap class 6 — ALS context lost across async continuations | **SS-5** — continuation sites still unenumerated; directly degrades MS-4's gate. |
| same | Gap class 4 — never assume an ORM mechanism works; prove it on the real DB | **MS-1** (the mechanism as specified is not on the call path) and **SS-2** (shadow validates a different path than `enforce` will run). |
| same | Gap class 3 — completeness tests must check correctness, not partition coverage | **MS-2** — `SHADOW_READ_OPS` is derived by set union with no assertion that every member is *comparable*. Union ≠ correctness. |
| `scope-writer-blindspots-2026-07-21-adoption-gates.md` | BS-2 — "surface X is adopted" is not provable from the transport layer | **MS-4** — `runUnscoped`'s reason union is *declared*, zero call sites; and **MS-5** — a passing `grep` for the mount proves nothing about ordering. |
| same | BS-1 — a backfill without a write-path change; "the test helper encodes the shape production doesn't produce" | **MS-5** / **MS-6** — AC-2 and the QA grep are both satisfiable by a mount that never opens a frame. The acceptance artifact encodes a shape production won't produce. |

### New blind-spot class to seed after revision

**"Observation-only harness that observes nothing."** A shadow/diff/canary epic must
carry a *positive control* as a first-class MUST_SHIP requirement, not just a
deploy-time smoke test: a scheduled synthetic that must appear in the sink, a
minimum-sample floor in the exit criteria, and an alert on zero-samples. Otherwise
every failure mode in the harness — including the ones its own safety mechanisms
cause (a latched circuit breaker) — converges on the same output as success. Applies
to any future SCOPE whose deliverable is *evidence* rather than *behaviour*.

---

# Rev-2 verdict — 2026-07-21T11:04:00Z

**verdict: BLOCK · must_ship_gaps: 1 (new) · rev-1 MUST_SHIP closed: 8/8 · should_ship_gaps: 4**

## Verdict

Rev 2 closes **all eight** rev-1 MUST_SHIP gaps, and closes the two load-bearing
ones (MS-1, MS-6) structurally rather than rhetorically. The SS-6 partial decline is
sound. This is a materially different document from rev 1 and the epic is one
one-line schema amendment away from shippable.

It is blocked on exactly **one** new MUST_SHIP, introduced *by* the MS-3 fix: the
`ScopedShadowDivergence.businessId` column name collides with the DMMF-derived
tenant classifier, which inverts the SCOPE's own claim about `GLOBAL_ALLOWLIST` and
turns the completeness test red. The fix is a rename with an existing precedent in
this schema. It is blocking only because it lands in a **migration**, which is the
one artifact this epic produces that cannot be quietly corrected later.

Nothing else below is blocking. MR-1 is stated precisely so the revision loop is
cheap.

---

## MUST_SHIP still open

### MR-1: `ScopedShadowDivergence.businessId` makes the sink table a tenant-scoped model, and the `GLOBAL_ALLOWLIST` claim is inverted

- **What's missing:** `businessId` is not a free-form column name in this codebase —
  it is the **classifier input**. `scoped-models.ts:19-24` derives `SCOPED_MODELS`
  from DMMF: any model with a `businessId` **scalar** is automatically
  directly-scoped, with no human step. D-7's `ScopedShadowDivergence` declares
  `businessId String?` (line 299 of the SCOPE), so on `migrate dev` it is
  auto-classified as a tenant-scoped model.

  The Data Model section and Non-goals amendment then say both new models "MUST be
  added to `GLOBAL_ALLOWLIST`, or the completeness test (§5.3) fails." Verified
  against `server/src/lib/__tests__/scoped-models.complete.test.ts`, the opposite is
  true — adding it fails the suite in **three** places:

  | Test | Line | Result |
  |---|---|---|
  | `SCOPED_MODELS == exactly the businessId-bearing models` | 27-30 | fails — DMMF derives it in; the allowlist cannot remove it |
  | `the three classes are pairwise disjoint` | 37-39 | fails — `${g} is both global and directly-scoped` |
  | `every global-allowlist model exists and has no businessId` | 74-79 | fails — `global model ScopedShadowDivergence DOES have businessId — remove from allowlist` |

  `ScopedShadowStat` has no `businessId` and the SCOPE's treatment of it is correct;
  it does need the allowlist row. The claim is wrong for one of the two models, and
  it is wrong in the direction that makes it look already-handled.
- **Failure mode:** Three, compounding.
  1. **AC-7 / AC-8 are red on arrival.** "Both suites green" cannot pass with the
     schema as specified.
  2. **The sink becomes tenant-scoped in the layer the epic exists to validate.**
     Left un-allowlisted (the only way CI goes green as written), the model sits in
     `SCOPED_MODELS`, so under `enforce` every read of `ScopedShadowDivergence`
     through `prisma` hits `injectScope` and — from the platform-admin status
     endpoint (G-11), which has no business frame — takes
     `prisma-scoped.ts:139`'s `throw new ScopedContextError(model)`. The `enforce`
     epic inherits an observability table it cannot read at exactly the moment it
     needs it. The `__basePrismaUnsafe` write path (D-7) is unaffected; this is a
     read-path defect.
  3. **It is in a migration.** Renaming a shipped column costs a second migration
     and a backfill. Every other open item in this audit is a doc or code edit.
- **Industry pattern:** Not an exemplar question — it is a house-rule violation with
  a house precedent. `UnscopedAccessLog` (`schema.prisma:4631-4641`) is the closest
  analogue in the repo: the *previous* piece of tenant-isolation observability,
  which stores a tenant reference and is in `GLOBAL_ALLOWLIST`. It names its columns
  `subjectUserId` / `subjectBusinessId` for precisely this reason, and
  `prisma.ts:76-86` writes it on the raw base client — the same shape D-7 specifies.
  Rev 2 reproduces that design and then breaks the one naming convention that makes
  it work.
- **Recommended fix:** In D-7, rename the column to **`subjectBusinessId String?`**
  (matching `UnscopedAccessLog`), and rename the D-6 record field to
  `subjectBusinessId` or keep `businessId` in the TS interface and map it at the sink
  boundary (`prisma-shadow.sink.ts`, File Plan #7). Then:
  - both models are `businessId`-free → both correctly belong in `GLOBAL_ALLOWLIST`,
    and the Non-goals amendment becomes true as written;
  - correct the Data Model / Non-goals sentence — the allowlist rows are required
    because the models are **unclassified**, not because they would otherwise be
    scoped;
  - add an AC: *the two new models appear in `GLOBAL_ALLOWLIST` and in neither
    `SCOPED_MODELS` nor `CHILD_SCOPED`; `scoped-models.complete.test.ts` passes
    unmodified.* The test must not be edited to accommodate the schema — that test
    is the mechanical guard the whole isolation layer rests on.
  - D-8's SQL uses `businessId`; update the three runbook queries to match.
- **Severity:** MUST_SHIP

**On the "does the allowlist amendment widen blast radius?" question:** with the
rename, **no**. Both models are genuinely tenant-free platform observability data,
the amendment adds two rows and touches nothing else in `scoped-models.ts`, and the
completeness test's line-77 guard is itself the mechanical proof that the rows can
never be abused to hide a tenant-bearing model. The amendment is correctly scoped.
Without the rename, it is not a widening either — it is simply red CI.

---

## Verification of the three load-bearing closures

### MS-1 — CLOSED, structurally

Verified against `server/src/lib/prisma.ts` and `server/src/lib/prisma-scoped.ts`.

- `prisma.ts:110-111` is today `scopedMode === 'enforce' ? clients.scoped : clients.softDeleted`.
  D-1's three-way resolution binds `shadow → clients.scoped`, and
  `prisma.ts:69-72` attaches `createScopingExtension` to exactly that client. So
  `$allOperations` (`prisma-scoped.ts:134`) **is** on the live call path under
  `shadow`. The rev-1 "ships green, does nothing" bug is gone.
- The "structurally impossible, not merely intended" test: D-2 places the shadow
  branch **above** `prisma-scoped.ts:136`'s guard chain, so under `shadow` there is
  no path through `$allOperations` that reaches `injectScope`, `executePlan`, or the
  `ScopedContextError` throw on line 139. The observed path and the caller's path are
  the same invocation, and `real = q(args)` is bound before any harness statement.
  Correct — and AC-4's four-point throw injection is the right proof obligation.
- RD-3's rewrite is honest: it keeps rev 1's legitimate concern on the record and
  prices it rather than deleting it.

### MS-3 — CLOSED on specification, blocked on MR-1

The sink is concretely buildable: two models with field types, three indexes, a
`@@unique` dedupe target, the write path pinned to `__basePrismaUnsafe` with the
re-entry rationale, a named cron file, an explicit 30/180-day retention split, and a
5 000-shapeHash/hour write cap with counters that survive the cap. FM-15 now has real
numbers (~3.6M row ceiling). AC-15/AC-16 make it falsifiable. That is everything
rev 1's MS-3 asked for. Only the column name is wrong.

### MS-6 — CLOSED for the false-green case; one alert is circular (see SR-1)

Mapping each rev-1 silent-death path to its catcher:

| Silent death | Caught by | Verdict |
|---|---|---|
| Breaker latched open | canary absence (D-9.1) + `sampled=0` alert (D-9.2) + volume floor | covered |
| `throttleFactor` decayed to 0 | same three | covered |
| Cold-start counter reset | durable `ScopedShadowStat` (D-7) | covered |
| MS-1 / MS-2 recurrence | canary + volume floor | covered |
| **Env var lost at redeploy** | alerts 1 and 2 — **both gated on `mode === 'shadow'`** | see SR-1 |

The one D-9 claims and does not fully deliver is the redeploy case. It does **not**
produce a false green light, because the exit criterion "canary present in every
45-minute window of the watch" is evaluated retroactively over durable rows and is
independent of whether the page fired. So MS-6's actual requirement — the sink can
distinguish "never ran" from "found nothing" — is met. The residue is a real-time
alerting hole, downgraded accordingly.

---

## SS-6 decline — sound, accept it

The reasoning holds. A second `PrismaClient` opens its own pool; against a Neon
pooled endpoint on a free-tier instance whose pooler ceiling is *unmeasured*, that
converts a bounded, self-correcting failure (in-pool contention, capped at 2 of 10 by
`SHADOW_MAX_INFLIGHT`, with an EWMA arm that decays the sampler and a breaker behind
it) into an unbounded one (pooler-level connection exhaustion, which fails *real*
queries with no in-app throttle able to see or relieve it). That is not trading a
known risk for an unknown one — it is refusing to.

Two things make the decline defensible rather than convenient, and both are present:
the pre-ramp gate (record the pooler limit before any ramp step, in the QA checklist)
and the sample floor moving 0.05 → 0.01. It is listed in Out of Scope with a
revisit trigger. Accepted without reservation.

One note for the runbook: the pre-ramp reading must record the **pooler** limit, not
the Postgres `max_connections` — on Neon the pooled endpoint is the binding
constraint and the two numbers differ by an order of magnitude.

---

## Should-ship (do not block; fix in the same pass as MR-1 where cheap)

### SR-1: Both required alerts self-disable under the failure they exist to detect
Alerts 1 and 2 in §Observability are conditioned `while mode is 'shadow'`, and `mode`
is `getScopedPrismaMode()` reading the same `SCOPED_PRISMA_ENFORCE` var whose loss is
the failure. On Render these are hand-set `sync: false` vars. A typo
(`shadown`) or a dropped var reads as `off` (`env.scoped-prisma.ts:14-18` returns
`'off'` for anything unrecognised), the harness goes inert, and both pages are
silent by construction. The 7-day watch then burns to completion. Not blocking — the
canary exit criterion catches it at evaluation, so no false green — but it wastes a
week. Fix: derive the alert's expected mode from a durable source (last non-zero
`ScopedShadowStat` bucket, or an explicit `SHADOW_WATCH_ACTIVE` flag set once at watch
start), not from the live env read. Alternatively alert on "`sampled` bucket went from
non-zero to zero," which needs no mode predicate at all.

### SR-2: File Plan #11 targets a file that no longer has that shape
`server/src/lib/env.ts` was split at commit `62f6297` — it is now a **65-line barrel
of named re-exports** with no accessor bodies. Rev 2 depends on the file's shape in
three places:
- Premise table cites `env.ts:267` for `getScopedPrismaShadowSample()` — that line
  does not exist; it is `env.scoped-prisma.ts:21`.
- File Plan #11 (`env.ts` modify ~+40, "3 new knobs + validation") — the bodies
  belong in `env.scoped-prisma.ts`; only the **export list** changes in `env.ts`
  (~+3 lines). The barrel uses named lists, never `export *`, so a new accessor in
  the sibling is **not** visible from `env.ts` until the barrel row is added —
  self-revealing at `tsc`, but it is two rows, not one.
- §API Contract "New env knobs (added to `env.ts`)" — same correction.

Symbol names are preserved by the barrel, so nothing in rev 2 breaks on *imports*;
the dependency is purely on file shape and line numbers. Retarget #11 to
`env.scoped-prisma.ts` (bodies, ~+35) plus `env.ts` (barrel rows, ~+3).

**Gate-coverage side effect worth stating:** `HIGH_RISK_PATHS.md` matches
`**/lib/env.ts`. It does **not** match `env.scoped-prisma.ts`. Once the knobs move,
edits to the scoped-Prisma env contract no longer trip `check-plan-required.cjs`. The
epic's plan will cover it anyway (prisma.ts is in the same change), but the split has
silently narrowed gate coverage on this exact file and someone should add the
`**/lib/env.*.ts` pattern. That is the env-split epic's job, not this one's — flag it
across.

### SR-3: `validateScopedPrismaBoot()` is dead code, and GOLD_STANDARD says otherwise
`grep -rn validateScopedPrismaBoot server/src` returns its definition
(`env.scoped-prisma.ts:33`) and the barrel re-export (`env.ts:62`) — **zero call
sites**. Confirmed.

Does rev 2's rollout depend on it? **No.** Checked directly: the rollout drives
`SCOPED_PRISMA_ENFORCE` by hand, the kill switch is `off`, and no AC or exit
criterion in this SCOPE references the boot guard. Pre-cutover the guard's only
behaviour is rejecting a garbage flag value — `SCOPED_PRISMA_CUTOVER_DONE` is not set
during this epic. So this is **not** a MUST_SHIP for `scoped-prisma-shadow`, and the
author has not missed a blocking item.

Two things do follow, and both should land here because this epic is cheaper than the
next one:
1. **Call it.** Two lines in `server/src/index.ts`. Its garbage-value branch is the
   only mechanical defense against the SR-1 typo path — right now
   `SCOPED_PRISMA_ENFORCE=shadown` boots silently in `off`. Wiring it converts SR-1's
   worst case from "silent week" to "refuses to boot."
2. **Correct `docs/GOLD_STANDARD.md` P0.1.** It lists the boot-guard as present and
   ready (line 77) and its exit criteria say "boot-guard active" (line 110). Both
   read as *wired*. It is not. The `enforce` epic will inherit that sentence as a
   satisfied precondition and it is false — for that epic the guard **is** load-bearing
   (it is the M3 control from `SECURITY_AUDIT_tenant-isolation.md:207`), so leaving the
   doc wrong sets up the next epic to skip the only thing standing between a mis-set
   prod flag and silent loss of tenant isolation post-cutover.

**Pattern, stated once because it is now three-for-three.** Every component this
layer has produced has landed dark and unreachable: `scopedContext` written and never
mounted; the scoping extension attached to a client nothing used; the boot guard
defined and never called. All three passed review, all three passed CI, all three
were described in a roadmap doc as ready. The common cause is that this layer's
artifacts are *definitions* — a middleware, an extension, a validator — and a
definition typechecks, tests, and greps identically whether or not anything calls it.
The generalisable control is an **adoption assertion per component**: for each new
capability, one test that fails when the call site is removed, not when the definition
is removed. MS-1 and MS-6 already gave rev 2 that shape for the harness. Recommend the
File Plan add one for the boot guard (`index.ts` calls it — assert boot fails on a
garbage flag value) and that this be seeded as a learnings entry for the layer.

### SR-4: No AC proves the promise reuse actually reuses
D-2 binds `const real = q(args)` and hands the same promise to both the caller and
`observe()`. The whole performance budget ("at most one extra DB read per sampled
read", §Performance ceiling) rests on that promise resolving once. This repo has
already been bitten by lazy Prisma promise semantics in this exact layer —
`prisma-scoped.ts:14-17` carries the warning, and it is recorded as
`project_scoped_prisma_mechanism`. AC-10 proves zero extra queries at sample `0`;
nothing proves *exactly one* extra at sample `1`. Add: capture SQL via the existing
`base.$on('query')` hook (`prisma.ts:57`) and assert a sampled `findMany` emits
exactly two statements, not three. Cheap, uses machinery AC-13 already introduces, and
it is the only thing standing between the stated budget and a silent 2× read
amplification.

---

## Rev-1 items confirmed closed, not re-litigated

MS-1 (D-1/D-2/RD-3, AC-4) · MS-2 (D-3 explicit subtraction, FM-16, AC-14) ·
MS-4 (provenance split, HTTP gated at 0, three verbatim SQL queries) ·
MS-5 (frame inside `middleware/auth.ts`; the `auth`-vs-`authenticate` correction is
right and my rev-1 symbol name was wrong) · MS-6 (canary, zero-sample alert, volume
floor) · MS-7 (`unstable-window` / `skew-suspect` as kinds, both reported by count) ·
MS-8 (`routeHint` pinned to the matched template, AC-6 on post-winston bytes,
`?q=Raju+Traders` case) · SS-1, SS-2, SS-3, SS-4, SS-5, SS-7 all implemented as
specified. MS-3 closed on specification; only MR-1 remains.

## What rev 2 got right

- **MS-1 was fixed at the architecture, not the wording.** The easy revision was to
  keep `softDeleted` and add prose about why that is fine. The author instead accepted
  that shadow makes the extension load-bearing, said so in §Accepted Trade-offs, and
  bought it down with structure. That is the correct call and it was the expensive one.
- **MS-3 was fixed by taking the cost, not dodging it.** Rev 1's "no migration" was
  listed as a trade-off; rev 2 correctly reclassifies it as the thing that made the
  epic unverifiable, and prices the schema gate openly.
- **The premise table now carries a `STALE — FALSE` row against `render.yaml`** and a
  correction of my own MS-5 symbol name. A SCOPE that pushes back on its auditor with
  evidence is worth more than one that complies.
- **D-8's honest under-claim** — stating that the HTTP-zero gate reads "every query
  that reached a route handler inside its own frame," not "every query originating
  from HTTP" — is exactly the discipline that keeps a gate from becoming a rubber
  stamp.

## Cross-session learnings applied (rev 2)

| Learning | Entry | Caught in rev 2 |
|---|---|---|
| `scope-writer-blindspots-2026-07-19-tenant-isolation.md` | Gap class 3 — completeness tests check correctness, not partition coverage | **MR-1** — the SCOPE reasons about `GLOBAL_ALLOWLIST` as a hand-maintained list and misses that `SCOPED_MODELS` is DMMF-derived, so the two interact |
| same | Gap class 4 — never assume an ORM mechanism works | **SR-4** — promise reuse is assumed, not asserted; lazy-promise semantics already burned this layer once |
| `scope-writer-blindspots-2026-07-21-adoption-gates.md` | BS-2 — "surface X is adopted" is not provable from the transport layer | **SR-3** — third landed-dark component; a definition greps identically whether or not it is called |
| new (seed after this revision) | "Observation-only harness that observes nothing" | Rev 2 implements it (D-9). Extend the entry: **an alert predicated on the same env var whose loss it detects is not a control** (SR-1) |
