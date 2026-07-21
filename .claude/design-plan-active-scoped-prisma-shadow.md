---
status: approved
feature: scoped-prisma-shadow
created: 2026-07-21T12:00:00+05:30
approver: Sawan (standing authorization — gold-standard Wave A)
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
  - server/src/lib/prisma.ts
  - server/src/lib/prisma-scoped.ts
  - server/src/middleware/auth.ts
agents_invoked:
  - scope-writer (output: docs/SCOPE_scoped-prisma-shadow.md)
  - scope-auditor (output: docs/SCOPE_AUDIT_scoped-prisma-shadow.md, verdict: PASS at rev 3)
  - architect (output: docs/ARCHITECTURE_scoped-prisma-shadow.md)
  - architecture-auditor (output: docs/ARCHITECTURE_AUDIT_scoped-prisma-shadow.md, verdict: PASS at rev 2)
  - security (output: docs/SECURITY_AUDIT_scoped-prisma-shadow.md, verdict: APPROVED WITH CONDITIONS at rev 3, conditions applied in rev 4)
files_planned:
  - server/src/lib/__tests__/prisma-shadow.spike.test.ts
  - server/src/lib/prisma-shadow.types.ts
  - server/src/lib/prisma-shadow.constants.ts
  - server/src/lib/prisma-shadow.diff.ts
  - server/src/lib/prisma-shadow.classify.ts
  - server/src/lib/prisma-shadow.redact.ts
  - server/src/lib/prisma-shadow.throttle.ts
  - server/src/lib/__tests__/prisma-shadow.diff.test.ts
  - server/src/lib/__tests__/prisma-shadow.classify.test.ts
  - server/src/lib/__tests__/prisma-shadow.redact.test.ts
  - server/src/lib/__tests__/prisma-shadow.throttle.test.ts
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
  - server/src/lib/scoped-models.ts
  - server/src/lib/prisma-shadow.sink.ts
  - server/src/lib/prisma-shadow.stats.ts
  - server/src/lib/__tests__/prisma-shadow.sink.test.ts
  - scripts/scoped/lint-raw-client.mjs
  - package.json
  - .githooks/pre-commit
  - server/src/lib/prisma-shadow.ts
  - server/src/lib/prisma-scoped.ts
  - server/src/lib/prisma.ts
  - server/src/lib/env.scoped-prisma.ts
  - server/src/lib/__tests__/prisma-shadow.harness.test.ts
  - server/src/lib/request-meta.ts
  - server/src/middleware/scoped-context.ts
  - server/src/middleware/auth.ts
  - server/src/lib/__tests__/request-meta.test.ts
  - server/src/middleware/__tests__/auth-scope-frame.test.ts
  - server/src/jobs/shadow-retention.cron.ts
  - server/src/jobs/shadow-canary.cron.ts
  - server/src/jobs/shadow-watchdog.cron.ts
  - server/src/lib/cron-scheduler.ts
  - server/src/lib/boot-guards.ts
  - server/src/index.ts
  - server/src/services/shadow/shadow-status.service.ts
  - server/src/routes/admin/scoped-shadow.admin.ts
  - server/src/routes/admin/index.ts
  - server/src/routes/admin/__tests__/scoped-shadow.admin.test.ts
  - server/src/__tests__/adoption/shadow-adoption.test.ts
  - server/src/__tests__/adoption/boot-guard.spawn.test.ts
  - server/src/__tests__/adoption/pre-commit-gate.spawn.test.ts
  - scripts/scoped/__tests__/lint-raw-client.rule.test.ts
  - server/src/__tests__/scoped-shadow.readonly.test.ts
  - server/src/__tests__/scoped-shadow.integration.test.ts
  - server/vitest.shadow.config.ts
  - docs/RUNBOOK_scoped-shadow.md
  - docs/CONTINUATION_SITES_scoped-prisma.md
  - render.yaml
  - docs/GOLD_STANDARD.md
  - ssot.config.mjs
  - .github/workflows/qa.yml
  - scripts/scoped/raw-sql-audit.allowlist.json
  - server/src/lib/__tests__/prisma-shadow.sink-failure.test.ts
  - server/src/__tests__/adoption/ci-lint-invocation.test.ts
acceptance:
  backend:
    - tsc clean (npx tsc -b --noEmit)
    - node scripts/enforce.js — 0 new errors
    - npm run ssot — exit 0
    - vitest shadow suite green under vitest.shadow.config.ts
    - adoption assertions A1-A12 redden when their call site is deleted (spot-checked, not assumed)
    - Phase 0 spike gate: Promise.resolve(q(args)) collapses to exactly one SELECT
    - curl admin status endpoint — 200 as platform admin, 401 unauthenticated, 403 as non-admin
  frontend:
    - n/a — server-only epic, no UI surface
---

# scoped-prisma-shadow — Implementation Plan

Wave A of `docs/GOLD_STANDARD.md`. Under `SCOPED_PRISMA_MODE=shadow`, run the
scoped query plan as a read-only probe alongside each sampled real query, diff
the results, and persist divergences to `ScopedShadowDivergence` — so the blast
radius of flipping to `enforce` is measured before the flip, not after.

## Why the gate chain ran five rounds

Every artifact in this layer is a **definition**, and a definition typechecks,
tests, and greps identically whether or not anything calls it. Four components
were written, merged, and believed done while never being invoked:

| Component | Believed | Actually |
|---|---|---|
| `scopedContext` ALS middleware | mounted | never mounted |
| scoping `$extends` under `shadow` | reachable | attached only to `clients.scoped` |
| `validateScopedPrismaBoot()` | wired | zero callers |
| `scripts/scoped/lint-raw-client.mjs` | "wired into CI + pre-commit" (its own docstring) | never ran — no npm script, no workflow, and `.githooks/pre-commit` runs only the SSOT check |

The same shape recurred at every level of review: a control that reports success
regardless of whether the thing it guards works. AA-3/4/5 (architecture audit),
B-3/B-4 (security), then N-1/N-2 (security, opened by the fixes themselves).

The control this epic adopts in response — **adoption assertions**: a test that
spawns what *invokes* the artifact, so deleting the wiring line reddens it. Plus
the rule that every gate needs a test proving it can fail (AC-25, AC-31).

## Build phases

0. Spike — **a gate, not a task**. If `Promise.resolve(q(args))` does not collapse
   to one SQL statement, §4.1's performance budget is wrong and the design needs
   rework before anything else is built.
1. Pure units (diff, classify, redact, throttle) — no Prisma, no I/O.
2. Sink + schema + the B2/B7 lint wiring.
3. The harness and its composition-root wiring (`prisma.ts`, `prisma-scoped.ts`).
4. Request meta + tenant frame (`auth.ts`, `scoped-context.ts`).
5. Crons, boot guards, admin status endpoint.
6. Adoption assertions + integration.
7. Docs, `render.yaml`, `GOLD_STANDARD.md`, SSOT registry.

## Concurrency

A second Claude session owns `server/src/lib/env.ts` and `scripts/enforce.js`.
`env.ts` is **deliberately absent** from `files_planned:` above — this epic's env
target is `env.scoped-prisma.ts`. The file-scope lock in
`check-plan-required.cjs` therefore enforces the separation mechanically rather
than by my remembering it.

## Known gaps carried out of this epic

- **SR-2 / File #53** — `HIGH_RISK_PATHS.md` matches `**/lib/env.ts`, which does
  not glob `env.scoped-prisma.ts`. The env split at `62f6297` moved eight domain
  siblings — including this layer's boot guard and mode parser — out of gate
  coverage. Proposed pattern `**/lib/env.*.ts`. **Cannot be fixed here**: that
  file is itself a trust anchor requiring its own `architect, security` plan.
  Durable record lands in `GOLD_STANDARD.md` (File #51), because a listing in a
  design plan grants review for one edit and is not a control.
- **Git hooks are not installed by anything committed.** `core.hooksPath` is
  local git config; neither `package.json` has a `prepare`/`postinstall`. So the
  SSOT pre-commit gate — described in the global rules as "a hard wall, every
  session, no memory" — does not exist on CI or a fresh clone. File #19 adds the
  `prepare` script; File #54 adds the CI step that cannot be un-configured.
- **Files #31/#32/#33 (crons) are unaudited by security.** Deferral is sound by
  arithmetic, not by argument: retention deletes on `lastSeenAt < 30d`, exit
  queries read a 7-day window, so the sets are disjoint by construction. The
  exposure is constant drift once File #50 makes those ceilings env knobs —
  closed by a boot assertion (`retentionDays >= 4 x watchWindowDays`, File #35).
