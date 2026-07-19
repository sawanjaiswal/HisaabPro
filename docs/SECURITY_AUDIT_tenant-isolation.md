---
audit_of: ARCHITECTURE_tenant-isolation.md
scope_ref: SCOPE_tenant-isolation.md
arch_audit_ref: ARCHITECTURE_AUDIT_tenant-isolation.md (PASS)
auditor: security
audited_at: 2026-07-19
prisma_version: 6.19.2
verdict: PASS-WITH-CONDITIONS
critical: 0
high: 4
medium: 5
low: 2
---

# Security Audit — Data-Layer Tenant Isolation (Scoped Prisma)

## Verdict: PASS-WITH-CONDITIONS

The design fails **closed** on every enumerated leak vector and sources the tenant
key from the **signed JWT** (`req.user.businessId`), never from a request-controlled
field — structurally closing the `req.user.userId` vs `.id` IDOR class this project
was bitten by. I read the live code before trusting the docs (`prisma.ts`,
`soft-delete/middleware.ts`, `env.ts`, `auth.ts`, schema spot-checks) and confirmed:
`User` carries **no** `businessId` → global passthrough (so the pre-frame
`prisma.user.findUnique` in `auth.ts:61` does not throw); the `96` businessId-scalar
count reproduces; all 86 raw-SQL sites bind `businessId` as a `$n` parameter (no
SQL-injection of the tenant key). **No CRITICAL, design-changing leak with no defense
exists**, so this is not a BLOCK.

It is **PASS-WITH-CONDITIONS** because one real isolation gap (H1) is **not** covered
by any current B-vector or red-team case, and four operational guarantees (H2–H4,
plus the medium items) must be enforced at build/cutover time. Each condition fits
inside the existing architecture — none forces a redesign.

---

## Threat-model findings

### CRITICAL — none

The three load-bearing claims hold: unset ALS → throw (never silent unscoped);
tenant key from JWT (not body/param/header); `$queryRaw` bypass is enumerated,
parameterized, and audit-gated with the "structural isolation" claim withheld until
0 unwaived. No path returns another tenant's rows without an explicit `runUnscoped`.

---

### HIGH

**H1 — Write-side `data` reassignment is uncovered: a scoped `update`/`updateMany`/
`upsert` can set `data.businessId` (or a scoped scalar FK) to another tenant → row
donation / cross-tenant pollution.**
The injector's enumerated defenses (B1–B14) all guard the **WHERE** side (reads) and
nested **connect** targets. Nothing in §2.3/§3 strips or validates the **DATA**
payload of a write. Concretely, under tenant A's context:
- `prisma.invoice.update({ where:{id:'<A-row>'}, data:{ businessId:'<B>' } })` — the
  two-step resolves `<A-row>` under A (passes), then writes by id with
  `data.businessId='<B>'` → the row is **moved into tenant B**. A can create a
  malicious row as A and reassign it into B (integrity breach / injection into
  another tenant), or silently exfiltrate/lose its own rows.
- `prisma.document.update({ where:{'<A-doc>'}, data:{ partyId:'<B-party>' } })` —
  scalar FK reassignment to a foreign parent; the connect-guard (B13) only walks
  `connect`/`connectOrCreate`, not raw scalar FKs in `data` on **update** (§3.4
  covers scalar FK only on **create**).
- `prisma.invoice.updateMany({ where:{…}, data:{ businessId:'<B>' } })` — moves every
  matched A-row to B.

`create`/`createMany` are safe (design overwrites `data.businessId = ctx`), but the
**update/updateMany/upsert data path is not**. `businessId` immutability (arch S5) is
_assumed_ but not _enforced_ — this is where it must be enforced.
**Condition (gate):** the injector MUST, on `create`/`createMany`/`update`/`updateMany`/
`upsert`, force `data.businessId = ctx` (reject if it differs) AND validate every
scoped scalar FK present in `data` against ctx (same resolve as the connect-guard).
Add red-team cases: `update data.businessId=B`, `updateMany data.businessId=B`,
`update data.<scopedFk>=<B-parent>` → all must 0-row / NOT_FOUND, never move a row.

**H2 — `runUnscoped` + `__basePrismaUnsafe` is a genuine unscoped window; its audit
guarantee is only as strong as the CI lint (#11) teeth.**
`runUnscoped` does `als.exit(fn)` (fail-closed nesting ✓) and writes `UnscopedAccessLog`
(auditable ✓), reason is an enum/template type (greppable ✓), takes **no** businessId
(cannot be widened by attacker input ✓). But inside it, scoped-model access via
`__basePrismaUnsafe` is fully unscoped. The ONLY thing keeping unscoped base access
_out_ of ordinary service code is lint #11.
**Condition (gate):** lint #11 must (a) fail on any `__basePrismaUnsafe.<scopedModel>`
outside the injector + an explicit file allowlist, (b) ban NEW `$queryRaw*` outside
the audited allowlist, and (c) run in CI as a hard gate BEFORE Phase 2. A deliberate
`__basePrismaUnsafe.invoice.findMany()` and a new `$queryRaw` must both fail CI (this
is already an acceptance criterion — verify it has teeth, not just a TODO).

**H3 — Fail-closed availability: every Prisma-reaching path OUTSIDE the request frame
must be enumerated and wrapped, or enforce is a self-inflicted outage.**
Enumerated live paths that reach Prisma with **no** ALS frame (all currently throw
under enforce → fail-closed, not a leak, but block viability):
- **Authenticated-but-no-active-business routes** — `req.user.businessId ?? ''`
  (auth.ts:75) means onboarding / `business.create` / business-switch / list-my-
  businesses run with empty businessId → no frame opens (§1 "if businessId"). Each
  scoped query there throws. Reasons `business.create`/`business.switch-resolve`
  exist; the FULL set must be enumerated.
- **Cron** — `scripts/cron/purge-deleted-templates.ts` (+ the new
  cleanup-unscoped-log) query scoped models with no frame → wrap in
  `runUnscoped('cron.<name>')` or per-business frame.
- **Webhooks** — razorpay uses raw SQL (bypasses, ok); msg91 / resend / aisensy
  delivery webhooks writing via ORM to any scoped model must wrap.
- **Detached fan-out** — notification queue / `res.on('finish')` / streamed-PDF
  continuations (arch §3.8, S3).
**Condition (gate):** produce an exhaustive inventory of non-request Prisma callers,
assign each a frame/`runUnscoped` strategy, and add the full-middleware-chain happy-
path integration test the arch audit (S3) already flagged. A single miss = 500s on a
real route, discoverable only in prod.

**H4 — Raw-SQL audit is the residual-risk backstop; verify each of the 86 sites
carries a `businessId` predicate, not just a bind param.**
Spot-checks are clean: `product/search.ts` binds `p."businessId" = $1`;
`recycle-bin.service.ts` interpolates the **table name** (`DELETE FROM "${entityType}"`)
but gates it with a Zod allowlist + `verifyOwnership(…, businessId)`; the razorpay
`$executeRawUnsafe` is a system-level `WebhookEvent` insert with no tenant column.
No SQLi of the tenant key found. The risk is a raw site that FORGETS the businessId
predicate entirely (unscoped read), which the extension cannot catch.
**Condition (gate):** `raw-sql-audit.allowlist.json` must classify all 86 as
{tenant-safe (has businessId predicate) | needs-manual-businessId | move-to-ORM};
0 unwaived is the hard gate into Phase 2. Flag `recycle-bin`'s table-name
interpolation explicitly as "safe iff Zod allowlist + verifyOwnership both present."

---

### MEDIUM

**M1 — Shadow-diff logging must not dump cross-tenant PII.**
`SCOPED_PRISMA_SHADOW_DIFF{model,op,injected,manual}` at 100% sampling: `injected`/
`manual` must be the **query shape / row counts / own-tenant ids**, never the returned
row bodies. A diff by definition surfaces rows one client sees and the other doesn't —
logging those rows would write cross-tenant PII into logs. Log counts + where-clause
digests only.

**M2 — `UnscopedAccessLog` is platform-global; gate its reads.**
Correctly written via `__basePrismaUnsafe`, append-only, `{reason, actor, detail}`.
Confirm `detail` = route/job name only (no row PII), and that READS are platform-admin
only (`runUnscoped('platform.admin')`), since it reveals cross-tenant actor activity.

**M3 — Flag evaluated at import time; boot-guard ordering + honest rollback.**
`prisma = enforce ? scoped : softDeleted` (§2.5) resolves ONCE at module load.
(a) `getScopedPrismaEnforce()` must read `process.env` AFTER dotenv loads, else it
defaults wrong at import. (b) `validateScopedPrismaBoot()` must run at boot alongside
`validateNicEnv()`. (c) The rollout table says env→shadow rollback is "no deploy" —
inaccurate: flipping the flag requires at least a **process restart** since the client
is bound at import. State that plainly so on-call doesn't expect a live flip.

**M4 — connectOrCreate / upsert create-branch must force ctx.**
`connectOrCreate` create-branch defaults to reject (fail-closed ✓); `upsert`'s
create branch must inject `data.businessId = ctx` (same rule as H1) — confirm the
`onMissing:'upsertCreate'` path runs the create-side data guard, not a bare create.

**M5 — Proxy tx-fallback must fail closed if the tx-bound scoped client is unresolved.**
Arch S1 concedes the `getExtensionContext` primary is likely non-viable and the
Proxy+tx-ALS-slot fallback is effectively THE mechanism. Security requirement on that
fallback: if the tx-scoped ALS slot is unset for any `$transaction` path, the
re-dispatch MUST throw — never fall back to the raw (unscoped) `tx` client. A silent
fall-through there is a cross-tenant write inside a transaction. Spike #17(d) must
assert this negative case, not only the happy tx path.

---

### LOW

**L1 — Document the two-step TOCTOU invariant (arch S5) and tie it to H1.**
Under READ COMMITTED the resolve→write window is safe only because `businessId` is
immutable. H1's "reject `data.businessId` change" is what MAKES it immutable at the
data layer — so H1 is the enforcement of the L1 assumption. Note the dependency.

**L2 — Dev `globalForPrisma` singleton must cache the flag-selected client.**
`globalForPrisma.prisma` (prisma.ts:60) caches across hot-reloads in dev; ensure the
scoped/softDeleted selection is cached consistently so dev doesn't mix a scoped and an
unscoped client across reloads (would mask a fail-closed bug in tests).

---

## What the design got right (preserve)

- **Tenant key from the signed JWT, never request input** — structurally closes the
  `req.user.userId`/`.id` IDOR class. `runInBusinessContext` rejects empty
  `businessId` (never stores `''` as a scope).
- **Fail-closed is the default everywhere:** unset ctx → throw; `runUnscoped` →
  `als.exit`; foreign connect/scalar-FK → NOT_FOUND; forged id → null/0.
- **No half-applied rollout window.** The flag is global and all-or-nothing per phase;
  there is never a state where some models are scoped and others aren't (the task's
  §7 concern does not materialize). Every transition is env-flag-driven.
- **Honest uncovered surface.** `$queryRaw` bypass is acknowledged, parameterized,
  audit-gated, and the DPDP/"structural isolation" claim is explicitly withheld until
  0 unwaived — no hand-waving.
- **Completeness = correctness at the column level** (test #14, DMMF-authoritative).

---

## Gate checklist (all MUST clear before Phase 2 / enforce)

- [ ] **H1** Injector forces `data.businessId = ctx` and validates scoped scalar FKs in
      `data` on create/createMany/update/updateMany/upsert; red-team cases added for
      `data.businessId=B`, `updateMany data.businessId=B`, `update data.<fk>=<B-parent>`.
- [ ] **H2** Lint #11 has teeth in CI (base scoped-access + new raw SQL both fail);
      runs before Phase 2.
- [ ] **H3** Exhaustive inventory of non-request Prisma callers (auth-no-business
      routes, cron, webhooks, fan-out) each wrapped; full-chain happy-path test added.
- [ ] **H4** All 86 raw sites classified; 0 unwaived; recycle-bin table-name
      interpolation annotated as allowlist+ownership-gated.
- [ ] **M1** Shadow diff logs counts/where-digests, never row bodies.
- [ ] **M2** `UnscopedAccessLog` reads platform-admin-gated; `detail` carries no row PII.
- [ ] **M3** Flag read post-dotenv; `validateScopedPrismaBoot()` wired at boot; rollout
      doc corrected to "requires restart."
- [ ] **M4** upsert/connectOrCreate create-branch forces ctx.
- [ ] **M5** Proxy tx-fallback throws (never uses raw tx client) when the tx-scoped slot
      is unset; spike #17(d) asserts the negative case.
- [ ] **L1/L2** TOCTOU invariant documented; dev singleton caches the selected client.

Clearing H1–H4 + M1–M5 converts this to PASS. The architecture itself is sound; these
are implementation-time isolation guarantees, not a redesign.
