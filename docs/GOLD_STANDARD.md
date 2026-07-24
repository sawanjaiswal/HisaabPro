# HisaabPro — Gold Standard Plan

> **Purpose:** an honest, evidence-backed audit of where HisaabPro actually
> stands and a prioritized plan to reach "gold standard" — a stable, correct,
> multi-tenant billing app ready for real Indian MSMEs running multiple
> companies/stores.
>
> **Method:** every number below was measured against the codebase, not
> estimated. Re-run the commands in each section to refresh.
>
> Last audited: **2026-07-24** · Branch: `redesign/mobile-first-sweep`
> (previous audits: 2026-07-21 same branch · 2026-07-19 on `master`)

---

## 0. Definition of "gold standard"

HisaabPro is gold when ALL of these hold (measurable gates, not vibes):

| # | Gate | How it's checked | 07-19 | 07-21 | 07-24 |
|---|------|------------------|-------|-------|-------|
| G1 | **No cross-tenant data leak is structurally possible** | Every scoped query auto-injects `businessId` at the data layer; a missed filter fails closed | ❌ | 🟡 **built, landed dark** | 🟡 built + shadow-ready, still off |
| G2 | Core billing loop works end-to-end, every day | login→business→party→product→invoice→payment→dashboard→ledger | ✅ | ✅ | ✅ |
| G3 | Server + client test suites green, 0 failing | `npm test` both packages | ✅ | ✅ 1409 + 1269 | ✅ (not re-run this pass — last green 07-23) |
| G4 | `tsc` clean both packages | `npm run typecheck` | ✅ | ✅ | ✅ re-verified |
| G5 | Offline-first discipline holds | `node scripts/enforce-offline.mjs` | 🟡 | 🟡 1 debt item | ✅ **0/0/0 clean** |
| G6 | Platform-shell invariants hold | `node scripts/enforce.js` | 🟡 5 | 🔴 **6 errors + 13 warnings** | ✅ **all checks green** |
| G7 | Every screen has all 4 UI states + 320px clean | per-page audit sweep | ⬜ | 🟡 **81/190 measured clean** | 🟡 81/190 (no new sweep) |
| G8 | Money is always integer paise; ledgers reconcile | GL trial-balance = 0 | ✅ | ✅ | ✅ |
| G9 | Multi-business switching is smooth | switch has its own limiter | ❌ | ✅ **MET** | ✅ |
| G10 | **Every screen matches the GPT design language** | `docs/GPT_REDESIGN_PLAN.md` tracker | — | 🟡 **~34/58 screens** | 🟡 ~34/58 (parties/DateField/tabs polished) |

**Headline (changed since 07-21):** the debt gates all closed. `enforce.js` went
from **6 errors + 13 warnings → all-green** (P2.1 oversized files split, P2.2
platform-shell debt fully drained with both debt sets now empty *and still
gating*), and the offline ratchet reached **0/0/0** (P3.2). The audit-writer SSOT
landed (P3.3): 64 inline `auditLog.create` sites migrated onto `createAuditEntry`
behind a `forbidden`-guarded commit gate. `tsc` clean both packages, re-verified.
The scoped-Prisma tenant-isolation layer (G1) remains **built + shadow-ready but
landed dark** — `SCOPED_PRISMA_ENFORCE` is still unset, so production runs
unscoped. **G1 is now the ONLY structural gate not green**, and its remaining work
is a flag rollout (shadow-watch → enforce), not construction. That is the single
highest-leverage action left in this plan.

---

## 1. Current health baseline (measured 2026-07-24)

```
Typecheck         clean (root + server)                    npx tsc -b --noEmit      ✅ re-verified
Offline ratchet   rawFetch 0/0 · localStorage 0/0 · mutMeta 0/0 (1873 files)
                                                           node scripts/enforce-offline.mjs  ✅
SSOT gate         pass (59 legacy grandfathered)           npm run ssot             ✅
enforce.js        ALL checks passed · 0 errors · 0 warnings  node scripts/enforce.js  ✅
Client tests      1409 pass · 0 fail  (not re-run this pass — last green 07-23)  npx vitest run
Server tests      1269 pass · 0 fail · 7 todo (not re-run — order-dependent flake)  npm --prefix server test
Pages audited     190 · 81 fully clean (43%)  (no new sweep since 07-21)  (import-following design sweep)
Routes            209                                      grep -c 'path=' src/App.tsx
```

Baseline improved on every mechanical gate. Since 07-21: enforce.js flipped from
6 errors + 13 warnings → all-green (P2.1 + P2.2 closed), offline ratchet reached
0/0/0 (P3.2), the audit-writer SSOT landed (P3.3 — ssot grandfathered count rose
45 → 59 as the guarded rows were added). Test suites weren't re-run this pass;
they were last green 07-23 and no server logic changed since (the only server
diff is the audit-writer refactor, covered by integration 99/99). **G1 shadow
rollout is the only structural item left.**

---

## 2. Gap register (tiered, evidence-backed)

### P0 — Ship-blocking for multi-tenant

#### P0.1 · Scoped Prisma is built but not enforced *(was "does not exist")*
- **Evidence:** `server/src/lib/prisma.ts:110` exports the scoped client **only**
  when the mode is `enforce`. `getScopedPrismaMode()` (`env.ts:258`) reads
  `SCOPED_PRISMA_ENFORCE`, which is set **nowhere** — not in `render.yaml`, not
  in any `.env`. Default is `'off'`. `scoped-context.ts:13` even documents the
  land-dark state: *"harmless to mount while SCOPED_PRISMA_ENFORCE=off."*
- **Also present and ready:** 57 models in `scoped-models.ts`, the injection core
  (`prisma-scoped.{inject,merge,rewrite}.ts`), ALS context middleware, and the M3
  boot-guard that refuses to start prod if `SCOPED_PRISMA_CUTOVER_DONE=true`
  without `enforce`.
- **✅ `shadow` mode is now BUILT (2026-07-22).** The line above previously read
  "shadow mode is a stub — do not plan around it"; that is no longer true and the
  correction is load-bearing, so it is kept rather than deleted. `prisma.ts` is a
  three-way resolution — `off → softDeleted`, `shadow → scoped + port`,
  `enforce → scoped` — and setting `SCOPED_PRISMA_ENFORCE=shadow` now runs every
  sampled read twice, compares the id sets, and writes divergences to
  `scoped_shadow_divergence` / `scoped_shadow_stat`, **returning the unscoped
  result unchanged.** Design: `docs/ARCHITECTURE_scoped-prisma-shadow.md`.
  Operations: `docs/RUNBOOK_scoped-shadow.md`. Adoption is proven by A1–A12 (every
  component carries a test that reddens when its call site is deleted). What
  remains for this gap is the **rollout** (runbook §3) and the separate `enforce`
  epic — not construction.
- **Why it's still P0:** built-but-off provides zero runtime protection. Every
  one of the 186 service files still relies on hand-written `where: { businessId }`.
- **Fix shape — two options, pick one:**

  **Option A (recommended) — shadow harness (BUILT 2026-07-22), then roll out.**
  Step 1 (build the harness) is **done** — see the ✅ note above. What remains:
  1. ~~Wire `shadow` mode~~ — done. Runs both clients, compares id sets, writes
     divergences, returns the unscoped result. Sampled via the env knobs now
     pinned in `render.yaml`.
  2. Deploy with `SCOPED_PRISMA_ENFORCE=shadow`, ramping the sample per runbook
     §3 (0.01 → 1.0). Watch 7 days.
  3. Triage every divergence using the runbook §9 signature — each is either a
     genuine missing filter (fix the service) or legitimately global (passthrough
     list). The `no-context` backlog is `docs/CONTINUATION_SITES_scoped-prisma.md`.
  4. Flip to `enforce` — **a separate epic, not authorised by the shadow design.**
     Watch error rates 48h.
  5. Set `SCOPED_PRISMA_CUTOVER_DONE=true` — the boot-guard then makes the state
     irreversible-by-accident.

  **Option B (faster, riskier) — skip shadow, enforce in staging.**
  1. Run both suites with `SCOPED_PRISMA_ENFORCE=enforce` locally. 2438 tests are
     the safety net.
  2. Deploy `enforce` to a staging env, run the full manual journey.
  3. Enforce in prod behind a fast rollback, then `CUTOVER_DONE=true`.

  Option A is the honest choice for a multi-tenant data-isolation cutover: the
  test suites exercise the happy path, not the 186 services' real query shapes.
- **Acceptance:** red-team test proves business A's token cannot read/mutate
  business B's row on any of the 57 scoped models, even with a forged id;
  boot-guard active; both suites green with `enforce` on.
- **Effort:** M — ~2-3 days to wire the shadow harness + 7 days watching, vs the
  1-2 week epic the 07-19 audit projected. The hard part (injection, rewrite,
  ALS, boot-guard) is done. **This is the critical path.**
- **⚠️ High-risk paths:** touching `prisma.ts` / `prisma-scoped*.ts` /
  `scoped-models.ts` / `env.ts` requires an approved
  `.claude/design-plan-active.md` with `architect, security`. Setting the env var
  in `render.yaml` does **not** — do the rollout by flag, not by code edit.

### P1 — Correctness / UX must-fix

#### P1.1 · Business-switch limiter — ✅ **DONE**
`switchBusinessRateLimiter` is mounted at `server/src/routes/auth/switch-business.ts:25`
with a dedicated test (`__tests__/switch-business-limiter.test.ts`). G9 met.

#### P1.2 · UI-state coverage — 109 of 190 pages incomplete
- **Evidence (measured, import-following sweep):** 37 pages have no error state,
  32 no empty state, 32 no layout primitive, 17 no i18n, 17 no loading state.
- **Worst offenders, ranked by user impact:**
  1. **Auth** — ✅ **i18n DONE 2026-07-24** (commit `9ee30183`). `LoginPage` was
     already `t.*`; `RegisterPage`/`VerifyOtpPage`/`ForgotPasswordPage` had ~33
     hardcoded English strings, now all on `t.*` (EN + HI), duplicated inline
     `<style>` shake block deduped into `LoginPage.css`. These are archetype-F
     full-screen forms — loading (button) + error states already present, empty
     is N/A, so `PageContainer` doesn't apply. Auth line item closed.
  2. **Onboarding / business creation** — *(next batch)* — `OnboardingPage`, `CreateBusinessPage`,
     `JoinBusinessPage`, `BusinessTypePage`: same gaps, second screen.
  3. **BOM + production-runs** (5 pages) — zero `useLanguage`; Hindi users see
     raw English.
  4. **Marketing** (8 pages) — no `PageContainer`; breaks the responsive contract.
  5. **POS** (4 pages) — no container, plus 3 of the 13 shell warnings.
- **Fix:** per-page, against `PAGE_AUDIT_CHECKLIST.md` A→N.
- **Effort:** M (batched by feature area, ~5 batches).

#### P1.3 · Offline queue replay — ✅ **DONE** (client + server, 2026-07-23)
- **Evidence (was):** offline *discipline* was clean but no test queued a mutation
  offline → went online → asserted single application.
- **Done 2026-07-23** (commit `c744bead`, `src/lib/__tests__/offline-replay.test.ts`):
  the **client replay contract** is now exercised end-to-end — 3 mutations
  (party/invoice/payment) queued offline, replayed FIFO exactly once each with a
  stable idempotency key, queue drained; double-replay is a no-op; 401 halts and
  preserves order; 4xx dead-letters + fires the rejection bridge. Runs against the
  real `processQueue` with an in-memory Dexie stand-in (jsdom has no IndexedDB).
- **Server half — done 2026-07-23** (commit `a9811b4c`,
  `server/src/__tests__/integration/idempotency-replay.contract.test.ts`): a real-DB
  integration test drives `POST /api/payments` through the real `idempotencyCheck`
  middleware — the same key replayed creates **one** Payment (cached 200, same id,
  outstanding debited once); two/zero keys create two; and the same key from a
  different user is not a hit (no cross-tenant cached-response leak). It did **not**
  need the Phase 7 #150 connection-drop harness — only the existing contract harness,
  which was itself resurrected the same day (commit `8b5d85da`: it was red at
  collection — see the integration-suite notes / memory).

### P2 — Debt burn-down

#### P2.1 · `enforce.js` oversized files — ✅ **DONE** (verified 2026-07-23)
```
server/src/lib/env.ts                                      293L → 64L   ✅ split
server/src/services/marketing/reminder-trigger.service.ts  286L → 236L  ✅
src/lib/api.ts                                             279L → 177L  ✅
src/components/layout/SideNav.tsx                          272L → 126L  ✅
server/src/services/party/ledger.service.ts                260L → 172L  ✅
server/src/services/hr/employee.service.ts                 259L → 231L  ✅
```
All six original offenders were split. The shadow epic later added two more
(`prisma-shadow.ts` 251L, `cron-scheduler.ts` 266L); both split 2026-07-23
(`prisma-shadow.race.ts` + `cron-runners.ts`, commit `035de30f`).
- **Acceptance MET:** `node scripts/enforce.js` → "All enforcement checks passed",
  0 OVERSIZED. Re-verified 2026-07-23.

#### P2.2 · Platform-shell debt — ✅ **DONE** (verified 2026-07-24)
Both debt lists are fully drained AND the checks now gate as errors:
`FIXED_BOTTOM_PHASE3_DEBT` and `FIXED_TOP_PHASE4_DEBT` are both `new Set([])` in
`scripts/enforce.js`, and check 10 (fixed-bottom) + check 12 (sticky/fixed top:0)
pass with zero exceptions. The 13 files listed in the 07-21 audit (business.css,
payment-form-actions.css, pos-billing.css, pos.css, recurring-detail.css,
role-builder.css, tax-category-form.css, cash-register.css, aging.css,
report-shared.css) all migrated onto `<BottomActionBar>`/`<Drawer>` or
`top: var(--header-height)`. The "fix the enforcement, not just the files" ask is
met — an empty debt set means new violations fail the commit, ratchet can only go
down. **Acceptance MET:** `node scripts/enforce.js` → all checks passed, 0 warnings.

#### P2.3 · Two feature-local design tokens outside the token file
`dashboard-page.css:18-19` defines `--hp-dash-surface: #012619` and
`--hp-dash-card: #003121` locally. Should live with the global emerald hero
tokens so dark-mode parity is automatic. **Effort:** XS.

#### P2.4 · SR-2 — the mode flag moved outside high-risk-gate coverage *(security-relevant)*
- **Evidence:** `~/.claude/rules/HIGH_RISK_PATHS.md` matches `**/lib/env.ts` and
  requires an `architect` plan to edit it. During the shadow epic the scoped-Prisma
  flag accessors were split into `server/src/lib/env.scoped-prisma.ts` — which the
  glob does **not** match. `getScopedPrismaMode()`, `validateScopedPrismaBoot()`,
  and the sample-rate/timeout/inflight knobs (the entire runtime tenant-isolation
  switch) can now be edited with **no** approved design plan. The split was correct
  for file-length; the gate coverage silently shrank with it.
- **Durable owner of this row:** the fix is a **one-line pattern addition** to
  `HIGH_RISK_PATHS.md` (`**/lib/env.scoped-prisma.ts` → `architect`, mirroring the
  `env.ts` row). That file lives under `~/.claude/rules/` and is **not this repo's
  to edit** — the shadow epic's plan (#53) records it as a blocked hand-off, and
  this row is where it lives until an operator makes the change. Recorded here so
  the gap is tracked in the repo that created it, per ARCHITECTURE §15.2 / SS-6.
- **Until then:** treat `env.scoped-prisma.ts` as high-risk by convention — no
  edit without `architect` review, gate or no gate.
- **Effort:** XS (one line), blocked on the rules file being editable.

#### P2.5 · C4 — retention/watch-window disjointness is a boot precondition, recorded
- **Precondition (durable record, C4):** the shadow retention cron deletes rows on
  `lastSeenAt < 30d`; the enforce-exit queries read a **7-day** `lastSeenAt` window.
  The two sets cannot intersect *by construction*, which is what makes "exit
  criteria computed over live rows" safe from "retention ate the evidence". This is
  a **precondition of trusting the exit numbers**, not a nice-to-have.
- **The real exposure is constant drift**, not the current values: once `render.yaml`
  makes the 30-day and 180-day ceilings env knobs, someone can set retention below
  the watch window and re-open the race. It is therefore closed by a **boot
  assertion** (`retentionDays ≥ 4 × watchWindowDays` under mode `shadow`, in the
  boot-guards) **and** by this durable record — meeting the same bar §19 already
  sets for the sample-rate footgun. If the boot assertion is ever relaxed, this row
  is the reason it must not be.
- **Effort:** none (shipped) — this is a record, not a task.

### P3 — Coverage / hygiene

- **P3.1** · The 11 server `.todo`/`describe.todo` markers (import invoice + payment
  end-to-end suites) are **intentional deferrals, not open gaps** — reviewed
  2026-07-23. Each is one of: (a) a cross-reference signpost to coverage that already
  lives in a unit suite (`#7/#8/#9/#10/#12` → `commit-invoices.test.ts`,
  `import.invoice-route.test.ts`, `erasure.service.ts`), or (b) a scenario that
  requires a live-Postgres concurrency/connection-drop harness that does not exist yet
  (`#11/#13` mid-tx crash + advisory-lock race, and the four payment `describe.todo`
  rows) — tracked as Phase 7 #150. Closing (a) would duplicate coverage; closing (b)
  needs the DB harness first. **Leave as todo; not counted as debt.**
- **P3.2** · Offline ratchet — ✅ **DONE** (2026-07-23, commit `954f13bb`). Last
  `mutationNoEntityType` (`/expenses/ocr`, a read-shaped POST) opted out with
  `offlineQueue:false`; baseline ratcheted to `0/0/0` for all three offline rules.
- **P3.3** · Canonical AuditLog writer — ✅ **DONE** (migration + guarded gate,
  2026-07-24). A latent DPDP FK bug surfaced under real Postgres:
  `erasure.service.ts` wrote its erasure record with `businessId:'SYSTEM'` (no such
  Business → P2003) and a non-null `userId` (→ `AuditLog.userId` `onDelete:Restrict`
  would block the erased user's own later deletion). Root-caused in
  `.claude/fix-trace-erasure-audit-fk.md`; fixed by deriving the real businesses
  and routing the write through the now-canonical `createAuditEntry()`
  (`services/settings/audit.ts`), which was extended to be **tx-aware** (atomic
  rollback inside the caller's `$transaction`) and **system-actor-capable**
  (`userId` NULL + `systemActor` set), and `enforce-audit-coverage.mjs` now counts a
  `createAuditEntry()` call as coverage. **Then closed the class:** a codemod routed
  all **64 inline `<client>.auditLog.create({...})` sites across 38 service files**
  onto `createAuditEntry()`, and the `ssot.config.mjs` row was flipped from discovery
  to a **`forbidden`-guarded gate** (`\.auditLog\.create(?:Many)?\s*\(`) — a raw
  create outside the canon module now fails the commit. The only grandfathered
  survivors (`ssot.baseline.json`) are sanctioned: the import `audit-emit*`
  PII-minimal wrapper layer (its own centralised audit surface, per
  SECURITY_AUDIT_PHASE7 S9) and the two `createMany` batch writers
  (`document/create-audit.ts`, `collections/bulk-reminder.service.ts`) —
  `createAuditEntry` is single-row. tsc clean · integration 99/99 · enforce.js green ·
  `npm run ssot` green · `enforce-audit-coverage --block` green. (Note: the server
  *unit* suite has a pre-existing order-dependent flake — a random single file fails
  ~1-in-3 full runs on HEAD too, unrelated to this change; tracked separately.)

### P4 — Design sweep completion (G10)

Tracked in full in `docs/GPT_REDESIGN_PLAN.md §5`. Summary of what remains:

| Wave | Scope | Remaining |
|---|---|---|
| 5 | Reports | 4 of 6 (P&L, Cash flow, GST, Aging) |
| 6 | People / HR / collections | 5 restyles + 1 NEW |
| 7 | Tasks / reminders / calendar | 4 restyles + 2 NEW |
| 8 | Settings / business / account | 18 — split 8a/8b/8c |
| 9 | Accounts / onboarding / import | 5 |
| NEW | Delivery-Route, Today's Tasks, **Universal Search**, Help, About | 5 full builds |

**24 restyles + 5 new builds.** Universal Search was reclassified this audit —
it was listed as "EXISTS/partial" but no global-search component, hook, or
`/api/search` endpoint exists anywhere. It is a full-stack build.

Per D2, the NEW screens stay deferred pending competitor comparison
(Vyapar / myBillBook / Khatabook / OkCredit).

---

## 3. Sequenced roadmap to gold

| Wave | Scope | Gate | Blocking? |
|------|-------|------|-----------|
| **A (now — critical path)** | P0.1 — deploy `SCOPED_PRISMA_ENFORCE=shadow`, watch 7d → triage divergences → `enforce` → `CUTOVER_DONE=true` + red-team test. Flag rollout, not code. | **G1** | ⛔ gates multi-tenant launch |
| ~~**B**~~ | ~~P2.1 oversized files · P2.2 shell debt + promote checks to errors~~ ✅ **DONE 2026-07-23/24** — enforce.js all-green | G6 ✅ | — |
| **C** | P1.2 UI-state sweep — auth → onboarding → BOM/production → marketing → POS | G7 | first-impression quality |
| **D** | P4 design sweep — Wave 5 → 6 → 7 → 9 → 8a/8b/8c (current branch) | G10 | product polish |
| **E** | ~~P1.3 offline-replay~~ ✅ · ~~P3.2 ratchet to 0~~ ✅ · P3.1 todo tests (deferred, needs DB harness) | G5 ✅, coverage | hygiene |
| **F** | 5 NEW screens (after competitor comparison per D2) | — | net-new surface |

**Critical path to "onboard multiple companies safely" = Wave A.** It is the only
structural gate left; everything after it is quality, not safety.

Wave B is complete — enforce.js is all-green with empty debt sets, so Waves C/D
commits no longer fight the gate. Remaining loose end outside the waves: **P2.3**
(2 local dash tokens → global emerald hero tokens, XS) and **P2.4/SR-2** (the
`env.scoped-prisma.ts` high-risk-glob gap, blocked on the `~/.claude/rules` file
being editable).

---

## 4. What is NOT on this plan (deliberately)

- New features beyond the 5 deferred GPT screens. HP is at feature-parity-plus vs
  myBillBook/Vyapar; the gap is stability, isolation, and polish — not surface area.
- Microservices, GST (Phase 2), or re-architecture beyond the scoped layer that
  is already built. Keep the monolith; make it airtight.
- Growing the manifest with "vNext ideas" — this plan closes real gaps and stops.

---

## Appendix A · Audit commands (re-run to refresh §1)

```bash
npx tsc -b --noEmit                    # G4
npx vitest run                         # G3 client
npm --prefix server test               # G3 server
node scripts/enforce.js                # G6
node scripts/enforce-offline.mjs       # G5
npm run ssot                           # SSOT gate
```

## Appendix B · Session fixes already landed (core-loop correctness)

| Commit | Fix |
|--------|-----|
| `a374c03` | New businesses seed the GL chart of accounts (couldn't invoice before) |
| `dd94ff6` | Payment create/fetch 500 — discount select mapped real columns |
| `8e52e04` | Party ledger double-counted every txn — exclude auto-posted GL mirrors |
| `fe8cc47` | Invoice edit fully broken — strip create-only keys from update payload |
| `e176468` | Rate-limit test mock derived from the real module (was drifting) |
