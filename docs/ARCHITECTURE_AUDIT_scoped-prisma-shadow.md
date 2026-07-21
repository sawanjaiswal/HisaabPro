---
audit_of: ARCHITECTURE_scoped-prisma-shadow.md
scope_ref: SCOPE_scoped-prisma-shadow.md
auditor: architecture-auditor
audited_at: 2026-07-21T11:45:00+05:30
rev2_audited_at: 2026-07-21T11:58:00+05:30
verdict: PASS
rev1_verdict: BLOCK
rev2_verdict: PASS
must_ship_gaps: 0
should_ship_gaps: 2
future_epic_recommendations: 3
scope_conformance_breaks: 0
rev1_must_ship_gaps: 6
rev1_scope_conformance_breaks: 2
---

# Architecture Audit — `scoped-prisma-shadow`

> **Current verdict: PASS (rev 2).** The rev-2 section is at the bottom of this
> document and supersedes everything above it. The rev-1 audit is retained verbatim
> as the record of what was found and why.

---

# Rev 1 — BLOCK (superseded)

## Verdict

**BLOCK.** 6 MUST_SHIP gaps, 2 of which are SCOPE conformance breaks.

The architecture is the strongest artifact this epic has produced — the §0
verification table is honest, the fourth landed-dark finding is real (I confirmed
it independently), and two of its four claimed SCOPE defects are correctly
diagnosed with correct fixes. It is blocked on six specific things, three of which
reproduce the epic's own defining failure mode inside the controls built to
prevent it:

- **AA-4**: adoption assertion **A9** does not test its call site. It goes green on
  a dark component. That is the exact failure §12 exists to close, in the row that
  closes §15.4.
- **AA-3**: the D-1 deviation converts SCOPE's MUST_SHIP HTTP-path-zero gate from
  *unreachable* into *unfalsifiable* — a gate that can never fail is a false green
  with a passing check in front of it.
- **AA-5**: the specified `observe()` path calls the probe with an undefined
  `businessId`, which Prisma drops, producing an unscoped probe, an empty diff, and
  a "no divergence" record. A false-green generator in the one repo whose memory
  file records drop-undefined as its known cross-tenant footgun.

Plus **AA-1** (an explicitly forbidden file in the File Plan), **AA-2** (the dedupe
key destroys this epic's primary deliverable to the `enforce` epic), and **AA-6**
(the composition root is cyclic, contrary to §2's central claim).

---

## SCOPE Conformance Map

| SCOPE decision | Architecture artifact | Status |
|---|---|---|
| G-1 shadow ⇒ `prisma` = `clients.scoped`, caller gets unscoped result | §3.1 · File #21/#22 · A1/A2 | OK |
| G-2 ALS frame inside `auth` | §6.2 · File #26/#27/#28 · A3 | OK |
| G-3 PII-free divergence record | §9.2 key allowlist · File #6 | OK |
| G-4 writes never double-executed; scalars never sampled | §4.2 subtraction + §4.3 plan-kind refusal | OK — verified by construction, see "Got right" #3 |
| G-5 any throw caught+counted, caller unaffected | §4.1 table · File #25 | OK |
| G-6 sample honours env + self-throttle | §4.2 cond. 7 · File #7 | OK |
| G-7 durable sink survives restart | §7 · File #12/#13/#15/#16 | OK |
| G-8 positive control (canary, zero-sample, volume floor) | §15.1 · File #32/#33 · A6/A7 | OK |
| G-9 false-divergence classes structural | §9.1 · File #5 | OK |
| G-10 both suites green under shadow | §12.1 item 6 | OK |
| G-11 admin status endpoint | §8 · File #37–#40 | OK (D-2 deviation sound) |
| G-12 shape-keyed dedupe with `suppressedCount` | §7.1 `@@unique([shapeHash, routeHint])` | **DEVIATED — AA-2.** D-4 fixes NULL-distinctness but the key still omits `kind`/`model`/`operation`, so every empty-diff record collapses into one row |
| G-13 triage runbook incl. skew signature | §9.1 · File #46 | OK |
| G-14 enumerate continuation sites + strategy | File #47 | OK as a doc; **the measured backlog that feeds it is destroyed by AA-2** |
| G-15 / G-16 / G-17 | not built | OK — SCOPE-declared NICE_TO_HAVE / FUTURE_EPIC |
| D-4 shadow side calls `executePlan` | §4.3 · File #21 | DEVIATED per D-7; **SS-2 verified intact** — `executePlan` is still the executing function |
| D-8 provenance split; HTTP-path `no-context` gated at **0** | §6.3 + `noBusinessOnToken` | **BREAK — AA-3.** The replacement predicate is satisfied by construction; it cannot return non-zero |
| D-8 job-path backlog SQL (`GROUP BY model, operation`) | §7.2 `routeHint String @default("")` | **BREAK — AA-2.** Returns one row regardless of backlog size |
| D-7 durable sink, 2 models, cleanup spec | §7 | OK (`lastSeenAt` correction is right) |
| D-6 record shape | §7.1 + §8.2 | OK; `noBusinessOnToken` is **uncomputable** from the declared `RequestMeta` (AA-3) |
| D-10 `shouldShadow()` predicate | §4.2, 8 conditions | Cond. 8 admits no-context reads with **no downstream branch** (AA-5) |
| File Plan #11 `env.ts` (~+40) | retargeted to #23 `env.scoped-prisma.ts` + **#24 `env.ts`** | **VIOLATION — AA-1.** `env.ts` is explicitly excluded from this epic's `files_planned` (concurrent session owns it) |
| RD-14 `shouldShadow` in `prisma-scoped.ts`, `txSlot` unexported | §4.2 | OK |
| Performance budget (1 extra read) | §11 + Phase 0 gate | OK — premise verified, counting method under-specified (SS-4) |
| Rollout stages + kill switch | §11 | OK |
| Security § (admin auth, IDOR, CSRF, audit, PII) | §8.1 reuse + §9.2 | OK |

---

## Must-ship gaps

### AA-1 — File Plan row #24 edits `server/src/lib/env.ts`, which this epic must not touch

**What's missing.** Row #24 is `server/src/lib/env.ts | modify | ~+4 | barrel rows`.
A concurrent session owns that file; this epic's `files_planned:` excludes it so the
file-scope lock enforces separation. The architecture also *knows* it needs the row —
§8.4 states plainly that the barrel "uses named lists, never `export *`, so a new
sibling accessor is invisible until the row is added … it is two files, not one." I
confirmed this: `env.ts:1-65` is a named-re-export barrel whose own header forbids
sibling-direct imports.

**Failure mode.** Either the builder edits `env.ts` and collides with the concurrent
session's write (lost edit, or a merge that silently drops one side's rows), or the
lock rejects the write mid-Phase-3 and the harness cannot read its three new knobs —
a stall at the highest-risk phase.

**Recommended fix.** Delete row #24. Have the three new-knob consumers
(`prisma.ts`, `prisma-shadow.throttle.ts`) import from `./env.scoped-prisma.js`
directly, with an inline `// barrel row deferred — see <epic>` comment and a
follow-up row. This deviates from `env.ts`'s "import from the barrel" convention;
that deviation must be stated in §16 as D-10, not left for the builder to discover.
Whichever way it is resolved, `env.ts` must not appear in the File Plan.

**Severity:** MUST_SHIP — blocks Phase 3.

---

### AA-2 — the dedupe key collapses the epic's primary deliverable into a single row

**What's missing.** SCOPE D-6 defines `shapeHash` as
`sha256(sorted(onlyUnscoped ++ onlyScoped))`. The architecture keeps that definition
and keys dedupe on `@@unique([shapeHash, routeHint])` (§7.1), with D-4 setting
`routeHint = ''` for every job-path row.

For every record kind with an **empty diff** — `no-context`, `unsupported-shape`,
`shadow-error` — `onlyUnscoped` and `onlyScoped` are both `[]`. `shapeHash` is
therefore a **single constant** across all of them. Combined with `routeHint = ''`
on the job path, the composite key `('<hash-of-empty>', '')` is identical for:

- every `no-context` record from every cron, every webhook, every continuation;
- every `unsupported-shape` record;
- every `shadow-error` record;
- across every model and every operation.

They upsert into **one row**, which keeps the `model`/`operation`/`kind` of whichever
record arrived first and accumulates everything else into `suppressed`.

**Failure mode.** SCOPE D-8's job-path query — this epic's stated deliverable to the
`enforce` epic (G-14, FM-3, §Non-goals "this epic *produces the list*") —

```sql
SELECT model, operation, sum(1+suppressed) AS n FROM "ScopedShadowDivergence"
WHERE kind='no-context' AND provenance='job' ... GROUP BY 1,2 ORDER BY n DESC;
```

returns exactly **one row**, forever, naming one arbitrary model/operation pair. The
`runUnscoped` adoption backlog — the thing the 7-day watch exists to produce — is not
merely incomplete, it is a single fabricated row. §19 open-risk 2 worries about
*hitting* the 5 000-shapeHash/hour cap; the actual behaviour is the opposite and worse
— the cap is never approached because there is one shape.

It also silently merges `shadow-error` into `no-context` counting if a
`shadow-error` record lands first, corrupting the `shadow-error < 0.1%` exit criterion.

**Industry pattern.** Sentry/Rollbar-style fingerprinting always includes the
*classification* (error type, culprit) in the group key, not only the payload
signature. A payload-only fingerprint groups all empty payloads together.

**Recommended fix.** Two options, either sufficient:

1. `@@unique([kind, model, operation, shapeHash, routeHint])` — the composite key
   carries the classification. Update the dedupe upsert's `where` accordingly and
   re-check the 5 000/hour cap against the new (higher) distinct-shape count.
2. Fold `kind`, `model`, `operation` into the `shapeHash` preimage:
   `sha256(kind + '|' + model + '|' + operation + '|' + sorted(ids))`. Simpler
   migration; but it changes the SCOPE D-6 definition of `shapeHash`, so it must be
   listed in §16.

Option 1 is preferred — it leaves `shapeHash` meaning what SCOPE says it means and
makes the grouping explicit in the schema, where a reviewer sees it.

**Severity:** MUST_SHIP · SCOPE conformance break (G-12, G-14, D-8).

---

### AA-3 — the D-1 deviation converts an unreachable gate into an unfalsifiable one

**The diagnosis is right; the fix is not.** §6.3/D-1 correctly identifies that
`auth.ts:75` sets `businessId: payload.businessId ?? ''` (confirmed — the line
exists verbatim), so a fresh signup hitting `GET /api/businesses` legitimately has
no tenant and SCOPE's "HTTP-path `no-context` = 0" gate is unreachable. Correct.

But trace the replacement predicate against the design's own control flow:

- `enterTenantFrame` opens the business frame **only when `businessId` is non-empty**
  (§6.1, mirroring `scoped-context.ts:21-24`, which I read).
- Therefore: *frame open* ⟹ the record is a real diff, not `no-context`.
- Therefore: `no-context` **∧** `RequestMeta` present ⟹ `businessId` was empty
  ⟹ `noBusinessOnToken = true`.
- The gate reads `kind='no-context' AND provenance='http' AND NOT noBusinessOnToken`.

That predicate is **empty by construction**. It cannot return non-zero for any
traffic pattern, including the one it exists to catch: if `enterTenantFrame` were
deleted from `auth.ts` entirely, every request would produce `no-context` +
`noBusinessOnToken=true` (because the token's businessId is never read), and the
gate would still read 0.

This is strictly worse than the unreachable gate it replaces. An unreachable gate
gets noticed and relaxed under pressure — visibly. An unfalsifiable gate reports
success forever. It is the same class as the three landed-dark components, promoted
into an exit criterion.

**Second, smaller defect in the same section.** `RequestMeta` is declared
(§6.2) as `{ method: string; getRouteHint: () => string | null }`. It carries no
signal about whether the token had a `businessId`. At record-build time, inside the
handler, `req` is not in scope for `prisma-shadow.redact.ts` — only the ALS slot is.
So `noBusinessOnToken` is **uncomputable** from the declared shape. The field is
specified in the Prisma model (§7.1), the API contract (§8.2), and the gate (§6.3),
with no producer.

**Recommended fix (both parts):**

1. `RequestMeta = { method, getRouteHint, hadBusinessOnToken: boolean }`, set in
   `enterTenantFrame` from `Boolean(req.user?.businessId)`. Now the field has a
   producer.
2. Replace the vacuous gate with a **positive-coverage** criterion, which is what
   MS-4 actually wanted. Suggested, in the §11 exit criteria:
   - `count(DISTINCT routeHint) WHERE subjectBusinessId IS NOT NULL` **≥ 20** over the
     watch window (this is the durable, production-traffic analogue of A3, and it
     fails if the frame stops opening); **and**
   - `no-context AND provenance='http' AND hadBusinessOnToken` = **0** — which is now
     a *reachable* predicate, because `hadBusinessOnToken=true` with no frame means
     the frame was lost between `auth` and the query (a continuation leak), which is
     a genuine defect this epic should catch.

Note the second predicate is the correct reading of what D-1 was reaching for: it
distinguishes "no tenant" (benign) from "had a tenant, lost the frame" (a bug),
rather than excluding both.

**Severity:** MUST_SHIP · SCOPE conformance break (D-8 / MS-4, a MUST_SHIP gate).

---

### AA-4 — adoption assertion A9 tests the definition, not the call site

**What's missing.** A9's assertion is: *"executing the lint script with a planted
`__basePrismaUnsafe.invoice.findMany()` fixture exits non-zero."*

That asserts the script **works**. It does not assert anything **invokes** it. Delete
File Plan row #19's `.githooks/pre-commit` line and A9 stays green. Delete the
`package.json` script row and A9 stays green (the test spawns the file path). The
component returns to exactly the state §0 row 15 and §15.4 describe as the fourth
landed-dark component — with a passing adoption assertion in front of it.

§12's own rule is *"a test that fails when the **call site** is removed, not merely
when the definition is."* A9 is the only row in the table that violates it, and it is
the row that closes the newly-discovered gap. I confirmed the current state:
`.githooks/pre-commit` contains only `node scripts/ssot/check.mjs`, and repo-wide
grep for `lint-raw-client` finds only doc references — no `package.json` script in
either the root or `server/`.

**Recommended fix.** Use the shape A4 already gets right — spawn the real artifact:

```
A9: stage a file containing `__basePrismaUnsafe.invoice.findMany()`, then
    spawn `.githooks/pre-commit` as a child process.
    Assert: non-zero exit AND the lint's message on stderr.
```

That reddens if the pre-commit line is removed, if the script row is removed, or if
the linter's rule breaks — all three call-site failures plus the definition failure.
Keep the direct-script invocation as a *separate* unit test of the rule itself; it
just cannot be the adoption proof.

**Cross-check on the other nine rows** (I traced each): A1, A2, A3, A4, A5, A6, A7,
A8, A10 all genuinely redden on call-site deletion. A4's child-process spawn is
correct and its premise holds — `validateScopedPrismaBoot()` really does have the
garbage-value branch it relies on (`env.scoped-prisma.ts:34-37`, verified;
`SCOPED_PRISMA_ENFORCE=shadown` throws). A8's 401-not-404 distinction is a
genuinely good mount assertion. A9 is the sole failure.

**Severity:** MUST_SHIP.

---

### AA-5 — `observe()` has no `no-context` branch; the specified path probes with an undefined `businessId`

**What's missing.** §4.2 condition 8 admits a read into sampling when
`getBusinessContext()` is present **"or the record is a `no-context` record."** §5.1's
`observe()` control flow has no corresponding branch — it goes straight from
`await input.real` to `input.runScoped()`.

`runScopedProbe(model, operation, args, businessId)` (§4.3) with no context receives
`businessId === undefined`. It calls `injectScope(model, operation, args, undefined)`.
I read the injector: `injectScope` builds `businessPredicate(businessId)` and
AND-merges it, producing `where: { AND: [..., { businessId: undefined }] }`.

**Prisma drops `undefined` keys.** The probe therefore issues an **unscoped** query,
which returns the same rows as the real unscoped query, which diffs to **zero
divergence**, which records as clean.

**Failure mode.** Every context-free read — currently 100% of cron, webhook, and
pre-business traffic, since `runUnscoped` has zero adopters — is recorded as *verified
non-divergent* rather than as `no-context`. The `diverged = 0 for 72 consecutive
hours` exit criterion is then partly satisfied by queries that were never actually
compared. This is the epic's stated catastrophic outcome (b): a harness that reports
zero divergences and gives false confidence.

It is also the specific footgun this repo has already been burned by and recorded in
memory (`feedback_auth_req_user_shape`: *"undefined causes cross-tenant IDOR via
Prisma's drop-undefined semantics"*).

**Recommended fix.**

1. `observe()` gains an explicit early branch, **before** `inflight++` and before any
   probe: if `input.businessId` is absent, build a `no-context` record (provenance +
   `hadBusinessOnToken` per AA-3), `sink.write` it, bump stats, return. No probe, no
   pool slot, no sample budget consumed.
2. `runScopedProbe`'s signature is `businessId: string` (not optional), with a
   runtime `if (!businessId) throw new ShadowProbeNoContext()` as the belt — the same
   defence-in-depth reasoning §4.3 already applies to the plan-kind refusal.
3. Add an AC: *a sampled read with no ALS frame issues **zero** scoped queries and
   produces exactly one `no-context` record* — asserted with the spy delegate that
   A10 already builds.

**Severity:** MUST_SHIP.

---

### AA-6 — the composition root is cyclic; §2's acyclicity claim is false as drawn

**What's missing.** §2 asserts *"Dependency direction is one-way"* and breaks the
`prisma-scoped ↔ prisma-shadow` cycle correctly via `prisma-shadow.types.ts` + a
`runScoped` thunk. That half is sound and I verified it is achievable given the
current import graph.

But the same diagram, four lines lower, shows `sink.ts → stats.ts →
__basePrismaUnsafe`, and §7.5 confirms writes go through `__basePrismaUnsafe`, which
is exported from **`prisma.ts:101`**. The full graph is:

```
prisma.ts ──imports──> prisma-shadow.ts ──> prisma-shadow.sink.ts ──imports──> prisma.ts
```

`prisma.ts` calls `setShadowPort(createShadowPort())` **during its own module
evaluation** (§3.1: "executed before the `prisma` export is evaluated"). That forces
full evaluation of `prisma-shadow.ts` and its transitive imports, one of which is
re-entering `prisma.ts` mid-evaluation.

**Failure mode.** It happens to work *today* only because two things line up:
`export const __basePrismaUnsafe = clients.base` sits at `prisma.ts:101`, before the
new wiring line at ~`:110`; and `sink.ts` would reference the binding inside a
function body rather than at module top level. Break either — move the wiring line
above `:101`, or have `sink.ts` do `const db = __basePrismaUnsafe` at module scope —
and you get a **TDZ `ReferenceError` at boot**, in the composition root, under
`shadow` only. That failure is invisible in `off` and `enforce`, i.e. invisible in
every environment except the one the epic ships.

**Recommended fix.** Apply the pattern the architecture already invented one section
earlier. The port is injected at the composition root precisely to avoid a cycle; the
base client should be too:

```
// prisma.ts
if (scopedMode === 'shadow') setShadowPort(createShadowPort({ db: clients.base }))
```

`prisma-shadow.sink.ts` / `stats.ts` then take the client as a constructor argument
and import **nothing** from `prisma.ts`. The graph becomes genuinely one-way, the
§2 claim becomes true, and §7.5's `RAW_CLIENT_ALLOWLIST` row (File #18) is still
needed — but now for a file that receives the client rather than reaching for it,
which is also the easier thing for the linter to reason about.

Update the §2 diagram accordingly; a builder scaffolding from that diagram will
otherwise write the cyclic version.

**Severity:** MUST_SHIP.

---

## Should-ship gaps

### SS-1 — `probeContinuation`'s snippet contradicts its own prose and reproduces a known bug

§4.3 writes the continuation as:

```
(a) => runReentry(() => innerClient[model][op](a))
```

then says, in the next clause, *"awaited **inside** the `runReentry` callback
(lazy-promise rule)."* The snippet does not await inside the callback. This layer's
own header comment (`prisma-scoped.ts:14-17`) and the project memory
(`project_scoped_prisma_mechanism`) both state that a non-awaiting callback tears
down the ALS store before the query fires. The correct form is
`runReentry(async () => await innerClient[model][op](a))` — which is exactly what
every existing branch in `executePlan` does (verified, `prisma-scoped.ts:96-121`).

A builder copies snippets, not prose. Fix the snippet.

### SS-2 — A3's assertion contradicts §19 open-risk 3

A3 asserts *"every record carries non-null `subjectBusinessId` and a **non-empty
`routeHint`**"* across ≥20 routers. §19.3 states that routers terminating in
`router.use(handler)` produce a **null** `routeHint`, and that #30 is supposed to
*measure* how many of the ≥20 are affected. Both cannot be true. As written, A3 fails
on precisely the routers §19 predicts — so the builder will weaken A3, and the
weakening will likely take the `subjectBusinessId` half with it.

Split it: `subjectBusinessId` non-null on **all** ≥20 (that is the frame assertion,
and it must stay hard); `routeHint` non-empty on ≥N with the shortfall enumerated
into File #47. State N.

### SS-3 — A1/A2 have no stated mechanism for controlling boot-time env

`const scopedMode = getScopedPrismaMode()` is evaluated at `prisma.ts:103`, at module
load, and `clients` is memoised onto `globalThis.__hpPrismaClients` whenever
`NODE_ENV !== 'production'` (`prisma.ts:94-97`) — which includes the test run. A
vitest file that sets `process.env.SCOPED_PRISMA_ENFORCE` in a `beforeAll` and then
imports `prisma` gets whatever the first importer in the worker already cached.

A1 and A2 are the two assertions that prove the epic's headline wiring. Their setup
mechanism is unspecified, and the most natural improvisation (set env in the test
body) produces a test that passes for the wrong reason — or worse, passes under the
suite-wide `SCOPED_PRISMA_ENFORCE=shadow` second run (§12.1 item 6) and fails alone,
which reads as flake and gets skipped.

Specify it. Either a dedicated vitest project with `env` set in config, or
`vi.resetModules()` + dynamic `import()` after env assignment, or (cleanest) run
`scoped-shadow.integration.test.ts` only in the shadow-mode CI pass and assert the
inverse in the default pass.

### SS-4 — the Phase 0 gate's counting method is under-specified

The gate itself is correctly framed as a **gate**, and its premise checks out: I read
`prisma-scoped.inject.ts:133-138` and both read paths return `noGuards(...)`, so
`plan.guards` is empty for every read and `executePlan`'s `runGuards` loop is a
genuine no-op. "Exactly one more statement" is the right expected value.

But `base.$on('query')` also emits `BEGIN`/`COMMIT` events for batched operations and
does not distinguish them from the statement under test. "Exactly 1" without a filter
is flaky, and a flaky gate gets loosened to "≤ 2" on its second red run — at which
point it stops distinguishing "one query" from "two queries."

Sharpen it: count only events whose `query` matches `^SELECT`, and assert the exact
count on both sides. One line of spec; it is the difference between a gate and a
suggestion.

### SS-5 — §15.2 cites the wrong File Plan row for the blocked hand-off

§15.2 says *"File Plan row **#49** is listed as blocked / not-this-epic."* Row #49 is
`docs/GOLD_STANDARD.md`. The blocked hand-off is row **#51**. §19.4 and the File Plan
footer both say #51 correctly. Fix §15.2 — a wrong pointer in the one paragraph
whose job is to stop a gap being dropped is a bad place for a typo.

### SS-6 — the SR-2 hand-off has no home outside this document, and the stated interim control isn't one

**Row #51's BLOCKED call is correct.** `HIGH_RISK_PATHS.md` is a declared trust anchor
under its own "Hook chain & gate SSOT" section, requiring `architect, security` and
its own approved plan; it is also a global rules file outside this repo's blast
radius. Blocking it and naming the exact pattern (`**/lib/env.*.ts`) is the right
call, and listing it as a row rather than a footnote is the right instinct.

Two problems with the hand-off *mechanism*:

1. It lives only in this architecture doc, which closes when the epic closes. A gap
   recorded in a closing document is the process-level version of landing dark. Row
   #49 already edits `docs/GOLD_STANDARD.md` — put the SR-2 pattern change into its
   backlog in the same commit. That file is the roadmap SSOT and outlives the epic.
2. §15.2's interim mitigation — *"this epic's own design plan lists
   `env.scoped-prisma.ts` in `high_risk_paths_touched`, so the file is reviewed under
   this epic"* — is accurate but is not a control. `check-plan-required.cjs` decides
   whether to **block** by matching the edited path against `HIGH_RISK_PATHS.md`;
   listing a path in a plan grants review for *this* edit and creates no enforcement
   for the next editor. Say so, rather than letting it read as coverage. The gap stays
   open until row #51 lands, and the doc should state that plainly.

### SS-7 — File Plan row #19 bundles two files

`package.json` + `.githooks/pre-commit` in one row, one estimate. Minor, but the
file-plan discipline is one row per file precisely so estimates and ownership stay
legible. Split it.

---

## Future-epic recommendations

1. **Exact-parity continuation.** Re-invoking the caller's `q` twice within one
   `$allOperations` call would remove the residual composition-order difference §4.3
   documents. Correctly sequenced behind Phase 0 and correctly declared a non-blocker.
2. **G-15 scalar comparator** for `count`/`aggregate`/`groupBy`, and **G-17 raw-SQL
   tenant audit** — both correctly deferred per SCOPE; G-17 correctly identified as
   gating `enforce`, not `shadow`.
3. **Dedicated shadow pool.** Correctly declined pending the §11 stage-2 pooler
   reading, with the reasoning owned rather than hand-waved.

---

## What the architecture got right

1. **§0's verification table is honest work**, including where it corrects the SCOPE.
   I spot-checked eight rows against the tree; all eight hold.
2. **The fourth landed-dark finding is real.** Independently confirmed:
   `.githooks/pre-commit` contains only `node scripts/ssot/check.mjs`, no
   `lint-raw-client` script exists in root or `server/package.json`, and repo-wide
   grep finds only documentation references. Finding it unprompted, in an epic whose
   thesis is exactly this failure class, is the strongest signal in the document.
3. **Read-only-by-construction genuinely holds.** Verified at
   `prisma-scoped.inject.ts:133-138`: `FIND_UNIQUE_OPS` → `{kind:'findFirst'}`,
   `READ_MERGE_OPS` → `{kind:'sameOp'}`, both via `noGuards(...)`. No read path can
   produce `twoStep` or `upsert`. The §4.3 plan-kind refusal is therefore correctly
   characterised as defence-in-depth rather than the primary control — and the
   argument for keeping it anyway (it makes the property hold of the *code*, not of a
   constant's current contents) is the right argument.
4. **SS-2 survives the D-7 deviation.** `executePlan` remains the executing function;
   the synthetic continuation only substitutes for `q` in the `sameOp` branch, and
   the `findFirst` branch never touches it. The fidelity caveat is stated honestly
   rather than glossed, and the decision to design against the proven mechanism first
   is correct given this layer's history.
5. **Two of the four claimed SCOPE defects are correctly diagnosed with correct
   fixes**: NULL-distinctness in the unique index (D-4) and `createdAt` pinning under
   a dedupe upsert (D-5). Both are subtle, both are real, both fixes are right as far
   as they go. AA-2 is a gap in the D-4 fix's reach, not a refutation of the diagnosis.
6. **A4 is a model adoption assertion** — the child-process spawn is the correct
   expensive choice, its premise is verified in code, and the reasoning for rejecting
   the cheap same-process version ("would test the exported function, which is
   precisely the thing that already passes today while being uncalled") is the exact
   right frame.
7. **D-2** (`/api/admin` over a bespoke `/api/internal`) is correct reuse, not
   scope-cutting: it inherits `requireAdmin`, the limiter, and `auditAdminAction`
   rather than reimplementing three security controls.
8. **The migration is genuinely additive** and the three-step rule is correctly
   declared N/A with a stated reason. Rollback (`off` + restart, tables left inert) is
   right — no down-migration on the critical path.
9. **SR-1's watchdog design** — predicate over durable rows, never a live env read,
   registered unconditionally, asserted at mode `off` (A7) — correctly closes an alert
   that would otherwise self-disable under the failure it detects. The declined
   alternative (`SHADOW_WATCH_ACTIVE` env var) is declined for the right reason.

---

## Cross-session learnings applied

- **"Landed dark" / definition-vs-call-site** (this epic's own thesis, generalised
  from three confirmed instances + a fourth found here). Applied as the primary lens
  to all ten §12 rows. Caught **AA-4** (A9 asserts the definition) and, at the
  criterion level, **AA-3** (a gate that cannot fail is the same pathology promoted
  into an exit criterion).
- **`feedback_auth_req_user_shape`** — *"undefined causes cross-tenant IDOR via
  Prisma's drop-undefined semantics."* Directly caught **AA-5**: the specified probe
  path passes `businessId: undefined` into `injectScope`.
- **`project_scoped_prisma_mechanism`** — *"MUST await re-dispatched calls inside
  ALS `.run()`; Prisma promises are lazy."* Caught **SS-1**, where the architecture's
  own prose states the rule and its snippet violates it.
- **Learnings gap class 4** ("never assume an ORM mechanism works") — the
  architecture applies this correctly itself (Phase 0 as a gate, D-7's refusal to
  assume double-continuation works). Used here to check the Phase 0 gate's sharpness
  → **SS-4**.
- **Global CLAUDE.md file-layer discipline** — every row ≤ 250 lines: verified, 51
  rows, max estimate 230. Caught **SS-7** (one row, two files) and **AA-1** (a row
  that must not exist).

---
---

# Rev 2 — PASS

**Audited:** 2026-07-21 · `docs/ARCHITECTURE_scoped-prisma-shadow.md` rev 2, 1466
lines, File Plan 53 rows, Revision Log at §20.

## Verdict

**PASS.** All six MUST_SHIP gaps are genuinely closed — not papered over — and both
SCOPE conformance breaks are repaired. No fix introduced a new fail-silent defect.

Two SHOULD_SHIPs remain, both from the same under-specification (§5.1 never says
whether a *clean* comparison writes a row). Neither blocks: they fail **loud**, not
silent. Details below, with the reasoning for why that distinction is the deciding
one rather than a courtesy.

## MUST_SHIP disposition

| # | Gap | Closed? | Verification |
|---|---|---|---|
| AA-1 | File Plan edited `server/src/lib/env.ts` | **YES** | `env.ts` appears in no File Plan row (grep-confirmed); row #24 is `env.scoped-prisma.ts`; line 1223 states the exclusion explicitly; consumers import the sibling directly; deviation recorded as **D-10** in §16 rather than left for the builder |
| AA-2 | Dedupe key collapsed every empty-diff record into one row | **YES** | `@@unique([kind, model, operation, shapeHash, routeHint])`; `shapeHash` keeps SCOPE's definition; cap re-checked; **AC-24** + §12.2 item 5 are a real regression test (two `no-context` records differing only in model/operation must produce **two** rows) |
| AA-3 | Replacement gate was unfalsifiable; `noBusinessOnToken` had no producer | **YES** | `RequestMeta.hadBusinessOnToken` set in `enterTenantFrame` from `Boolean(req.user?.businessId)`, with `runWithRequestMeta` unconditional so the field exists precisely when no frame opens — the producer is real. Criterion 1 is genuinely reachable (see below). **AC-25** is a true falsifiability proof |
| AA-4 | A9 asserted the definition, not the call site | **YES** | A9 now stages a violating file and spawns `.githooks/pre-commit` as a child process; direct-script invocation demoted to File #44 and explicitly labelled not-adoption-proof; §12's rule text amended to name the trap |
| AA-5 | `observe()` probed with `businessId: undefined` | **YES** | Explicit no-context branch before `inflight++` and before any probe; `runScopedProbe(… businessId: string)` with a `ShadowProbeNoContext` throw as belt; `shouldShadow()` condition 8 deleted so context-presence is decided in one place. **A11 + AC-23** assert zero scoped queries via spy delegate |
| AA-6 | Composition root was cyclic | **YES** | `createShadowPort({ db: clients.base })` referencing the local const; `createShadowSink(db)`/`createShadowStats(db)` take it as an argument; `ShadowDb` is a narrow structural type so even the type import doesn't drag `prisma.ts` back in. Redrawn §2 diagram carries the literal line *"NOTHING under prisma-shadow.* imports prisma.ts. The graph is acyclic."* — a builder scaffolding from it writes the acyclic version |

### Checks I ran rather than accepted

**AA-5 — no path reaches a probe without a frame.** Traced all four: (1) `observe()`
branches on `!input.businessId` before `inflight++`, returns without calling
`runScoped`; (2) `runScoped` is now invoked as `input.runScoped(input.businessId)`,
so the value is passed explicitly rather than re-read; (3) `runScopedProbe` types it
`string` and throws on empty; (4) rev-1 condition 8 — the clause that admitted a
no-context read into sampling with no downstream branch — is deleted. A11 asserts
zero probe invocations against a spy delegate, which reddens if the branch is removed.
Clean.

**AA-3 criterion 1 is genuinely reachable.** I checked this specifically, because
rev 1's failure was a predicate that looked reachable and wasn't. `no-context ∧ http
∧ hadBusinessOnToken` requires *RequestMeta present, business frame absent, token
carried a tenant*. Since `runWithRequestMeta` is outer and unconditional and
`runInBusinessContext` is inner and conditional, that state arises when the inner
frame stops opening while the outer one still does — which is exactly the partial
regression (someone removes or short-circuits the `runInBusinessContext` call) that
rev 1's predicate could not see. It reads 0 in health and non-zero on the defect.
**AC-25 tests precisely that mutation** ("non-zero when the tenant frame is stubbed
out of `enterTenantFrame`"), which is a real falsifiability proof, not another
assertion that passes regardless. The *total* removal case (both frames gone) is
covered by criterion 2 collapsing to 0 and by A3a. The two criteria together cover
both mutations; rev 1's single predicate covered neither.

**AA-2 cap arithmetic — conclusion right, input wrong.** §7.2 says "~60 scoped
models". The actual DMMF-derived count is **96** (`Prisma.dmmf` filtered by
`businessId` scalar — I ran it). So the job-path bound is 3 × 96 × 5 = **1 440**, not
900. The conclusion is unaffected — 1 440 is comfortably under the 5 000
distinct-key/hour cap, and after the first hour these are upserts rather than inserts
— so retaining the cap unchanged is still correct. Correct the number in §7.2; it
does not change the decision.

**AA-4 reddens on hook-line deletion.** Confirmed by construction: the test spawns
`.githooks/pre-commit`, which currently contains only `node scripts/ssot/check.mjs`.
Remove row #19's added line and the spawned hook exits 0 on a staged violation → the
assertion fails. It also reddens if the `package.json` row is dropped (hook line
would invoke a missing script) or if the rule itself breaks. All three call-site
failure modes covered.

## SHOULD_SHIP disposition

All seven rev-1 SHOULD_SHIPs closed, none declined. Spot-checked the two flagged:

- **SS-4** — the `^SELECT` filter is in the Phase 0 gate row with an exact count on
  both sides, plus a paragraph explaining why a flaky gate gets loosened to "≤ 2" and
  stops measuring the only thing it exists to measure. Closed, and better argued than
  I asked for.
- **SS-6** — File #51 writes the `**/lib/env.*.ts` pattern into `GOLD_STANDARD.md`'s
  backlog with the reason and the required agent pair; §15.2 now states plainly that a
  design-plan listing **is not a control** and that "the gap stays open until row #53
  lands." Blocked row renumbered #51 → #53 consistently. Closed.

## New — SHOULD_SHIP (do not block)

### RS-1 — exit criterion 2 is computed over a table that only holds divergences

`ScopedShadowDivergence` has seven kinds (§9.1); none of them is *"compared and
identical."* There is no `match` / `clean` / `observed` kind. So

```
count(DISTINCT routeHint) WHERE subjectBusinessId IS NOT NULL  ≥ 20
```

counts only route templates that produced an `unstable-window`, `skew-suspect`,
`unsupported-shape`, `shadow-error`, or `diverged` record with a frame open. In the
**target healthy state** — `diverged` = 0, `shadow-error` < 0.1% — that is a count
over incidental noise. A tidy system with few paginated endpoints can sit well under
20 while the frame is opening perfectly on all 138 route files, and the criterion
blocks the `enforce` epic for no reason. A criterion that fires in the success state
gets relaxed — the dynamic §1 itself names.

The related loose end: **§5.1 writes a record unconditionally** after `classify()`,
but §9.1 has no kind for a clean comparison, and §7.2's cap arithmetic assumes only
divergence-shaped rows exist. The builder has to guess, and the two guesses have
opposite consequences — record-everything explodes the table and invalidates the cap
math; record-nothing makes criterion 2 uncomputable as intended. Same for
`distinctFramedRoutes` in the status payload (§8.2 line 708), which has no stated
derivation.

**Why this is not a blocker.** Its failure direction is *fail-loud*: it blocks a
promotion that should have proceeded. It cannot certify a broken harness as working.
The fail-silent direction — the entire subject of AA-3, AA-4 and AA-5 — is closed by
criterion 1, AC-25, and A3a, and A3a already proves frame coverage across ≥20 routers
in CI on every run. Criterion 2 is defence-in-depth over production traffic, not the
sole control.

**Fix (small, mechanical, pick one):** (a) derive `distinctFramedRoutes` from a
`ScopedShadowStat`-style rollup keyed on `routeHint` rather than from the divergence
table; or (b) add a bounded `observed` row deduped on `(routeHint, model)` — the
widened AA-2 composite key already supports this cheaply; or (c) state that
`classify()` returns null for a clean diff, no row is written, and drop criterion 2
in favour of A3a plus the volume floor. Whichever is chosen, say it in §5.1 so the
cap math in §7.2 and the payload field in §8.2 both have a stated source.

### RS-2 — §7.2's scoped-model count is wrong (96, not ~60)

See above. One-number correction; the retain-the-cap conclusion holds.

## Does the rule live inside the epic, or only in the learnings file?

The coordinator asked me to judge this rather than take it. **It lives inside the
epic**, in two load-bearing places, not just in the learnings file:

1. **§1's rev-2 note** states the generalisation in the architecture's own problem
   statement — *"a control built to detect dark components is itself a component, and
   needs its own call-site assertion and its own falsifiability check"* — and names
   all three instances (AA-3, AA-4, AA-5) as the same pathology.
2. **§12's rule text** now carries the operational half: *"A test that spawns the
   artifact directly is testing the definition; the adoption test must spawn or
   exercise whatever is supposed to invoke it."* That is the sentence that would have
   caught rev-1's A9 at write time.
3. **AC-25 is the enforcement.** It is the first acceptance criterion in this epic
   that tests a *gate's* falsifiability rather than a component's behaviour — it
   mutates `enterTenantFrame` and requires the gate to redden. That is the rule
   executing in CI, not merely stated.

The architect's read that three of six MUST_SHIPs were one defect class is correct,
and the generalisation is the right one. It is carried in the artifact, not only
exported.

## What rev 2 got right beyond the fixes

- Every fix cites the auditor's reasoning back and then goes one step further:
  AA-6 added the narrow `ShadowDb` type (which I did not ask for) to stop the type
  import re-creating the cycle; AA-2 added `AC-24` as a regression test rather than
  just changing the key; AA-4 kept the direct-script test but relabelled it.
- **A3 split into A3a/A3b** resolves my SS-2 (A3 vs §19.3 contradiction) the right
  way: the `subjectBusinessId` half stays hard at ≥20, the `routeHint` half is a
  stated ≥15 with the shortfall enumerated by name. It weakened the part that had to
  be weakened and refused to weaken the part that mattered.
- **§12.1** answers SS-3 with a concrete mechanism (dedicated vitest project, `pool:
  'forks'`, `isolate: true`, inverse assertion in the default pass) rather than a
  gesture at one.
- The Revision Log at §20 maps every AA/SS to its disposition and section. Auditable.

## Cross-session learnings — rev 2

- The rev-1 finding class ("a control that reports success regardless of whether the
  guarded thing works") is now appended to
  `~/.claude/learnings/architecture-blindspots-*.md` by the architect, and — more
  usefully — is enforced inside this epic by AC-25. The **new** sub-lesson worth
  carrying forward is RS-1's shape: *when you replace a vacuous gate, check the new
  predicate's behaviour in the **success** state too, not only in the failure state.*
  Rev 1's gate was broken in the fail-silent direction; its replacement's criterion 2
  is imperfect in the fail-loud direction. Both are failures of the same question
  asked only once.
