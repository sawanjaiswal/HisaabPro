# SCOPE — Data-Layer Tenant Isolation (Scoped Prisma)

> Pre-flight: Read `CLAUDE.md`, `.claude/rules/*` (OFFLINE, PLATFORM_SHELL,
> PRISMA_MIGRATION, HIGH_RISK_PATHS), context packs
> `~/.claude/contexts/{india-android-saas,auth-patterns}.md`, learnings
> `~/.claude/learnings/architecture-blindspots-{2026-05-31,2026-06-07}.md`,
> `docs/GOLD_STANDARD.md` (§0 G1, §2 P0.1), and live code:
> `server/src/lib/prisma.ts`, `soft-delete/{index,middleware,models}.ts`,
> `middleware/resolve-scoped.ts`, `lib/env.ts`, `__tests__/setup.ts`,
> `prisma/schema.prisma`. Phase 1 skipped (pre-answered). **Revised once after
> `SCOPE_AUDIT_tenant-isolation.md` BLOCK — see Revision Log.**

---

## Summary

Make cross-tenant reads and writes **structurally impossible**: a Prisma **client
component** extension auto-injects `{ businessId }` into every query on a
tenant-scoped model, sourced from an AsyncLocalStorage business context. A
forgotten filter — or an unset context — fails **closed** (returns/affects no
rows, or throws), never open (another tenant's data).

The mechanism (operation rewrite + soft-delete composition) is **proven by a
mandatory real-Postgres Phase-0 spike BEFORE any production wiring** — because the
live soft-delete module explicitly warns that Prisma *query* extensions cannot
switch operation type.

---

## Goals

- Inject `businessId` into every `where` for the **96** directly-scoped models,
  AND-intersecting any hand-written `businessId` (never widening). `[MUST_SHIP]`
- Scope the **~28 child models that carry no `businessId` scalar** via a two-step
  parent-id planner for `updateMany`/`deleteMany` (Prisma forbids relation filters
  there — a scalar `where:{ <fk>: { in: <in-scope parent ids> } }` is the only
  implementable defense). `[MUST_SHIP]`
- Validate every nested `connect`/`connectOrCreate` target on a scoped relation is
  in-tenant before the write (extensions do not recurse into connect targets). `[MUST_SHIP]`
- Completeness test derived **mechanically from Prisma DMMF**: every model with a
  `businessId` scalar MUST be in `SCOPED_MODELS`; `GLOBAL_ALLOWLIST` membership can
  NOT exempt a `businessId`-bearing model. `[MUST_SHIP]`
- **Phase-0 proof spike** on real Postgres: prove the operation-rewrite mechanism
  (findUnique→findFirst, delete/update→two-step) actually works on the installed
  Prisma version AND composes with soft-delete, BEFORE production wiring. `[MUST_SHIP]`
- Fail **closed** when context is unset on a scoped query (throw). `[MUST_SHIP]`
- Red-team integration test on **real ephemeral Postgres in CI (hard gate)**: biz A
  cannot read/mutate biz B's row on ANY scoped op — incl. child `updateMany`/
  `deleteMany`, nested `connect`, `$transaction`, and forged id. `[MUST_SHIP]`
- ALS-continuation tests: a scoped query on `res.on('finish')` / streaming / PDF /
  export / notification-fanout paths either still sees context OR fails closed. `[MUST_SHIP]`
- One-time **audit of all 86 raw-SQL sites** — each classified tenant-safe /
  needs-manual-`businessId` / move-to-ORM — as a **gate to the enforce cutover**. `[MUST_SHIP]`
- Audited `runUnscoped(reason)` escape hatch, enumerated for reads AND no-context
  writes (incl. `/api/auth/*` audit-log writes). `[MUST_SHIP]`
- Keep all 1245 server tests green; injector unit-tested independently of the global
  prisma Proxy mock. `[MUST_SHIP]`
- Shadow mode: log where injected scope differs from manual scope; ALSO flag write
  ops whose manual `where` carries no `businessId`. `[SHOULD_SHIP]`
- CI lint: fail if a scoped model is queried on `__basePrismaUnsafe` outside the
  allowlist; ban new raw SQL outside the audited allowlist. `[SHOULD_SHIP]`
- Boot-guard: prod refuses to start unless `SCOPED_PRISMA_ENFORCE=enforce`
  post-cutover. `[SHOULD_SHIP]`
- Add missing `businessId` index to `PayslipSnapshot`. `[SHOULD_SHIP]`
- Migrate ~406 services off manual `where:{businessId}`. `[FUTURE_EPIC]`
- Auto-scope raw SQL via a parser (the *audit* is MUST_SHIP; the *parser* is not). `[FUTURE_EPIC]`
- Per-user scoping of user-owned globals. `[FUTURE_EPIC]`
- Denormalize `businessId` onto child models (fallback if the two-step planner
  proves too costly at scale). `[FUTURE_EPIC]`

---

## User Flow

Infra epic — the "user" is every authenticated request.

**Happy path (per request)**
1. Auth + business-resolution middleware set `req.user.userId` + active `businessId`.
2. New `scoped-context.ts` middleware opens `runInBusinessContext({businessId,userId}, next)`.
   The frame wraps `next()` **and** — per blindspot SS-2 (2026-05-31) — any
   post-response continuation is handled explicitly (see ALS section).
3. `prisma.<scopedModel>.<op>()` reads `businessId` from the context and AND-merges it.
4. Only this tenant's rows return. A service also passing `where:{businessId}` gets
   the identical result (intersection is a no-op).

**Error paths**
- Scoped query, **no context** → throw `AppError(INTERNAL, 500, 'Tenant context missing')`,
  logged `SCOPED_PRISMA_CONTEXT_UNSET` {model, op}. Fails closed.
- Service passes `where:{businessId:'other'}` → `{ AND:[{businessId:'other'},{businessId:ctx}] }`
  → zero rows.
- Nested `connect:{id:'<B-row>'}` on a scoped relation → resolve fails → `NOT_FOUND`, no write.
- `runUnscoped()` without a reason → throws at call site (reason is required; no audit row = no run).

---

## Failure Mode Walkthrough

### A. Operational (6-months-post-launch)

1. **Provider/DB outage** — Extension adds in-memory `where`-merge + ALS reads +
   (for by-id writes and child many-writes) ≤1 resolve query; no new external
   dependency. DB down = existing 500s.
2. **Abuse spike (100x)** — Reads add zero round-trips. By-id writes + child
   `updateMany`/`deleteMany` add exactly one `findFirst`/`findMany(select id)` inside
   the same tx. Bounded; rate-limit is an auth-layer concern, unchanged.
3. **DB bloat** — Only new writes are `UnscopedAccessLog` (90-day cron) — spec below.
4. **Client-version lag** — Server-only, response-shape-preserving (same rows/fields,
   filtered). No client contract change.
5. **Regulatory (DPDP)** — The compliance artifact = scoped-models SSOT + red-team
   test + `runUnscoped` audit log + **the completed 86-site raw-SQL audit**. The
   "structural isolation" claim is only made AFTER the raw-SQL audit gate clears
   (Gap 5); until then the claim is explicitly withheld.
6. **Cost runaway** — ≤1 extra query per by-id/child-many write; reads add nothing.
   Shadow adds one base-client query per request during a time-boxed 1-week window only.
7. **Insider abuse** — `runUnscoped` is the only sanctioned cross-tenant path (audited);
   raw-client access to a scoped model is CI-lint-blocked; raw SQL is audited + allowlisted.

### B. Isolation-specific leak vectors (each has a coded defense + a red-team case)

| # | Leak vector | Defense (fails closed) |
|---|-------------|------------------------|
| B1 | Unlisted / **misclassified** scoped model | Completeness test derives must-scope set from DMMF `businessId` scalars; a `businessId` model absent from `SCOPED_MODELS` (even if parked in `GLOBAL_ALLOWLIST`) FAILS CI (Gap 3). |
| B2 | Raw-client escape (`__basePrismaUnsafe.invoice.…`) | CI lint fails outside injector + `runUnscoped` allowlist. |
| B3 | Nested `create` to a scoped child relation | Child inherits parent row scope via FK; top-level op scoped, so the create can't cross tenants. |
| B4 | `findUnique` by primary key (60 call-sites) | Rewrite → `findFirst` + `{ businessId }`; foreign id → `null`. |
| B5 | `update`/`delete`/`upsert` by unique key | Two-step: `findFirst({<unique>, businessId})` → null → `NOT_FOUND`; else act on resolved id **inside the caller's tx if one is active, else a new interactive tx** (SS-2 nested-tx). |
| B6 | `where` on `@@unique([businessId, sku])` | Compound already carries `businessId`; AND-merge ctx (no-op if matches, zero rows if wrong). |
| B7 | Raw SQL (`$queryRaw*`/`$executeRaw*`) | NOT covered by extensions. **All 86 sites audited (Gap 5)**; CI lint bans new raw SQL outside the audited allowlist. Auto-parse = FUTURE. |
| B8 | ALS context unset | Scoped op with no context → **throw** (`SCOPED_PRISMA_CONTEXT_UNSET`, 500). |
| B9 | **Child `updateMany`/`deleteMany`** (no own `businessId`) | **Two-step child planner**: resolve in-scope parent ids (`<Parent>.findMany({where:{businessId:ctx, id:{in: candidateParentIds}}, select:{id}})`), rewrite to scalar `where:{ AND:[ callerWhere, { <fk>:{ in: allowedParentIds } } ] }`, all inside one tx. Prisma rejects relation filters here — scalar FK-`in` is the only implementable path (Gap 1). |
| B10 | `count`/`aggregate`/`groupBy` | AND-merge `{ businessId }` (children take a relation filter for READs, so `{ <parentRel>: { businessId: ctx } }`). |
| B11 | `$transaction` interactive callback | Extension applies inside tx client; context is request ALS, still in frame. Red-team mutates inside `$transaction`. |
| B12 | Explicit widening (`OR:[{businessId:a},{businessId:b}]`) | Injector wraps caller `where` as `{ AND:[ callerWhere, { businessId: ctx } ] }` → cannot widen past ctx. |
| B13 | **Nested `connect`/`connectOrCreate` to a scoped relation** | Injector walks `data` for `connect`/`connectOrCreate` on scoped relation fields (enumerated from DMMF) and resolves each target via a scoped `findFirst`; foreign/unknown id → `NOT_FOUND`, no write. Extensions do NOT recurse into connect targets, so this is explicit (Gap 2). |
| B14 | **Async-continuation context loss** (`res.on('finish')`, streaming/PDF/export/fanout) | Scoped query outside the request frame → throw (fail closed). Continuation sites enumerated + each assigned a strategy (re-enter frame or `runUnscoped`); tested (Gap 6). |

---

## API Contract

No new HTTP endpoints. Internal injector + context API.

```ts
// server/src/lib/business-context.ts
interface BusinessContext { businessId: string; userId: string }
function runInBusinessContext<T>(ctx: BusinessContext, fn: () => T): T
function getBusinessContext(): BusinessContext | undefined
function runUnscoped<T>(reason: UnscopedReason, fn: () => Promise<T>): Promise<T>

type UnscopedReason =
  | 'auth.login-by-phone'        // find user before any business context exists
  | 'auth.audit-write'           // AuditLog write from /api/auth/* (scoped model, no ctx) — SS-3
  | 'business.create'            // first Business row
  | 'business.switch-resolve'    // which businesses a user belongs to
  | 'platform.admin'             // AdminUser cross-tenant console
  | 'cron.<jobName>'             // scheduled job iterating businesses (job name REQUIRED, not bare 'cron.system')
  | 'webhook.provider'           // provider webhook keyed by external id, pre-context
  | 'response.continuation'      // explicit re-enter for post-response work that can't inherit the frame

// server/src/lib/prisma-scoped.inject.ts — pure, unit-testable
function injectScope(
  model: string, operation: string,
  args: Record<string, unknown>, businessId: string,
): { operation: string; args: Record<string, unknown>; plan?: TwoStepPlan | ChildManyPlan }
// throws ScopedContextError when businessId is empty
```

Error shape (surfaced by the global handler): `{ success:false, error:{ code, message } }`.

---

## Data Model

**Verified schema facts (grep is the SSOT — counts are re-derived, never transcribed
into a fixed-size allowlist, per blindspot 2026-05-31 SS-1):**
- **96** models carry a `businessId String` scalar → `SCOPED_MODELS` (directly scoped).
- **8** use single-column inline `@unique` on `businessId` (`InventorySetting`,
  `DigitalSignature`, `DocumentSettings`, `ReminderConfig`, `TransactionLockConfig`,
  `PosSetting`, `InvoiceSettings`, `LoyaltyProgram`) — still indexed, fine.
- **~28 child models carry NO `businessId`** → `CHILD_SCOPED` (scoped via parent FK).
- **`PayslipSnapshot` has `businessId` but NO `@@index`** (verified: only inline
  `@unique` on `payrollId`). An injected `findMany`/`updateMany` filtering `businessId`
  is a **seq scan** → add the index (below) before enforce.

**Scoping needs no new column on the 96** — existing `businessId` + its indexes carry
the hot path.

**Child → parent FK map (`CHILD_SCOPED`, pinned; resolves to nearest `businessId`-bearing ancestor):**

| Child model | FK column | Parent (scoped) |
|-------------|-----------|-----------------|
| PartyAddress | `partyId` | Party |
| PartyCustomFieldValue | `partyId` | Party |
| OpeningBalance | `partyId` | Party |
| PartyPricing | `partyId` | Party |
| PriceListEntry | `priceListId` | PriceList |
| DocumentLineItem | `documentId` | Document |
| DocumentAdditionalCharge | `documentId` | Document |
| DocumentShareLog | `documentId` | Document |
| PaymentAllocation | `paymentId` | Payment |
| PaymentDiscount | `paymentId` | Payment |
| ProductCustomFieldValue | `productId` | Product |
| JournalEntryLine | `journalEntryId` | JournalEntry |
| LoanTransaction | `loanAccountId` | LoanAccount |
| StockVerificationItem | `verificationId` | StockVerification |
| JobItem | `jobId` | Job |
| CustomOrderItem | `customOrderId` | CustomOrder |
| CustomOrderAdvance | `customOrderId` | CustomOrder |
| PosSaleItem | `posSaleId` | PosSale |
| PosSaleEvent | `posSaleId` | PosSale |
| CashEntryEvent | `cashEntryId` | CashEntry |
| BomComponent | `bomId` | Bom |
| ProductionRunComponent | `productionRunId` | ProductionRun |
| MarketingCampaignRecipient | `campaignId` | MarketingCampaign |
| ReminderInstance | `ruleId` | ReminderRule |
| AppointmentStatusEvent | `appointmentId` | Appointment |
| GstReconciliationEntry | `reconciliationId` | GstReconciliation |
| ImportJobRow | `importJobId` | ImportJob |
| GodownStock | `godownId` | Godown |

> The architect MUST re-derive this map from the DMMF and assert every `CHILD_SCOPED`
> key (a) has no `businessId` scalar and (b) maps to a real relation whose target is
> `businessId`-bearing (transitively) — enforced by the completeness test (#14).
> `CouponRedemption`/`SubscriptionEvent` map to `Coupon`/`Subscription`; if those
> parents are platform-global (no `businessId`) the child is likewise global — the
> completeness test forces that decision, not a silent default.

**New table — escape-hatch audit log (ephemeral; cleanup MANDATORY):**

```prisma
model UnscopedAccessLog {   // append-only, written via __basePrismaUnsafe (intentionally unscoped)
  id        String   @id @default(cuid())
  reason    String              // UnscopedReason value
  actor     String?             // userId | 'cron:<name>' | 'system'
  detail    String?             // route / job name
  createdAt DateTime @default(now())
  @@index([createdAt])          // cleanup + forensic
  @@index([reason, createdAt])
}
```
- Cleanup: `server/scripts/cron/cleanup-unscoped-log.ts`, every 24h, retain 90 days,
  index on `createdAt`.

**Index fix (migration):** add `@@index([businessId, createdAt])` to `PayslipSnapshot`.

Both schema changes ship via `prisma migrate dev` (never `db push` — PRISMA_MIGRATION_RULES).

---

## File Plan

SSOT check: no existing HP tenant-scoping module (`.claude/ssot-index.json` clean;
Flint's scoped-prisma is a different repo per GOLD_STANDARD §P0.1). New capability
`tenant-scoping` gets a `ssot.config.mjs` row.

| # | Path | Action | Est. Lines | Layer | Notes |
|---|------|--------|-----------|-------|-------|
| 1 | `server/src/lib/scoped-models.ts` | create | ~130 | constants | `SCOPED_MODELS`, `CHILD_SCOPED` (child→FK→parent), `SCOPED_RELATION_FIELDS` (for connect-guard), `GLOBAL_ALLOWLIST` (+`globalReason`) |
| 2 | `server/src/lib/business-context.ts` | create | ~110 | lib | ALS store + `runInBusinessContext`/`getBusinessContext`/`runUnscoped` + audit write |
| 3 | `server/src/lib/prisma-scoped.merge.ts` | create | ~90 | utils (pure) | `andMergeWhere`, compound-unique detection, `createMany` data-inject, connect-target walk |
| 4 | `server/src/lib/prisma-scoped.rewrite.ts` | create | ~160 | utils (pure) | findUnique→findFirst; two-step by-unique planner; **child-many parent-id planner** (Gap 1) |
| 5 | `server/src/lib/prisma-scoped.inject.ts` | create | ~180 | utils (pure) | `injectScope()` dispatch; connect/connectOrCreate guard (Gap 2); throws on empty ctx |
| 6 | `server/src/lib/prisma-scoped.ts` | create | ~160 | transport | **client `$extends({query})` component** that can re-issue as a different op (the proven mechanism); executes two-step/child plans; shadow hook |
| 7 | `server/src/lib/prisma.ts` | **edit** | ~+45 | transport | export `__basePrismaUnsafe`; compose soft-delete THEN scoping (order proven by spike #17); flag-gated re-export |
| 8 | `server/src/lib/env.ts` | **edit** | ~+35 | env | `getScopedPrismaEnforce()` (`off\|shadow\|enforce`) + `validateScopedPrismaBoot()` |
| 9 | `server/src/middleware/scoped-context.ts` | create | ~80 | middleware | opens `runInBusinessContext` from `req.user`; registers a `res.on('finish')`-safe strategy (Gap 6) |
| 10 | `server/src/lib/prisma-shadow.ts` | create | ~130 | lib | shadow-diff harness; ALSO flags write ops with no manual `businessId` (SS-5) |
| 11 | `scripts/scoped/lint-raw-client.mjs` | create | ~120 | script (CI) | scoped-model-on-`__basePrismaUnsafe` ban + new-raw-SQL ban outside allowlist |
| 12 | `scripts/scoped/raw-sql-audit.allowlist.json` | create | ~90 | data | the 86 audited raw sites, each `{file, line, classification, note}` (Gap 5) |
| 13 | `server/src/lib/__tests__/prisma-scoped.inject.test.ts` | create | ~210 | test | injector unit tests (B1–B14), pure, no DB |
| 14 | `server/src/lib/__tests__/scoped-models.complete.test.ts` | create | ~80 | test | DMMF `businessId ⊆ SCOPED`; allowlist `businessId`-free; CHILD_SCOPED FK valid (Gap 3) |
| 15 | `server/src/__tests__/integration/tenant-isolation.redteam.test.ts` | create | ~240 | test | real Postgres; A cannot touch B on every op incl. child-many, connect, `$transaction`, forged id |
| 16 | `server/src/__tests__/integration/scoped-als-continuation.test.ts` | create | ~120 | test | scoped query on `res.on('finish')`/stream/PDF path sees ctx OR fails closed (Gap 6) |
| 17 | `server/src/__tests__/integration/scoped-mechanism.spike.test.ts` | create | ~160 | test | **Phase-0 gate**: proves findUnique→findFirst rewrite + delete→two-step + soft-delete composition on real Prisma/Postgres (Gap 4) |
| 18 | `server/scripts/cron/cleanup-unscoped-log.ts` | create | ~50 | script | 90-day retention |
| 19 | `server/prisma/schema.prisma` | **edit** | ~+14 | schema | `UnscopedAccessLog` + `PayslipSnapshot` `@@index([businessId, createdAt])` |
| 20 | `server/src/__tests__/setup.ts` | **edit** | ~+8 | test | stub `__basePrismaUnsafe` + `runUnscoped` passthrough in the prisma mock (SS-4) |

No row exceeds 250 lines. #3/#4/#5 are split so no pure-utils file passes the cap.

---

## UI States / Mobile / UX Copy

No UI, no client change, no copy. Response shapes byte-identical (same rows/fields,
filtered). Fail-closed surfaces the existing generic 500 toast / offline banner.
Offline queue unaffected (mutations still route through `api()`; scoping is server-transparent).

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Child `deleteMany({where:{paymentId:'<B-payment>'}})` | Two-step: resolve in-scope Payment ids → `where:{ AND:[caller, {paymentId:{in: allowedIds}}] }` → 0 rows for foreign parent |
| Child `updateMany` with a foreign parent id | Same planner; foreign parent excluded from the `in` set → 0 rows |
| `document.update({data:{party:{connect:{id:'<B-party>'}}}})` | Connect-guard resolves `<B-party>` under ctx → null → `NOT_FOUND`, no write |
| `connectOrCreate` where connect id is foreign | Resolve fails → treated as create-under-ctx OR reject (architect picks; default reject to avoid accidental duplicate) |
| Model wrongly placed in `GLOBAL_ALLOWLIST` but has `businessId` | Completeness test FAILS CI (Gap 3) |
| `PayslipSnapshot` filtered by `businessId` | Backed by new `@@index([businessId, createdAt])` |
| Two-step runs inside an already-open `$transaction` | Injector detects the active tx client and acts within it; never opens a nested interactive tx (SS-2) |
| Scoped query in `res.on('finish')` handler | Throws unless wrapped in `runUnscoped('response.continuation', …)` or the handler re-enters the frame; enumerated + tested (Gap 6) |
| `AuditLog` write from `/api/auth/login` (no ctx, but scoped model) | Wrapped in `runUnscoped('auth.audit-write', …)` (SS-3) |
| Raw `$queryRaw` in `login.ts`/`admin-dashboard` | Classified in the raw-SQL audit allowlist; enforce cutover blocked until all 86 classified |

---

## Security

- **Auth required:** context derived from `req.user`; no context = fail closed.
- **Role:** orthogonal to RBAC; platform-admin cross-tenant only via
  `runUnscoped('platform.admin', …)` (audited).
- **IDOR:** structurally closes the `req.user.userId` vs `.id` class (MEMORY
  `feedback_auth_req_user_shape`).
- **Rate limit / CSRF:** unchanged (no new endpoint).
- **Audit:** every `runUnscoped` writes an append-only `UnscopedAccessLog` row.
- **Insider:** `__basePrismaUnsafe` on a scoped model + new raw SQL are CI-blocked.
- **High-risk gate:** edits `**/lib/prisma.ts` + `**/lib/env.ts` → requires
  `architect, security` on an approved `design-plan-active.md` (this SCOPE = step 1).

---

## Observability

- Structured events (≤7): `SCOPED_PRISMA_CONTEXT_UNSET` {model,op}·
  `SCOPED_PRISMA_SHADOW_DIFF` {model,op,injected,manual}·
  `SCOPED_PRISMA_NO_MANUAL_SCOPE` {model,op} (SS-5 write-with-no-manual-where)·
  `SCOPED_PRISMA_UNSCOPED_USED` {reason,actor}·
  `SCOPED_PRISMA_TWOSTEP_MISS` {model}· `SCOPED_PRISMA_CONNECT_REJECT` {model,relation}.
- **Sentry:** any `CONTEXT_UNSET` in prod = P1 (a path escaped the middleware — likely
  Gap 6 continuation). `>0 SHADOW_DIFF` or `>0 NO_MANUAL_SCOPE` after shadow week
  blocks enforce.
- **Dashboards:** shadow-diff → 0 before enforce; `UNSCOPED_USED` by reason (anomaly
  watch); `CONNECT_REJECT` (should be ~0 in normal use).
- **Cost:** no external provider; track p95 mutation latency, alert +20%.

---

## Test Infrastructure

- **CI Postgres is a hard prerequisite, not a hedge.** CI provisions an ephemeral
  Postgres (GitHub Actions `services: postgres:16`) exposed as `DATABASE_URL_TEST`;
  #15/#16/#17 run against it as a **required gate**. If CI has no Postgres these three
  cannot run → the epic's guarantee is unproven → block. (setup.ts wholesale-mocks
  `../lib/prisma.js`, so unit tests never touch a DB; the three integration files
  import the REAL client via `vi.importActual` / a separate vitest project.)
- **Phase-0 spike (#17)** proves, on the installed Prisma version: (a) the client
  component can intercept `findUnique` and return `findFirst` semantics with an extra
  predicate; (b) `delete`/`update` by unique key executes as a scoped two-step;
  (c) soft-delete's `isDeleted` filter STILL applies to the rewritten op (composition);
  (d) the extension fires inside `$transaction`. **If (a) proves impossible via query
  extension, the documented fallback is a client-level `$allOperations` component /
  delegate wrapper — chosen and re-proven before wiring.**
- **Injector units (#13):** `injectScope()` fixtures for B1–B14 incl. empty-ctx throw,
  findUnique rewrite, two-step plan, child-many plan, connect-guard, createMany inject,
  compound-unique, OR-intersection.
- **Completeness (#14):** DMMF `businessId` models ⊆ `SCOPED_MODELS`; every
  `GLOBAL_ALLOWLIST` entry has no `businessId` scalar unless it carries a documented
  `globalReason`; every `CHILD_SCOPED` key lacks `businessId` and maps to a real parent.
- **Red-team (#15):** seed biz A + biz B rows on every scoped + child model; under A's
  ctx attempt read/update/delete/upsert/count/aggregate/groupBy/`updateMany`/`deleteMany`/
  nested-`connect`/`$transaction` at B's known + forged-cuid ids → null/0/NOT_FOUND on
  each; then A touches A's rows normally. Reserved ids `test-biz-A`/`test-biz-B`.
- **ALS continuation (#16):** drive a real route whose handler schedules a scoped query
  on `res.on('finish')` / a streamed PDF response → assert it either sees ctx or throws
  `CONTEXT_UNSET` (never silently unscoped), per blindspot 2026-05-31 SS-2.
- **No real money/SMS** — zero external calls.

---

## Accepted Trade-offs

- **Child many-writes use a two-step planner, not denormalized `businessId`.** Reason:
  avoids a 28-table migration + backfill now; the planner is correct and testable.
  Denormalization is the FUTURE fallback if the resolve query becomes a hot-path cost.
- **Raw SQL is audited, not auto-scoped.** Parser = FUTURE; the one-time 86-site audit
  + lint is the MUST_SHIP gate.
- **Gradual migration, not big-bang.** Intersection makes manual scope harmless.
- **Business-scoped, not user-scoped.** User globals stay `userId`-scoped in services.
- **Two-step adds ≤1 query per by-id/child-many write.** Only correct scoping for
  Prisma's unique-`where` + relation-filter limits.

---

## Resolved Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tenant context store | AsyncLocalStorage in NEW `scoped-context.ts` | `resolve-scoped.ts` is ID-resolver helpers, not an ALS store (verified) |
| Rewrite mechanism | **Client `$extends` component that re-issues the op** — proven by spike #17 BEFORE wiring | Live soft-delete module states *query* extensions "cannot reliably change operation type"; do not repeat that assumption unproven (Gap 4) |
| Composition order | soft-delete then scoping; **proven** in spike, not assumed | Prior SCOPE's "OUTERMOST rewrites first" rationale was wrong for a query extension |
| Child scoping | Two-step parent-id planner (`where:{<fk>:{in}}`) for many-writes; relation filter for reads | Prisma forbids relation filters in `updateMany`/`deleteMany` (Gap 1) |
| Nested connect | Resolve every connect/connectOrCreate target under ctx; reject foreign | Extensions don't recurse into connect (Gap 2) |
| Completeness | DMMF-derived must-scope set; allowlist cannot exempt a `businessId` model | Misclassification is likelier than non-classification (Gap 3) |
| Raw base name | `__basePrismaUnsafe` (greppable, lintable) | Matches HIGH_RISK trust-anchor naming |
| Merge | `{ AND:[callerWhere,{businessId:ctx}] }` | Airtight vs OR-widening + wrong-biz (B12) |
| Unset context | Throw (fail closed) | GOLD_STANDARD G1 |
| Two-step + open tx | Detect active tx client, act within it | Nested interactive tx is unsupported (SS-2) |
| Escape hatch | `runUnscoped(reason, fn)` + append-only log; reasons cover reads AND no-context writes | `/api/auth/*` `AuditLog` writes need it (SS-3) |

---

## Out of Scope

- Migrating ~406 services off manual `where:{businessId}`. `[FUTURE_EPIC]`
- Auto-scoping raw SQL via a parser (the 86-site audit IS in scope). `[FUTURE_EPIC]`
- Per-user scoping of user-owned globals. `[FUTURE_EPIC]`
- Denormalizing `businessId` onto child models. `[FUTURE_EPIC]`
- Business-switch rate-limiter (GOLD_STANDARD P1.1) — separate item.
- New features / GST / schema redesign beyond `UnscopedAccessLog` + the PayslipSnapshot index.
- Frontend / mobile / offline changes (none needed).

---

## Acceptance Criteria

- [ ] **Spike (#17) green on real Postgres** proving findUnique→findFirst, delete→two-step,
      soft-delete composition, and `$transaction` firing — BEFORE any production wiring.
- [ ] Red-team: under A's ctx, every op (incl. child `updateMany`/`deleteMany`, nested
      `connect`, `$transaction`) targeting B's known + forged id → null/0/NOT_FOUND on
      EVERY scoped + child model. Green on the CI Postgres gate.
- [ ] Red-team: A reads/mutates A's own rows normally.
- [ ] `injectScope(model, op, args, '')` throws `ScopedContextError`.
- [ ] Completeness: a `businessId`-bearing model dropped into `GLOBAL_ALLOWLIST` FAILS CI.
- [ ] ALS continuation: a scoped query on `res.on('finish')` sees ctx OR throws
      `CONTEXT_UNSET` (never silently unscoped).
- [ ] All 86 raw-SQL sites appear in `raw-sql-audit.allowlist.json` with a classification;
      0 unwaived → gate to enter Phase 2 (enforce).
- [ ] Composition: a soft-deleted row of A is excluded AND scoped (both filters apply).
- [ ] All 1245 server tests pass with `SCOPED_PRISMA_ENFORCE=enforce` (setup.ts stubs
      `__basePrismaUnsafe`).
- [ ] `tsc -b --noEmit` clean (server).
- [ ] CI lint: a deliberate `__basePrismaUnsafe.invoice.findMany()` AND a new
      `$queryRaw` outside the allowlist both FAIL.
- [ ] Shadow: seeded divergence emits one `SHADOW_DIFF`; a write with no manual
      `businessId` emits one `NO_MANUAL_SCOPE`.
- [ ] Boot-guard: prod boot with `SCOPED_PRISMA_ENFORCE` unset (post-cutover) throws.
- [ ] `PayslipSnapshot` has `@@index([businessId, createdAt])`.
- [ ] `npm run ssot` exit 0 (`tenant-scoping` row registered).

---

## QA Checklist (verifier confirms)

- [ ] Spike proves the rewrite mechanism on the installed Prisma version (Gap 4).
- [ ] Every scoped + child op exercised by the red-team test (per-op checklist).
- [ ] Child `updateMany`/`deleteMany` with a foreign parent id → 0 rows (Gap 1).
- [ ] Nested `connect`/`connectOrCreate` of a foreign id → NOT_FOUND, no write (Gap 2).
- [ ] Completeness fails on a `businessId` model wrongly allowlisted (Gap 3).
- [ ] Real-Postgres integration gate runs in CI (not skipped) (Gap 4).
- [ ] 86 raw sites all classified; enforce blocked until 0 unwaived (Gap 5).
- [ ] Continuation paths (PDF/stream/finish/fanout) each have a strategy + a test (Gap 6).
- [ ] Two-step inside an open `$transaction` acts within it, no nested tx (SS-2).
- [ ] `AuditLog` write from `/api/auth/*` wrapped in `runUnscoped('auth.audit-write')` (SS-3).
- [ ] setup.ts stubs `__basePrismaUnsafe` (no undefined crash) (SS-4).
- [ ] Shadow flags write ops with no manual `businessId` (SS-5).
- [ ] Cleanup cron deletes `UnscopedAccessLog` rows older than 90 days.
- [ ] Migrations created via `prisma migrate dev` (not `db push`).
- [ ] No new `eslint-disable`, no `as any` in the injector.

---

## Rollout & Cutover Sequence

| Phase | `SCOPED_PRISMA_ENFORCE` | Behaviour | Gate to advance | Rollback |
|-------|-------------------------|-----------|-----------------|----------|
| **-1 · Spike** | n/a | Throwaway real-DB spike (#17) proves the mechanism + composition | Spike green | Abandon design if mechanism infeasible → adopt documented fallback |
| 0 · Land dark | `off` | Extension present; re-export returns un-scoped client; all unit + integration tests green in CI Postgres | tests green, tsc clean, lint green, **86 raw sites all classified** | Revert PR (no runtime effect) |
| 1 · Shadow (prod) | `shadow` | Real client scoped; ALSO run base-client query, log `SHADOW_DIFF` + `NO_MANUAL_SCOPE`; mutations use MANUAL result | 1 week, 0 diffs, 0 no-manual-scope writes, Sentry clean | env → `off` (no deploy) |
| 2 · Enforce | `enforce` | Scoped client authoritative; base only via `runUnscoped`; fail-closed | red-team + full suite green in prod-mirror; **raw-SQL audit gate = 0 unwaived**; on-call briefed | env → `shadow` (no deploy) |
| 3 · Boot-guard | `enforce` (locked) | `validateScopedPrismaBoot()` throws in prod if not `enforce` | stable ≥1 week at Phase 2 | Emergency `CLAUDE_HIGHRISK_BYPASS`-style override, audited |

Rollback is env-flag-driven at every phase (no code deploy to fall back).

---

## Notes for the Architect (next in sequence)

1. **Reframed (was "$transaction propagation"):** the bigger unknown is
   **operation-rewrite feasibility**. Run spike #17 FIRST; if a query extension can't
   switch findUnique→findFirst, adopt the client-component/delegate fallback and
   re-prove composition with soft-delete.
2. Re-derive `CHILD_SCOPED` + `SCOPED_RELATION_FIELDS` from the DMMF; the completeness
   test enforces coverage, you own correctness (esp. `CouponRedemption`/`SubscriptionEvent`
   parent-globality).
3. Decide shadow sampling — recommend 100% for the bounded 1-week window, then off.
4. Design the child-many parent-id planner's candidate-id extraction (the caller's
   `where` may filter by FK, by other scalars, or be empty — an empty `where`
   `deleteMany` on a child must still resolve to only in-scope parent ids).

---

## Revision Log

**2026-07-19 — revised against `docs/SCOPE_AUDIT_tenant-isolation.md` (verdict BLOCK, 6 MUST_SHIP + 5 SHOULD_SHIP).**

Gaps closed (MUST_SHIP):
1. **Child many-write hole** — added `CHILD_SCOPED` two-step parent-id planner (B9,
   File #4, pinned FK map in Data Model), red-team case #15. Prisma-relation-filter
   limit acknowledged; scalar `where:{<fk>:{in}}` is the implementable path.
2. **Nested connect/connectOrCreate** — added connect-guard (B13, File #3/#5,
   `SCOPED_RELATION_FIELDS`), red-team case, `CONNECT_REJECT` metric.
3. **Completeness = correctness** — test #14 now derives must-scope set from DMMF
   `businessId` scalars; allowlist cannot exempt a `businessId` model.
4. **Unproven rewrite mechanism** — added Phase-0 spike gate (#17, Rollout Phase -1),
   client-component mechanism + documented fallback, CI-Postgres as a hard prerequisite.
5. **83→86 raw-SQL sites** — promoted to MUST_SHIP one-time audit + allowlist
   (File #12) gating the enforce cutover; new-raw-SQL lint ban.
6. **ALS async-continuation loss (blindspot SS-2)** — added B14, File #16 test,
   `response.continuation` reason, enumerated continuation strategy.

SHOULD_SHIP closed: SS-1 (corrected 96 count + PayslipSnapshot index migration),
SS-2 (nested-tx two-step), SS-3 (`auth.audit-write` reason), SS-4 (setup.ts stubs
`__basePrismaUnsafe`, File #20), SS-5 (shadow flags no-manual-scope writes).

Declined / deferred (with reason): child-model `businessId` denormalization kept
`[FUTURE_EPIC]` (two-step planner is sufficient + avoids a 28-table backfill now);
raw-SQL *auto-parser* stays `[FUTURE_EPIC]` (the audit is the MUST_SHIP part).
