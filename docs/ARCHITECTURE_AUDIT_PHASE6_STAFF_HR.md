---
audit_of: ARCHITECTURE_PHASE6_STAFF_HR.md
scope_ref: SCOPE_PHASE6_STAFF_HR.md
scope_audit_ref: SCOPE_AUDIT_PHASE6_STAFF_HR.md
auditor: architecture-auditor
audited_at: 2026-05-17T22:04:00Z
verdict: BLOCK
must_ship_gaps: 5
should_ship_gaps: 4
future_epic_recommendations: 2
scope_conformance_breaks: 0
passes_run: 5
passes_passed: 1
passes_blocked: 4
---

# Architecture Audit — Phase 6 Staff & HR (#135-#140)

## Overall Verdict — BLOCK

**5 MUST_SHIP gaps. 4 SHOULD_SHIP gaps. 0 scope conformance breaks.**

Architect successfully absorbed all 7 SCOPE_AUDIT gaps (G1-G7) at the *intent* layer
— the decision tree in §0, the PIN file reconciliation in §5.1, the 403 status code
choice in §6, the audit-coverage SSOT in §7.4, the payroll-reversal pattern in §8.3,
the geofence consent scrub in §9.3, and the per-business preview rate limit in §8.4
are all real engagements with the gap list, not lip-service.

**However**, four of the five MUST_SHIP gaps are *implementation-fiction* — patterns
that reference middleware/storage/models/files that do not exist in the HP codebase
as documented. The architecture would BLOCK at code time the moment a builder tried
to `import { niceRateLimit }` or `req.session.pinVerifiedAt`. The fifth is an
internal contradiction in the payroll-reversal section that an implementer cannot
resolve without going back to architect.

**SCOPE conformance breaks: 0.** Every concrete SCOPE decision IS reflected in
architecture — these gaps are about architectural correctness, not silent
deviation from SCOPE.

**Decision:** Architect must produce v2 addressing the 5 MUST_SHIP gaps below
BEFORE security agent runs. Several of the gaps materially affect the security
audit surface (session storage = token-equivalent; Payment.type = money-out audit
trail; req.session = cookie/transport contract), so running security on v1 wastes
a pass.

---

## Per-pass verdict matrix

| Pass | Focus | Verdict | MUST_SHIP | SHOULD_SHIP |
|------|-------|---------|-----------|-------------|
| 1 | SCOPE alignment | PASS | 0 | 0 |
| 2 | Data model integrity | BLOCK | 2 | 1 |
| 3 | Middleware ordering + races | BLOCK | 1 | 1 |
| 4 | PIN architecture + brute force | BLOCK | 1 | 1 |
| 5 | File Plan + LOC discipline | BLOCK | 1 | 1 |

---

## SCOPE Conformance Map

Every concrete SCOPE decision listed; each maps to a real architecture artifact.

| SCOPE decision | Architecture artifact | Status |
|----------------|----------------------|--------|
| #135 Attendance + photo + geofence consent | §2.1 `Attendance` model + §9.3 consent scrub | OK |
| #136 Payroll runs (DRAFT→FINAL→PAID) | §2.1 `PayrollRun` + §8.3 reversal pattern | OK |
| #137 Salary slips (immutable PDF snapshot) | §2.1 `PayslipSnapshot` model | OK |
| #138 Multi-firm (switch-business endpoint) | §3.2 sequence diagram | OK |
| #139 Audit-trail FTS search + redaction | §2.2 `AuditLog.searchVector + redactedFields` | OK |
| #140 Transaction PIN (4-digit, 5-min grace, lockout) | §5 (full PIN architecture, DH reuse) | OK |
| No JWT token shape change (SCOPE §6.5) | §1 explicit "no token claim changes" | OK |
| PIN_REQUIRED returns 403 not 401 (G5) | §6 + middleware contract | OK |
| Audit-coverage SSOT (G1) | §7.4 `audit-coverage.ts` declarative map | OK |
| Compensating Payment for payroll reversal (G3) | §8.3 (but see Gap M2) | DEVIATED |
| Withdrawable geofence consent (G4) | §9.3 cron + Settings UI | OK |
| Per-business payroll preview rate limit (G6) | §8.4 (but see Gap M3) | DEVIATED |
| DH PIN file reuse (G7: 13 of 15 in scope, 2 OUT) | §5.1 file table | OK |
| Idempotency vs PIN ordering | §11 middleware chain: PIN before idempotencyCheck | OK |

**Scope conformance breaks: 0** — every SCOPE decision is at least *intended* in
architecture. Where DEVIATED is listed, the issue is implementation contradiction
inside the architecture proposal itself, not a silent overrule of SCOPE.

---

## Pass 1 — SCOPE alignment

**Verdict: PASS.** Architect engaged every SCOPE_AUDIT gap (G1-G7) substantively.

What was checked:
- Every feature in SCOPE §2-§7 has a §-numbered artifact in architecture
- G1 audit-coverage SSOT → §7.4 declarative `audit-coverage.ts` with 20 service entries
- G2 PIN grace state → §5.3 documented (but storage-layer broken — see Pass 3 Gap M3)
- G3 payroll-reversal compensating entry → §8.3 documented (but contradicts itself — Pass 2 Gap M2)
- G4 DPDP geofence withdrawal → §9.3 cron + Settings UI documented
- G5 PIN_REQUIRED 403 not 401 → §6 + §11 middleware contract, with `src/lib/api.ts`
  interceptor sketch at lines 619-633
- G6 payroll-preview per-business rate limit → §8.4 documented (but wrong middleware
  name — Pass 3 Gap M3)
- G7 DH PIN file reconciliation → §5.1 table: 15 DH files, 13 ported, 2 OUT_OF_SCOPE
  (matches my filesystem check at `/Users/sawanjaiswal/DudhHisaab/src/services/auth-pin/`)

No SCOPE decision is silently overruled. The deviations called out elsewhere are
*implementation* contradictions, not policy reversals.

---

## Pass 2 — Data model integrity

**Verdict: BLOCK.** 2 MUST_SHIP gaps, 1 SHOULD_SHIP gap.

### M1 — `Payment.type` enum lacks `PAYROLL_OUT` / `PAYROLL_IN` values [MUST_SHIP]

`server/prisma/schema.prisma:1203-1235` defines `Payment.type` as a string with
comment `// PAYMENT_IN, PAYMENT_OUT`. §8.3 introduces payroll-disbursement
Payment rows of `type = "PAYROLL_OUT"` and reversal entries of
`type = "PAYROLL_IN"`. These values do not exist in the codebase.

**What's missing:** §2.2 column-extension table doesn't list any change to
`Payment.type` allowed-value documentation. There is also no migration step
added to the §2.4 migration sequence to extend the enum comment or to update
any check constraint / Zod schema / route validation that may currently reject
non-PAYMENT_* values.

**Failure mode:** First payroll-FINALIZE call writes a Payment row with type
`"PAYROLL_OUT"`. If any downstream consumer (ledger, balance recompute,
party-balance trigger, exports, analytics, audit log) treats `type` as a
known-enum and switches on PAYMENT_IN/PAYMENT_OUT, the new value is silently
ignored — meaning balances drift, audit log narrative misclassifies the
transaction, exports under-report payroll, and reversal entries can't be
distinguished from accidental payments.

**Industry pattern:** Either (a) extend the SSOT enum in schema, code, and
migration in one PR, or (b) introduce a separate `Payment.category` discriminator
(`'CUSTOMER'` vs `'PAYROLL'`) so `type` stays PAYMENT_IN/PAYMENT_OUT and category
disambiguates. Either way it's a schema-layer decision that must precede the
service implementation.

**Recommended fix:** Add to §2.2:
- Row: `Payment.type` — extend allowed values to `PAYMENT_IN | PAYMENT_OUT | PAYROLL_OUT | PAYROLL_IN`
- Migration PR2 line item: "Update enum comment; update Zod `paymentSchema` in
  `server/src/lib/validation/payment.ts`; audit `server/src/services/payment/**`
  for switch statements that need a default-throw."

**Severity:** MUST_SHIP — silent type-mismatch in money model.

---

### M2 — §8.3 internally contradicts itself on payroll reversal shape [MUST_SHIP]

§8.3 paragraph 2 says: *"Reversal writes a compensating Payment row with
`amountPaise = -original.amountPaise`."*

§8.3 paragraph 4 says: *"Reversal writes a Payment row with `type = 'PAYROLL_IN'`
(the inverse tender), `amountPaise = original.amountPaise` (positive)."*

These are two different patterns. Negative-amount-same-type and positive-amount-
inverse-type produce identical net balance arithmetic, but they are mutually
exclusive design choices that produce divergent ledger UIs, divergent
period-total reports, and divergent reconciliation queries.

**What's missing:** Pick one. Document why the other was rejected.

**Failure mode:** Two engineers implement two different reversal paths in
different PRs. Reports double-count or zero-out depending on which path
fired. Audit trail shows mixed sign conventions for ostensibly identical
operations.

**Industry pattern:** Most Indian billing/accounting systems (Zoho Books,
Tally) prefer the inverse-tender approach because (a) line items stay
positive in PDFs (no "Rs -50,000" in employee-facing salary statements),
(b) period totals can `SUM(amount) WHERE type = 'PAYROLL_OUT'` without
sign gymnastics, (c) it parallels the existing PAYMENT_IN/PAYMENT_OUT
relationship for refunds.

**Recommended fix:** Rewrite §8.3 to commit to one approach. Pin to
inverse-tender (`PAYROLL_IN`, positive amount) for consistency with
existing payment-refund conventions. Update the corresponding entry in
§17 acceptance gates.

**Severity:** MUST_SHIP — implementation cannot proceed without disambiguation.

---

### S1 — `BusinessUser.status` collision with proposed `suspendedAt` [SHOULD_SHIP]

`server/prisma/schema.prisma:282-299` already defines:
```
status String @default("ACTIVE") // ACTIVE, SUSPENDED, PENDING
```

§2.2 proposes adding `BusinessUser.suspendedAt`, `suspendedById`, `suspendedReason`
without acknowledging the existing `status` column. This creates two SSOTs for
"is this user suspended?": either `status === 'SUSPENDED'` or
`suspendedAt !== null`.

**What's missing:** §2.2 should state one of:
- (a) `suspendedAt`/`suspendedById`/`suspendedReason` are *metadata* fields and
  the canonical "is suspended" check stays `status === 'SUSPENDED'`. The trio
  is only set when status transitions to SUSPENDED, cleared on transition back.
- (b) Migration deprecates the `status` column in favor of `suspendedAt IS NOT NULL`
  semantics. (Almost certainly NOT this — `status` also encodes PENDING.)
- (c) `status` stays for ACTIVE/PENDING distinction; `suspendedAt` is the
  audit/recency record. Both are written atomically.

**Failure mode:** `/me` widening at §3.4 filters on `suspendedAt: null`. The
backfill of `suspendedAt` for users currently `status = 'SUSPENDED'` is not
mentioned. After deploy, the existing suspended users still appear ACTIVE via
the new check.

**Industry pattern:** Document the relationship explicitly and add a backfill
step to the migration: `UPDATE business_users SET suspended_at = NOW() WHERE status = 'SUSPENDED' AND suspended_at IS NULL`.

**Recommended fix:** Add a 2-paragraph reconciliation note to §2.2; add backfill
step to migration PR2; pick option (a) above (least invasive).

**Severity:** SHOULD_SHIP — won't block code, will leak suspended users into
active queries on day one of deploy.

---

### Pass 2 SHOULD_SHIP item (architecture inventory)

§2.2 lists "existing AuditLog fields" but omits `systemActor`, `ipAddress`,
`deviceInfo` (all present at `server/prisma/schema.prisma:1579-1601`).
This isn't load-bearing but the next dev who reads the architecture will assume
those fields don't exist and re-introduce them. Single-line fix.

---

## Pass 3 — Middleware ordering + races

**Verdict: BLOCK.** 1 MUST_SHIP gap, 1 SHOULD_SHIP gap.

### M3 — `niceRateLimit` does not exist; real export is `nicRateLimit` (different shape) [MUST_SHIP]

§8.4 payroll-preview rate limit code block:
```ts
router.post('/payroll/preview', authenticate, requirePin, niceRateLimit({
  windowMs: 60_000,
  max: 3,
  keyBy: (req) => `payroll-preview:${req.user.businessId}`,
}), payrollPreviewHandler)
```

`server/src/middleware/nic-rate-limit.ts:9` exports `nicRateLimit` (NIC = National
Informatics Centre, not "nice"). The export is a **pre-configured limiter**
(`createRateLimiter({...})` returned middleware), NOT a factory accepting
`{windowMs, max, keyBy}` per call site. The §8.4 example would fail TypeScript
at the second character (`niceRateLimit` is undefined import) and would fail
again at the call signature.

**What's missing:** Either:
- (a) Use the existing pre-configured limiter (but it doesn't support
  per-`businessId` keys — would rate-limit globally), OR
- (b) Add a new factory export (e.g. `createPerBusinessRateLimit({...})`) to
  `server/src/middleware/`, document it in §11, add a row to §18 File Plan.

**Failure mode:** Builder copies the §8.4 snippet, gets a tsc error, "fixes" it
by either:
- importing the real `nicRateLimit` and removing the `{windowMs, max, keyBy}` arg
  — silently producing global rate-limiting (one slow user blocks the whole
  multi-tenant fleet from previewing payroll), OR
- writing a one-off `express-rate-limit` inline call that doesn't share the
  Redis store the project actually uses → useless across multiple node processes.

**Industry pattern:** Per-tenant rate limits need a per-tenant key fn AND a
shared store (Redis). HP's `nic-rate-limit.ts` already uses Redis (per
`require('@/lib/redis')` or equivalent). The factory wrapping must accept
both `keyBy` and `store`.

**Recommended fix:** Add a §11 sub-section "Per-business rate-limit factory"
referencing a new `server/src/middleware/per-business-rate-limit.ts`. Add
this file to the §18 File Plan. Update §8.4 to use the correct name and
correct shape.

**Severity:** MUST_SHIP — code block does not compile and the silent
workarounds break tenancy isolation.

---

### S2 — Idempotency vs PIN ordering documented but not justified for non-mutating paths [SHOULD_SHIP]

§11 middleware chain places `requirePin` BEFORE `idempotencyCheck` for state-
changing endpoints. The justification ("refused action must not burn idempotency
token") is correct for POST/PUT/PATCH/DELETE.

What's not addressed: PIN-gated **GET** endpoints (`/audit-log/search`,
`/admin/audit-log/replay-detail`). These have no idempotency middleware, so the
ordering question doesn't apply — but the §11 chain table lists "GET sensitive"
as a row and shows the same PIN-before-idempotency order, which is misleading
because GET endpoints don't run `idempotencyCheck` at all.

**Recommended fix:** Split §11 into two sub-tables: "Mutating PIN-gated route"
and "GET PIN-gated route". Remove the idempotency column from the GET row.

**Severity:** SHOULD_SHIP — doc clarity, not runtime risk.

---

## Pass 4 — PIN architecture + brute force

**Verdict: BLOCK.** 1 MUST_SHIP gap, 1 SHOULD_SHIP gap.

### M4 — `req.session.pinVerifiedAt` has no backing store — `express-session` not installed [MUST_SHIP]

§5.3 PIN grace state:
> "After successful PIN verification, the middleware sets
> `req.session.pinVerifiedAt[routeClass] = Date.now()` via express-session
> (already in use)."

Express-session is NOT installed and NOT in use. Grep of `server/src/` returns
zero hits for `express-session`, `cookie-session`, `session(`. The HP server is
stateless on cookies (CSRF + JWT + refresh-token); there is no session table,
no Redis-backed session store, no `req.session` middleware mounted in
`server/src/index.ts` or any app-init file.

**What's missing:** A storage layer for the "5-minute PIN grace window" state.
This is the only piece of mutable per-user/per-session state the architecture
introduces, and it is named-but-unbacked.

**Failure mode:** Builder mounts express-session (decision-by-default) → adds a
second cookie to every response → tenancy decisions now read from BOTH the
JWT and the session blob, creating two SSOTs for identity → DPDP audit
surface expands silently → token-theft attack surface widens (the session
cookie may be in scope of an XSS that the httpOnly JWT cookie wasn't). OR
builder picks Redis-keyed by user-id (better) but then must invent the
key-scoping, TTL, invalidation-on-PIN-change-or-logout, cross-tab semantics,
and refresh-survival — all of which should be designed up front, not
discovered.

**Industry pattern:** Three viable backings:
1. **JWT claim refresh** — bake `pinVerifiedAt` into the refresh token and
   force a refresh post-PIN. Pro: no new storage. Con: requires token-shape
   change (which SCOPE §6.5 explicitly forbade).
2. **Redis hash** keyed by `userId`, fields = routeClass, value = expiry epoch.
   Pro: works with existing Redis. Con: needs a new key prefix + TTL +
   logout-eviction hook.
3. **Encrypted cookie** with HMAC, holding the grace map. Pro: stateless.
   Con: cookie-size growth, encryption-key management.

Per SCOPE §6.5 (no token change), option 2 (Redis) is the natural choice.
Architect must commit to it in §5.3 and add the new key prefix to §11 and
§18.

**Recommended fix:** Rewrite §5.3 to:
- Reject express-session
- Specify Redis key `pin:grace:{userId}:{routeClass}` with TTL = 300s
- Add invalidation hook in `services/auth/logout.service.ts` (DELETE all
  matching keys) and in `services/auth-pin/pin-change.ts` (same)
- Add `server/src/services/auth-pin/pin-grace-store.ts` to §18 File Plan
- Add §11 row showing the read path in `requirePin` middleware

**Severity:** MUST_SHIP — entire PIN UX depends on this. Without it, every
PIN-gated action prompts for PIN every time, breaking the SCOPE §5.2
5-minute grace window commitment.

---

### S3 — 403 PIN_REQUIRED interceptor placement in `src/lib/api.ts` [SHOULD_SHIP]

§6 lines 619-633 propose a 403 PIN_REQUIRED clause in `src/lib/api.ts`. The
existing `src/lib/api.ts:152-168` already handles 403 — but specifically a 403
with `body.error.code === 'CSRF_FAILED'`, AND that block is gated by
`needsCsrf` (line 80: `SYNC_MUTATION_METHODS.has(method) && !path.startsWith('/auth/')`).

The architect's snippet shows the new PIN_REQUIRED clause indented inside the
same `if (response.status === 403 && needsCsrf ...)` block. That gating is
wrong for PIN_REQUIRED:

- `GET /api/audit-log/search` is PIN-gated and returns 403 PIN_REQUIRED. It
  does NOT satisfy `needsCsrf` (it's a GET). The clause never fires; the
  caller surfaces a raw 403 with no PIN-prompt UI.

**Recommended fix:** §6 should show the PIN_REQUIRED clause as a **sibling**
top-level `if` block:
```ts
if (response.status === 403) {
  const body = await response.clone().json().catch(() => null) as {error?: {code?: string}} | null
  if (body?.error?.code === 'PIN_REQUIRED') {
    // open PinPromptModal, retry on success
    return openPinPromptAndRetry<T>(path, options)
  }
}
```
placed **above** the existing `if (response.status === 403 && needsCsrf)` block
(or with `else if` chaining). Document explicitly that PIN_REQUIRED handling
must be CSRF-method-agnostic.

**Severity:** SHOULD_SHIP — without this, GET PIN-gated routes return raw
403 to the user instead of triggering the PIN prompt modal.

---

## Pass 5 — File Plan + LOC discipline

**Verdict: BLOCK.** 1 MUST_SHIP gap, 1 SHOULD_SHIP gap.

### M5 — ~10 File Plan rows for PR7 audit-backfill point to non-existent services [MUST_SHIP]

§18 File Plan rows 162-181 (PR7: audit-coverage backfill) cite paths that do
not match the actual `server/src/services/` layout. Verified non-existent:

| Row | Cited path | Actual codebase path |
|-----|-----------|----------------------|
| 165 | `services/refund/refund-issue.service.ts` | NO `refund/` directory exists |
| 167 | `services/approval/approval-respond.service.ts` | `services/settings/approvals.ts` |
| 168 | `services/recurring/recurring-pause.service.ts` | NO "pause" file — only `runner/generation/clone` |
| 170 | `services/payment/void.service.ts` | `services/payment/update-delete.ts` |
| 172 | `services/party/edit.service.ts` | `services/party/update-delete.ts` |
| 174 | `services/settings/role-edit.service.ts` | `services/settings/roles.ts` |
| 175 | `services/settings/setting-modify.service.ts` | `services/settings/app-settings.ts` |
| 176 | `services/settings/transaction-lock-edit.service.ts` | `services/settings/transaction-lock.ts` |
| 178 | `services/document/share.service.ts` | `services/shared-link.service.ts` |
| 178 | `services/document/delete.service.ts` | `services/document/delete.ts` |

What's correct (verified): rows 179 (`loyalty/loyalty-program.service.ts`), 180
(`commission/commission-rule.service.ts`), 181 (`pos/pos-void.service.ts`)
all exist exactly as cited.

**What's missing:** A reconciliation pass against the real `server/src/services/`
tree. The 20-service audit-backfill is the largest delivery in PR7 (per §17
acceptance: "all 20 services emit audit events"), and the File Plan is the
implementer's contract for "what files to open and edit". With 10 of 20 rows
pointing nowhere, the implementer either (a) creates ten net-new files (bad —
duplicates existing services) or (b) stops and asks the architect to redo
the mapping (slow — architect must run the same grep I just ran).

**Failure mode:** PR7 lands with audit-backfill on the 10 correctly-named
services and quietly omits the other 10 (because the builder gave up and
shipped what would compile). Half the "sensitive" surface has no audit
trail. SCOPE §4.3 commitment to "every sensitive action audited" silently
breaks.

**Industry pattern:** File Plan must be grep-validated before architect signs
off. Running `find server/src/services -name '*.ts' | sort` once and
intersecting with the cited paths catches this in 30 seconds.

**Recommended fix:** Architect re-grep `server/src/services/**/*.ts`, update
all 10 paths to real files, re-verify the LOC estimates against actual
file sizes (a `delete.ts` file may already exceed 250L; the audit-emit
edits may force a split, which is a different File Plan row).

**Severity:** MUST_SHIP — PR7 is unbuildable as written.

---

### S4 — Cron file naming convention drift [SHOULD_SHIP]

§9.3 introduces `services/consent/geofence-consent-scrub.cron.ts`. Existing
HP cron convention (per `server/src/jobs/`) is `run-*.ts`:
`run-batch-expiry-alerts.ts`, `run-ptp-evaluator.ts`,
`run-recurring-generator.ts`. The `.cron.ts` suffix is novel.

**Recommended fix:** Rename to `server/src/jobs/run-geofence-consent-scrub.ts`
to match convention. Update §18 File Plan row.

**Severity:** SHOULD_SHIP — won't break, but introduces a second convention.

---

## Must-ship gaps (summary)

| # | Title | Failure mode | Pass |
|---|-------|-------------|------|
| M1 | `Payment.type` enum lacks PAYROLL_OUT / PAYROLL_IN | Balances drift; audit misclassifies | 2 |
| M2 | §8.3 internally contradicts payroll-reversal shape (negative-amount vs inverse-tender) | Two engineers, two implementations | 2 |
| M3 | `niceRateLimit` doesn't exist; real `nicRateLimit` has wrong shape | Silent global rate-limit OR untestedidempotent re-impl | 3 |
| M4 | `req.session.pinVerifiedAt` has no backing store — express-session not installed | Either token-shape change (forbidden) or new session cookie (security expansion) | 4 |
| M5 | ~10 PR7 File Plan rows point to non-existent service files | Half the audit-backfill silently omitted | 5 |

## Should-ship gaps (summary)

| # | Title | Pass |
|---|-------|------|
| S1 | `BusinessUser.status` collision with proposed `suspendedAt` (no backfill) | 2 |
| S2 | §11 middleware chain conflates GET-PIN with mutating-PIN ordering | 3 |
| S3 | 403 PIN_REQUIRED interceptor placement in `src/lib/api.ts` (must be sibling, not CSRF-nested) | 4 |
| S4 | `*.cron.ts` suffix breaks existing `run-*.ts` job convention | 5 |

Plus the inventory miss: `AuditLog.systemActor / ipAddress / deviceInfo` omitted
from §2.2 "existing" list (single-line doc fix).

## Future-epic recommendations

1. **Dedicated `Tenancy` model** — once Phase 6 multi-firm ships, the `BusinessUser`
   table will be performing double-duty for membership + suspension audit. A
   future epic could split `Tenancy { userId, businessId, role, joinedAt }`
   from `Suspension { tenancyId, suspendedAt, byUserId, reason }`. Not blocking
   v1.
2. **Audit-coverage runtime assertion** — §7.4 `audit-coverage.ts` is a
   declarative SSOT. A future enforcement script could parse the file at
   build time AND `grep` for `auditLog.write(` calls in every listed service,
   failing CI if a listed service doesn't actually call it. Not blocking v1.

## What the architecture got right

- **G5 (403 vs 401) consistently applied** through §6, §11, and the proposed
  `api.ts` interceptor sketch — no doc says 401 anywhere.
- **Idempotency-before-PIN call order** correctly identified as wrong; PIN
  before idempotency correctly enforced in §11.
- **DH PIN file reuse table (§5.1)** is *accurate* — the 15 DH files exist
  exactly as cited at `/Users/sawanjaiswal/DudhHisaab/src/services/auth-pin/`,
  and the 2 OUT_OF_SCOPE picks (the two DH-specific orchestrators) are the
  right ones to drop.
- **§17 per-feature acceptance gates** are crisp and testable — no "fuzzy"
  "feature works" criteria.
- **Migration sequence (§2.4)** correctly identifies the GIN index requires
  raw SQL CONCURRENTLY per PRISMA_MIGRATION_RULES.md.
- **§9.3 geofence consent withdrawal cron** addresses G4 with concrete
  implementation (not "we'll figure it out").
- **No JWT token shape change** held — architect did not silently introduce
  a new claim despite the PIN-grace pressure.

## Cross-session learnings applied

- "Architect-claimed middleware/service exists" check — caught Gap M3
  (`niceRateLimit` vs `nicRateLimit`) and Gap M5 (10 wrong service paths).
  Future audits: always intersect File Plan with `find server/src` output.
- "Storage layer for new mutable state must be named" — caught Gap M4
  (express-session assumption). Future audits: any `req.session.*` or
  `cache.set(*)` in architecture must cite the store (Redis key, table,
  cookie) explicitly.
- "Money-model enum extensions need migration row" — caught Gap M1
  (`Payment.type` PAYROLL_OUT). Future audits: any new "type" string-literal
  value in service code must be traced to schema + Zod + downstream switches.
- "Internal architecture contradictions" — caught Gap M2 (§8.3 sign-vs-tender).
  Future audits: read each architectural section twice; the second pass looks
  only for self-contradictions, not omissions.

## Action required from architect

Produce ARCHITECTURE_PHASE6_STAFF_HR.md **v2** addressing the 5 MUST_SHIP gaps:

1. M1 — Add `Payment.type` enum extension to §2.2 + migration row
2. M2 — Commit §8.3 to inverse-tender (`PAYROLL_IN`, positive amount); delete
   the negative-amount paragraph
3. M3 — Replace `niceRateLimit` with a real factory; add the factory file to
   §18 File Plan; document the Redis store reuse
4. M4 — Replace `req.session.pinVerifiedAt` with Redis-keyed grace map;
   document key prefix, TTL, and logout/pin-change invalidation hooks; add
   `services/auth-pin/pin-grace-store.ts` to §18
5. M5 — Re-grep `server/src/services/**` and rewrite all 10 broken PR7 rows
   to point at real files; re-estimate LOC against current file sizes

SHOULD_SHIP items can ship in v2 alongside the MUST_SHIPs or be deferred to
a v2.1 — they don't block security agent independently.

**Do not advance to security-auditor on v1.** Three of the five MUST_SHIPs
(M3, M4, M5) materially change the security surface (rate-limit shape,
session storage, audit-backfill coverage), so a security audit on v1 would
have to be redone after v2 lands.

---

## v2 re-audit (2026-05-17)

**audited_at**: 2026-05-17T22:34:00+05:30
**auditor**: architecture-auditor (re-run pass)
**target**: ARCHITECTURE_PHASE6_STAFF_HR.md v2 (revision_log entry dated 2026-05-17, 1866 lines)

**Overall**: PASS_WITH_GAPS
**Counts**: 1 MUST_SHIP, 5 SHOULD_SHIP, 3 questions-for-security, 0 FUTURE_EPIC

---

### M1-M5 closure verification

- **M1 (Payment.type enum widening)**: **PARTIALLY CLOSED** — closure of the schema-level question is genuine (Payment.type IS a `String @db.VarChar` per `server/prisma/schema.prisma:1207`; no `ALTER TYPE` is needed; the §2.4 PR1 migration row that updates the in-line comment and bumps `shared/enums.ts` is correctly designed). The PR1 file plan adds rows 6 + 7 (shared/enums.ts widening + payment.schemas.ts re-import). **However**, §2.2 line 325 promises "PR1 task: audit + add `default: throw`" against six downstream consumers (`payment/update-delete.ts`, `payment/create.ts`, `report-party.ts`, `report-payment.ts`, `dashboard/home.ts`, `party/ledger.service.ts`) but the PR1 file plan §18.2 contains NO rows for editing those six files. The defensive-default work is declared but unallocated. See new MUST_SHIP M6 below.

  Independent fact-check against the repo TODAY:
  - `shared/enums.ts:82` reads `['PAYMENT_IN', 'PAYMENT_OUT']` (architect's claim that the widening is already done in the repo is FALSE — but the architect doesn't actually claim that; the doc says "PR1 EDIT" so this is fine).
  - 14 grep hits on `=== 'PAYMENT_IN'` and `=== 'PAYMENT_OUT'` ternaries across `payment/*`, `report/*`, `dashboard/home.ts`, `party/ledger.service.ts`. None throw on unknown values; all silently treat unknown-type as `PAYMENT_OUT`-equivalent in their arithmetic branches. PAYROLL_OUT flowing through a customer-payment query would be silently misclassified.

- **M2 (negative-amount paragraph deletion)**: **CLOSED** — grep for "negative" in the v2 doc returns 9 hits; every hit is either (a) §0 changelog entry, (b) §8.3 explanation of why the rejected pattern is wrong, (c) §17 acceptance gate ("no row has `amount < 0`"), or (d) §20 postmortem trigger ("negative-amount Payment row appears in prod"). Zero hits assert the negative-amount pattern as the design choice. §8.3 (lines 1023-1064) commits firmly to inverse-direction-same-amount with four numbered justifications and four downstream-impact notes. `reversesPaymentId` FK is documented in §2.2 lines 297-304 with proper Prisma relation directives + the `@@index([reversesPaymentId])` index. §11 ordering is consistent (PIN before idempotency, both before the route handler). Period-total queries in §8.3 line 1063 explicitly enumerate gross vs net SQL patterns.

- **M3 (createRateLimiter factory wrapper)**: **CLOSED** — `niceRateLimit` grep across the v2 doc returns 1 hit (line 1069, a removal-justification: "v1 doc's `niceRateLimit` name as fictional"). Zero hits in `server/src/`. The new `per-business-factory.ts` proposal at §8.4 lines 1074-1099 correctly wraps the real `createRateLimiter` from `server/src/middleware/rate-limit/factory.ts` (verified — the factory accepts `keyFn` per line 10 of factory.ts). File Plan row 32 adds the wrapper at ≤70L. Middleware mount in §8.4 lines 1115-1122 places `payrollPreviewRateLimit` AFTER `requireActiveBusiness` (which guarantees a valid `req.user.businessId`), so the `?? req.ip ?? 'unknown'` defensive fallback in the keyFn (line 1096) never actually fires in practice — the empty-businessId / unauthed-user shared-bucket risk that I flagged mid-audit is dissolved by the chain order. Good.

- **M4 (signed-cookie PIN grace)**: **CLOSED with caveats** — `req.session` grep returns 0 hits in `server/src/` and 3 hits in the v2 doc, all removal-justification ("req.session.* references removed"). Cookie design at §5.3 lines 615-696 is solid: HMAC-SHA256 over JWT_SECRET, identity-bound via `uid` field (defeats cross-user replay per §5.3 line 631), HMAC verification via `crypto.timingSafeEqual` (line 682), httpOnly + secure + sameSite=strict + path=/api, session-cookie semantics (no Max-Age means browser-close clears it) with a SERVER-SIDE 12h hard-cap envelope `exp` field (line 642 + 680). cookieParser IS mounted at `server/src/app.ts:85` (line 11 imports, line 85 mounts) so `req.cookies` will be available. Cookie invalidation matrix at §5.3 lines 723-732 covers logout, logout-all, PIN reset finalize, PIN change, switch-business — comprehensive. Cookie-size analysis at line 753 confirms <10% of the 4KB cookie budget. The 180L estimate for `pin-grace-cookie.ts` is reasonable.

  Caveats:
  - At ≈180L the file is uncomfortably close to the 250L cap — a single follow-on (e.g. adding a route-class allowlist check to defeat unknown-routeClass injection) would breach. See SHOULD_SHIP S5.
  - The test file `pin-grace-cookie.test.ts` (row 68) is estimated at 180L, NOT 150L as the task description claimed — still under cap.
  - The three security-agent questions the architect raised (JWT_SECRET reuse for HMAC, cookie-tamper telemetry taxonomy, sameSite=strict OAuth callback impact) are legitimate but NOT MUST_SHIP for code-start; they're security-agent's responsibility. See "Questions for security agent" below.

- **M5 (PR7 audit-backfill path reconciliation)**: **CLOSED** — spot-checked all 15 reconciled paths via `ls`:
  | Cited path | Exists? | LOC |
  |---|---|---|
  | `services/party/update-delete.ts` | YES | 127 |
  | `services/document/delete.ts` | YES | 67 |
  | `services/document/update.ts` | YES | 175 |
  | `services/payment/update-delete.ts` | YES | 150 |
  | `services/settings/staff.ts` | YES | 248 (at cap) |
  | `services/settings/roles.ts` | YES | 131 |
  | `services/settings/app-settings.ts` | YES | 37 |
  | `services/settings/transaction-lock.ts` | YES | 38 |
  | `services/settings/approvals.ts` | YES | 70 |
  | `services/settings/pin.ts` | YES | 97 |
  | `services/shared-link.service.ts` | YES | 118 |
  | `services/recurring/crud.ts` | YES | 174 |
  | `services/loyalty/loyalty-program.service.ts` | YES | 146 |
  | `services/commission/commission-rule.service.ts` | YES | 240 (near cap) |
  | `services/pos/pos-void.service.ts` | YES | 232 (near cap) |

  All 15 paths confirmed to exist. The "refund row removed" claim is verified — no `services/refund/` directory exists in HP. The "document/update.ts added" claim is verified — file exists at 175L and audit-coverage SSOT row was correctly added. File Plan row count: largest row number is 209, no gaps, total 209 rows — consistent with architect's claim.

---

### Pass 1 (SCOPE alignment)

**PASS** — SCOPE conformance map from v1 still holds. No regression. The two §5.1 Gap-G7 reconciliations stay clean.

---

### Pass 2 (Data model integrity)

**PASS_WITH_GAPS** — M1 schema-level decision and M2 reversal-shape are both correctly committed. New MUST_SHIP M6 below covers the consumer-side defensive-default work that §2.2 line 325 promised but the file plan did not allocate. New SHOULD_SHIP S5 covers a stale narrative count: §0 line 59 + §17.5 line 1476 + §7.4 line 957 all say "20 services backfilled" but the actual AUDIT_COVERAGE SSOT contains 22 entries (6 Phase-6 + 16 backfill), and the PR7 file plan rows 169-190 ship 22 edits. The 20-count is stale wording from the v1 reconciliation pass. The enforce script uses the SSOT (truth source), so this is a doc-prose drift, not a logic break.

---

### Pass 3 (Middleware / races)

**PASS** — `createRateLimiter` factory verified at `server/src/middleware/rate-limit/factory.ts:15`; `keyFn` signature matches the wrapper. `requireActiveBusiness` is correctly slotted BEFORE the rate-limit middleware in §8.4 line 1115, eliminating the empty-businessId shared-bucket concern. Chain order in §11 keeps PIN-before-idempotency for mutating routes (correct — burned-token-after-PIN-refuse race avoided) and explicitly distinguishes the GET-PIN-gated route ordering at §11 lines 1264-1270. S2 from v1 audit (GET-PIN vs mutating-PIN documentation conflation) is now addressed.

---

### Pass 4 (PIN architecture)

**PASS_WITH_QUESTIONS** — Cookie design is sound for code-start. Tampered cookies, replayed cookies, expired envelopes all rejected per integration tests in §17.6 lines 1489-1490. Brute-force surface still has BOTH per-device (`pinAttempts/pinLockedUntil` in UserAppSettings) AND per-phone (`PinPhoneLockout` table) bounds even WITH a valid grace cookie — a stolen cookie does not bypass PIN-attempts lockout because every actual PIN entry goes through `pin-verify.service.ts` which increments `pinAttempts`. The cookie only short-circuits the "5-min grace" path; it never substitutes for a fresh PIN entry once the route requires one. FE round-trip for cookie-expired case is implicit but documented: 403 PIN_REQUIRED → PinGateProvider opens sheet → user re-verifies → cookie reissued → original request retried (§6.2 lines 818-840 + §12.3-12.4 lines 1331-1349).

JWT_SECRET-rotation behavior is the safer fail-mode the architect chose: rotation invalidates all existing cookies (HMAC verify fails) → all users prompted to re-verify PIN on next gated action → no exposure window. Documented implicitly in §5.3 line 692 (`secret.length < 32` boot-time check).

---

### Pass 5 (File Plan / LOC)

**PASS_WITH_GAPS** — File Plan totals 209 rows (verified by counting unique numeric prefixes 1-209, no gaps). Largest backend row remains `payroll-run.service.ts` at 240L (under 250 cap, addendum-extract documented at line 1785). `pin-grace-cookie.ts` at 180L has ~70L of headroom for additions; comfortable. Test file `pin-grace-cookie.test.ts` at 180L OK (architect listed 150L in task description; actual file plan row 68 has 180L — small mismatch with task description, not load-bearing). Three files at 220-240L (`pin-reset.service.ts`, `pin-lockout.service.ts`, `pin-verify.service.ts`) are close to cap; if the DH ports come in slightly bigger than estimated, splits are forced mid-build — see SHOULD_SHIP S6.

---

### New MUST_SHIPs (must close before advancing to security)

#### M6 — `Payment.type` widening lacks downstream consumer edits in PR1 file plan [MUST_SHIP]

§2.2 line 325 declares: "Downstream consumers we touched and confirmed switch-on-`type` is exhaustive (**PR1 task: audit + add `default: throw`**)". The §2.2 table then lists 6 consumer files:

1. `server/src/schemas/payment.schemas.ts` — handled (row 7)
2. `server/src/services/payment/get-list.ts` — NO file plan row
3. `server/src/services/report/{report-payment, report-daybook, report-party}.ts` — NO file plan rows
4. `server/src/services/dashboard/{home, stats}.ts` — NO file plan rows
5. `server/src/services/party/ledger.service.ts` — NO file plan row
6. `server/src/services/cash-register/cash-entry.queries.ts` — NO file plan row

Grep against the real repo: 14 sites use `=== 'PAYMENT_IN'` or `=== 'PAYMENT_OUT'` ternaries (`p.type === 'PAYMENT_IN' ? -X : X` shape). None throw on unknown values; all silently treat an unrecognised type-string as the ELSE branch:

- `services/party/ledger.service.ts:98` — `openingBalance += p.type === 'PAYMENT_IN' ? -Number(p.amount) : Number(p.amount)` — a PAYROLL_OUT/PAYROLL_IN row mis-classified as PAYMENT_OUT in customer-balance arithmetic
- `services/payment/update-delete.ts:26, 80, 128` — same ternary shape against outstanding-balance delta math
- `services/payment/create.ts:107, 124` — same ternary shape
- `services/report/report-party.ts:80`, `services/report/report-payment.ts:24-25,68` — same shape, affecting party reports + day-book sums
- `services/dashboard/home.ts:163` — `pmt.type === 'PAYMENT_IN' ? 'payment_in' as const : 'payment_out' as const` — silently mis-categorises payroll rows in the dashboard "Money Out / Money In" tiles

**Failure mode**: First payroll FINALIZE writes Payment rows with `type='PAYROLL_OUT'` linked to an Employee. If the Employee is also a Party (or shares a partyId because the architect routes payroll Payments through a STAFF Party in §8 — currently UNCLARIFIED), the party-ledger code silently double-counts payroll as a customer payment, inflating outstanding balances. Dashboard tiles aggregate payroll into the wrong bucket. Even if payroll Payments never carry a partyId that resolves to a customer/supplier party (i.e., the Employee is a fresh Party of type STAFF), the report aggregators still iterate every Payment matching the businessId in the date window and silently misclassify the type.

**Why it's MUST_SHIP and not SHOULD_SHIP**: M1 closure depends on this. M1 is the schema-level decision; M6 is the necessary follow-on at the consumer layer. Without M6, M1 ships incomplete and the first real PayrollRun in prod inflates customer balances or misreports dashboard totals depending on which path fires first.

**Recommended fix** (architect v3, ~30 min of work):
1. Resolve the open question in §8 about whether payroll Payments carry a partyId pointing at a STAFF-type Party, or a separate `employeeId` linkage (currently §2.1 line 212 shows `Payroll.paymentId` linking to Payment but doesn't mandate `Payment.partyId` shape). PICK ONE.
2. If "shared with party model": add 6 rows to §18.2 PR1 file plan editing the 6 consumer files above to add `default: throw new Error(...)` to switch/ternary blocks that touch `Payment.type`.
3. If "separate employee link": clarify in §8 that party-balance / customer-ledger code paths are NEVER reached for payroll Payments (because `partyId` is null or points at a STAFF Party that's filtered out at query time). Add a §17.2 acceptance gate proving that.
4. Either way: §17.2 needs an acceptance gate "Party-ledger query for any party returns no PAYROLL_OUT / PAYROLL_IN rows" OR "Dashboard 'Money Out' tile groups PAYROLL_OUT into a separate category, not mixed with PAYMENT_OUT".

**Severity**: MUST_SHIP — silent money-math mis-classification in the first payroll-FINALIZE call to prod.

---

### SHOULD_SHIPs (build can start; close before PR-7 ships)

#### S5 — Stale "20 services" narrative count [SHOULD_SHIP]

§0 line 59, §7.4 line 957, §17.5 line 1476 all say "20 mutation services backfilled". Actual AUDIT_COVERAGE SSOT contains 22 entries (6 Phase-6 + 16 backfill). PR7 file plan ships 22 edits (rows 169-190). The narrative count is stale from v1's reconciliation pass. The enforce script reads the SSOT, so behavior is correct; only the prose is drifted.

**Recommended fix**: Sweep-replace "20 mutation services" → "22 mutation services" in those three sites. 30 seconds of editing.

#### S6 — `pin-grace-cookie.ts` ≈180L and four DH ports at 210-220L are uncomfortably close to the 250 cap [SHOULD_SHIP]

File Plan rows 50 (`pin-lockout.service.ts` ~210L), 51 (`pin-verify.service.ts` ~210L), 53 (`pin-reset.service.ts` ~220L), 57 (`pin-grace-cookie.ts` ~180L) are all within ~30-70L of the cap. DH ports historically come in 10-15% heavier than estimated when the import paths and the HP-specific adaptations are factored in. If `pin-verify.service.ts` lands at 240L (still under cap) but the audit acceptance gate at §17.6 line 1492 ("PIN verify writes AuditLog (success + failure + lockout)") adds 15L of structured-logging calls, the file silently breaches mid-build and forces a split during PR3 review — slowing the dependent PR4-PR6 graph.

**Recommended fix**: Pre-plan a split that's "free until needed". For each of the 4 files above, name the extract file in §18.4 ("if `pin-verify.service.ts` breaches, extract `pin-verify-orchestrator.ts` taking the success branch + audit emission"). Costs nothing if the file lands at estimate; saves a /garden cycle if it doesn't.

#### S7 — File Plan row 7 (`payment.schemas.ts` "+2 LOC, re-import verification only") is suspiciously trivial [SHOULD_SHIP]

The widening of `PAYMENT_TYPES` in `shared/enums.ts` propagates to `payment.schemas.ts:33` via the existing `z.enum(PAYMENT_TYPES)` — so "+2 LOC, verification only" is the right size IF the existing schema file already imports from shared/enums.ts. Verified: `payment.schemas.ts:9` does `import { PAYMENT_TYPES }`. So the line item is accurate. But "+2 LOC" likely understates the test surface — the schema's consumers (the 6 consumer files in M6) need integration tests that confirm a `PAYROLL_OUT` payment passes Zod through every route that touches Payment. Architect should add a one-line acceptance gate in §17.2: "POST /api/payments with `type='PAYROLL_OUT'` is rejected with 400 (PAYROLL_* values are reserved for internal payroll-service insertion, not user-facing payment creation)". Otherwise an attacker could mint a fake PAYROLL_OUT row via the public payment endpoint and break the reversal-lookup invariant (`reversesPaymentId IS NULL` on forward entries).

**Recommended fix**: Either (a) add Zod schema split: public payment-create schema accepts only `['PAYMENT_IN', 'PAYMENT_OUT']`, internal payroll-write path uses the widened enum; OR (b) add a server-side guard in `payment/create.ts` rejecting PAYROLL_*. Document the choice in §2.2 and add the acceptance gate.

#### S8 — `Payment.partyId` shape for payroll Payments is unspecified [SHOULD_SHIP]

§2.1 line 212 says `Payroll.paymentId` links to Payment. `Payment.partyId` (schema line 1208) is `String` and NOT NULL. So every payroll Payment must carry SOME partyId. The architect mentions in §2.2 line 333 "Payroll Payments are linked to an Employee (Party of type STAFF if we choose to model that) — **clarified in §8**" but §8 never makes the call. This is an unresolved schema-shape question with downstream implications for the M6 consumer-edit footprint.

**Recommended fix**: Commit in §8 to one of (a) every Employee gets a paired Party of type STAFF created at Employee-create time, (b) Payment.partyId becomes nullable and payroll rows store NULL there + a new `Payment.employeeId` FK, (c) reuse an existing system-party "Payroll" row per business. Each choice has different consumer-edit fan-out. Decision unblocks M6's "shared model vs separate link" branch above.

#### S9 — `requireActiveBusiness` middleware's "BusinessUser suspended" check needs a DB read on every gated request [SHOULD_SHIP]

§3.4 widens `/me` to filter `suspendedAt: null`. But the glossary §1 line 86 says `requireActiveBusiness` "REFUSES if the corresponding BusinessUser row is now `suspendedAt`" — implying a DB lookup per gated request. With 30+ PIN-gated routes, this adds 30+ extra Postgres round-trips per session (one per route hit). At Render Starter's ~25 connection ceiling this becomes load-bearing during a heavy session. The middleware file row 59 (`require-active-business.ts` ~75L) doesn't show caching.

**Recommended fix**: Add a 60-second in-process or Redis-store cache on `(userId, businessId) → suspendedAt status`. On every `switch-business` or `members/:userId/suspend`, evict the relevant entries. Document in §11 middleware chain + file plan row 59. Alternatively, accept the trade-off and add a §17.4 acceptance gate proving p95 latency does not regress more than 50ms on PIN-gated routes.

---

### Questions for security agent (NOT MUST_SHIP, but flag for security review)

1. **JWT_SECRET reuse for cookie HMAC** (raised by architect). Fail-mode is safe (rotation invalidates all existing cookies). But: if HMAC verification logic gains a bug (e.g. someone "optimises" the timingSafeEqual to `===`), both PIN-gate and JWT validity become compromised by the same defect. Sibling `PIN_GRACE_COOKIE_SECRET` would split the blast radius at the cost of one more env var. Security agent should pick.
2. **Cookie tamper telemetry event taxonomy**. §20 mentions a "pin-grace-cookie.ts HMAC-verify rejection metric" but doesn't define the event name, log fields, or alert threshold. Security agent should specify.
3. **`sameSite=strict` impact on future OAuth callbacks**. Cookie won't ride cross-site POSTs; if HP later adds an SSO provider that POSTs back to a callback URL, the cookie is absent on the callback request, forcing a fresh PIN re-verify. Architect notes this as a concern. Security agent should call out that adding `lax` is NOT an acceptable mitigation (would re-introduce CSRF surface) — the right fix is to scope the cookie to /api and add an SSO-callback-only re-verify modal.

---

### Decision

**ADVANCE to security agent** — **BLOCKED on M6 alone**. M6 is a real schema-consumer hole that must be closed before security agent runs (otherwise security would flag it under A04 Insecure Design and the architect would have to round-trip a v3 anyway). All other findings (S5-S9, 3 security questions) are non-blocking for build-start and can be closed during PR1 review or rolled into the security-agent pass.

**Architect action**: Produce v3 (or v2.1 in-place) addressing M6 by:
1. Picking the `Payment.partyId` shape for payroll Payments (resolves S8).
2. Adding 6 PR1 file plan rows for the consumer-defensive edits (or proving via acceptance gate that the consumers are never reached for PAYROLL_* types).
3. Sweep-replacing "20 services" → "22 services" in 3 narrative sites (S5).
4. Documenting the public-vs-internal Zod-enum split or guard for PAYROLL_* (S7).

ETA for v3: ~45 minutes. Then re-run architecture-auditor for a quick M6-closure verification pass before advancing to security agent.

**Do not advance to security-auditor on v2 as-shipped.** M6 materially expands the data-model surface security must audit (every place customer balance or report tile is computed). A security pass on v2 would have to be redone after v3 closes M6.

---

## v2.1 re-audit (2026-05-17)

**audited_at**: 2026-05-17T23:21:00+05:30
**auditor**: architecture-auditor (v2.1 re-run pass)
**target**: ARCHITECTURE_PHASE6_STAFF_HR.md v2.1 (revision_log entry v2.1 dated 2026-05-17, 1244 lines)

**Overall**: BLOCK
**Counts**: 2 MUST_SHIP (NEW), 1 SHOULD_SHIP (NEW), 0 FUTURE_EPIC

---

### M6/S7/S8 closure verification

- **M6 (helper extraction + 7 consumer edits)**: **CLOSED** — `shared/payment-types.ts`
  exists in §18.2 row 8 at ~90L. Helper code at lines 315-352 is pure (no I/O, no DB,
  type-only imports from `./enums.js`). `paymentTypeDirection` switch is exhaustive
  with `_exhaustive: never` compile-time check. Rows 9-15 of PR1 file plan list all
  7 consumer edits at +6 to +12L each (well under the "≤25L per row" rule from the
  task brief). Exclusion table at lines 366-370 documents `cash-register/cash-entry.queries.ts`,
  `collections/statement.service.ts`, and `report-daybook.ts` with concrete reasons —
  verified accurate. Acceptance gate at line 1035 ("verified at PR1 by grep against
  the 6 consumer files") provides the closing test.

- **S7 (PaymentTypePublic / PaymentTypeInternal + 400 guard)**: **CLOSED** —
  9 references to `PaymentTypePublic`/`PaymentTypeInternal`/`INVALID_PAYMENT_TYPE` in
  the doc (close to but not the 12 the task brief expected; the missing 3 are
  duplicate banners — non-load-bearing). The Zod split at lines 296-305 is well-formed
  (`z.enum(CUSTOMER_PAYMENT_TYPES)` for public, `z.enum(PAYMENT_TYPES)` for internal).
  Defense-in-depth guard documented at line 308. Two acceptance gates at lines 1030-1031
  test POST /api/payments rejection of both `PAYROLL_OUT` and `PAYROLL_IN`. Error code
  added to §6 (line 609). However see new MUST_SHIP M8 — the guard collides with the
  `assertCustomerPaymentType` call in the same file.

- **S8 (Employee↔Party STAFF pairing)**: **PARTIALLY CLOSED — see M7** —
  `§8.5` exists at line 786, decision firmly committed to (`type='STAFF'` paired
  Party in same tx as Employee, `Employee.partyId @unique`, paired soft-delete).
  Implementation code at lines 805-834 is correct as written. `Payment.partyId`
  invariant (NOT NULL forever) is preserved. PR6 row 138 (createEmployee with pairing)
  ships at ~230L (under cap). However the architect makes a FALSE schema claim that
  blocks the entire implementation — see M7 below.

---

### Pass 1 (SCOPE alignment)

**PASS** — no regression. SCOPE conformance map from v1/v2 still holds. STAFF Party
pairing aligns with SCOPE §4.2 ("Payment.partyId NOT NULL preserved").

---

### Pass 2 (Data model integrity)

**BLOCK** — 1 MUST_SHIP gap (M7). The §8.5 design is architecturally correct, but
rests on a false premise about the current schema state.

---

### Pass 3 (Helper composition / middleware)

**BLOCK** — 1 MUST_SHIP gap (M8). Helper purity is good; collision with the 400-guard
in `payment/create.ts` is not.

---

### Pass 4 (PIN architecture)

**PASS** — no regression from v2. Cookie design, middleware chain, brute-force surface
all unchanged by v2.1.

---

### Pass 5 (File Plan / LOC discipline)

**BLOCK_WITH_GAPS** — 1 file plan row points at a non-existent path
(M7-adjacent finding — `party/list.service.ts` is the wrong filename; real file is
`party/list-get.ts`); LOC estimates are realistic (max +12L per consumer row, well
under the 25L cap). Total row count 217 verified — counting frontmatter delta (+8)
and reading §18 numbered rows (1 + 2-7 + 8-22 + 23-48 PR1, 49-63 PR2, 64-104 PR3,
105-125 PR4, 126-137 PR5, 138-172 PR6, 173-194 PR7, 195-217 PR8) confirms ≈217 rows
within the +/-1 task-brief tolerance.

---

### New MUST_SHIPs (must close before advancing to security)

#### M7 — `Party.type` schema does NOT enumerate STAFF; PR1 lacks the widening migration [MUST_SHIP]

Architect's §0 (line 58) and §8.5 (line 792) both assert:

> "`Party.type` field at `server/prisma/schema.prisma:1015` already enumerates
> `CUSTOMER | SUPPLIER | STAFF` (STAFF was added in a prior epic but never used).
> Phase 6 finally activates it."

**Independent verification against the repo TODAY:**

- `server/prisma/schema.prisma` is 3846 lines. The `Party` model is at **line 358-449**,
  NOT line 1015 (line 1015 falls inside an unrelated model — possibly Invoice or Sale).
- `schema.prisma:365` reads literally: `type String @default("CUSTOMER") // CUSTOMER, SUPPLIER, BOTH`
  — STAFF is **NOT** in the comment or the column default.
- `shared/enums.ts:68` reads: `export const PARTY_TYPES = ['CUSTOMER', 'SUPPLIER', 'BOTH'] as const`
  — STAFF is **NOT** in the Zod SSOT.
- All 3 Party schemas at `server/src/schemas/party.schemas.ts` lines 49, 71, 87 use
  `z.enum(PARTY_TYPES)` — every one of them will REJECT `type: 'STAFF'` at the API boundary.

**Implications for the v2.1 design:**

- The PR1 file plan §18.2 lists NO row that widens `PARTY_TYPES` in `shared/enums.ts`
  to add `'STAFF'`. Row 6 (`shared/enums.ts +8L`) is widening `PAYMENT_TYPES`, not
  `PARTY_TYPES`.
- The PR1 file plan lists NO row that updates the schema comment on `Party.type` to
  include `STAFF`.
- The §2.2 column-changes table (lines 270-277) lists 6 column changes; `Party.type`
  widening is NOT one of them.
- The PR6 `createEmployee` code at line 812 executes `tx.party.create({ data: { type: 'STAFF' }})`.
  Because the schema column is `String` with no DB-level CHECK constraint, Prisma will
  ACCEPT the row (schema-permissive). But any read path that hydrates this Party
  through `z.enum(PARTY_TYPES)` (e.g. `partyListQuerySchema.type` at line 71) will
  fail Zod validation — surfacing as 500s on every party-list query that returns a
  STAFF row.

**Failure mode**: PR6 ships, first Employee is created → STAFF Party row exists in
DB. The next call to GET /api/parties returns the row, the response goes through
schemas that include `z.enum(PARTY_TYPES).optional()` — Zod throws on the unexpected
`'STAFF'` value. Every Phase-6-aware business's party-list endpoint returns 500
until someone widens `PARTY_TYPES`.

Worse: the `where.type = { not: 'STAFF' }` default-filter the architect proposes at
line 841 will silently FAIL too — Prisma accepts it (string comparison) but it's
filtering against a value Zod has never validated. If a future schema-validation
ratchet (similar to enforce-offline.mjs) fires, every Party.type that's been narrowed
through the Zod schema will reject STAFF, and the filter becomes a no-op or a 500.

**Why MUST_SHIP**: S8 closure depends on this. Without `PARTY_TYPES` widening, the
entire §8.5 design fails at the API boundary the first time a STAFF Party tries to
round-trip. This is not theoretical — `server/src/schemas/party.schemas.ts:71` and
`:87` are read-side schemas used in list and update endpoints.

**Recommended fix** (architect v2.2, ~15 min):

1. Add `Party.type` widening row to PR1 file plan §18.2:
   - `shared/enums.ts` row (already exists for PAYMENT_TYPES) gains another +2L:
     `export const PARTY_TYPES = ['CUSTOMER', 'SUPPLIER', 'BOTH', 'STAFF'] as const`
   - `server/prisma/schema.prisma` Party.type comment update: `// CUSTOMER, SUPPLIER, BOTH, STAFF` (string-column, no migration needed beyond comment)
   - `server/prisma/migrations/20260518_phase6_schema_core/migration.sql` — no SQL change needed (string column accepts STAFF), but add a SQL comment for archaeologists.
2. Add to §2.2 column-changes table: `Party.type | **Widened allowed-values set** (string column; no `ALTER TYPE`) | Activate STAFF for §8.5 pairing`.
3. Replace the false claim at line 792 with: "`Party.type` field at `server/prisma/schema.prisma:365` previously enumerated `CUSTOMER | SUPPLIER | BOTH`; PR1 widens it to add `STAFF`. The string column requires no DDL — only the Zod enum widening and comment update."
4. Replace the schema-line citation at line 59 (`schema.prisma:1015`) with the real `schema.prisma:365`.
5. Verify all 3 Party Zod schemas (lines 49, 71, 87 of `party.schemas.ts`) will accept STAFF after the widening — they will, since they all use `z.enum(PARTY_TYPES)`.

**Severity**: MUST_SHIP — silent 500-on-list-query the day after PR6 lands.

---

#### M8 — `payment/create.ts` row 358 collides 400-guard with `assertCustomerPaymentType` (which throws 500) [MUST_SHIP]

The §2.2 design (line 308) says:

> "Defense-in-depth server guard: `payment/create.ts` adds an early check that
> rejects any `data.type` not in `CUSTOMER_PAYMENT_TYPES` with `400 INVALID_PAYMENT_TYPE`"

The §2.2 consumer table (line 358) ALSO says for `payment/create.ts`:

> "early-guard `assertCustomerPaymentType(data.type)` + `delta * paymentTypeDirection(data.type) * -1`"

But `assertCustomerPaymentType` at line 347-351 throws a **plain `Error`**, not a
`BusinessError` with 400 status. Plain Errors in Express services bubble to the
default error handler and surface as **500 Internal Server Error** unless explicitly
caught.

This produces two contradictory or redundant guards in the SAME file:

- If the 400 guard fires FIRST: `assertCustomerPaymentType` is unreachable dead code.
- If `assertCustomerPaymentType` fires FIRST: every misrouted payroll-type via the
  public endpoint surfaces as 500 instead of the documented 400.
- If both fire (one early, one inside a helper): contradictory test expectations
  (line 1030-1031 acceptance gate says 400; runtime will be 500 if the assert wins).

This is the same v1-Pass-3 internal-contradiction pattern as the original M2.

**Why MUST_SHIP**: §17.2 acceptance gates at lines 1030-1031 explicitly require
`POST /api/payments with type='PAYROLL_OUT' is rejected with 400 INVALID_PAYMENT_TYPE`.
Without M8 resolution, the test will fail with 500 if the assert path wins, OR the
assert is dead code and the doc at line 358 is misleading.

**Recommended fix** (architect v2.2, ~10 min):

Pick one of:
- (a) Document that `assertCustomerPaymentType` is **never** called in `payment/create.ts`;
  the 400 guard owns ALL rejection there. The consumer-table row 358 should read:
  `400-guard rejects PAYROLL_* with INVALID_PAYMENT_TYPE; helper used only for the
  arithmetic — paymentTypeDirection() not the assert`. The assert stays for
  `party/ledger.service.ts` belt-and-braces use only.
- (b) Make `assertCustomerPaymentType` throw a `BusinessError('INVALID_PAYMENT_TYPE', 400)`
  instead of a plain Error. Then it can subsume the 400 guard. Either way: ONE path,
  documented explicitly.
- (c) Keep both: assert at function entry (internal-invariant for callers from
  payroll code), 400-guard at endpoint entry (server-validation for public callers).
  Document the boundary explicitly in §2.2 — internal-invariant throws as 500 by design
  (it should never fire on a well-formed call; if it does, that's a bug), public-validation
  returns 400 (user-facing).

The task brief explicitly asked: "Does the architect document where the assert
function throws vs returns 400 (server-validation vs internal-invariant)?" — answer
is NO. v2.1 silently conflates the two.

**Severity**: MUST_SHIP — acceptance gate at §17.2 line 1030 will fail at PR1 build
time without disambiguation.

---

### New SHOULD_SHIPs

#### S10 — `party/list.service.ts` file does not exist; real file is `party/list-get.ts` [SHOULD_SHIP]

PR1 file plan row 16 cites `server/src/services/party/list.service.ts` (+4L). §8.5
default-filter table line 841 cites the same path.

**Verified against the repo**: `server/src/services/party/` contains: addresses.ts,
create.ts, custom-fields.ts, followups.service.ts, groups.ts, helpers.ts,
last-contacted.service.ts, ledger.service.ts, ledger.types.ts, list-get.ts,
pricing.ts, tags.service.ts, update-delete.ts. **There is no `list.service.ts`**.
The party-list service is `list-get.ts`.

This is the same builder-blocker pattern as v1's M5 (10 wrong service paths in PR7
audit-backfill). v2.1 introduced ONE new instance of the same defect.

**Why SHOULD_SHIP, not MUST_SHIP**: the implementer can grep + auto-correct in 30
seconds (vs. M7 which requires a design call). But still: the file plan is the
contract; a wrong filename is a contract break.

**Recommended fix**: Sweep-replace `party/list.service.ts` → `party/list-get.ts`
at lines 841 and 1101 (two sites). 1 minute of editing.

**Severity**: SHOULD_SHIP (file plan contract drift, mechanical fix).

---

### Spot-check: M1-M5 closures (no regression introduced by v2.1)

- **M1**: Payment.type widening intact. shared/enums.ts row 6 still in PR1. No change.
- **M2**: §8.3 inverse-direction-same-amount still committed; lines 711-754 unchanged
  in approach; no negative-amount-pattern reappearance.
- **M3**: `createRateLimiter` + `perBusinessRateLimit` wrapper still at §8.4 lines
  761-771; ordering after `requireActiveBusiness` preserved at line 777.
- **M4**: PIN-grace cookie design at §5.3 unchanged; no express-session sneak-back.
  Spot-check shows req.session grep still 0 hits in server/src/.
- **M5**: PR7 audit-backfill paths previously verified (15/15) — no v2.1 edits to
  §18.8 except the "20 → 22 services" sweep, which doesn't introduce new path errors.

---

### Decision

**BLOCK — architect must produce v2.2 closing M7 and M8 before security agent runs.**

M7 is a SCHEMA-LAYER falsehood (architect built §8.5 on the belief that STAFF is
already a Party.type enum value; verified false). Security agent would catch this
under A04 Insecure Design AND A03 Injection (silent schema-vs-Zod drift creates
unenforced validation surface). The v2.2 round-trip is cheaper than letting it
land then redoing the security pass on v2.3.

M8 is an INTERNAL CONTRADICTION between two documented guards in the same file with
two different status codes (400 vs 500). Same risk surface — security would flag
the inconsistent error-code semantics on the public payment endpoint.

S10 is a file-plan-contract drift; ride along with v2.2 in 1 minute of editing.

**Estimated v2.2 turnaround: ~30 minutes.**

Then quick re-audit (M7+M8 closure only, no full pass) before advancing to security.

**Do not advance to security-auditor on v2.1 as-shipped.** M7 expands the
schema-vs-Zod-validation surface security must audit (every Party-list endpoint
becomes a potential 500 vector once STAFF is in the database). A security pass on
v2.1 would be redone after v2.2 lands.


---

## v2.2 re-audit (2026-05-17)

**audited_at**: 2026-05-17T23:39:00+05:30
**auditor**: architecture-auditor (v2.2 surgical re-run — M7/M8/S10 closure only)
**target**: ARCHITECTURE_PHASE6_STAFF_HR.md v2.2 (revision_log entry v2.2 dated 2026-05-17, 1378 lines)

**Overall**: PASS
**Counts**: 0 MUST_SHIP (NEW), 0 SHOULD_SHIP (NEW), 0 FUTURE_EPIC

---

### M7/M8/S10 closure verification

- **M7 (PARTY_TYPES widening + customer-facing-picker filter policy)**: **CLOSED**
  - `shared/enums.ts:68` verified independently — current state is
    `['CUSTOMER', 'SUPPLIER', 'BOTH']` (no STAFF), exactly matching the architect's
    self-correction. The v2.1 false claim of pre-existing STAFF is now retracted
    and the widening is firmly planned.
  - `server/prisma/schema.prisma` line 365 corroborated (line 468 was a downstream
    `@@index([partyId, type])` reference — not the Party.type definition; architect's
    citation of `:365` for the column definition is consistent with v2.1 audit M7
    finding).
  - All 3 Zod schemas at `server/src/schemas/party.schemas.ts:49,71,87` use
    `z.enum(PARTY_TYPES)` — verified by grep — so widening `shared/enums.ts`
    automatically widens all 3 schemas with zero additional Zod edits. Architect's
    claim at v2.2 §8.5 confirmed.
  - PR1 file plan §18.2 now contains the required rows:
    * Row 2a — `schema.prisma:365` comment widening (+1L) ✓
    * Row 6 — grew from +8L to +12L for PARTY_TYPES addition ✓
    * Row 16a — `party/create.ts` STAFF guard (+6L) ✓
    * Rows 17a/b/c — FE constants + 2 component re-imports (+0L each) — see "rows 17a/b/c
      0L verification" below
    * Rows 24a/b — 2 new test files (~110L + ~90L) covering POST /api/parties STAFF
      rejection + STAFF round-trip ✓
  - §2.2 column-changes table now includes `Party.type` row (verified at line 315) ✓
  - §8.5 "Schema already supports it" bullet replaced with truthful widening narrative
    + comprehensive filter policy table at lines 444-456 (10 surfaces enumerated) ✓
  - §17.2 acceptance gates expanded with 5 STAFF-specific tests (lines 1119-1122, 1133-1134) ✓
  - Two false schema citations (line 59 §0, line 792 §8.5) corrected to `schema.prisma:365` ✓

- **M8 (single rejection path via AppError)**: **CLOSED**
  - HP error infrastructure verified:
    * `server/src/lib/errors.ts` exists with `AppError` class (line 79) + `ErrorCode`
      enum (line 4) — architect's claim is accurate
    * `server/src/middleware/errorHandler.ts` exists with `errorHandler` function
      that maps `AppError` → typed JSON response with the cited status code (line 36-37)
    * The `AppError(code, statusCode, message, details?)` constructor signature matches
      what `assertCustomerPaymentType` now calls (verified at v2.2 §2.2 line 396-405)
  - PR1 file plan row 8a explicitly adds `INVALID_PAYMENT_TYPE` to `ErrorCode` enum
    (+2L). This is necessary because `ErrorCode` does NOT contain `INVALID_PAYMENT_TYPE`
    in the current `errors.ts` (verified — closest existing entries are `INVALID_INPUT`,
    `VALIDATION_ERROR`, `PHONE_INVALID` in the 400-family at lines 5-10).
  - §17.2 acceptance gates at lines 1125-1127 now read **"rejected with 400
    INVALID_PAYMENT_TYPE"** (not "expect 400 OR 500"). One specific assertion is added
    at line 1127 that explicitly proves the assert path yields 400 not 500 when
    Zod is bypassed via direct service invocation — perfectly closes M8's
    contradiction-via-divergent-status-code risk.
  - §6.2 line 695 updated to document the single rejection path with the explicit
    note "Zod + service-layer `assertCustomerPaymentType` both throw
    `AppError(ErrorCode.INVALID_PAYMENT_TYPE, 400, ...)` — M8 closure v2.2"
  - §20 postmortem trigger added at line 1337 — if 500 ever appears for PAYROLL_*,
    the team knows to check whether `assertCustomerPaymentType` regressed to plain
    `Error`. This is the right kind of self-watching architecture.

- **S10 (filename correction)**: **CLOSED**
  - PR1 file plan row 16 now reads `server/src/services/party/list-get.ts` (verified
    against repo — `list-get.ts` exists, `list.service.ts` does not).
  - §8.5 default-filter table line 446 also corrected to `party/list-get.ts`.
  - Both sites match the actual file at `/Users/sawanjaiswal/Projects/HisaabPro-phase6/server/src/services/party/list-get.ts` (6027 bytes, mtime 21:21).

---

### Rows 17a/b/c 0L verification (suspicion check)

Task brief flagged the 3 FE rows estimated at "0L each" as a code-smell — either
genuine 0-net (constant-only edits) or placeholder rows hiding deferred work.

Verification:

- **Row 17a (`party.constants.ts`)**: Architect's prose explicitly says "STAFF
  intentionally NOT added" — i.e. the existing `PARTY_TYPE_OPTIONS` and
  `PARTY_TYPE_LABELS` constants are left UNCHANGED. The +0L is correct: the filter
  policy works by absence, not by add-then-filter. STAFF is widened in
  `shared/enums.ts` (a runtime-permitted value) but deliberately omitted from
  FE dropdown sources (a build-time policy decision encoded by what the constants
  enumerate). This is a clean architectural pattern — the FE never has to filter,
  because the menu literally doesn't include the option.

- **Rows 17b (`PartyFilterBar.tsx`) and 17c (`PartyFormBasic.tsx`)**: Both re-import
  `PARTY_TYPE_OPTIONS` from the unchanged constants file. Because the source constant
  is unchanged (row 17a is +0L), the consumer files require zero edits beyond
  verifying the import still resolves. Architect's prose says "re-imports — no logic
  change beyond constant". The +0L is correct: no logic change, only a verification
  that the existing imports still produce the desired (STAFF-absent) dropdown.

**Implication for the builder**: row 17a is functionally a NO-OP edit row — the
file is opened, confirmed to NOT contain STAFF, and committed. Rows 17b/c are
likewise file-open + verify-import-resolves rows. The architect should consider
whether to delete the rows entirely (since they're truly 0L) or keep them as
"verification rows" so PR1 explicitly documents that 3 FE files were inspected. Keeping
them is fine — explicit deferral-prevention. But the LOC totals are honestly stated.

**No SHOULD raised** — the rows are honest and the filter pattern is sound.

---

### STAFF Party-vs-Employee relationship (new focus area)

Task brief asked whether the FK direction is clear and whether one entity is
authoritative.

**Verified at v2.2 §8.5 lines 882-887 + implementation at 893-921**:

- **Source of truth**: `Employee` is authoritative; the paired `Party` row is
  derived from it.
- **FK direction**: `Employee.partyId` (`@unique`) — Employee points at Party.
  Party does NOT have an `employeeId` back-pointer. (Party.type='STAFF' is the
  only way to recognize a paired Party row.)
- **Lifecycle is one-way**: `createEmployee()` creates Party then Employee in
  ONE `$transaction` — failure rolls both back. `deleteEmployee()` soft-deletes
  BOTH in ONE `$transaction`. Architect explicitly bans `Employee.partyId` mutation
  (line 886).
- **Customer-create endpoint refuses STAFF**: `POST /api/parties` with type=STAFF
  returns 400 (row 16a, ~+6L, plus test row 24a). This eliminates the orphan-Party
  vector entirely — STAFF parties exist if and only if an Employee created them.

This is a well-designed invariant. The orphan-STAFF-Party and orphan-Employee
failure modes are both closed:
- Orphan STAFF Party: refused by `party/create.ts` guard ✓
- Orphan Employee: `Employee.partyId` is NOT NULL + `@unique`, and createEmployee
  is the only path that satisfies it ✓
- Orphan via direct SQL: postmortem trigger at line 1335 catches this in prod ✓

**No gap raised.** Architect's design is clean.

---

### File-count tally re-verification

- §0 line 121: claims **222 files** (208 BE + 14 FE incremental). Architect's
  delta narrative at line 121 traces v2 → v2.1 (+8) → v2.2 (+5 net new files-on-disk,
  with 3 rows at +0L sharing existing file-plan slots).
- §18 header line 1171: claims "total 222 rows" — matches.
- §18.9 line 1308: closing tally narrative reads "v2 → v2.1 delta +8 ... v2.1 → v2.2
  delta +5". Math: 209 (v2 base) + 8 (v2.1) = 217 → + 5 (v2.2 net new files) = 222 ✓
- Mechanical grep count of explicit numbered rows in §18 (including ranges) returns
  85 row markers — consistent with the architect's tally given that several rows
  use ranges (`25-55`, `60-65`, `66-70`, `82-105`, `110-130`, `134-142`, `150-177`,
  `178-193`, `194-199`, `204-222`) that each represent multiple files.

**Tally is consistent.** 222 is the honest total.

---

### Pass 1-5 spot-check (no regression in M1-M6 or S7-S8 closures)

- **Pass 1 (SCOPE)**: PASS — STAFF Party pairing still aligns with SCOPE §4.2.
  No new SCOPE-conformance breaks introduced by v2.2.
- **Pass 2 (Data model)**: PASS — PARTY_TYPES widening firmly planned in PR1;
  PAYMENT_TYPES widening (M1) unchanged; §8.3 reversal pattern (M2) unchanged.
- **Pass 3 (Middleware/race)**: PASS — `perBusinessRateLimit` (M3) unchanged;
  M8 closure adds NO new middleware (it changes the throw shape inside an existing
  helper).
- **Pass 4 (PIN)**: PASS — §5.3 cookie design (M4) unchanged.
- **Pass 5 (File Plan/LOC)**: PASS — v2.2 added 8 new rows (5 real, 3 +0L
  verification rows) + grew 4 existing rows by 4L/5L/2L/0L respectively. No row
  in PR1 exceeds 250L. S6 pre-planned splits for PR3 (>230L extraction triggers)
  remain. M5 PR7-paths unchanged.

---

### Cross-session learnings (carryforward from v2.1)

The same `architecture-blindspots-2026-05-17.md` lesson registry that v2.1 cited
applies here. v2.2's closure of M7 reinforces lesson #4 (architect must
**independently grep schema state** rather than narrate from memory — the v2.1
schema-line falsehood was the trigger). v2.2's closure of M8 reinforces lesson #5
(when two guards target the same exception, they must funnel through ONE
error-throwing helper to guarantee semantic equivalence — the AppError funnel is
the right pattern).

No new lessons added — both gap classes M7 and M8 were caught by the v2.1
audit's existing lessons working correctly. Architect responded surgically and
honestly (including admitting the v2.1 false schema citation in the revision log
at line 1359).

---

### Decision

**ADVANCE to security agent.**

M7/M8/S10 are all CLOSED with concrete evidence. Architecture v2.2 is internally
consistent, schema-grounded (independently verified), file-plan-honest (no
phantom file paths), and the 0L-FE rows are legitimately 0L. No new MUST_SHIP
or SHOULD_SHIP surfaced. STAFF Party↔Employee pairing is well-disciplined with
both directions of orphan-risk explicitly closed.

Security agent should focus on:
1. `AppError`/`ErrorCode` path semantics (M8 closure) — ensure no error-leaking
   stack traces in `INVALID_PAYMENT_TYPE` response details.
2. `Party.type='STAFF'` filter discipline across all 10 surfaces in §2.2 — the
   filter policy is design-correct, but security should verify each filter is in
   the right code path (server-side, not just FE).
3. The 3 PIN/cookie questions from v2 (JWT_SECRET reuse, cookie tamper telemetry,
   sameSite=strict + OAuth) — these remain open from the v2 re-audit.
4. The S9 BusinessUser-cache latency mitigation — security should validate the
   acceptance gate at §17.4 is sufficient or recommend the Redis-store cache
   pre-emptively.

**Estimated security audit cost**: ~2-3h, normal scope. No round-trip back to
architect expected unless security finds a NEW class of issue.

