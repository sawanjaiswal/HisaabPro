# Security Audit — Epic D — v3 verdict: PASS_WITH_GAPS

> Audited 2026-05-17 14:18 IST by security agent — Pass 2
> Worktree: `/Users/sawanjaiswal/Projects/HisaabPro-epic-d`
> Branch: `epic/phase-5-d-crm-loyalty`
> Against: `ARCHITECTURE_EPIC_D_crm_loyalty.md` (v3, 2,173 lines)
> Supersedes: v2 audit (BLOCK, 5 MUST_FIX + 4 SHOULD_FIX)

**Disposition:** task-manager MAY seed `.claude/design-plan-active.md`.
All 5 MUST_FIX from v2 are properly encoded with concrete code snippets,
file targets, AND grep-able §17 acceptance gates. All 4 SHOULD_FIX are
encoded. Two NEW_SHOULD_FIX surface in v3 (loyalty-route M4 pattern parity)
— both are non-blocking and can be folded into PR3/PR4.

---

## v3 review — closed items

| ID | v3 status | Where | Acceptance gate (§17 line) | Comment |
|----|-----------|-------|----------------------------|---------|
| **M1** ruleSnapshot deep-clone | PASS | §4.2 (L1003-1089) callout box; §3.4.1 (L754-770) re-snapshot at restore | §17.3 L2147-2152: `git grep "JSON.parse(JSON.stringify"` ≥ 2 matches + test 12.12 step 7 asserts void-row ruleSnapshot still reflects pre-edit rule | Strong. Re-snapshot chain (accrue→void→restore) explicitly forbids reaching back to live `CommissionRule.config`. Test 12.12 (L1916-1937) walks the 13-step proof. |
| **M2** server-only Party fields | PASS | §3.6 (L845-942) NEW section with both Pattern A `.omit` and Pattern B allow-list `.strict()` (B preferred); enforce.js #91b grep | §17.2 L2121-2125: PATCH with `lastContactedAt` → 400 ZodError + pre-commit grep blocks `lastContactedAt\|loyaltyPointsCache\|loyaltyOptOut` in `party.schemas.ts` | Strong. Three layers of defence (strict, allow-list, grep). Test 12.13 (L1939-1953) verifies entire PATCH rejected (not partial-applied). |
| **M3** withinDays cap + index | PASS | §3.5 (L788-843) Zod `.max(365)` + service-layer clamp; §2.5 (L444) composite index `(businessId, lastContactedAt, isActive)`; migration step 9 (L497) | §17.2 L2126-2129: `?withinDays=400` → 400; `=365` → 200; index migration confirmed | Strong. Belt-and-braces (Zod + service clamp + covering index). Test 12.14 (L1955-1967) walks 7-row boundary table including DoS payload `999999`. |
| **M4** cross-tenant 404 STAFF_NOT_FOUND | PASS | §6.3 (L1299-1349) — `businessUser.findFirst` + `isActive: true` precheck returns 404, NOT 200-empty, NOT 403 | §17.3 L2153-2157: cross-tenant uuid → 404; even owner can't cross tenants → 404 (test 12.8 steps 6 + 8) | Strong. Explicit "indistinguishable from non-existent" comment (L1316-1321). Same pattern noted for loyalty routes at L1365-1367 (but see NEW_S3 below — not as rigorously encoded). |
| **M5** factory middleware (no `headersSent`) | PASS | §6.3 (L1249-1297) — new file `server/src/middleware/commission-ledger-auth.ts` (#27c, ~50L); single-pass two-terminal pattern explicit | §17.3 L2158-2162: factory file exists + grep forbids `res.headersSent` in `commission.routes.ts` | Strong. v2 deprecated pattern shown alongside v3 replacement (L1230-1247). `posCheckoutAuth` (L584-590) uses the same pattern for S3 — consistency. |
| **S1** BigInt cross-multiply | PASS | §2.1 (L292-319) `computePointsEarned` uses `BigInt`; §3.1.1 (L612-638) `pos.validators.ts` superRefine uses cross-multiplication | §17.1 L2102-2104: test 12.11 (L1901-1914) overflow row `computePointsEarned(1e12, 10000) === 1e10` | Strong. Comment explicitly names `Number.MAX_SAFE_INTEGER = 2^53 − 1` and walks the overflow class. |
| **S2** rate cap at Zod boundary | PASS | §6.1 (L1188-1215) `commissionRuleSchema.strict()` with `rateBps.max(10000, 'COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT')` | §17.3 L2163-2166: `rateBps: 15000` → 400 + FE soft warning at 5000 + hard block at 10000 | Strong. Mode-specific `superRefine` enforces `flatPerUnitPaise` vs `rateBps` required-field logic. |
| **S3** loyalty.redeem route-layer middleware | PASS | §3.1 (L566-595) `posCheckoutAuth` factory on `POST /api/pos/sales`; §6.1 row mentions enforcement | §17.1 L2105-2108: 403 BEFORE tx opens; test 12.15 (L1969-1982) asserts zero PosSale rows + zero idempotency rows consumed | Strong. Test 12.15 step 4-5 verifies tx never opened (not just rejected after-the-fact). |
| **S4** PR3→PR5 rebase contract | PASS | §8 (L1594-1614) callout: PR5 MUST rebase on PR3 to avoid silently overwriting `restorePosSale` loyalty logic | §17.3 L2167-2169: post-PR5-merge `git grep "applyRedemption\|restoreForPosSale" server/src/services/pos/` MUST still return matches | Strong. Operational rule + CI grep gives two-layer defence against the silent-overwrite class. |

**All 5 MUST_FIX + 4 SHOULD_FIX: PASS.**

---

## NEW findings introduced or surfaced by v3

| ID | Severity | Where | Issue | Recommendation |
|----|----------|-------|-------|----------------|
| **NEW_S1** | SHOULD_FIX | §6.3 (L1364-1371), §11.3 (L1809) | `GET /api/loyalty/balance/:partyId` and `GET /api/loyalty/ledger/:partyId` cross-tenant precheck is **mentioned** ("same pattern applied") but lacks the concrete handler code snippet that §6.3 spelled out for commission. No file-plan row for a `loyaltyLedgerAuth` factory and no §17 grep/integration test for 404 PARTY_NOT_FOUND. The M4 attack class is identical (UUID enumeration via `partyId` path-param). Builder may copy-paste the commission pattern correctly — or may slip back to 403/200-empty without a gate to catch it. | Add to §17.1: integration test `GET /api/loyalty/balance/<other_tenant_party_uuid>` → 404 PARTY_NOT_FOUND (NOT 200-empty, NOT 403). Add to file plan: an explicit `partyTenantPrecheck` helper service used by both loyalty routes. Non-blocking — same architectural pattern already proven in M4. |
| **NEW_S2** | SHOULD_FIX | §3.1.1 + §3.1 — loyalty redemption checkout | The redemption row's `partyId` is validated for "exists" (`PARTY_REQUIRED_FOR_REDEMPTION`) but the v2 tenant-test row #4 (POST `/api/pos/checkout` with `partyId: <other_tenant_party>` should return 400 `PARTY_NOT_IN_TENANT`) has no explicit cross-tenant assertion anywhere in v3. The error code `PARTY_NOT_IN_TENANT` never appears in the doc. Service-layer fetches by `partyId + businessId` would catch it (Prisma scoping is established convention), but no §17 row tests it. Attacker scenario: leaked credential on tenant A debits points from tenant B's high-value party (debit succeeds → tenant B's points balance corrupted) — gated only by FK constraint failure, not by explicit `PARTY_NOT_IN_TENANT` semantics. | Add to §17.1: `loyalty_redemption` payment with cross-tenant `partyId` → 400 (or 404) `PARTY_NOT_IN_TENANT` BEFORE points are debited. Confirm `loyalty-redeem.service.applyRedemption` does `findFirst({ where: { id, businessId } })` not raw `findUnique({ where: { id } })`. Non-blocking — convention-level safety likely holds, but explicit gate eliminates the reviewer-vigilance dependency. |

Both NEW findings are SHOULD_FIX (parity gaps with already-encoded M4) — neither MUST_FIX nor a new attack class. They can be folded into PR3 acceptance without v4.

---

## A01–A10 deltas vs v2 audit

| Class | v2 | v3 | Delta |
|-------|----|----|-------|
| A01 Broken Access Control | FAIL | **PASS_WITH_FINDINGS** | M2 + M4 + S3 all closed at architecture layer. NEW_S1 + NEW_S2 carry similar pattern to loyalty routes — non-blocking. |
| A03 Injection | PASS_WITH_FINDINGS | **PASS** | S1 BigInt cross-multiply closes the float-edge logic-injection class. |
| A04 Insecure Design | FAIL | **PASS** | M1 (deep clone) + M5 (factory middleware) + S2 (rate cap) + S4 (rebase contract) all closed with grep tests. |
| A05 Sec Misconfig | PASS_WITH_FINDINGS | **PASS** | M3 withinDays cap closed at Zod boundary + service clamp + covering index. |
| A08 Data Integrity | PASS_WITH_FINDINGS | **PASS** | M1 ruleSnapshot immutability closed; void+restore chain re-snapshots from prior ledger row. |
| Others | unchanged | unchanged | — |

---

## Final disposition

**task-manager MAY seed `.claude/design-plan-active.md`** with the v3
architecture as the contract. The 2 NEW_SHOULD_FIX items should be added
to PR3's acceptance checklist (loyalty cross-tenant precheck parity) — they
do NOT block plan seeding.

**Carry into PR3 gate** (suggested wording for task-manager):
1. Add §17.1 test: `GET /api/loyalty/balance/<other_tenant_party>` → 404 PARTY_NOT_FOUND
2. Add §17.1 test: POS `loyalty_redemption` with cross-tenant `partyId` → 400 PARTY_NOT_IN_TENANT
3. Confirm `loyalty-redeem.service.applyRedemption` uses `findFirst({ where: { id, businessId } })`

No v4 architecture revision required.

---

## Summary

| Metric | v2 | v3 |
|--------|----|----|
| MUST_FIX outstanding | 5 | **0** |
| SHOULD_FIX outstanding | 4 | 2 (both NEW, both loyalty-route M4 parity) |
| NICE_TO_HAVE | 2 | 2 (unchanged — N1 loyalty config AuditLog, N2 opt-out wired no-op) |
| Verdict | BLOCK | **PASS_WITH_GAPS** |
| Most concerning closed | M1 ruleSnapshot mutation | (closed) |
| Most concerning open | — | NEW_S2 cross-tenant `partyId` in `loyalty_redemption` payment lacks explicit gate |
| Next | v3 revision | task-manager seeds plan; PR3 picks up 2 NEW_SHOULD_FIX |

---

# Pass 2 — Post-Ship (PR7) — verdict: **PASS**

> Audited 2026-05-17 18:46 IST by security agent — Pass 2 (post-ship re-audit)
> Worktree: `/Users/sawanjaiswal/Projects/HisaabPro-epic-d`
> Branch  : `epic/phase-5-d-crm-loyalty`
> Commits : `b61e1a1..4f93808` (PR1 foundation → PR6 Commission FE — 6 commits)

**Disposition:** All MUST_FIX from Pass 1 are intact in shipped code. Both
NEW_SHOULD_FIX items raised by Pass 1 (NEW_S1 loyalty balance/ledger
cross-tenant 404, NEW_S2 POS `loyalty_redemption` cross-tenant `partyId`
guard) are CLOSED in shipped code. One NEW SHOULD_FIX surfaces in Pass 2
(loyalty-expiry cron multi-pod race) — **non-blocking**; it inherits the
project-wide cron-without-leader-election pattern shared by
`recurring-generator`, `mandate-reminder`, etc.

Zero MUST_FIX. **Verdict: PASS.**

---

## Mandatory grep results (verbatim)

### M1 — ruleSnapshot deep-clone (≥ 2 expected, got 6)

```
$ git grep -n "JSON.parse(JSON.stringify" server/src/services/commission/
server/src/services/commission/commission-accrual.service.ts:24: * §17.3 deep-clone grep test: `git grep -n "JSON.parse(JSON.stringify"
server/src/services/commission/commission-snapshot.utils.ts:5: * Single SSOT for the `JSON.parse(JSON.stringify(...))` idiom so every
server/src/services/commission/commission-snapshot.utils.ts:16: * §17.3 grep test: `git grep -n "JSON.parse(JSON.stringify"
server/src/services/commission/commission-snapshot.utils.ts:42: * The `JSON.parse(JSON.stringify(...))` idiom strips Date → ISO string
server/src/services/commission/commission-snapshot.utils.ts:47:  return JSON.parse(JSON.stringify({
server/src/services/commission/commission-snapshot.utils.ts:75:  return JSON.parse(JSON.stringify(m.ruleSnapshot)) as CommissionRuleSnapshot
```

Forward-accrual site: `commission-accrual.service.ts:184` calls
`cloneRuleSnapshot(rule)` BEFORE `tx.commissionLedger.create`. Void/restore
sites: `pos-commission-symmetry.ts:91` (void) and `:162` (restore) both call
`cloneFromPriorMeta(src.meta)` — re-snapshot from the SOURCE row's meta,
NEVER from the live `CommissionRule`. Chain is unbroken across edit/soft-
delete events. **VERDICT: PASS.**

### S3 — posCheckoutAuth route-layer middleware (≥ 1 expected, got 2)

```
$ git grep -n "posCheckoutAuth" server/src/routes/pos-sales.ts
server/src/routes/pos-sales.ts:14:import { posCheckoutAuth } from '../middleware/pos-checkout-auth.js'
server/src/routes/pos-sales.ts:69:  posCheckoutAuth,
```

Ordering confirmed at `pos-sales.ts:65-72`:
```
auth → posCheckoutAuth → requireIdempotencyKey → requirePermission('pos.create')
                ↑ 403 BEFORE idempotency key can be consumed
```
`posCheckoutAuth` (`middleware/pos-checkout-auth.ts:44`) skips the
permission check unless `payments.some(p => p.mode === 'loyalty_redemption')`.
**VERDICT: PASS.**

### S4 — PR5 did NOT clobber PR3 loyalty restore (≥ 2 expected, got 6)

```
$ git grep -n "applyRedemption|restoreForPosSale" server/src/services/pos/
server/src/services/pos/pos-checkout.loyalty.ts:15:import { applyRedemption } from '../loyalty/loyalty-redeem.service.js'
server/src/services/pos/pos-checkout.loyalty.ts:62:    const result = await applyRedemption(tx, {
server/src/services/pos/pos-loyalty-symmetry.ts:9: *  - restoreForPosSale → for every VD row tied to this posSaleId, write one
server/src/services/pos/pos-loyalty-symmetry.ts:96:export async function restoreForPosSale(
server/src/services/pos/pos-void.service.ts:15:import { voidForPosSale, restoreForPosSale } from './pos-loyalty-symmetry.js'
server/src/services/pos/pos-void.service.ts:208:    const loyaltySym = await restoreForPosSale(tx, ctx.businessId, posSaleId)
```

PR5 (commission BE, `340d5bc`) added `pos-commission-symmetry.ts` as a
NEW file alongside the existing `pos-loyalty-symmetry.ts` from PR3 — they
coexist in `pos-void.service.ts` with separate symmetry calls.
**VERDICT: PASS.**

### M5 — commissionLedgerAuth factory + NO res.headersSent escape

```
$ git grep -n "commissionLedgerAuth" server/src/routes/commission.routes.ts
server/src/routes/commission.routes.ts:21: * v3 / M5 — uses `commissionLedgerAuth` factory middleware ...
server/src/routes/commission.routes.ts:34:import { commissionLedgerAuth } from '../middleware/commission-ledger-auth.js'
server/src/routes/commission.routes.ts:124:  commissionLedgerAuth,

$ git grep -n "res.headersSent" server/src/routes/commission.routes.ts
server/src/routes/commission.routes.ts:22: * two terminals — no `res.headersSent` chain).
server/src/routes/commission.routes.ts:123:  // v3 / M5 — factory middleware. Single-pass, no `res.headersSent` chain.
```

Both `res.headersSent` hits are NEGATIVE comments (describing the banned
pattern). The factory at `middleware/commission-ledger-auth.ts:23-38` is
single-pass / two-terminal: own-ledger path calls `next()`; other-staff
path delegates to `requirePermission('commission.view_all')`. No
`if (res.headersSent) return;` escape-hatch anywhere. **VERDICT: PASS.**

### S2 — commission rate cap defined + thrown (≥ 1 expected, got 4)

```
$ git grep -n "COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT" server/src/
server/src/lib/errors.ts:29:  COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT = 'COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT',
server/src/schemas/commission.schema.ts:49:    .max(COMMISSION_RATE_MAX_BPS, 'COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT')
server/src/services/commission/commission.errors.ts:17: * 400 COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT — rateBps > 10000.
server/src/services/commission/commission.errors.ts:23:    ErrorCode.COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT,
```

Caps at Zod boundary (10_000 bps = 100 %). **VERDICT: PASS.**

### M4 — cross-tenant returns 404 STAFF_NOT_FOUND (not 403)

```
$ git grep -n "STAFF_NOT_FOUND" server/src/services/commission/
server/src/services/commission/commission-ledger.service.ts:14: * needs `req.user.businessId` and returns 404 STAFF_NOT_FOUND. Service
server/src/services/commission/commission-ledger.service.ts:175: * Throws 404 STAFF_NOT_FOUND if `staffUserId` is not an ACTIVE BusinessUser
server/src/services/commission/commission.errors.ts:4: * Security audit M4 (STAFF_NOT_FOUND), S2 (RATE_MAX), M3 (WITHIN_DAYS_RANGE).
server/src/services/commission/commission.errors.ts:110: * 404 STAFF_NOT_FOUND — caller requested ledger/leaderboard for a staffUserId
server/src/services/commission/commission.errors.ts:116:    ErrorCode.STAFF_NOT_FOUND,
```

`assertStaffInBusiness(businessId, targetStaffUserId)` at
`commission.routes.ts:135` runs BEFORE `listLedger` when the caller is
requesting another staff's ledger. UUID enumeration oracle is closed —
indistinguishable response between "not in my tenant" and "doesn't exist."
**VERDICT: PASS.**

### A04 concurrency — advisory lock around loyalty redeem (≥ 1 expected, got 2)

```
$ git grep -n "pg_try_advisory_xact_lock" server/src/services/loyalty/
server/src/services/loyalty/loyalty-redeem.service.ts:71: * Stable 31-bit signed int from partyId for pg_try_advisory_xact_lock.
server/src/services/loyalty/loyalty-redeem.service.ts:93:    SELECT pg_try_advisory_xact_lock(${k1}::int, ${k2}::int) AS ok
```

`loyalty-redeem.service.ts:130-185`: `applyRedemption` takes a
transaction-scoped advisory lock keyed on
`(hashId(businessId), hashId(partyId))` BEFORE balance precheck → before
RD-row insert. Concurrent redemption on the same party → 409
`LOYALTY_CONCURRENT_REDEMPTION` (clean reject, not silent double-spend).
**VERDICT: PASS.**

### A09 — no PII in console.* (expected EMPTY)

```
$ git grep -n "console.log|console.error" server/src/services/loyalty/ server/src/services/commission/
(no output — exit 1)
```

Winston `logger.*` used throughout. Analytics payloads (`analyticsEmit`)
carry only opaque cuid IDs (businessId, ruleId, partyId, posSaleId) — no
phone, name, or email. **VERDICT: PASS.**

### A03 — raw queries reviewed

```
$ git grep -n "queryRaw|executeRaw|$queryRawUnsafe|$executeRawUnsafe" server/src/services/loyalty/ server/src/services/commission/
server/src/services/loyalty/loyalty-redeem.service.ts:92:  const rows = await tx.$queryRaw<{ ok: boolean }[]>`
```

Single `$queryRaw` invocation is `pg_try_advisory_xact_lock(${k1}::int,
${k2}::int)` — a tagged template (parameter-binding, NOT string concat),
and both inputs are integer hashes (not user-controlled strings). No
`$queryRawUnsafe` or `$executeRawUnsafe` anywhere in Epic D. **VERDICT: PASS.**

### Observability + no-notification-spam

```
$ git grep -n "analyticsEmit" server/src/services/commission/
server/src/services/commission/commission-rule.service.ts:11: *  - createRule  → insert + analyticsEmit('commission_rule_created') post-call
server/src/services/commission/commission-rule.service.ts:22:import { analyticsEmit } from '../../lib/analytics.js'
server/src/services/commission/commission-rule.service.ts:109:  analyticsEmit('commission_rule_created', {

$ git grep -n "notificationManager.notify" server/src/services/commission/
(no output — exit 1)
```

**VERDICT: PASS** — analytics, not user-facing notifications, on money
paths.

---

## Additional verification (beyond mandatory greps)

| Check | Result |
|-------|--------|
| Zod `.strict()` in 3 new schema files (commission/loyalty/party) | 6 + 6 + 18 = 30 invocations |
| Zod `.passthrough()` in 3 new schema files | **0** |
| `data: req.body` in new routes (commission/loyalty) | **0** |
| `req.user.id` vs `req.user.userId` regression | **0** (all use `userId`) |
| Hardcoded secrets (`sk_`, `pk_`, `API_KEY = "..."`) | **0** |
| Banned `mongoSanitize` | **0** |
| `eval` / `innerHTML =` / `dangerouslySetInnerHTML` in Epic D FE | **0** (one false-positive matching "stale") |
| `localStorage.setItem` in Epic D FE | **0** |
| Raw `fetch('...')` in Epic D FE (OFFLINE_RULES Rule 1) | **0** |
| `cloneFromPriorMeta` actually called at void/restore sites | YES — `pos-commission-symmetry.ts:91` + `:162` |
| `validateLoyaltyOnCheckout` called BEFORE `prisma.$transaction` opens | YES — `pos-checkout.service.ts:52` (before line 61) |
| `enforce.js` (15 checks incl. Party server-only fields M2) | **All PASS** |
| Cross-tenant party precheck in loyalty balance/ledger | YES — `assertPartyInTenant` (loyalty-balance.service.ts:56) |
| Cross-tenant party precheck in POS `loyalty_redemption` payment | YES — `validateLoyaltyOnCheckout` (pos.validators.ts:179-185) |

### Pass-1 NEW_SHOULD_FIX status

- **NEW_S1 (loyalty balance/ledger cross-tenant 404)** — **CLOSED**.
  `loyalty-balance.service.ts:56-62` defines `assertPartyInTenant`, called
  at line 70 (`getBalance`) and line 137 (`listLedger`). Throws
  `loyaltyPartyNotFoundError(partyId)` → 404 PARTY_NOT_FOUND. Test
  evidence: `__tests__/loyalty-balance.test.ts:65`.
- **NEW_S2 (POS `loyalty_redemption` cross-tenant `partyId`)** — **CLOSED**.
  `pos.validators.ts:168-209` defines `validateLoyaltyOnCheckout`. At
  line 179-185: `prisma.party.findUnique({ where: { id: input.partyId },
  select: { businessId: true } })` followed by `if (!party ||
  party.businessId !== businessId) throw partyNotInTenantError(input.partyId)`.
  Throws BEFORE `prisma.$transaction` opens at line 61 — idempotency key
  is NOT consumed. Error code `PARTY_NOT_IN_TENANT` defined in
  `lib/errors.ts:31`.

---

## OWASP A01–A10 — Pass 2 deltas

| Class | Pass 1 | Pass 2 | Delta |
|-------|--------|--------|-------|
| A01 Broken Access Control | PASS_WITH_FINDINGS | **PASS** | Both NEW_S1 + NEW_S2 closed in shipped code |
| A03 Injection | PASS | **PASS** | unchanged |
| A04 Insecure Design | PASS | **PASS_WITH_FINDING** | new SHOULD_FIX surfaced: cron multi-pod race (S5 below) |
| A05 Sec Misconfig | PASS | **PASS** | unchanged |
| A07 Authentication | PASS | **PASS** | middleware ordering verified (auth → posCheckoutAuth → requireIdempotencyKey) |
| A08 Data Integrity | PASS | **PASS** | M1 deep-clone live at all 3 call sites |
| A09 Logging | PASS | **PASS** | zero `console.*` in new services; analytics carry only IDs |

---

## New finding — SHOULD_FIX (S5)

| ID | Severity | Where | Issue | Recommendation |
|----|----------|-------|-------|----------------|
| **S5** | SHOULD_FIX | `server/src/services/loyalty/loyalty-expiry.cron.ts` + `lib/cron-scheduler.ts:97-106` | The expiry cron's `expireForBusiness` does (a) `findMany` expired AC rows, (b) `findMany` existing EX rows for those, (c) `createMany` the missing EX rows. The schema has NO `@@unique([businessId, type, note])` constraint and `lib/cron-scheduler.ts` runs `initCronJobs()` on EVERY server pod (no leader election). Two pods firing at 04:15 IST → both pass the precheck → both `createMany` → duplicate EX rows → party balance is double-debited for the expiry. Per-tenant impact is silent (no error surfaced). | Two-layer fix (pick either or both): (1) Add `@@unique([businessId, type, note])` to `LoyaltyLedger` model — DB-level dedupe with `createMany({ skipDuplicates: true })`. (2) Wrap `expireForBusiness` in `pg_try_advisory_xact_lock(<expiry-job-namespace>, hashId(businessId))` — same primitive already used in `loyalty-redeem.service`. **NON-BLOCKING because**: (a) this concurrency hole is systemic — `recurring-generator`, `mandate-reminder`, `subscription-grace-expiry`, etc. all share the no-leader-election pattern; Epic D is following established project convention. (b) On a single-pod deploy (current default) the race cannot occur. Recommend folding into a cross-cutting Epic that introduces job leader-election OR the advisory-lock + DB-unique combo across ALL crons. |

## Future-epic note

| ID | Severity | Issue |
|----|----------|-------|
| **F1** | FUTURE_EPIC | Multi-pod cron leader-election OR cron-level advisory locks (project-wide). Loyalty expiry (S5) is just the most recent example. Suggested fix: add a `lockMicroBatch('cron:<job-name>', () => {...})` helper that uses `pg_try_advisory_lock(<cron-namespace>, hashId(jobName))`, and wrap each `initCronJobs` job in it. Single helper, ~30 LOC, eliminates the race class for every cron. |

---

## Test re-run vs PR6 baseline

```
Test Files  3 failed | 31 passed (34)
     Tests  6 failed | 347 passed (353)
```

**347/353 — EXACTLY matches the PR6 baseline.** Zero new failures introduced
by the Pass-2 audit window. The 6 failing tests pre-date Epic D PR1:

- `einvoice.access.test.ts` × 2 — 402 (subscription gate) returned vs
  expected 404/400. Pre-existing failure outside Epic D scope.
- `parties.test.ts` × 4 — `replayProtection` + `idempotencyCheck()` were
  added to `POST /api/parties` by commit `f88ec26` (pre-Epic-D security
  hardening). Test mock doesn't send `x-idempotency-key` header, so
  `MISSING_REQUEST_HEADERS` fires before `validate(createPartySchema)`.
  This is a **defense-in-depth improvement** mis-detected as a test
  regression — needs test-suite update, NOT a security issue.

---

## Code fixes applied in Pass 2

**None.** No MUST_FIX surfaced; SHOULD_FIX S5 is non-blocking + systemic
(should be addressed in a cross-cutting cron-hardening epic, not patched
piecemeal here per the audit contract).

---

## Final disposition

| Tier | Count | Items |
|------|-------|-------|
| MUST_FIX | **0** | — |
| SHOULD_FIX | **1** | S5 (loyalty-expiry cron multi-pod race — systemic) |
| FUTURE_EPIC | **1** | F1 (cron leader-election OR project-wide cron advisory locks) |

**Verdict: PASS.** Epic D shipped cleanly with all Pass-1 MUST_FIX +
NEW_SHOULD_FIX closed in code. The new SHOULD_FIX (S5) inherits a
project-wide cron pattern and is appropriately deferred to a future
hardening epic. No code fixes applied during Pass 2.

Proof file: `/tmp/epic-d-pr7-proof.txt`
