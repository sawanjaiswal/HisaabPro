# HisaabPro — Gold Standard Plan

> **Purpose:** an honest, evidence-backed audit of where HisaabPro actually
> stands and a prioritized plan to reach "gold standard" — a stable, correct,
> multi-tenant billing app ready for real Indian MSMEs running multiple
> companies/stores.
>
> **Method:** every number below was measured against the codebase, not
> estimated. Re-run the commands in each section to refresh.
>
> Last audited: **2026-07-21** · Branch: `redesign/mobile-first-sweep`
> (previous audit: 2026-07-19 on `master`)

---

## 0. Definition of "gold standard"

HisaabPro is gold when ALL of these hold (measurable gates, not vibes):

| # | Gate | How it's checked | 07-19 | 07-21 |
|---|------|------------------|-------|-------|
| G1 | **No cross-tenant data leak is structurally possible** | Every scoped query auto-injects `businessId` at the data layer; a missed filter fails closed | ❌ | 🟡 **built, landed dark** |
| G2 | Core billing loop works end-to-end, every day | login→business→party→product→invoice→payment→dashboard→ledger | ✅ | ✅ |
| G3 | Server + client test suites green, 0 failing | `npm test` both packages | ✅ | ✅ 1409 + 1269 |
| G4 | `tsc` clean both packages | `npm run typecheck` | ✅ | ✅ |
| G5 | Offline-first discipline holds | `node scripts/enforce-offline.mjs` | 🟡 | 🟡 1 debt item |
| G6 | Platform-shell invariants hold | `node scripts/enforce.js` | 🟡 5 | 🔴 **6 errors + 13 warnings** |
| G7 | Every screen has all 4 UI states + 320px clean | per-page audit sweep | ⬜ | 🟡 **81/190 measured clean** |
| G8 | Money is always integer paise; ledgers reconcile | GL trial-balance = 0 | ✅ | ✅ |
| G9 | Multi-business switching is smooth | switch has its own limiter | ❌ | ✅ **MET** |
| G10 | **Every screen matches the GPT design language** *(new gate)* | `docs/GPT_REDESIGN_PLAN.md` tracker | — | 🟡 **~34/58 screens** |

**Headline (changed since 07-19):** the scoped-Prisma tenant-isolation layer is
now **built** (`prisma-scoped.{ts,inject,merge,rewrite}`, `scoped-models.ts`,
`scoped-context` middleware, boot-guard in `env.ts`) — but it is **landed dark**.
`SCOPED_PRISMA_ENFORCE` is not set in `render.yaml` or any env file, so
`getScopedPrismaMode()` returns `'off'` and production still runs unscoped
queries. The remaining work is a **rollout plus one missing piece** — the
`shadow` diff harness is a stub with no consumers — not the 1-2 week epic the
07-19 audit projected. That is now the single highest-leverage action in this plan.

---

## 1. Current health baseline (measured 2026-07-21)

```
Client tests      136 files · 1409 pass · 0 fail          npx vitest run
Server tests      149 files · 1269 pass · 0 fail · 7 todo npm --prefix server test
Typecheck         clean (root + server)                    npx tsc -b --noEmit
Offline ratchet   rawFetch 0/0 · localStorage 0/0 · mutMeta 1/6
                                                           node scripts/enforce-offline.mjs
SSOT gate         pass (45 legacy grandfathered)           npm run ssot
enforce.js        6 blocking · 13 warnings                 node scripts/enforce.js
Pages audited     190 · 81 fully clean (43%)               (import-following design sweep)
Raw hex           20 total · 18 legitimate                 grep, var()-fallback-excluded
Routes            209                                      grep -c 'path=' src/App.tsx
```

Still a **healthy** baseline. Test count grew (1245 → 1269 server, +164 client)
and G9 closed. Two things regressed: platform-shell debt (5 → 13) and enforce.js
went from 5 warnings to 6 hard errors.

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
- **⚠️ `shadow` mode is a stub — do not plan around it.** `getScopedPrismaMode()`
  parses `'shadow'` and `getScopedPrismaShadowSample()` exists in `env.ts:267`,
  but **neither has a single consumer.** `prisma.ts:110` is a two-way ternary:
  `enforce ? scoped : softDeleted`. Setting `SCOPED_PRISMA_ENFORCE=shadow` today
  changes only a log string — it does **not** diff scoped vs unscoped queries.
  The shadow-diff harness described in the original architecture was never built.
- **Why it's still P0:** built-but-off provides zero runtime protection. Every
  one of the 186 service files still relies on hand-written `where: { businessId }`.
- **Fix shape — two options, pick one:**

  **Option A (recommended) — build the shadow harness first (~2-3 days), then roll out.**
  1. Wire `shadow` mode in `prisma-scoped.ts`: run the query on both clients,
     compare result-id sets, log divergence, **return the unscoped result** so
     behaviour is unchanged. Sample via `getScopedPrismaShadowSample()`.
  2. Deploy with `SCOPED_PRISMA_ENFORCE=shadow`. Watch 7 days.
  3. Triage every divergence — each is either a genuine missing filter (fix the
     service) or a legitimately-global query (add to the passthrough list).
  4. Flip to `enforce`. Watch error rates 48h.
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
  1. **Auth** — `LoginPage`, `RegisterPage`, `VerifyOtpPage`, `ForgotPasswordPage`:
     no container, no i18n, no loading/error/empty. Every user's first screen.
  2. **Onboarding / business creation** — `OnboardingPage`, `CreateBusinessPage`,
     `JoinBusinessPage`, `BusinessTypePage`: same gaps, second screen.
  3. **BOM + production-runs** (5 pages) — zero `useLanguage`; Hindi users see
     raw English.
  4. **Marketing** (8 pages) — no `PageContainer`; breaks the responsive contract.
  5. **POS** (4 pages) — no container, plus 3 of the 13 shell warnings.
- **Fix:** per-page, against `PAGE_AUDIT_CHECKLIST.md` A→N.
- **Effort:** M (batched by feature area, ~5 batches).

#### P1.3 · Offline queue replay still unexercised end-to-end
- **Evidence:** offline *discipline* is clean (rawFetch 0, localStorage 0), but no
  test queues a mutation offline → goes online → asserts single application.
  Unchanged since 07-19.
- **Fix:** integration test — queue party + invoice + payment offline, replay,
  assert single application + correct GL + idempotency on double-replay.
- **Effort:** M.

### P2 — Debt burn-down

#### P2.1 · `enforce.js` — 6 blocking errors (regression: were 0)
```
server/src/lib/env.ts                                      293L  ⚠️ high-risk path
server/src/services/marketing/reminder-trigger.service.ts  286L
src/lib/api.ts                                             279L
src/components/layout/SideNav.tsx                          272L
server/src/services/party/ledger.service.ts                260L
server/src/services/hr/employee.service.ts                 259L
```
- Split per the 6-layer rule (types → constants → utils → transport → service → route).
- `env.ts` is a declared high-risk path — needs an approved design plan first, or
  defer it and split the other 5.
- **Acceptance:** `node scripts/enforce.js` → 0 errors. **Effort:** S each.

#### P2.2 · Platform-shell debt grew 5 → 13 warnings
- 8 × fixed-bottom (Phase 3) → `<BottomActionBar>` / `<Drawer>`:
  `business.css:107`, `payment-form-actions.css:67`, `pos-billing.css:388,593`,
  `pos.css:364`, `recurring-detail.css:286`, `role-builder.css:157`,
  `tax-category-form.css:25`
- 5 × fixed/sticky-top (Phase 4) → `<Header>` primitive or `top: var(--header-height)`:
  `cash-register.css:535`, `aging.css:359`, `pos-billing.css:15`, `pos.css:15`,
  `report-shared.css:11`
- **Root cause of the growth:** these are *warnings*, so new violations land
  silently. **Fix the enforcement, not just the files** — promote both checks to
  errors once the list is drained, so the ratchet can only go down.
- **Effort:** S each · **Acceptance:** enforce.js 0 warnings, both checks blocking.

#### P2.3 · Two feature-local design tokens outside the token file
`dashboard-page.css:18-19` defines `--hp-dash-surface: #012619` and
`--hp-dash-card: #003121` locally. Should live with the global emerald hero
tokens so dark-mode parity is automatic. **Effort:** XS.

### P3 — Coverage / hygiene

- **P3.1** · 7 todo tests on the server — close them.
- **P3.2** · Offline ratchet: drive the last `mutationNoEntityType` (1/6) to 0,
  then `--ratchet` the baseline down so it can't regress.

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
| **Now** | **P0.1 — wire the shadow-diff harness in `prisma-scoped.ts` (the stub `shadow` mode does nothing today)** | G1 | ⛔ critical path |
| **A** | P0.1 shadow-watch 7d → triage divergences → `enforce` → `CUTOVER_DONE=true` + red-team test | **G1** | ⛔ gates multi-tenant launch |
| **B** | P2.1 split 5 non-high-risk oversized files · P2.2 drain shell debt **and promote both checks to errors** | G6 | unblocks clean commits |
| **C** | P1.2 UI-state sweep — auth → onboarding → BOM/production → marketing → POS | G7 | first-impression quality |
| **D** | P4 design sweep — Wave 5 → 6 → 7 → 9 → 8a/8b/8c | G10 | product polish |
| **E** | P1.3 offline-replay integration test · P3.1 todo tests · P3.2 ratchet to 0 | G5, coverage | hygiene |
| **F** | 5 NEW screens (after competitor comparison per D2) | — | net-new surface |

**Critical path to "onboard multiple companies safely" = Now → Wave A.**
Everything after Wave A is quality, not safety.

Wave B is deliberately ahead of C and D: with 6 blocking `enforce.js` errors,
every commit in Waves C/D has to fight the gate or bypass it.

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
