# HisaabPro — Gold Standard Plan

> **Purpose:** an honest, evidence-backed audit of where HisaabPro actually
> stands and a prioritized plan to reach "gold standard" — a stable, correct,
> multi-tenant billing app ready for real Indian MSMEs running multiple
> companies/stores.
>
> **Method:** every number below was measured against the codebase, not
> estimated. Re-run the commands in each section to refresh.
>
> Last audited: 2026-07-19 · Branch: master

---

## 0. Definition of "gold standard"

HisaabPro is gold when ALL of these hold (measurable gates, not vibes):

| # | Gate | How it's checked | Status |
|---|------|------------------|--------|
| G1 | **No cross-tenant data leak is structurally possible** | Every scoped query auto-injects `businessId` at the data layer; a missed filter fails closed, not open | ❌ NOT MET |
| G2 | Core billing loop works end-to-end, every day | login→business→party→product→invoice→payment→dashboard→ledger, verified | ✅ MET (this session) |
| G3 | Server + client test suites green, 0 failing | `npm test` both packages | ✅ 1245/0/7-todo server |
| G4 | `tsc` clean both packages | `npm run typecheck` | ✅ MET |
| G5 | Offline-first: no raw fetch, all mutations labelled, no localStorage entity writes | `node scripts/enforce-offline.mjs` | 🟡 near (1 debt item) |
| G6 | Platform-shell invariants hold (edge-to-edge safe) | `node scripts/enforce.js` | 🟡 5 tracked debt items |
| G7 | Every core screen has all 4 UI states + 320px clean | per-page audit checklist | ⬜ UNVERIFIED |
| G8 | Money is always integer paise; ledgers reconcile | GL trial-balance = 0; ledger single-count | ✅ MET (this session) |
| G9 | Multi-business switching is smooth for a real multi-store owner | switch has its own limiter, instant, no lockout | ❌ NOT MET |

**Headline:** the core loop is now correct (4 bugs fixed this session). The one
thing standing between HP and "safe to onboard multiple companies" is **G1 —
data-layer tenant isolation.** Everything else is polish and debt burn-down.

---

## 1. Current health baseline (measured 2026-07-19)

```
Server tests      146 files · 1245 pass · 0 fail · 7 todo      npm --prefix server test
Client tests      135 test files (invoice suite 104/104)       npx vitest run
Typecheck         clean (root + server)                         npm run typecheck
Offline ratchet   rawFetch 0/0 · localStorage 0/0 · mutMeta 1/6 node scripts/enforce-offline.mjs
SSOT gate         pass (45 legacy grandfathered)                npm run ssot
enforce.js        5 blocking (all Phase 3/4 shell debt)         node scripts/enforce.js
File discipline   22 files >250L (≈4 core, rest landing/data)   find … -exec wc -l
Codebase          2843 TS/TSX files                             —
```

This is a **healthy** baseline. HP is not a rescue project — it's a strong
codebase with one structural gap and a normal debt tail.

---

## 2. Gap register (tiered, evidence-backed)

### P0 — Ship-blocking for multi-tenant

#### P0.1 · No data-layer tenant isolation *(the whole ballgame)*
- **Evidence:** `server/src/lib/prisma.ts` applies only a soft-delete extension
  and slow-query logging — no `businessId` injection. Scoping is manual in
  **406 service files**; **60 `findUnique({ where: { id } })`** calls read a row
  by primary key with no tenant predicate, relying on a hand-written ownership
  re-check that is easy to forget.
- **Why it's P0:** one forgotten `where: { businessId }` = another company sees
  a competitor's invoices/parties/balances. This class already caused a real
  IDOR here (`req.user.userId` vs `.id` — Prisma drops `undefined`, silently
  unscoping the query). Manual discipline across 406 files will not hold as the
  team and surface grow.
- **Note:** the scoped-prisma design in the global `HIGH_RISK_PATHS.md`
  (`prisma-scoped.ts`, `prisma-scoped.inject.ts`, `scoped-models.ts`) belongs to
  a *different* project (Flint). **HP has none of it.** This is net-new work.
- **Fix shape (high-risk epic — requires `architect → security → task-manager`
  + approved `design-plan-active.md` before any edit to `prisma.ts`):**
  1. `scoped-models.ts` — SSOT list of tenant-scoped models.
  2. `prisma-scoped.inject.ts` — `$extends` query middleware that AND-merges
     `{ businessId }` into every `where` for scoped models; rewrites
     `findUnique → findFirst` (findUnique can't carry a non-unique predicate);
     two-step update/delete-by-id (fetch scoped, then act).
  3. Async-local-storage business context set in `resolve-scoped.ts` middleware,
     read by the injector — services stop passing `businessId` by hand.
  4. Flag-gated cutover (`SCOPED_PRISMA_ENFORCE`): shadow-compare in prod,
     then boot-guard that refuses to start unenforced post-cutover.
  5. A gate/lint that fails CI if a scoped model is queried on the raw client.
- **Acceptance:** a red-team test proves business A's token cannot read/mutate
  business B's row on ANY scoped model, even with a forged id; boot-guard active;
  all existing tests green with enforce on.
- **Effort:** L (epic, ~1–2 weeks incl. migration + shadow period).

### P1 — Correctness / UX must-fix

#### P1.1 · Business switching shares the login brute-force limiter ✅ *(identified this session)*
- **Evidence:** `switch-business.ts:25` mounts `authRateLimiter` (5 req/min/IP —
  the login/OTP bucket). A multi-store owner (Amit persona) switching stores a
  few times a minute gets "Too many attempts" and is locked out.
- **Fix:** give switch-business its own authenticated-action limiter (~60/min);
  the route is already `auth`-gated so brute-force protection is redundant.
- **Effort:** S (single route file). **Awaiting cap decision (recommend 60/min).**

#### P1.2 · Verify the 4 UI states + 320px on every core screen
- **Evidence:** G7 unverified; checklist exists (`PAGE_AUDIT_CHECKLIST.md`) but
  no proof captured for the core flow screens.
- **Fix:** run `scripts/qa-route-sweep.mjs` / screenshot the core screens at
  320/375px in loading, error, empty, success.
- **Effort:** M.

#### P1.3 · Untested core areas: offline queue replay + multi-business data isolation at runtime
- **Evidence:** offline *discipline* is clean, but the queue's actual
  offline→online replay (idempotency, ordering, conflict) has not been
  exercised end-to-end this session; multi-business runtime isolation is
  untested pending P0.1.
- **Fix:** integration test: queue a party+invoice+payment offline, go online,
  assert single application + correct GL.
- **Effort:** M.

### P2 — Debt burn-down (tracked, non-blocking)

#### P2.1 · Platform-shell Phase 3/4 debt (5 files)
- `tax-category-form.css:25` (fixed-bottom) → `<BottomActionBar>/<Drawer>`
- `cash-register.css:535`, `aging.css:359`, `pos-billing.css:15`, `pos.css:15`,
  `report-shared.css:11` (fixed/sticky top:0) → `<Header>` primitive / stack
  under `--header-height`.
- **Effort:** S each. **Acceptance:** `node scripts/enforce.js` → 0 errors.

#### P2.2 · File-size discipline (22 files >250L)
- Real core offenders: `api.ts` (278), `reminder-trigger.service.ts` (285),
  `ledger.service.ts` (259), `employee.service.ts` (258). Rest are
  landing/marketing UI (`feature-bento-grid` 554, `playstore-mock` 819) or data
  files (`notification-templates.data` 511, `permissions-data` 327) — data files
  are acceptable, landing is low-priority.
- **Effort:** S–M. Split only the 4 core service/lib files.

### P3 — Coverage / hygiene

#### P3.1 · 7 todo tests on the server — close the coverage gaps.
#### P3.2 · Offline ratchet: drive the last `mutationNoEntityType` (1/6) to 0.

---

## 3. Sequenced roadmap to gold

| Wave | Scope | Gate cleared | Blocking? |
|------|-------|--------------|-----------|
| **Now** | P1.1 switch-business limiter | G9 | quick win |
| **Wave A** | **P0.1 tenant isolation epic** (architect→security→task-manager, design-plan, build, shadow, cutover) | **G1** | ⛔ gates multi-tenant launch |
| **Wave B** | P1.2 four-states/320px sweep + P1.3 offline-replay + multi-biz isolation integration tests | G7, G5, runtime-G1 | ships confidence |
| **Wave C** | P2.1 shell debt → enforce.js 0 · P2.2 split 4 core files | G6 | polish |
| **Wave D** | P3.1 todo tests · P3.2 offline ratchet → 0 | coverage | hygiene |

**Critical path to "onboard multiple companies safely" = Now → Wave A.**
Everything after Wave A is quality, not safety.

---

## 4. What is NOT on this plan (deliberately)

- New features. HP is at feature-parity-plus vs myBillBook/Vyapar; the gap is
  stability + isolation + polish, not surface area.
- Microservices, GST (Phase 2), or any re-architecture beyond the tenant-scoping
  layer. Keep the monolith; make it airtight.
- Growing the manifest with "vNext ideas" — this plan closes real gaps and stops.

---

## Appendix · Session fixes already landed (core-loop correctness)

| Commit | Fix |
|--------|-----|
| `a374c03` | New businesses seed the GL chart of accounts (couldn't invoice before) |
| `dd94ff6` | Payment create/fetch 500 — discount select mapped real columns |
| `8e52e04` | Party ledger double-counted every txn — exclude auto-posted GL mirrors |
| `fe8cc47` | Invoice edit fully broken — strip create-only keys from update payload |
