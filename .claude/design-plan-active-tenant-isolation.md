---
status: approved
feature: tenant-isolation
created: 2026-07-19T12:55:11Z
approver: Sawan ("launch the Wave A epic")
high_risk_paths_touched:
  - server/src/lib/prisma.ts
  - server/src/lib/prisma-scoped.ts
  - server/src/lib/prisma-scoped.inject.ts
  - server/src/lib/scoped-models.ts
  - server/src/lib/env.ts
files_planned:
  - server/src/lib/prisma.ts
  - server/src/lib/prisma-scoped.ts
  - server/src/lib/prisma-scoped.inject.ts
  - server/src/lib/prisma-scoped.rewrite.ts
  - server/src/lib/scoped-models.ts
  - server/src/lib/business-context.ts
  - server/src/lib/scoped-context.ts
  - server/src/lib/env.ts
  - server/src/middleware/scoped-context.ts
  - server/prisma/migrations/**
  - scripts/lint-scoped-prisma.mjs
agents_invoked:
  - scope-writer (output: docs/SCOPE_tenant-isolation.md)
  - scope-auditor (output: docs/SCOPE_AUDIT_tenant-isolation.md, verdict: PASS)
  - architect (output: docs/ARCHITECTURE_tenant-isolation.md)
  - architecture-auditor (output: docs/ARCHITECTURE_AUDIT_tenant-isolation.md, verdict: PASS)
  - security (output: docs/SECURITY_AUDIT_tenant-isolation.md, verdict: PASS-WITH-CONDITIONS)
acceptance:
  backend:
    - "Phase-(-1) spike proves the extension can re-dispatch findFirst + two-step write on the CALLER'S open interactive $transaction client (Proxy + tx-ALS-slot fallback path — S1: getExtensionContext primary is likely non-viable); named assertions pass or the whole approach is abandoned per the documented denormalize rollback"
    - "tsc clean (server)"
    - "H1 — guardWriteData enforced on update/updateMany/upsert: data.businessId != ctx throws SCOPED_PRISMA_DATA_BUSINESSID_REJECT; scalar-FK reassignment (data.partyId etc.) resolved in-tenant or NOT_FOUND; red-team test proves a cross-tenant re-parent write fails"
    - "H2 — runUnscoped/__basePrismaUnsafe unscoped window is CI-lint-guarded (lint #11 fails the build on a scoped model queried off the raw client) BEFORE the enforce flag flips; every runUnscoped call writes UnscopedAccessLog"
    - "H3 — exhaustive inventory of non-request Prisma callers (auth no-active-business `businessId ?? ''` paths, cron purge-deleted-templates.ts, ORM/razorpay webhooks, detached fan-out) each wrapped in a business frame or runUnscoped; proven no path throws under enforce (no fail-closed self-DoS)"
    - "H4 — all 86 raw-SQL sites audited to carry a businessId PREDICATE (not merely a bound param); each is provably tenant-safe, gated, or enumerated as accepted residual risk"
    - "M1 — shadow-diff harness logs mismatch COUNTS/ids only, never cross-tenant row contents or PII"
    - "M2 — UnscopedAccessLog is platform-global but read-access-controlled (admin-only)"
    - "M3 — import-time flag/boot-guard ordering correct; docs/plan state 'enforce rollback requires a restart' (flag read once at boot)"
    - "M4 — upsert create-branch injects ctx businessId + runs guardWriteData"
    - "M5 — Proxy tx-fallback THROWS if the tx-scoped ALS slot is unset; never dispatches on the raw unscoped tx client"
    - "curl: a request under tenant A cannot read tenant B's invoice/party/product (findUnique by B-id → null/404)"
    - "curl: a request with no active-business context → 500 Tenant context missing (fail closed), never another tenant's rows"
    - "completeness test #14 — DMMF-derived: 96 directly-scoped businessId models + 27 child-scoped FK map; fails CI on a wrong FK column or misclassified child (GodownStock/ImportJobRow class)"
  frontend:
    - "N/A — data-layer epic, no UI surface (explicit waiver, ARCHITECTURE §11). Behavior is transparent to feature code; existing feature screens must render unchanged under the shadow flag"
---

# Tenant Isolation — Implementation Plan (Wave A, P0.1)

Independent plan slot (`design-plan-active-tenant-isolation.md`) so it coexists with
any other active plan the repo holds — the gate hook scans all `design-plan-active*.md`.

Build a data-layer `businessId` auto-injection layer (scoped Prisma `$extends`)
so cross-tenant reads/writes become **structurally impossible**, replacing manual
`businessId` scoping across ~406 service files. Context + gold gates:
`docs/GOLD_STANDARD.md` (G1, P0.1).

## Design provenance (all gates cleared)

| Gate | Output | Verdict |
|------|--------|---------|
| scope-writer | `docs/SCOPE_tenant-isolation.md` | written |
| scope-auditor | `docs/SCOPE_AUDIT_tenant-isolation.md` | PASS (1 revision — closed 6 MUST_SHIP) |
| architect | `docs/ARCHITECTURE_tenant-isolation.md` | written (23-row File Plan, all ≤250L; caught GodownStock → child map = 27) |
| architecture-auditor | `docs/ARCHITECTURE_AUDIT_tenant-isolation.md` | PASS (0 MUST_SHIP, 5 SHOULD_SHIP) |
| security | `docs/SECURITY_AUDIT_tenant-isolation.md` | PASS-WITH-CONDITIONS (H1–H4, M1–M5) |

## Mechanism (decided, spike-gated)

Client-level `$extends` `$allOperations` component with **re-dispatch** (query
extensions provably cannot switch operation type — the live soft-delete doc-comment
records this). Composition: soft-delete **inner** / scoping **outer** via late-bound
`getInner() => softDeleted` (no scoping layer, so re-dispatch can't infinitely
re-enter and `businessId` merges exactly once). Directly-scoped models (96) get
`where` AND-merge + findUnique→findFirst rewrite + two-step by-id update/delete;
child-scoped models (27) resolve the parent id in-tenant. All mutating ops also run
`guardWriteData` (H1). Escape hatch: `runUnscoped(reason, fn)` → `UnscopedAccessLog`.

## Rollout

Flag-gated (`SCOPED_PRISMA_ENFORCE`), all-or-nothing per phase (no half-applied
window — confirmed by security §7). Order: **Phase-(-1) spike (go/no-go)** →
shadow (100% sampling, softDeleted client + shadow harness, auto-throttle to 0.1 if
mutation p95 +20%) → enforce (prod boot-guard: prod must fail to boot unless
`SCOPED_PRISMA_ENFORCE==='true'` post-cutover). CI lint #11 must be green before
enforce.

## Carried-forward audit conditions

The `acceptance.backend` block above is the literal gate checklist. **S1** (the
architecture-auditor's load-bearing finding) makes the Proxy + tx-ALS fallback the
**expected** in-tx mechanism, not a fallback — the Phase-(-1) spike must prove *that*
path specifically, and the denormalize rollback only rescues the 27 children, not the
96 direct models' in-tx two-step, so a spike failure = abandon-and-reassess, not a
silent downgrade. **H1** is folded into ARCHITECTURE §2.3 + §3.6a (data-payload guard).
The 4 remaining SHOULD_SHIP items (child-read relation field-name not just FK scalar;
full-middleware-chain propagation test; File #6 overflow split under the Proxy path;
TOCTOU/businessId-immutability note) are tracked in the architecture doc and closed
during implementation.

## Build order (Step 6)

Phase-(-1) spike → backend behind `SCOPED_PRISMA_ENFORCE` (types → scoped-models SSOT
→ pure injector + guardWriteData → dispatch → prisma.ts exports → context middleware
→ CI lint) → verifier proof gate (tsc + the curl trio + completeness test #14) → QA
against this acceptance block. Never skip a proof gate.
