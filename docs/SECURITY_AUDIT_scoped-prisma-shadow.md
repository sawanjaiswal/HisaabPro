---
audit_of: ARCHITECTURE_scoped-prisma-shadow.md (rev 3 — re-audited; rev 2 REJECTED, see §1-§10)
scope_ref: SCOPE_scoped-prisma-shadow.md (rev 3)
arch_audit_ref: ARCHITECTURE_AUDIT_scoped-prisma-shadow.md (rev-2 verdict PASS)
prior_security_audit: SECURITY_AUDIT_tenant-isolation.md (PASS-WITH-CONDITIONS)
auditor: security
audited_at: 2026-07-21
reaudited_at: 2026-07-21
tree_at: 78f6dce
verdict: APPROVED WITH CONDITIONS
verdict_rev2: REJECTED
blocking: 0
medium: 2
low: 2
conditions: 4
---

# Security Audit — `scoped-prisma-shadow`

## Verdict: REJECTED — 6 blocking findings

> **SUPERSEDED — this verdict applies to rev 2.** The rev-3 re-audit is §11 at the
> end of this file; the frontmatter carries the current verdict
> (**APPROVED WITH CONDITIONS**). §1–§10 are retained unedited as the record of what
> was found and what the closures must be checked against.

None of the six requires a redesign. All are localized edits to
`ARCHITECTURE_scoped-prisma-shadow.md` (§5.1, §7.1, §7.6, §11, §12, §15.4) plus two
File Plan rows. Clearing them converts this to APPROVED.

I read the live tree before trusting the docs: `prisma.ts`, `prisma-scoped.ts`,
`business-context.ts`, `scoped-context.ts`, `env.scoped-prisma.ts`, `scoped-models.ts`,
`middleware/auth.ts`, `middleware/admin-auth.ts`, `routes/admin/index.ts`, `app.ts`,
`lib/logger.ts`, `scripts/scoped/lint-raw-client.mjs`,
`scripts/scoped/raw-sql-audit.allowlist.json`, `.githooks/pre-commit`,
`.github/workflows/qa.yml`, and both `package.json` files. Where the design and the
tree disagree, the tree wins and the correction is below.

The architecture is unusually strong on the surfaces it addressed. The six blocking
findings cluster in one place the three prior audit rounds did not reach: **the sink
write path**. Rounds 1–3 hardened the probe (read-only ops, plan-kind refusal,
no-context branch, acyclic injection). Nobody audited what happens after
`classify()` returns. That is where this epic's remaining risk lives, and — per
finding B-3 — it is also where the promotion gate is currently unsound.

---

## 1. Threat surface: the sink table as a cross-tenant aggregation

### What can actually leak

`ScopedShadowDivergence` stores, per row: `subjectBusinessId` (the querying tenant,
plaintext in the DB), and `onlyUnscoped[]` / `onlyScoped[]` — **row ids belonging to
tenants other than `subjectBusinessId`**. That is not incidental; it is the payload
the epic exists to produce. The runbook's own triage signature says so
(`ARCHITECTURE:827`: *"`onlyUnscoped` containing another tenant's ids"*).

So the honest characterization is: this table is a durable, platform-global,
cross-tenant **identifier-linkage store**. Row ids are pseudonymous under DPDP, but
they re-identify trivially by joining back to the live DB, which every reader of this
table has. The PII wall as written (`§9.2`, no row bodies / no args / no
`err.message` / no `originalUrl`) is correct and well-constructed, but it is a wall
against *content*, and the risk here is *linkage*. The design never states this.

**B-6 (BLOCKING) — the persisted id-array cap was dropped between SCOPE and
architecture.**
`SCOPE_scoped-prisma-shadow.md:244-245` caps both arrays at **20 ids**.
`ARCHITECTURE_scoped-prisma-shadow.md:538-539` declares `onlyUnscoped String[]` /
`onlyScoped String[]` with no cap, and the only cap the architecture carries is
`SHADOW_MAX_ROWS = 5000` (`:1049`, `:353`) — which is the **diff input** cap, a
different quantity. A builder scaffolding from §7.1 persists up to 5 000 foreign
row ids per record.

This compounds with the canary. Per `SCOPE:413-416` the canary is *by design* "a
`findMany` with no tenant predicate over a fixture where a second fixture tenant holds
rows" — i.e. a deliberately maximal divergence, executed **every 15 minutes**, retained
30 days. Under the architecture's uncapped arrays, the positive control becomes a
recurring bulk dump of another tenant's id space into a platform-global table.

Required: restate `cap 20` explicitly in §7.1 next to the two array fields (not only
in the SCOPE), and constrain the canary fixture so the divergence it proves is
bounded — a synthetic model or a `where` over a fixed handful of seeded ids, never an
unbounded `findMany` over a production-populated model.

### Who can read it

Two gates, and only one of them exists.

- **Route level:** `GET /api/admin/scoped-shadow/status` behind `requireAdmin`. I
  verified `requireAdmin` (`server/src/middleware/admin-auth.ts:104-170`) is genuinely
  strong — Bearer only, blacklist check, DB re-verification of `isActive`, and a
  JWT-role vs DB-role mismatch check that forces re-auth. `apiRateLimiter` is global
  (`server/src/app.ts:102`) and applies. The 401/403/404/500 matrix in §8.3 is right,
  and A8's "401 not 404" assertion is a correct adoption proof for the mount. This
  half is sound.
- **Data level: none.** Both models go into `GLOBAL_ALLOWLIST` (§7.1), which under
  `enforce` means any server code may read them with no tenant frame and **no
  `runUnscoped` audit row**.

**M-1 (MEDIUM) — the M2 precedent is not applied to a strictly more sensitive table.**
`SECURITY_AUDIT_tenant-isolation.md:135-138` (M2) required that `UnscopedAccessLog`
reads be platform-admin-gated *via* `runUnscoped('platform.admin')`, so that reads of
cross-tenant activity are themselves audited. `UnscopedAccessLog` carries a reason and
two ids. `ScopedShadowDivergence` carries foreign tenants' row ids. The stronger table
gets the weaker treatment. Wrap `shadow-status.service.ts` (File #37) reads in
`runUnscoped('platform.admin')` so every read lands in the audit log, matching M2.

**M-3 (MEDIUM) — FM-13's audit half has no acceptance criterion.**
`auditAdminAction` (`admin-auth.ts:205`) is a helper the handler must *call*; it is not
middleware, and `server/src/routes/admin/index.ts` mounts sub-routers with no shared
guard. FM-13 (`ARCHITECTURE:1055`) claims "admin-gated, hashed businessId, audit row",
but AC-12 covers status codes only — nothing asserts the row is written. In an epic
whose entire second deliverable is "controls that land dark", an uncalled audit helper
is the signature failure. Add an AC: an authorised status read writes exactly one
`AdminAction` row.

### The `subjectBusinessId` naming decision

**Sound — confirmed, one line.** `SCOPED_MODELS` is DMMF-derived purely by the
presence of a `businessId` scalar (`server/src/lib/scoped-models.ts:19-23`, verified
verbatim); naming the column `businessId` would auto-classify the sink as tenant-scoped,
and since the admin read path runs with no tenant frame it would then throw
`ScopedContextError` under `enforce` — a fail-closed break of the very endpoint used to
triage the cutover. `UnscopedAccessLog.subjectBusinessId` (`prisma.ts:76-86`) is the
correct precedent. Nothing else depends on these models being scoped: the sink writes
through the injected base client, `stats.ts` reads through the same handle, and the
`GLOBAL_ALLOWLIST` rows + the unmodified `scoped-models.complete.test.ts` keep the
classification honest. No further action.

---

## 2. Threat surface: probe amplification, caps, and failure modes

The probe side is well-bounded and I have no finding against it: sample 0.01 in prod,
`SHADOW_MAX_INFLIGHT = 2` against a `connection_limit=10` pool (`prisma.ts:30`,
verified), 250 ms `Promise.race`, a 20-errors/60 s breaker with 5-minute cooldown, an
EWMA throttle, and — correctly — the AA-5 no-context branch that skips the probe
entirely. Promise-reuse holding the budget at one extra `SELECT` is properly gated by
the Phase-0 spike with the `^SELECT` filter (§13). That is a good design.

The **sink** side has no equivalent, and this is where two of the blocking findings sit.

**B-1 (BLOCKING) — `void sink.write(record)` is an unhandled-rejection crash, not a
silent fail-open.**
§5.1 issues `void sink.write(record)` at `ARCHITECTURE:383` (no-context branch) and
`:394` (compare branch), and `stats.bump(...)` alongside. `observe()`'s `try/catch`
does **not** catch a rejection from a promise it never awaits — that is a separate
chain. §4.1's containment table (`:250`) covers `observe()`'s own rejection via
`.catch()`, and the shadow branch's `catch { countHarnessError() }` (`:228`) is
synchronous only. Nothing catches the sink's.

On Node ≥ 15 an unhandled rejection terminates the process by default. A unique-key
race on the dedupe upsert, a pool timeout, a connection reset, or the table simply not
existing yet (Phase-2 merged, migration not yet deployed — the exact state §7.5 step 2
creates) therefore **kills the API process under `shadow`**. The design's stated
posture, "fails open silently with a counter", is not what the pseudocode does.

The codebase already gets this right one file away: `prisma.ts:76-86` writes the
`UnscopedAccessLog` sink as
`void base.unscopedAccessLog.create({...}).catch((err) => logger.error(...))`.
The epic's pseudocode drops the `.catch` from a pattern the repo established. Every
fire-and-forget in the harness needs an explicit terminal `.catch`, and §4.1's
containment table needs a fifth row covering it.

**B-2 (BLOCKING) — sink writes are outside the inflight cap and outside the breaker;
§11's "zero pool slots" claim is false.**
In §5.1 the no-context branch runs `void sink.write(record)` and returns **before**
`inflight++` (`:383` vs `:387`). In the compare branch, `inflight--` is in `finally`
and the sink write is fire-and-forget, so it too resolves outside the gauge. The
breaker only records probe errors (`:397`).

Consequently `ARCHITECTURE:924` — *"no-context reads consume **zero** pool slots
(§5.1)"* — is wrong. They consume zero *probe* slots; each still issues a Postgres
upsert on the same 10-connection pool. And by the architecture's own analysis
(`:405-409`) the no-context population is ~100% of cron/webhook/pre-business traffic.
At rollout stage 1 (staging, **sample = 1**, `§11`) a cron loop over a scoped model
produces one uncapped upsert per read, with no inflight ceiling, no breaker, and no
throttle arm — the only bound is the 5 000-distinct-*key*/hour cap, which bounds
distinct rows, not write volume, because the dedupe upsert still executes per record.

Required: put the sink write path under a gauge (its own or the existing one), have
the breaker record sink failures, and correct the §11 budget line. Note this is
precisely the class the epic's own FM-8 exists to prevent — it was applied to the
probe and not to the writer.

**Is "fail open" right here?** Mostly yes, and specifically no in one place. Fail-open
is correct for the probe: a harness must never be able to fail a tenant's request, and
§4.1's four containment properties achieve that. It is **wrong** for the *sink*, for
the reason in B-3: a silently-failing sink does not merely lose observability, it
manufactures the exact evidence the cutover decision consumes. Sink failure must be
loud.

---

## 3. Threat surface: PII

**Sound, with the one exception already recorded as B-6.** The `redact.ts` key-allowlist
construction (`§9.2`) is the right mechanism — building a fresh object with declared
keys cannot leak a field it never reads, which is stronger than a denylist. The
specific exclusions are correct and each maps to a real leak I can trace in this
codebase: `args` withheld (a `where` here routinely carries a phone — `hasInclude` /
`hasBoundedWindow` booleans cross the boundary instead), `err.message` withheld in
favour of `errorName` (Prisma embeds failing field values), `originalUrl` / `params` /
`query` withheld in favour of the matched Express template, and `businessId` barred as
a metric label.

`routeHint` is correctly designed as a thunk (`ARCHITECTURE:461-464`) evaluated at
record-build time, because `req.route` does not exist at `auth` time — I verified the
ordering claim against `server/src/middleware/auth.ts:75` and `app.ts`. The
`GET /api/parties?q=Raju+Traders` test case (`:998`) is the right proof and asserts on
the correct artifact.

Asserting on **post-winston bytes** rather than the pre-serialization object (`:845`)
is the correct choice and I confirmed why it matters:
`server/src/lib/logger.ts:16` `INLINE_PHONE_RE = /(\+?\d{10,15})/g` rewrites *any*
10–15-digit run, and `scrubPii` recurses arrays (`:24`) — so it will happily mangle an
id-shaped string. The architecture already flags this (`:846-847`). Confirmed as
handled; keep that assertion.

`stackHint` (≤3 frames, `src/services/**`, file:line only) and `errorName`
(constructor name only) are both fine.

---

## 4. Threat surface: `__basePrismaUnsafe` and the B2 control

I confirmed your finding independently and then found it is worse than "never ran".

Current state, verified: `scripts/scoped/lint-raw-client.mjs:21` claims *"Wired into
CI + .githooks/pre-commit"*. `.githooks/pre-commit` contains only
`node scripts/ssot/check.mjs`. No `lint-raw-client` script exists in root or
`server/package.json` (I enumerated both). `.github/workflows/qa.yml` runs typecheck,
`enforce-offline.mjs`, build, and Lighthouse — nothing else. The script does run clean
today (exit 0), so the baseline is currently honest; it has simply never gated
anything.

**B-4 (BLOCKING) — the planned wiring does not close B2, and A9 is green in the
environment where the gate is absent.**

Three parts, all verified in the tree:

1. `core.hooksPath` is `.githooks` **on this machine only** — it is local git config.
   Nothing committed installs it: there is no `prepare` and no `postinstall` script in
   either `package.json` (I grepped both, plus every `.mjs`/`.sh`/`.yml` for
   `core.hooksPath`; zero hits). A fresh clone, a new machine, or CI has no hook at all.
2. The File Plan wires rows #18 (allowlist), #19 (`package.json`), #20
   (`.githooks/pre-commit`). **There is no `.github/workflows/qa.yml` row.** After this
   epic the linter's docstring claim "Wired into CI" is still false.
3. A9 spawns `.githooks/pre-commit` **as a file**. It therefore passes on a machine
   where git never invokes that file.

That third point is AA-4's exact failure class, one level up. Rev 2 correctly moved the
assertion from the script to the hook — but the hook file is not the invoker either;
git is, and git's invocation depends on uncommitted local config. The architecture's
own §1 lesson ("a control built to detect dark components is itself a component")
applies to A9 recursively and stops one level short.

Required: add a `qa.yml` step running `npm run lint:raw-client`, and make **that** the
A9 call site — CI is an invoker that cannot be silently unconfigured per-developer.
Keep the hook line as defence-in-depth, and add a `prepare` script setting
`core.hooksPath` so a fresh clone installs it.

**B-5 (BLOCKING) — the B2 control is import-shaped, and AA-6's injection fix makes the
new consumer structurally invisible to it.**

`lint-raw-client.mjs:93` is `if (!text.includes(RAW_CLIENT_TOKEN)) continue` — the whole
check keys off the literal string `__basePrismaUnsafe` appearing in a file. Under rev 2,
`sink.ts` and `stats.ts` **receive** the client as a constructor argument
(`createShadowSink(db)`), so they contain no token and the linter cannot see them.

The AA-6 fix is correct and I would not reverse it — the TDZ cycle it closed was real.
But §7.6 (`ARCHITECTURE:670-674`) then asserts that `sink.ts` "still needs a
`RAW_CLIENT_ALLOWLIST` row (File #18), because the linter's rule is about which files
may hold an unscoped client at all." That row is a **no-op**: it allowlists a file the
linter would never flag. Worse, the B2 side has no stale-row detection — B7 has one
(`lint-raw-client.mjs:143-145` reports allowlist rows whose files show no raw SQL) but
B2 does not, so the dead row is permanently silent and reads as coverage.

Evidence this already happens: `RAW_CLIENT_ALLOWLIST` at `:36` contains
`server/scripts/cron/cleanup-unscoped-log.ts`, which sits **outside** the walk root
`SERVER_SRC = server/src` (`:30`) and so could never be flagged. A dead allowlist row
is already sitting there unnoticed.

The structural consequence is the one that matters: this epic establishes **injection
as the sanctioned pattern** for raw-client consumers, and every future
injection-shaped consumer is invisible to B2 with no lint change required. The
hand-off site itself — `createShadowPort({ db: clients.base })` — is inside
`prisma.ts`, which is allowlisted, so the escape happens on a line the control does not
inspect by design.

Required: extend the linter to flag the hand-off (any expression passing `clients.base`
/ the raw client out of `prisma.ts` as an argument, against a reviewed allowlist), or
carry the constraint in the type system so a module receiving a `PrismaClient`-shaped
argument is reviewable. And do not record File #18's row as coverage — say plainly in
§7.6 that B2 does not see injected consumers.

**Have other unreviewed consumers accumulated while the control was dark?** No. I
grepped the token repo-wide: the only non-comment occurrences are `prisma.ts:101` (the
definition) and `server/src/__tests__/setup.ts:60` (the vitest mock) — both already
allowlisted. The dark period did not produce drift. The exposure is forward-looking,
which is exactly why B-5 needs closing now rather than being carried.

---

## 5. Threat surface: raw SQL (B7)

**The ratchet mechanism is sound.** `checkRawSql` (`lint-raw-client.mjs:117-146`) counts
per file against a frozen per-file baseline, fails on any increase, allows decreases,
and reports both stale rows and un-lowered rows as notes. `raw-sql-audit.allowlist.json`
holds 47 files / 89 sites and I reproduced the count. It is monotone in the safe
direction and cannot be loosened without an explicit reviewed edit. Good control.

Two gaps.

**M-4a — the walk root excludes `server/scripts/**`.** `SERVER_SRC` is
`server/src` (`:30`), so `server/scripts/backfill-money-paise.ts` — which contains raw
SQL and is not in the baseline — is outside the ratchet entirely. Any future
cron/backfill script placed there can introduce unscoped raw SQL invisibly. This is
pre-existing, not caused by the epic, but the epic is the commit that first makes this
linter load-bearing, so it is the right moment to widen the walk (and to drop or
relocate the already-dead `server/scripts/...` allowlist row at `:36`).

**M-4b — the epic's own SQL is undeclared.** The architecture never states whether
`prisma-shadow.stats.ts` (File #16) implements the hourly rollup, the D-8
`GROUP BY model, operation` backlog query, and `count(DISTINCT routeHint)` via the
Prisma query API or via `$queryRaw`. All three *are* expressible with Prisma
`groupBy`, so this is a choice, not a constraint — but the File Plan adds a **B2**
allowlist row (#18) and **no** `raw-sql-audit.allowlist.json` row. If any of them lands
as raw SQL, the epic's Phase-2 commit fails B7 at the exact moment it wires the gate,
and the path of least resistance under time pressure is to bump the baseline without
review — the one thing that degrades a ratchet.

Required: state in §7 that `stats.ts` uses the Prisma query API only, **or** add the
allowlist row with a written tenant-safety note in the same commit. Do not leave it to
the builder to discover at gate time.

---

## 6. The promotion gate

You asked whether the criteria are sound enough to hang a tenant-isolation cutover on.
**Not yet** — because of B-3, which is a defect of the same class as the three the
architecture audit already caught, at a layer none of them reached.

**B-3 (BLOCKING) — sink-write failures are invisible to every exit criterion.**

Trace the counters in §5.1. `stats.bump('sampled')` and `stats.bump(kind)` fire at
`:395`. `stats.bump('shadow-error')` fires only from the `catch` around the **probe**
(`:396-397`). The divergence row is written by a fire-and-forget `void sink.write(...)`
at `:394`, after classification, outside that `catch` (see B-1).

Therefore the observable state

```
sampled = high · diverged = 0 · shadow-error = 0
```

is produced *identically* by "there were no divergences" and by "every divergence write
is failing". The watchdog (§15.1) does not distinguish them either: it predicates on
`ScopedShadowStat` rows with kind `sampled`/`watch-active`, so a healthy stats path
alongside a broken divergence path is silence.

The cutover criterion is `kind='diverged' = 0 for 72 consecutive hours`
(`ARCHITECTURE:904`). Under a partially-failing sink that criterion is satisfied by a
harness that observed divergences and dropped them — which is verbatim the epic's own
stated catastrophic outcome (b), *"a harness that reports zero divergences and gives
false confidence"* (`:409`), reintroduced one layer below where AA-5 closed it.

Required, and it is small:

1. A `sink-write-failed` counter, incremented from the terminal `.catch` B-1 adds.
2. It must be written on a **different** path than the one that failed — a log line at
   `error` plus the Sentry alert, not another row in the table that is failing — so it
   survives the failure it detects. This is the same reasoning §15.1 already applied
   correctly to SR-1 (predicate over durable rows, never over the live env read); apply
   it once more.
3. An added exit criterion: `sink-write-failed = 0` over the watch window, and
   `sink-write-failed` on the status payload next to `shadowError`.

**RS-1: I concur with the architecture auditor's read, and it has a clean fix.**
Criterion 2 (`count(DISTINCT routeHint) WHERE subjectBusinessId IS NOT NULL ≥ 20`)
counts over a table that, by construction, holds only anomalies — so in the target
healthy state it is a count over incidental noise and can legitimately sit under 20
while frames open perfectly on all 138 route files. Holding it below blocking was the
right call (its failure direction is fail-loud) but it should not ship as written,
because a criterion that fires in the success state gets relaxed, and the relaxation
will be argued for during a cutover window.

The fix also resolves the loose end RS-1 flags (§5.1 writes a record unconditionally,
§9.1 has no `clean` kind, §7.2's cap arithmetic assumes only anomaly-shaped rows, and
`distinctFramedRoutes` has no stated derivation — four guesses left to the builder,
with opposite consequences): **derive frame coverage from a routeHint-keyed rollup in
`ScopedShadowStat`, not from the divergence table.** Clean comparisons bump a
`observed`-style stat keyed by `routeHint`; the divergence table keeps holding only
anomalies, so §7.2's cap math stays valid; criterion 2 gets a real denominator and
reddens for the right reason — `enterTenantFrame` stopping — rather than for the wrong
one, a tidy system.

**One over-claim to correct, relevant to the same decision.** §12.2 item 6 states that
running the server suite a second time under `shadow` is *"meaningful only because A2
puts the scoped client on the path."* It puts the scoped **client** on the path but not
the scoped **code path**: §4's shadow branch returns at `ARCHITECTURE:229` before the
guard chain, for every model, so the injector, `ScopedContextError`, and `executePlan`'s
enforce-mode branches are never exercised by that run. The dual-mode CI pass is a
useful no-regression check for the *harness*; it is **not** evidence that `enforce`
works. Say so in §12.2, so the `enforce` epic does not inherit it as a satisfied
precondition. (This is the same failure shape as `SECURITY_AUDIT_tenant-isolation.md:207`
M3 being described in `GOLD_STANDARD.md` as "present and active" while
`validateScopedPrismaBoot()` had zero callers — which §15.3 correctly identified and is
fixing.)

**Net read.** With B-3 closed and criterion 2 re-based on a rollup, the criteria are
sound enough: the volume floor, the ≥20-model spread, the canary liveness, the
72-hour `diverged=0` window, the explicit reporting of the two excluded populations,
and the honest `rawSqlSitesUnaudited` flag together form a defensible evidence base.
Without B-3, the headline number is not trustworthy, and it is the only number the
cutover decision reads.

---

## 7. Does anything weaken the existing `enforce` path?

**The "harness is absent, not flag-disabled" claim holds — structurally, with one
condition.** Verified against the live `prisma-scoped.ts`: the shadow branch is gated on
`shadowPort && model`, `shadowPort` is module-private and set only by
`setShadowPort(...)`, and §3.1 calls that exclusively under `scopedMode === 'shadow'`.
Under `off` and `enforce` the port is `null`, `shouldShadow()` returns false on its
first line, and the enforce guard chain at today's `prisma-scoped.ts:129` is reached
byte-identically. Passing `clients.base` (a local const) rather than the
`__basePrismaUnsafe` export also correctly removes the AA-6 ordering fragility at its
source rather than documenting it as a constraint. Good.

The condition:

**M-2 (MEDIUM) — `setShadowPort()` is a new exported mutable-state setter on a trust
anchor, with no mode guard and no one-shot protection.**
A call with a non-null port while the mode is `enforce` converts §4's branch into an
unconditional unscoped passthrough **for every scoped model** — a one-line
tenant-isolation kill switch, reachable from any importer of `prisma-scoped.ts`, and
from any test that sets a port and forgets to reset it (the shadow-mode vitest project
in File #47 makes that a live possibility across workers). The trust anchor's public
surface grows by exactly the shape the SCOPE was careful to avoid elsewhere — `txSlot`
was deliberately kept module-private (`SCOPE:200-201`) on the reasoning that widening a
trust anchor's surface needs extra sign-off. `setShadowPort` needs that reasoning
applied to it.

Required: `setShadowPort` throws if `getScopedPrismaMode() !== 'shadow'`, and throws on
a second call with a non-null port; the shadow branch asserts the mode as a belt. This
is the same "belt" pattern §4.3 already applies correctly to `runScopedProbe`'s
`businessId`.

**M-5 (MEDIUM) — DPDP erasure.** `ScopedShadowDivergence` holds `subjectBusinessId`
plus foreign-tenant row ids and sits outside every deletion cascade; the top-level
orchestrator does not exist yet (`server/src/services/import/erasure.service.ts:116`,
`TODO(wiring)` for `user-erasure.service.ts`). Retention on `lastSeenAt` (§7.4) is the
right choice for the reason §7.4 gives — but it means a **still-firing** divergence
keeps `lastSeenAt` fresh indefinitely, so an erased tenant's ids can outlive the erasure
for as long as the divergence recurs. Either add a hard `createdAt`-based ceiling
alongside the `lastSeenAt` rule, or state the residual explicitly in the runbook and
add the table to the erasure inventory so the future orchestrator inherits it.

---

## 8. Sound surfaces (no action)

Stated in one line each, as requested.

- **`subjectBusinessId` naming** — reasoning holds; nothing depends on the sink being
  scoped (§1 above).
- **Probe read-only-ness** — `SHADOW_READ_OPS` as an explicit subtraction over imported
  sets, plus `runScopedProbe`'s hard refusal of `twoStep`/`upsert` before `executePlan`
  (which does issue real writes, `prisma-scoped.ts:96-121` — verified), plus A10's
  enumeration against a spy delegate. Three independent layers; sound.
- **AA-5's no-context branch** — correct, and correctly placed before `inflight++`; the
  non-optional `businessId` with a runtime throw is the right belt against Prisma's
  drop-undefined semantics (the `feedback_auth_req_user_shape` footgun).
- **`probeContinuation` awaiting inside `runReentry`** — matches every existing
  `executePlan` branch and the `project_scoped_prisma_mechanism` lesson; correct.
- **`shouldShadow()` conditions 4–6** (`!isReentrant()`, `!getUnscopedReason()`,
  `txSlot.getStore() === undefined`) — each verified against live code; correctly
  prevents sampling inside re-dispatch, sanctioned unscoped windows, and transactions.
- **Tenant key provenance** — unchanged from the prior audit: sourced from the signed
  JWT via `req.user.businessId` (`middleware/auth.ts:75`), never request input.
- **`requireAdmin`** — genuinely strong (Bearer-only, blacklist, DB re-verification,
  JWT-vs-DB role mismatch → forced re-auth); A8's "401 not 404" is the right adoption
  proof for the mount.
- **PII wall construction** — key-allowlist over denylist, post-winston byte assertion,
  args never crossing the boundary; sound apart from B-6.
- **B7 ratchet mechanism** — monotone-down, per-file, with stale-row reporting; sound
  apart from the walk-root gap (M-4a).
- **Migration sequence** — purely additive, two new tables, no backfill, no NOT-NULL
  promotion; the three-step rule correctly does not apply. `migrate deploy` already in
  `render.yaml`. Kill switch is env-only. No finding.
- **`routeHint` NOT NULL (D-4) and `lastSeenAt` (D-5)** — both corrections to the SCOPE
  are right, and the Postgres NULL-distinctness reasoning behind D-4 is correct.
- **AA-2's widened dedupe key** — the Sentry/Rollbar fingerprinting convention is the
  right precedent and the cap re-check is sound.

---

## 9. Gate checklist — all must clear before Phase 3

- [ ] **B-1** Every fire-and-forget in the harness carries a terminal `.catch`
      (`sink.write`, `stats.bump`, `observe`), modelled on `prisma.ts:76-86`. §4.1's
      containment table gains a row for it.
- [ ] **B-2** Sink writes brought under a concurrency gauge; breaker records sink
      failures; `ARCHITECTURE:924`'s "zero pool slots" corrected to "zero probe slots,
      one sink write".
- [ ] **B-3** `sink-write-failed` counter, emitted on a path independent of the failing
      one, surfaced on the status payload, and added to the exit criteria at 0.
      Criterion 2 re-based on a `routeHint`-keyed `ScopedShadowStat` rollup (also closes
      RS-1 and the §5.1/§9.1 record-everything ambiguity).
- [ ] **B-4** `qa.yml` step running `npm run lint:raw-client`, and A9 re-pointed at the
      CI invocation; `prepare` script installs `core.hooksPath`; hook line kept as
      defence-in-depth.
- [ ] **B-5** Linter extended to see injection-shaped raw-client consumers (or a
      type-level equivalent); §7.6 states plainly that File #18's row is not coverage;
      B2 gains stale-row reporting; dead `server/scripts/...` row removed.
- [ ] **B-6** `cap 20` restated in §7.1 on both id arrays; canary fixture constrained to
      a bounded synthetic id set rather than an unbounded `findMany`.
- [ ] **M-1** `shadow-status.service.ts` reads wrapped in `runUnscoped('platform.admin')`
      per the M2 precedent.
- [ ] **M-2** `setShadowPort` mode-guarded and one-shot; shadow branch asserts mode.
- [ ] **M-3** AC added: an authorised status read writes exactly one `AdminAction` row.
- [ ] **M-4** `stats.ts` declared Prisma-query-API-only, or a reviewed
      `raw-sql-audit.allowlist.json` row lands in the same commit; linter walk root
      widened past `server/src`.
- [ ] **M-5** Sink added to the erasure inventory, or a `createdAt` ceiling added
      alongside the `lastSeenAt` retention rule.
- [ ] **§12.2 item 6** over-claim corrected: the dual-mode suite run is not evidence
      that `enforce` works.

Clearing B-1 … B-6 converts this audit to **APPROVED**. The M-items are conditions on
the build, in the same sense as H1–H4 / M1–M5 in
`SECURITY_AUDIT_tenant-isolation.md` — they do not require another design revision, but
they must be closed before `enforce` is considered.

---

## 10. Note for the next auditor

Every round on this epic has found its defects one layer below where the previous round
looked: SCOPE audit found unreachable *definitions*; architecture audit rev 1 found
unfalsifiable *controls*; this audit found an unaudited *write path* behind a
well-audited read path. The recurring shape is that attention concentrates on the
component under discussion and stops at its first fire-and-forget boundary — `void
sink.write(...)` was in the pseudocode through three rounds and read as a terminal
statement rather than as a promise nobody owns.

If there is a fourth round, the untouched layer is the **retention and rollup crons**
(Files #31/#32/#33) — they run unattended, hold the base client, and delete from the
table that the cutover decision reads. Nobody has audited what happens when the
retention cron and the 72-hour `diverged=0` window disagree about which rows exist.


---

# §11 — rev-3 re-audit (2026-07-21)

**Verdict: APPROVED WITH CONDITIONS.** All six blocking findings and all five mediums
are genuinely closed. Two new mediums were opened by the fixes themselves (N-1, N-2),
two low items carry over as build-time refinements, and four conditions attach to
phase gates. None requires another architecture revision — every condition is a change
to code that has not been written yet, verifiable at the phase gate that already
exists for it.

Scope of this pass, per the coordinator: (a) is each finding genuinely closed, (b) did
any fix open a new hole. Surfaces cleared in §1–§10 were not re-litigated.

## 11.1 Closure table

| ID | Claim | Verified | Disposition |
|---|---|---|---|
| **B-1** unowned promise kills the process | all fire-and-forget goes through `emit()`/`emitStatsOnly()`; no bare `void promise` anywhere | **Exhaustive sweep run.** Three `void` occurrences exist in rev 3 — ARCH:281 (`observe()` call, `.catch(() => countHarnessError())`), ARCH:505 (`sink.write` → `.then().catch(onSinkFailure).finally()`), ARCH:514 (`stats.bump` → same chain). Every one carries a terminal handler. §4.1 gains the fifth containment row (ARCH:314); §10 makes `SINK_SHED` terminal (ARCH:1193, 1215); A12/AC-26 inject a rejecting `ShadowDb` with an `unhandledRejection` spy (ARCH:1303) | **CLOSED** — residual **N-2** below |
| **B-2** sink writes outside the connection budget | gauge default 2, sheds not queues, feeds the breaker, footprint 4 of 10 | Footprint re-checked against source, not against the doc: `prisma.ts` sets `connection_limit=10`, and `softDeleted`/`scoped` are both `$extends` of one `base` client, so there is exactly one 10-connection pool. 2 probe + 2 sink = **4 of 10 is accurate**. The false "zero pool slots" line is corrected in place (ARCH:1270-1272) | **CLOSED** |
| **B-3** a broken sink greens the gate | in-process counter reported off-path; exit criterion at 0; RS-1 folded in | Report path is genuinely independent: `onSinkFailure` writes log + Sentry group + status payload (ARCH:517-522, 1008, 1047), never a `ScopedShadowStat` row. The restart-laundering objection I was going to raise is **already answered** — ARCH:1243-1247 gates on the counter **and** on absence of the `['shadow','sink-write-failed']` Sentry group over the same window, which is the durable half. §7.2's cap arithmetic is undisturbed: clean comparisons write no divergence row (D-13/AC-30, ARCH:798-802), so the divergence population only shrinks. `ScopedShadowStat` correctly widened to `@@unique([hourBucket, kind, routeHint])` with a matching index; criterion-2 cardinality (168 × ~200 ≈ 34k / 7d) is sound | **CLOSED** — residual **N-1** below |
| **B-4** the lint control has no invoker | `qa.yml` step + `prepare` hooksPath + A9b executes the extracted command | A9b is tied to the **invoker**, not to a file that exists: it parses `qa.yml`, extracts the `run:` string referencing `lint:raw-client`, and **executes that extracted string** against a planted violation, requiring non-zero exit (ARCH:1300, AC-31 at ARCH:1797, File #57). It reddens on deletion (nothing to extract), rename, and rule breakage — the three ways AA-4 failed. CI is an invoker that cannot be locally unconfigured; the `prepare` script is correctly the *defence-in-depth* half, not the load-bearing one | **CLOSED** |
| **B-5** the control cannot see an injected client | allowlist row is not coverage; injection-shaped detection; stale rows; widened root | §7.6 (ARCH:894-943) now states plainly that File #18's allowlist row is **not coverage**, cites `lint-raw-client.mjs:93` (the import-shaped check) and the already-dead `RAW_CLIENT_ALLOWLIST:36` row, and lists all three fixes | **CLOSED** — refinement **N-3** below |
| **B-6** cross-tenant identifier-linkage store | `SHADOW_MAX_IDS = 20` restated + enforced + asserted; §9.3 bounds it four ways; D-15 bounded canary | §7.1 carries the cap comment on both arrays plus the new `@@index([createdAt])`; §9.3 (ARCH:1149-1183) states the linkage threat in plain terms and bounds it by cap / dual retention ceiling / admin-gated hashed access / **D-15** replacing SCOPE:413-416's unbounded canary `findMany` with `findMany({ where: { id: { in: CANARY_FIXTURE_IDS } } })`. D-15 is the substantive one: without it the positive control was a recurring linkage source producing 20 real production ids every 15 minutes, forever | **CLOSED** |
| **M-1** cross-tenant status read unlogged | `runUnscoped('platform.admin')` | Matches the M2 precedent in `SECURITY_AUDIT_tenant-isolation.md:135-138` | CLOSED |
| **M-2** harness absent, not flag-disabled | `setShadowPort` mode guard + one-shot | **Checked properly, as asked.** §3.1a (ARCH:230-267): throws `ShadowPortModeError` unless mode is `shadow`, throws `ShadowPortAlreadySetError` on a second call, mode read by direct import (D-10), belt assertion `shadowPort && mode === 'shadow'` in the branch, **no `clearShadowPort()`** (test isolation via File #47 `pool: 'forks'`/`isolate: true`), both throws asserted by AC-29. This is what upgrades the claim from convention to structure — under `off`/`enforce` the port cannot be set at all, so the harness is absent rather than disabled | **CLOSED — structurally** |
| **M-3** audit row droppable | AC-27 | One authorised read ⇒ exactly one `AdminAction` row (#40) | CLOSED |
| **M-4** stats path raw-SQL status undeclared | Prisma-query-API-only + conditional File #55 | See §11.4 — the conditional row is sound | CLOSED |
| **M-5** indefinite retention of linkage rows | dual ceiling + index | 30d `lastSeenAt` **or** 180d `createdAt` (D-14), `@@index([createdAt])` present, both tables in the runbook's DPDP erasure inventory | CLOSED |

## 11.2 New findings opened by the fixes

### N-1 (MEDIUM) — B-2's shedding and B-3's failure counter are the same integer

`SINK_SHED` is reached two ways and both increment `sinkWriteFailed`
(ARCH:1206-1207, and `onSinkFailure` is called from the saturation branch at
ARCH:500-503):

- **saturation** — gauge at `SHADOW_SINK_MAX_INFLIGHT`; benign backpressure, exactly
  what B-2 asked for;
- **rejection** — the sink write failed; a broken pipe, which is what B-3 gates on.

B-3's exit criterion is `sinkWriteFailed = 0` and *"a window ending with a non-zero
value does not qualify the `enforce` epic"* (ARCH:1243-1247). Under N-1 that criterion
is now also non-zero whenever the gauge sheds — and the gate where shedding is most
likely is **stage 1, staging at sample 1.0** (ARCH:1225), with two slots serving a
stats bump on *every* sampled read while divergence writes are rare. Two outcomes,
both bad: the gate is unachievable, or the operator learns to wave the counter
through — which is precisely the "an empty table and a broken pipe are
indistinguishable" failure B-3 was raised to prevent, reintroduced one level up.

Both events must feed the breaker (correct as designed). They must not share a
counter.

**Condition C1** — split into `sinkShed` (saturation; breaker-feeding; budgeted,
non-zero permitted with a stated ceiling) and `sinkWriteFailed` (rejection;
disqualifying at 0; the only one carrying the `['shadow','sink-write-failed']`
Sentry fingerprint). Update ARCH:1206-1207, §11 stage 1, the exit criteria, and
A12/AC-26 (which asserts `sinkWriteFailed === 50` on 50 *rejections* — that assertion
stays correct under the split, which is a good sign the split is the natural shape).

### N-2 (MEDIUM) — the terminal handlers are not themselves total

B-1's claim is "no un-owned promise". True. But a `.catch(fn)` only contains the
rejection if `fn` cannot throw, and neither handler is protected:

- `onSinkFailure` (ARCH:517-522) calls `logger.error` and `captureException`. A throw
  there — Sentry not initialised in a worker, a transport error — rejects the promise
  returned by `.catch()`, which nothing owns. Node ≥ 15: process exit. B-1 exactly.
- ARCH:283, `.catch(() => shadowPort!.countHarnessError())` — same shape, and the
  non-null assertion is a second way to throw if a future edit ever nulls the port.

AC-26 injects a rejecting `ShadowDb`, which exercises the handler being *called*, not
the handler *throwing*, so the assertion does not cover this.

**Condition C2** — wrap both handler bodies in `try { … } catch { /* last resort */ }`
(or route both through one `safeInvoke` helper), and extend AC-26 with a second case:
a `logger`/`captureException` stub that throws, asserting the `unhandledRejection` spy
still never fires.

## 11.3 Low / build-time refinements

- **N-3 (LOW)** — §7.6 item 1's first half ("flag any function accepting a
  `PrismaClient`-shaped parameter in a non-allowlisted file") is too broad to
  implement as a violation. Measured on the current tree: **13** files have a
  prisma-shaped function parameter by signature grep, but **56** reference
  `ExtendedPrismaClient` / `TransactionClient` out of 1094 `.ts` files under
  `server/src`. Those 56 receive the *scoped* client, not `clients.base` — flagging
  them is pure false positive, and the predictable response is a bulk-filled
  allowlist, which leaves B2 **weaker** than it is today. The second half — flag
  **call sites passing `clients.base` / `__basePrismaUnsafe` as an argument** out of
  an allowlisted file — is precise, targets the actual AA-6 escape, and is sufficient
  on its own. **Condition C3:** implement the call-site rule as the violation; keep
  the parameter-shape rule advisory-only (report, do not fail) or drop it.
- **N-4 (LOW)** — signature inconsistency in §5.2: `emit` calls `stats.bump(statKinds)`
  (ARCH:506) while `emitStatsOnly` calls `stats.bump(statKinds, routeHint)`
  (ARCH:514). Harmless in prose, but the builder should not have to guess whether
  `routeHint` is optional on the rollup key that criterion 2 reads. Pin the signature.

## 11.4 The two questions referred back

### Files #31/#32/#33 — defer to the `enforce` epic? **Yes, with C4.**

The interim reasoning is stronger than the architect gave it credit for. It is not an
argument; it is arithmetic. Retention deletes on `lastSeenAt < 30d`, every exit-criteria
query runs over `lastSeenAt` within a 7-day window (§7.4), so a row that fires *inside*
the window has a `lastSeenAt` inside the window and **cannot** be deleted within it.
The set of rows the cutover reads and the set retention removes are disjoint by
construction, not by luck.

What is not guarded is drift in the constants: if the 30/180 ceilings are ever exposed
as env knobs (File #50 adds "env knobs" to `render.yaml`) or lowered in code, the
disjointness silently ends and the failure mode is a window that reads clean for a
reason unrelated to the code — the same class as B-3. So:

**Condition C4** — (a) keep the 30/180 ceilings as module constants, **not** env knobs;
if File #50 exposes either, add a boot assertion that the retention floor exceeds the
watch window. (b) Record the "audit #31/#32/#33 before using this table's emptiness as
evidence" precondition in `docs/GOLD_STANDARD.md`'s backlog via File #51 — the same
durable-owner treatment SS-6 gave SR-2 — not only in §19 of a document that closes with
this epic. §19 risk 4 already establishes that "listed in the design plan" is not a
control; risk 5 should be held to its own standard.

With C4, #31 does not need to be in scope now. This epic is not authorised to make the
cutover decision (§11 stage 6), and the crons are read-only with respect to every
control this audit relies on.

### File #55 conditional row — **sound.**

A conditional File Plan row is unsound only when its absence is undetectable. Here the
absence is mechanically adjudicated: the B7 ratchet in `lint-raw-client.mjs:117-146`
is per-file and monotone-down, so a new `$queryRaw`/`$executeRaw` site in
`prisma-shadow.stats.ts` with no baseline row **fails the build**. The builder cannot
silently exercise the conditional in either direction — raw SQL without the row is
blocked, and the row without raw SQL is caught by the same script's stale-row
reporting (:143-145). That is exactly the guess-at-build-time problem being resolved by
a gate rather than by discretion. Keep it.

## 11.5 Conditions summary

| # | Condition | Gate |
|---|---|---|
| **C1** | Split `sinkShed` (saturation) from `sinkWriteFailed` (rejection); only the latter is disqualifying-at-0 and Sentry-fingerprinted (N-1) | before stage 1 |
| **C2** | Make `onSinkFailure` and the ARCH:283 catch total; extend AC-26 with a throwing-logger case (N-2) | phase 3 |
| **C3** | B-5 linter ships the `clients.base`-passed-as-argument rule as the violation; parameter-shape heuristic advisory-only (N-3) | phase 2 |
| **C4** | Retention ceilings stay constants (or gain a boot assertion); the #31/#32/#33 precondition recorded in `GOLD_STANDARD.md` via File #51 (§19 risk 5) | phase 5 / doc |

C1 and C2 are code-level and cheap. C3 protects the control from being degraded by its
own fix. C4 is a documentation-durability item with one code constraint.

## 11.6 Nothing weakened

Re-confirmed against rev 3: the `enforce` path in `prisma-scoped.ts` is untouched
below the shadow branch (ARCH:289-293 is byte-identical to the current guard chain and
`ScopedContextError` still throws on a missing frame); no new export re-opens a usable
unscoped `prisma` symbol; the port cannot be set outside `shadow` (M-2); and the
divergence table remains an anomaly table (AC-30) rather than a traffic log.

**Rev-3 verdict: APPROVED WITH CONDITIONS.** Proceed to build. C1–C4 are gate items,
not another revision cycle.
