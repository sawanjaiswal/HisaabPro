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
