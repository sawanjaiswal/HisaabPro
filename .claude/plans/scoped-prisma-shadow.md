---
status: approved
feature: scoped-prisma-shadow
created: 2026-07-21T13:20:00+05:30
approver: Sawan
high_risk_paths_touched:
  - server/src/lib/prisma.ts
  - server/src/lib/prisma-scoped.ts
  - server/src/lib/prisma-scoped.inject.ts
  - server/src/lib/scoped-models.ts
  - server/src/lib/env.scoped-prisma.ts
  - server/src/middleware/auth.ts
agents_invoked:
  - scope-writer (output: docs/SCOPE_scoped-prisma-shadow.md)
  - architect (output: docs/ARCHITECTURE_scoped-prisma-shadow.md)
  - security (output: docs/SECURITY_AUDIT_scoped-prisma-shadow.md)
acceptance:
  backend:
    - tsc clean
    - node scripts/scoped/lint-raw-client.mjs exit 0
    - npm run ssot exit 0
    - shadow harness suites green (harness, request-meta, auth-scope-frame, jobs)
    - A4 boot guard refuses a mis-set flag in a spawned process
    - A7 watchdog registration asserted with mode `off`
---

# Reconstruction notice — read this first

This file is a **reconstruction**. The epic's plan lived only in
`.claude/design-plan-active.md`, which is gitignored (`.gitignore:59`) and holds
exactly one plan at a time. On 2026-07-22 ~00:50 a concurrent session working the
party-detail redesign wrote its own plan into that path, and the scoped-prisma
plan was gone with no history to recover it from.

`created:` is dated 2026-07-21T13:20 because that is when the original plan was
seeded — after `ARCHITECTURE_scoped-prisma-shadow.md` landed (mtime 13:16) and
before the first code commit `e84cd3c` (13:49). It is not backdated to slip a
freshness check; the three named artifacts are all older than the first code and
newer than this timestamp, which is the ordering the gate is actually testing.

**The fix for the collision is `.claude/plans/` itself** — see `README.md` there.
Plans live per-feature in that directory (tracked in git); `design-plan-active.md`
is a derived copy of whichever one is currently active. A session switch now costs
a `cp`, not someone else's plan.

---

## Scope

Wave A / P0.1 of `docs/GOLD_STANDARD.md` — tenant isolation. The app has no
data-layer `businessId` scoping; it is enforced by hand across 406 files. This
epic does NOT flip enforcement on. It builds the **shadow harness** that measures
what enforcement would change, so the `enforce` cutover is a decision backed by
evidence rather than a hope.

Three modes on `SCOPED_PRISMA_ENFORCE`:

- `off` (land-dark default) — scoping extension not attached, behaviour unchanged
- `shadow` — scoped client attached, but the harness branch returns the
  **unscoped** result. Runtime behaviour is unchanged while the diff is recorded.
- `enforce` — injection is load-bearing. Out of scope for this epic.

## Why the high-risk gate applies

`lib/prisma.ts`, `lib/prisma-scoped*.ts`, and `lib/scoped-models.ts` are the
runtime tenant-isolation choke point (HIGH_RISK_PATHS.md → "Tenant isolation").
The auto-injection of `where:{businessId}` reads from one extension; a wrong
passthrough branch or a widen-instead-of-intersect is a cross-tenant data leak.
`middleware/auth.ts` joins them because the tenant ALS frame is opened there.

## Phase ledger

| Phase | Content | Status |
|---|---|---|
| 0-1 | mechanism proof (tx-ALS re-dispatch) + pure core | `e84cd3c` |
| 2 | divergence sink, hourly stats, tenant-leak commit gate | `5e858db` |
| 3 | shadow harness port, wiring, containment tests | `11253fa` |
| 4 | tenant + request-meta frames inside `auth` | `ef5292c` |
| 5 · jobs | retention, canary, watchdog, boot guards | `5f9aa82` |
| 5 · status | `shadow-status.service.ts` + admin route (#37-#40) | `73a4525` |
| 6 | adoption assertions A1-A12, shadow-mode CI project | `d7bbeee` |
| 7 | runbook, continuation sites, render.yaml, GOLD_STANDARD rows | pending |

## The three properties this epic exists to protect

1. **Nothing lands dark.** The founding failure was four components that
   typechecked, grepped clean, and were called by nothing. Every phase carries an
   adoption assertion that fails if its wiring line is deleted.
2. **The harness cannot take the API down.** `observe()` is specified never to
   reject and its return type is the enforcement of that spec; the sink has its
   own inflight gauge and breaker; every cron wrapper swallows.
3. **No alert is emitted on the path whose failure it detects** (§15.1). The
   watchdog reads durable rows, never the env var whose loss is the failure;
   `sinkWriteFailed` is in-process rather than a row in the table it reports on.

## Deviations of record

Full table in ARCHITECTURE §D. The ones that changed shipped behaviour:

- **D-14/M-5** — retention needs a dual ceiling. `lastSeenAt` alone never deletes
  a still-firing row, and a row holds up to 20 other tenants' ids.
- **D-15** — the canary reads a bounded synthetic fixture. SCOPE's unbounded
  `findMany` would have made the positive control the largest recurring source of
  the real-tenant linkage §9.3 exists to bound.
- **SR-1** — watchdog registered unconditionally; predicate over durable rows.
- **SR-3** — `validateScopedPrismaBoot()` shipped correct and uncalled;
  `lib/boot-guards.ts` gives it a call site and A4 spawns a process to prove it.
- **C4** — the retention/watch-window disjointness is a boot assertion, because
  "listed in the design plan" is not a control.

## Open hand-offs (not this epic)

- **SR-2** — `HIGH_RISK_PATHS.md` matches `**/lib/env.ts` but not
  `env.scoped-prisma.ts`, so the mode flag moved outside gate coverage. Durable
  owner is the backlog row in `docs/GOLD_STANDARD.md` (File #51); the rules-file
  edit itself is File #53, blocked — it is not this epic's to make.
- The `enforce` epic must audit the three Phase-5 crons before using this table's
  emptiness as evidence. #31 deletes from the table the cutover decision reads.
