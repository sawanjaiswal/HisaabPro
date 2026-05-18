# Security Audit — Phase 6 Pass 2 (post-PR8)

**Branch:** `epic/phase-6-staff-hr` · **Tip at audit:** `60651d7` (PR8 rollout)
**Auditor:** `security` agent · **Date:** 2026-05-18 · **Verdict:** `SHIP`

## Scope

Re-audit of the full Phase 6 surface AFTER PR8 (flags, runbook, ramp playbook)
landed. Pass 1 audit (pre-PR0) covered the User-model + multi-tenant switch
design surface. Pass 2 audits the SHIPPED code: PR0 → PR8 against the
v2.3 architecture and ROLLOUT_PHASE6.md.

Files reviewed (delta from Pass 1):

- `server/src/config/features.ts` (env-var flag SSOT, djb2 sticky bucketing)
- `src/config/features.ts` (FE flag SSOT, informational cohort)
- `server/src/middleware/require-recent-pin.ts` (signed cookie, `pf` fingerprint, tamper subtypes)
- `server/src/services/audit/audit-search.service.ts` (websearch_to_tsquery — A03.1)
- `server/src/middleware/require-active-business.ts` (req.user.userId — A01.1)
- `server/src/routes/{audit,hr,payroll}.routes.ts` (gate composition)
- `docs/ROLLOUT_PHASE6.md` (rollback procedure)
- `docs/RUNBOOK_PHASE6.md` (alert response)

## Verdict — SHIP

**0 MUST_FIX** blockers. Architecture-level controls (A01.1, A03.1, PIN
domain-prefix HMAC + pf fingerprint, audit-coverage `--block` SSOT) all
exercised in code and tests. Tenancy is enforced by `requireActiveBusiness`
on every Phase 6 router; PIN gate is composed AFTER tenancy on every
mutation route per architecture §17 acceptance gates.

## Findings tiered

### SHOULD_FIX (address before Stage 1 promotion)

**SHOULD_FIX-1 — feature-flag kill-switch is non-functional**
*Severity: Medium · Status: FIXED 2026-05-18*

`docs/ROLLOUT_PHASE6.md` §4.1/§4.2 documents a kill-switch: flip
`FEATURE_STAFF_HR=false` on Render, restart, no code deploy needed. But
none of `/api/hr/*`, `/api/payroll/*`, `/api/audit/*` consults
`FEATURES.STAFF_HR.enabled` — the env var has no runtime effect.

**Fix landed:**
- `server/src/middleware/require-feature.ts` (NEW, 38L) — calls
  `isFeatureEnabledForUser(key, req.user.userId)`; returns 404 NOT_FOUND if
  disabled. Reads `req.user.userId` not `.id` per A01.1.
- Wired inside `hr.routes.ts`, `audit.routes.ts`, `payroll.routes.ts` after
  `auth, requireActiveBusiness`. Composing inside the router (not via
  `app.use(path, mw, router)`) ensures auth runs first so `req.user.userId`
  is populated.
- `/api/auth/pin/*` is INTENTIONALLY not gated — PIN issuance must remain
  reachable during rollback so an in-cohort tenant can verify out of a
  PIN-stuck state.

**SHOULD_FIX-2 — `PinPhoneLockout` table is unused**
*Severity: Low · Status: deferred to Phase 6.1 cleanup*

Schema declares `PinPhoneLockout` but no service reads/writes it. Either
implement the lockout window (PIN-attempt rate-limit per phone) or drop
the table in a follow-up migration. Low risk because `requireRecentPin`
already rate-limits per business via `createPerBusinessLimiter`.

**SHOULD_FIX-3 — dead `DOMAIN_PREFIX_MISMATCH` tamper-subtype constant**
*Severity: Low · Status: FIXED 2026-05-18 (commit follow-up)*

`security-events.ts` declared `PIN_GATE_DOMAIN_PREFIX_MISMATCH` and included
it in the `SUSPICIOUS_EVENTS` aggregation set, but no emitter ever fires it —
the verification branch was folded into the generic `hmac_mismatch` path
during PR3 review (the `pin-grace-cookie-v1:` prefix is part of the HMAC
input, so a missing prefix manifests as a signature mismatch). Removed the
const + the SUSPICIOUS_EVENTS entry + updated the docstring; updated
RUNBOOK_PHASE6.md §2 to drop the dead subtype row and fold its semantics
into the `hmac_mismatch` row.

### FUTURE_EPIC (out of scope for Phase 6)

**FE-1 — per-feature RBAC permission keys**
`requireOwner()` gates audit/HR/payroll today. Architecture §16 calls for
`hr.read` / `hr.write` / `audit.read` / `audit.export` / `payroll.run` keys
once the permission matrix lands. Track as Phase 6.1.

**FE-2 — S9 (caching) for `requireActiveBusiness`**
Every gated request runs one `BusinessUser` SELECT. Latency target in
architecture §17.4 says ≤5ms P95 — currently within budget unmemoized, so
caching is deferred until either P95 degrades or membership-mutation
invalidation cost is acceptable.

## Regression checks run

| Check | Result |
|---|---|
| A01.1 grep — `req.user.id` outside test/userId contexts | empty (clean) |
| A03.1 grep — `to_tsquery` in `services/audit` outside test/websearch | empty (clean) |
| `enforce-audit-coverage.mjs --block` | exit 0 ("all covered") |
| `enforce-offline.mjs` | exit 0 (1532 files scanned) |
| `enforce.js` | exit 0 (13 pre-existing Phase 3/4 debt warnings non-blocking) |
| BE `tsc -b --noEmit` | exit 0 |
| FE `tsc -b --noEmit` | exit 0 |

## Sign-off

**Cleared to merge to `hisaabpro`.** SHOULD_FIX-1 is resolved on this
branch in a follow-up commit (`fix(phase-6): wire requireFeature
kill-switch`). SHOULD_FIX-2 and SHOULD_FIX-3 are tracked for Phase 6.1
cleanup and do not block ship.

Stage 0 (Internal cohort) promotion: GO once this branch merges.
Stage 1 (Pilot 10%) promotion: GO once `pin_gate.cookie_tamper_detected`
and `payment_already_reversed_total` dashboards are confirmed wired in
Grafana per RUNBOOK_PHASE6.md §1/§2.
