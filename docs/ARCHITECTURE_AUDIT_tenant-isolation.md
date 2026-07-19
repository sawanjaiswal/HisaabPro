---
audit_of: ARCHITECTURE_tenant-isolation.md
scope_ref: SCOPE_tenant-isolation.md
scope_audit_ref: SCOPE_AUDIT_tenant-isolation.md
auditor: architecture-auditor
audited_at: 2026-07-19T14:55:00+05:30
prisma_version_verified: 6.19.2
verdict: PASS
must_ship_gaps: 0
should_ship_gaps: 5
future_epic_recommendations: 0
scope_conformance_breaks: 0
---

# Architecture Audit — Data-Layer Tenant Isolation (Scoped Prisma)

## Verdict

**PASS.** No MUST_SHIP design hole. I read the live code before trusting the prose
(`prisma.ts`, `soft-delete/{index,middleware}.ts`, `schema.prisma`, `env.ts`,
`__tests__/setup.ts`) and verified extension semantics against the installed
`@prisma/client@6.19.2`. The linchpin mechanism (client-level `$extends`
`$allOperations` re-dispatch via a late-bound `getInner()`) is real, non-recursive,
and injects `businessId` exactly once; the one genuinely-unproven piece (re-dispatch
onto the caller's OPEN interactive transaction) is properly fenced behind a
concretely-specified Phase-(-1) hard-gate spike with a real, implementable fallback
and an env-flag rollback at every phase. Every enumerated leak vector has a coded,
fail-closed defense; the one uncovered surface (`$queryRaw`) is explicitly
acknowledged, audit-gated, and its "structural isolation / DPDP" claim withheld until
the gate clears. The FK map, the `96` count, the GodownStock removal, and the
ImportJobRow=`jobId` (CF-1) fix all verify against the live schema. Completeness test
#14 (CF-2) is specified at the column level and would fail CI on a wrong FK string.

Five SHOULD_SHIP findings below are implementation-completeness / test-coverage
tightenings — none is a shippable leak (each fails closed at CI or at runtime with a
thrown error, never with another tenant's rows). They must be closed before build but
do not block the design gate.

This is the last design gate before security review. It clears.

---

## SCOPE Conformance Map

| SCOPE decision (MUST unless noted) | Architecture artifact | Verified against | Status |
|---|---|---|---|
| Inject `businessId` into every `where` on 96 direct models, AND-intersect (never widen) | `injectScope` `merged` §2.3; `{AND:[caller,{businessId}]}` (B12) | `grep -cE '^\s+businessId\s+' schema.prisma` = **96** ✓ | OK |
| Two-step parent-id planner for child `updateMany`/`deleteMany` (B9) | `childMany` plan §2.3/§3.5; `prisma-scoped.rewrite.ts` (#4) | Prisma relation-filter ban on write-many acknowledged ✓ | OK |
| Validate nested `connect`/`connectOrCreate` in-tenant (B13) | `FkGuard`+`guarded` §2.2/§3.6 | extensions don't recurse into connect ✓ | OK |
| Standalone child-create scalar FK validated (deepens B3) | `guarded` §3.4 | — | OK (deepened, §Deviations 2) |
| DMMF-mechanical completeness; allowlist can't exempt a `businessId` model (Gap 3) | test #14 §5.3 assertions 1–4 | partition re-run: 51 free = 27 children + 24 globals, 0 unclassified ✓ | OK |
| Phase-0 real-PG spike BEFORE wiring (Gap 4) | spike #17, Rollout Phase -1 §10 | `postgres:16` CI prereq named ✓ | OK |
| Fail closed when context unset (B8, GOLD G1) | `getBusinessContext()` undefined → throw §2.4/§3.7 | `als.getStore()` undefined outside frame ✓ | OK |
| Red-team on real ephemeral CI Postgres (hard gate) | test #15 | `vi.importActual` around wholesale prisma mock (setup.ts:11) ✓ | OK |
| ALS-continuation tests (finish/stream/PDF/fanout) (Gap 6) | §3.8 + test #16 | — | OK (see S3) |
| One-time audit of 86 raw-SQL sites gating enforce | `raw-sql-audit.allowlist.json` (#12), Phase-0→2 gate | `$queryRaw` outside extension confirmed ✓ | OK |
| Audited `runUnscoped(reason)` for reads AND no-context writes | `runUnscoped` §2.1; `UnscopedAccessLog`; `als.exit(fn)` fail-closed nesting | — | OK |
| Keep 1245 tests green; injector unit-tested off the prisma mock | `vi.importActual` #13; setup.ts stubs #20 | setup.ts Proxy returns `{}` (line 15) ✓ | OK |
| Shadow diff + no-manual-scope flag (SHOULD) | `prisma-shadow.ts` (#10) §10 | — | OK |
| CI lint: scoped model on `__basePrismaUnsafe` + new raw SQL (SHOULD) | `lint-raw-client.mjs` (#11) | — | OK |
| Boot-guard prod-refuses-start unless enforce (SHOULD) | `validateScopedPrismaBoot()` (#8) §7 | — | OK |
| `PayslipSnapshot @@index([businessId,createdAt])` (SS-1, SHOULD) | Migration B §4 (#22) | PayslipSnapshot has `businessId`, only `@unique payrollId`, no composite idx ✓ | OK |
| Composition order soft-delete inner / scoping outer, proven | §6 + spike #17(c) | `base.$extends(softDelete)` (prisma.ts:57); soft-delete is `$allModels.$allOperations` query ext (middleware.ts:43) ✓ | OK |
| Rewrite mechanism = client `$extends` re-dispatch, not bare query-ext; named fallback | §6, §5.1 | `$allOperations` `query` bound to original op (library.d.ts:978); re-dispatch via `getInner()` ✓ | OK (see S1) |
| `$transaction` two-step within caller tx, no nested tx (SS-2) | §5.1 primary+fallback | primary `getExtensionContext(this)` dubious in query cb; fallback real ✓ | OK (see S1) |
| Corrected 27-row CHILD_SCOPED map; ImportJobRow=`jobId` (CF-1) | §5.2 table | `ImportJobRow { jobId String; job ImportJob @relation(fields:[jobId]) }` (schema:4316-19) ✓ | OK |
| GodownStock removed from children (directly-scoped) | §5.2 + Deviations 1 | `GodownStock { businessId String }` (schema:2856) ✓ | OK |
| Test #14 asserts FK column resolves as relation scalar → businessId ancestor (CF-2) | §5.3 assertions 1–4 | 3-row spot-check: paymentId/journalEntryId/appointmentId all scalar+relFromFields+child-no-biz+parent-biz ✓ | OK |
| `auth.audit-write` runUnscoped reason (SS-3) / setup.ts stubs (SS-4) / cleanup cron / `cron.<name>` | §2.1 `UnscopedReason`; #20; #18 | — | OK |

**scope_conformance_breaks: 0.** The two Deviations (GodownStock removal; B3
deepening) are strengthenings the SCOPE explicitly mandated (DMMF re-derivation) — not
silent overrules. Migration sequence (§4, A+B additive), dependency graph / file plan
(§File Plan, 23 rows), and rollout state machine (§7/§10) are all present → no
auto-block condition triggers.

---

## Must-ship gaps

**None.**

I actively tried to break the three load-bearing claims and each held:

- **Re-dispatch recursion (linchpin 1a/1b):** `createScopingExtension(() => softDeleted)`
  (§2.5) binds `getInner()` to the soft-delete-extended client that carries **no
  scoping layer**. A `rewriteFindFirst`/`twoStep` re-dispatch (`getInner().m.findFirst`)
  therefore enters soft-delete only — no re-entry into scoping, no infinite loop — and
  `businessId` is merged into the plan args exactly once before dispatch. Verified the
  callback `query` (library.d.ts:978) is bound to the *original* op, so switching ops
  genuinely requires the sibling-delegate call the design uses. Sound.
- **Composition with soft-delete (linchpin 2):** Traced `delete({where:{id}})`. Note
  the live soft-delete extension does **not** transform `delete`→`update` — it only
  injects `isDeleted:false` on the 8 READ_ACTIONS and passes every write through
  (middleware.ts:49-61). The architecture correctly grounds on this (§0 line 36) and
  never assumes otherwise. The two-step's resolve `getInner().m.findFirst({id,businessId})`
  IS a READ_ACTION, so soft-delete's `isDeleted:false` applies to the resolve — a
  soft-deleted row resolves to null → NOT_FOUND (fail-closed, correct). No
  double-application; no path where scoping is skipped because soft-delete already
  transformed the op (it transforms nothing but read `where`).
- **Fail-closed (5):** `getBusinessContext()` returns `als.getStore()` → `undefined`
  outside any frame → scoping throws `ScopedContextError` (§2.4). `runUnscoped` uses
  `als.exit(fn)` so a bare scoped query nested inside still throws unless it opens its
  own frame. `$queryRaw` is outside the extension — acknowledged, audit-gated (#12),
  claim withheld (A5). All fail-closed, none silently unscoped.

The FK map, `96` count, GodownStock removal, and CF-1 fix verify against the live
schema (see Conformance Map "Verified against" column). No businessId-free tenant-data
model requires multi-hop (grandchild) scoping: I enumerated all 51 businessId-free
models and their relation targets — every one that relates only to another
businessId-free model is a User/AdminUser/Coupon/Business-owned **platform global**
(the 24-model allowlist partition), not a tenant grandchild. The single-hop planner is
therefore complete, and test #14 assertion 3 fences any future multi-hop
misclassification at CI (it would reject a CHILD_SCOPED parent lacking `businessId`).

---

## Should-ship gaps

### S1 — The `$transaction` "primary" mechanism is very likely non-viable; the Proxy fallback is load-bearing, and the abandon→denormalize rollback does NOT cover the direct-model in-tx two-step

**What's off:** §5.1 nominates `Prisma.getExtensionContext(this)` as the *primary*
tx-client handle and relegates the Proxy+tx-ALS-slot wrapper to *fallback*. Verified
against library.d.ts: the `query.$allOperations` callback is typed
`DynamicQueryExtensionCb = <A>(args: A) => Promise<...>` (line 972) — a single-argument
callback with **no bound `this` delegate**. `getExtensionContext` is designed for
`client`/`model` component methods (where `this` is the delegate), not for a `query`
component callback. No existing code in the repo uses it. So the spike's part (d) will
almost certainly kill the primary and select the fallback — meaning the Proxy wrapper
(wrap `$transaction`, thread the tx client through a tx-scoped ALS slot, pass a
Proxy-wrapped `tx` to the callback) is effectively **the** mechanism, not a hedge.

That fallback IS genuinely implementable (it is the standard pre-`$extends`
multi-tenant Prisma pattern and does bind inside interactive transactions), which is
why this is not a MUST block. But two consequences are under-stated:

1. The terminal Phase-(-1) rollback ("abandon design → denormalize the 27 children")
   only rescues **children**. The two-step-in-tx problem also exists for the **96
   direct models** (update/delete/upsert *by unique* can't AND-inject `businessId` into
   a unique `where`, hence two-step). Denormalizing children does nothing for a
   `prisma.product.delete({where:{id}})` issued inside a caller's `$transaction`. If the
   Proxy fallback were also to fail, denorm is **not** a complete backstop.
2. Because the Proxy path is load-bearing, the spike (#17) must explicitly prove the
   **Proxy+tx-ALS-slot** path inside `$transaction`, not merely `getExtensionContext`.

**Fix:** Reframe §5.1/§6 so the Proxy+tx-ALS-slot wrapper is the **expected** mechanism
and `getExtensionContext` is the "try first, expected to fail" probe; make spike #17
part (d) assert the Proxy path (wrapped `tx`, one connection, rolls back together);
and add to the abandon-rollback a note that denormalization must be paired with an
`updateMany`-rewrite (or equivalent) for the direct-model by-id in-tx case, or state
plainly that the epic hard-depends on the Proxy mechanism.
**Severity:** SHOULD (defense exists and is implementable; fail-closed if it doesn't).

### S2 — Child READ relation-filter needs the relation FIELD name; the map only pins the FK scalar column

**What's missing:** §2.3 scopes child reads with a relation filter
`where:{AND:[caller,{<rel>:{businessId:ctx}}]}`. `<rel>` is the relation **navigation
field** on the child (e.g. `job` on `ImportJobRow`), **not** the scalar FK column
(`jobId`). The pinned map (§5.2) and File #1's description tabulate only the FK scalar;
`SCOPED_RELATION_FIELDS` is described as "for connect-guard" (scoped relation fields on
a **parent** that may be connected) — a different set from the child→parent relation
field name. The pure `injectScope` has no stated source for `<rel>`.

**Failure mode:** if `<rel>` is wrong/absent, Prisma throws "Unknown field" — fails
**closed** (no leak), but child `findMany`/`count`/`aggregate`/`groupBy` breaks at
runtime; red-team #15 would catch it late instead of the build catching it.
**Fix:** `CHILD_SCOPED` entries must carry (or DMMF-derive at load) the relation field
name — the relation whose `relationFromFields[0] === fk` — and test #14 should assert
it exists. Cheap (the DMMF data #14 already walks has it).
**Severity:** SHOULD (fail-closed, not a leak).

### S3 — No full-middleware-chain propagation test for the HAPPY path (recorded blindspot 2026-05-31)

**What's thin:** §3.8 leans on "Node's AsyncLocalStorage propagates across `await`
chains automatically" for the normal request path. `architecture-blindspots-2026-05-31.md`
records exactly this trap: the store only survives `mw → next() → handler` because
Express calls each `next()` synchronously; **any** intermediate middleware that calls
`next()` from a detached callback (`setImmediate`, un-awaited `.then()`,
`res.on('finish')`) drops the frame and every scoped query throws (self-inflicted
fail-closed DoS). File #16 tests the continuation *edge* cases; File #15 seeds context
directly. Neither is described as "drive a REAL route through the full
auth→business-resolution→scoped-context→handler chain under `enforce` and assert the
handler's scoped query sees ctx."

**Fix:** add that dedicated full-chain integration assertion (the blindspot's explicit
rule), and enumerate any middleware currently mounted between `scoped-context` and
handlers that calls `next()` asynchronously.
**Severity:** SHOULD (availability regression risk, fail-closed, not a leak).

### S4 — File #6 (transport / `executePlan` + tx dispatch) has no pre-planned overflow split

**What's risky:** #4 (rewrite planner, ~170L) got a pre-planned overflow row
(`prisma-scoped.childplan.ts`) — good discipline. #6 (transport, ~170L) carries five
plan-kind branches **plus** the tx dispatch, which under the Proxy fallback (S1) grows
to include the `$transaction` shim + tx-ALS-slot + Proxy-wrapped-tx logic. That is the
realistic path, and it is the file most likely to breach the 250L cap during build.
**Fix:** pre-plan a #6 split (e.g. `prisma-scoped.exec.ts` for `executePlan` /
`prisma-scoped.tx.ts` for the tx-client resolution) the same way #4 was pre-split.
**Severity:** SHOULD (File Plan realism; no contract violation yet, headroom exists).

### S5 — Two-step TOCTOU / isolation-level assumption is undocumented

**What's unstated:** the by-id two-step (resolve `findFirst({id,businessId})` → write
`by id`) has a window between resolve and write. Under Postgres default READ
COMMITTED, correctness relies on **`businessId` being immutable** (no tenant-transfer
operation) — which is true in this app (a row's owning tenant never changes), so the
window is not a real leak. But the design should say so.
**Fix:** one sentence in §5.1: the two-step assumes `businessId` immutability; a
concurrent delete of the resolved row simply yields a 0-row write (fail-closed). No
serializable isolation needed.
**Severity:** SHOULD (documentation of an assumption; negligible real risk).

---

## Future-epic recommendations

None beyond the four the SCOPE already tiered (406-service manual-scope migration;
raw-SQL auto-parser; per-user scoping of user globals; child-model `businessId`
denormalization). All correctly deferred; the architecture does not smuggle any of them
back into MVP.

---

## What the architecture got right (preserve)

- **Grounded the linchpin in the real limitation, not a hope.** It reads the live
  soft-delete doc-comment's "query extensions cannot reliably change operation type"
  as a hard gate, chooses `$allOperations`+`getInner()` re-dispatch (which I confirmed
  is the only op-switching mechanism available), and makes a real-Postgres spike a
  Phase-(-1) hard gate with a named fallback and an env-flag rollback at every phase.
- **`getInner()` cycle-break and single-injection** are correct (`() => softDeleted`
  lazy getter; re-dispatch avoids scoping re-entry; soft-delete still composes).
- **Fail-closed everywhere:** unset ALS → throw; `runUnscoped` → `als.exit`; empty
  `businessId` rejected at `runInBusinessContext` (never stores `''`); connect/scalar-FK
  foreign → NOT_FOUND.
- **Completeness = correctness at the COLUMN level** (test #14, CF-2) — DMMF-authoritative,
  the prose table is explicitly a human aid. This is the right inversion.
- **Honest uncovered surface:** `$queryRaw` acknowledged, audit-gated, DPDP claim
  withheld until 0 unwaived. No hand-waving.
- **Verified facts, not transcribed ones:** the `96` count, GodownStock's own
  `businessId`, ImportJobRow=`jobId`, PayslipSnapshot's missing composite index — all
  reproduce against the live schema.

---

## Cross-session learnings applied

- `scope-writer-blindspots-2026-07-19-tenant-isolation.md` — all 7 gap classes checked:
  (1) child write-many relation-filter ban → `childMany` scalar-`in` planner ✓;
  (2) extensions don't recurse into connect → explicit `FkGuard` ✓;
  (3) completeness=correctness from DMMF → test #14 ✓;
  (4) prove op-rewrite on real DB → spike #17 ✓ (I re-verified the `query`-op binding
  in library.d.ts that makes this necessary); (5) raw-SQL claim false while `$queryRaw`
  bypasses → 86-site audit gate ✓; (6) ALS continuation loss → §3.8/#16 ✓ (tightened by
  S3); (7) FK map DMMF-validated at column level → CF-2/#14 assertion 2 ✓ (I spot-checked
  3 rows + the GodownStock/ImportJobRow corrections against the schema).
- `architecture-blindspots-2026-05-31.md` — "ALS-across-`next()` must be tested against
  the REAL middleware chain, not just cited." Caught **S3**: §3.8 cites the propagation
  guarantee for the happy path; the mandated full-chain integration assertion is not in
  the File Plan. Also "don't hardcode cardinality a checker re-derives" → satisfied
  (`96`/`27` are DMMF-re-derived by #14, table is a snapshot).
- `architecture-blindspots-2026-06-07.md` — no-context tenant-scoped writes need a
  `runUnscoped` reason → `auth.audit-write` present (SS-3) ✓.
- `contexts/india-android-saas.md`, `contexts/auth-patterns.md` — reviewed; the
  `req.user.userId` (not `.id`) IDOR class (MEMORY `feedback_auth_req_user_shape`) is
  the exact class this epic structurally closes; frame opens from `req.user` after
  `requireAuth` ✓.

---

## Revision dialogue note

If the build surfaces that the Proxy+tx-ALS-slot wrapper cannot pass a Proxy-wrapped
`tx` into a caller's `$transaction` callback without breaking type inference on the
`ExtendedPrismaClient` public type (services are untouched per §2.5), that is a NEW
gap class (public-client-type preservation under a Proxy re-wrap) — append it to
`~/.claude/learnings/architecture-blindspots-2026-07-19.md`.
