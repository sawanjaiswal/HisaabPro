# SECURITY AUDIT — Phase 5 Epic D (CRM + Loyalty + Commission)

> Audited 2026-05-17 13:53 IST by security agent
> Worktree: `/Users/sawanjaiswal/Projects/HisaabPro-epic-d`
> Branch: `epic/phase-5-d-crm-loyalty`
> Against: `ARCHITECTURE_EPIC_D_crm_loyalty.md` (v2, 1,987 lines)

## Verdict: **BLOCK — 5 MUST_FIX**

Architecture design v2 is fundamentally sound (advisory locks acquired before reads, FIFO ledger with symmetric VR rows, ruleSnapshot pinning concept, businessId scoping throughout). However, **five implementation-level specifications are missing that, if shipped as currently described, cause real money loss or staff payroll fraud**.

The architecture-auditor's PASS_WITH_GAPS verdict covered design correctness; this security audit blocks on builder-facing gaps that v2 did not pin down.

**task-manager MUST NOT seed `design-plan-active.md` until the 5 MUST_FIX items are addressed in `ARCHITECTURE_EPIC_D_crm_loyalty.md` v3.**

---

## MUST_FIX (5) — blocking

### M1 — `ruleSnapshot` deep-clone not specified [A04 Insecure Design]
**Location:** ARCH §4.2, PR5 commission accrual

**Risk:** Commission rules are mutable (admin can edit `ratePct`). Architecture says "snapshot rule to `meta.ruleSnapshot` for forensics" but does not specify deep-clone semantics. If the implementation does `meta: { ruleSnapshot: rule }` directly, Prisma serializes the live object reference — but the bigger risk is subsequent code paths mutating the rule object before persistence, or future migrations reshaping `meta` and silently mutating every historical commission row.

**Money impact:** Admin edits rule to `ratePct: 5` (was 2). Historical ledger rows referencing the old rule now show `ruleSnapshot.ratePct: 5` if not deep-cloned at write time. Staff disputes become unwinnable; admin can rewrite history.

**Required spec:**
```ts
const ruleSnapshot = JSON.parse(JSON.stringify({
  ruleId: rule.id,
  scope: rule.scope,
  scopeId: rule.scopeId,
  ratePct: rule.ratePct,
  basis: rule.basis,
  createdAt: rule.createdAt.toISOString(),
}))
await tx.commissionLedger.create({ data: { ..., meta: { ruleSnapshot } } })
```
Architecture must add: "MUST be a frozen deep clone written inside the tx; the rule row may be edited or deleted after."

### M2 — `lastContactedAt` not omitted from `partyPatchSchema` [A01 Broken Access Control]
**Location:** ARCH PR1 / partyPatchSchema additions

**Risk:** Architecture §3 adds `lastContactedAt: DateTime?` to Party and says it is "set by server when /api/parties/:id/follow-ups POST is hit." But there is no explicit instruction that `lastContactedAt` MUST be omitted from the `partyPatchSchema.strict()` Zod schema. If the builder copies the existing `partyUpdateSchema` and includes the field, the client can backdate `lastContactedAt` to make a stale party look fresh — disabling the "not contacted in 30d" follow-up trigger and hiding ghosting customers from the CRM.

**Required spec:** Add to ARCH §3: "`lastContactedAt`, `loyaltyPointsCache`, and `loyaltyOptOut` are server-only — explicitly omitted from every Zod `partyPatchSchema` / `partyUpdateSchema` / `createPartySchema`. ESLint rule or test must assert these fields never appear in any party-facing input schema."

### M3 — `withinDays` parameter on `/api/parties/follow-ups` lacks max cap [A05 / DoS]
**Location:** ARCH §3.5 follow-up query, PR1

**Risk:** Architecture describes `GET /api/parties/follow-ups?withinDays=7` but doesn't cap the value. `withinDays=99999` against a tenant with 50k parties = full Party table scan with no index help. Tenant attacker can DoS their own tenant; competitor with leaked creds can DoS at scale.

**Required spec:**
```ts
z.object({
  withinDays: z.coerce.number().int().min(1).max(365),
})
// → 400 INVALID_WITHIN_DAYS_RANGE if out of bounds
```
Add covering index `(businessId, lastContactedAt, isActive)` with documented "expected scan window ≤ 365 days."

### M4 — Cross-tenant `staffUserId` check on `/api/commission/ledger` not specified [A01 IDOR / timing oracle]
**Location:** ARCH §6.3 (inline middleware), PR5

**Risk:** Architecture describes `/api/commission/ledger?staffUserId=X` with logic "if `staffUserId !== req.user.userId`, requires `commission.view_all`". But the implementation pattern shown does not specify what happens when `staffUserId` is a valid UUID belonging to a DIFFERENT TENANT's staff. Two outcomes are both wrong:
- (a) Empty array returned (200 OK) → confirms "this staff exists somewhere" via timing differences
- (b) Generic 403 → confirms "you don't have permission to view THIS specific user" — same oracle

**Required spec:**
```ts
const isInTenant = await prisma.businessUser.findFirst({
  where: { userId: staffUserId, businessId: req.user.businessId, isActive: true },
  select: { userId: true },
})
if (!isInTenant) return res.status(404).json({ error: 'STAFF_NOT_FOUND' })
// Identical 404 whether the userId doesn't exist OR belongs to another tenant
```
Architecture must specify: "staffUserId tenant check returns 404 STAFF_NOT_FOUND (NOT 403) to avoid leaking tenant boundaries via timing."

### M5 — Inline middleware pattern fragility [A04 Insecure Design]
**Location:** ARCH §6.3

**Risk:** The pattern shown:
```ts
if (requestedStaff !== req.user!.userId) {
  await requirePermission('commission.view_all')(req, res, () => {})
  if (res.headersSent) return
}
```
is fragile for three reasons:
- (a) `requirePermission` writes to `res` synchronously before `next()` is called — the `() => {}` next-shim swallows a thrown next-error
- (b) `res.headersSent` returns `true` only after the response is FLUSHED, not when `.status().json()` is called — timing varies
- (c) Future middleware-chain refactor (async `next` wrapping) silently breaks this — no test catches it

**Required spec:** Replace with explicit factory:
```ts
const middleware = req.query.staffUserId && req.query.staffUserId !== req.user.userId
  ? requirePermission('commission.view_all')
  : (_req, _res, next) => next()
router.get('/api/commission/ledger', requireAuth, middleware, handler)
```
OR move the permission check inside the handler with explicit `return res.status(403)`. Architecture must mandate one of the two patterns and forbid the `headersSent`-check approach.

---

## SHOULD_FIX (4)

### S1 — Loyalty redemption value math should be cross-multiplied integer check [A03 Injection / Logic]
ARCH §3.1.1, pos.validators.ts superRefine. `value = floor(points * redemptionPaisePerUnit / redemptionUnit)` with division in JavaScript can produce floating-point edge cases for unusual config. Spec must require integer cross-multiplication:
```ts
if (BigInt(amountPaise) * BigInt(redemptionUnit) !==
    BigInt(points) * BigInt(redemptionPaisePerUnit)) {
  return ctx.addIssue({ code: 'custom', message: 'LOYALTY_REDEMPTION_MATH_MISMATCH' })
}
```

### S2 — Rate cap enforcement location undefined [A04]
SCOPE §19 Q19 says "soft cap 50% with warning, hard cap 100%" but ARCH doesn't specify whether the 100% hard cap is enforced in `commissionRuleSchema.strict()` or service layer. Architecture must specify: `commissionRuleSchema` enforces `ratePct: z.number().int().min(0).max(10000)` (basis points, 100% = 10000); warning at 5000 lives in frontend only.

### S3 — `loyalty.redeem` permission server-side enforcement implicit [A01]
ARCH §6.1 lists `loyalty.redeem` as a permission key but POS checkout flow doesn't explicitly call `requirePermission('loyalty.redeem')` middleware. Builder may rely on "cashier role includes loyalty.redeem in seed data" → any staff without loyalty.redeem in their custom role can still redeem via the POS endpoint. Architecture must specify: "POS checkout handler MUST call `requirePermission('loyalty.redeem')` when `payment.mode === 'loyalty_redemption'` is present. Reject with PERMISSION_DENIED before opening the tx."

### S4 — PR3+PR5 both modify `pos-checkout.service.ts` — integration test required [A04]
ARCH §17 acceptance criteria. PR3 adds loyalty accrual at step 10.6; PR5 adds commission accrual at step 10.7. Both touch the same transaction block. Architecture must mandate: "PR5 acceptance test: assert `tx.loyaltyLedger.create` is called exactly once AND `tx.commissionLedger.create` is called exactly once per POS sale checkout, in step-order 10.5 → 10.6 → 10.7."

---

## NICE_TO_HAVE (2)

### N1 — AuditLog for `loyalty.configure` mutations [A09]
Architecture mentions AuditLog for commission rule CRUD but not for loyalty config changes (earn rate, redemption unit). Loyalty config edits affect future accrual math — should be auditable.

### N2 — Per-party loyalty opt-out UI toggle wired to no-op [A04]
SCOPE §19 mentions per-party loyalty opt-out toggle. If the UI ships but the server-side check is forgotten, customers who opted out still accrue → reputation/legal risk for PII-handling. Architecture must specify: opt-out lives on `Party.loyaltyOptOut: Boolean @default(false)`, accrual service skips when true. If not implemented in v1, the UI toggle MUST NOT ship (or must be disabled).

---

## A01–A10 Section-by-section

| Class | Verdict | Notes |
|-------|---------|-------|
| **A01 Broken Access Control** | **FAIL** | M2 (lastContactedAt forgery), M4 (cross-tenant staffUserId oracle), S3 (loyalty.redeem implicit). businessId scoping is consistently present throughout the design — but specific implementation gaps create IDOR vectors. |
| **A02 Cryptographic Failures** | PASS | No new crypto surface. Existing httpOnly cookie + CSRF + replay-nonce reused unchanged. |
| **A03 Injection** | PASS_WITH_FINDINGS | All Prisma queries parameterized. S1 (BigInt math) is logic-injection adjacent. `pg_advisory_xact_lock(hashtextextended($1, 0))` IS parameterized. |
| **A04 Insecure Design** | **FAIL** | M1, M5, S2, S4, N2. Most concerning class for Epic D — money flows depend on these specs. |
| **A05 Security Misconfiguration** | PASS_WITH_FINDINGS | M3 (withinDays DoS cap). Helmet/CORS/CSP unchanged. |
| **A06 Vulnerable Components** | PASS | No new dependencies introduced. |
| **A07 Authentication Failures** | PASS | No auth surface change. `req.user.userId` shape preserved (auth.ts:75 confirmed). Owner bypass at permission.ts:51-54 unchanged. |
| **A08 Software/Data Integrity** | PASS_WITH_FINDINGS | M1 (ruleSnapshot integrity over time). Migration immutability confirmed. |
| **A09 Logging/Monitoring** | PASS_WITH_FINDINGS | N1 (loyalty config audit). |
| **A10 SSRF** | N/A | No new outbound HTTP introduced. |

---

## Cross-tenant isolation test sketch

| # | Attacker action | Expected outcome | Why |
|---|----------------|------------------|------|
| 1 | Tenant A user GET `/api/parties/{TENANT_B_PARTY_ID}/loyalty-ledger` | **404 PARTY_NOT_FOUND** | 403 leaks party existence |
| 2 | Tenant A user POST `/api/parties/{TENANT_A_PARTY_ID}/follow-ups` body `{ lastContactedAt: "2030-01-01" }` | **200, `lastContactedAt` set server-side to `now()` only** | Forging hides stale customers (M2) |
| 3 | Tenant A user GET `/api/commission/ledger?staffUserId={TENANT_B_USER_ID}` | **404 STAFF_NOT_FOUND** (NOT 403, NOT 200-empty-array) | Timing/error-code oracle leaks staff (M4) |
| 4 | Tenant A user POST `/api/pos/checkout` body `payments: [{ mode: 'loyalty_redemption', partyId: TENANT_B_PARTY_ID, points: 100 }]` | **400 PARTY_NOT_IN_TENANT** | Without explicit party-tenant check, debits another tenant's points |
| 5 | Tenant A staff (no `commission.view_all`) GET `/api/commission/rules` | **200 own-applicable only OR 403** — consistent | Inconsistent return shape allows rule enumeration |

---

## Concrete recommendations for builder

1. **Architecture v3 amendments required** before task-manager seeds `design-plan-active.md`:
   - §3 Party schema: explicit "server-only fields" callout (`lastContactedAt`, `loyaltyPointsCache`, `loyaltyOptOut`) — must be omitted from EVERY input Zod schema.
   - §3.5 follow-up query: cap `withinDays` at 365; add covering index spec.
   - §4.2 commission ledger: explicit deep-clone code snippet for `ruleSnapshot`; mandate `JSON.parse(JSON.stringify(...))` inside tx.
   - §6.1 permissions: explicit `requirePermission('loyalty.redeem')` middleware spec for POS checkout when loyalty payment present.
   - §6.3 cross-tenant query check: replace inline `res.headersSent` pattern with factory-based middleware OR explicit handler check. 404 STAFF_NOT_FOUND for cross-tenant staffUserId.
   - §17 acceptance: integration test mandating both `ledger.create` calls survive PR3→PR5 sequence.

2. **Pre-PR Zod schema audit** (mechanical): grep all `partyPatchSchema`, `partyUpdateSchema`, `createPartySchema` for `lastContactedAt | loyaltyPointsCache | loyaltyOptOut`. Should be zero matches.

3. **Add to `scripts/enforce.js`**: pattern check for server-only Party fields in `server/src/services/party/*.validators.ts`. Block at pre-commit.

4. **Tenant isolation test**: implement the 5-row table above as `__tests__/security/epic-d-tenant-isolation.test.ts` BEFORE PR1 merges. Use two seeded tenants with overlapping resource counts to surface timing oracles.

5. **Loyalty/commission void+restore symmetry**: assert `SUM(LoyaltyLedger.points) WHERE partyId=X` equals `partyBalanceAfter` for every sale→void→restore sequence, including offline queue replay (idempotency-key collision case).

---

## Summary

| Metric | Count |
|--------|-------|
| MUST_FIX | 5 |
| SHOULD_FIX | 4 |
| NICE_TO_HAVE | 2 |
| Verdict | **BLOCK** |
| Most concerning | M1 ruleSnapshot mutation — historical commission ledger rows become rewriteable by admin (staff payroll fraud vector) |
| Next | Architect revises v2 → v3 with M1-M5 specs → re-audit (optional) → security pass-2 → task-manager seeds plan |
