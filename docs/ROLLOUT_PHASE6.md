# Phase 6 — Rollout Playbook (Staff & HR + Multi-Firm + Audit + PIN)

> Architecture: [ARCHITECTURE_PHASE6_STAFF_HR.md](./ARCHITECTURE_PHASE6_STAFF_HR.md) §16.
> Runbooks: [RUNBOOK_PHASE6.md](./RUNBOOK_PHASE6.md).
> Owner: Sawan. Last updated: 2026-05-18.

Phase 6 introduces six tenant-shaped features (#135–#140). Because all
six touch the request path of every authenticated user — `requireActiveBusiness`
becomes part of the middleware chain, the audit-log subsystem wraps 22
mutation services, and the PIN gate adds a SELECT to every gated handler
— we ship behind flags and ramp in cohorts. A blast-radius bug at 100%
would page on-call within minutes; a blast-radius bug at 10% gives us a
24-hour window to roll back.

This document is the **operating runbook** for the rollout itself — what
to check before each stage, what triggers a hold, what triggers a
rollback. The feature definitions live in the architecture doc; the
incident-response steps live in the runbook doc.

---

## 0. Flag inventory

| Flag (BE / FE) | Default | What it gates | Independent of |
|---|---|---|---|
| `FEATURE_STAFF_HR` / `VITE_FEATURE_STAFF_HR` | `false` | All Phase-6 HR routes + tenancy elevation + audit-search UI. | `TRANSACTION_PIN` (but see §3.2 below) |
| `FEATURE_STAFF_HR_COHORT_PCT` / `VITE_FEATURE_STAFF_HR_COHORT_PCT` | `0` | Sticky percentage gate (0..100). Server-bucketed by hashed userId. | — |
| `FEATURE_TRANSACTION_PIN` / `VITE_FEATURE_TRANSACTION_PIN` | `true` | `requireRecentPin` middleware active on all gated routes. | `STAFF_HR` |
| `FEATURE_TRANSACTION_PIN_COHORT_PCT` / `VITE_FEATURE_TRANSACTION_PIN_COHORT_PCT` | `100` | Cohort gate for PIN; default 100 because PR3 already enrolled all users. | — |

**Bucketing rule:** `hash(userId) % 100 < cohortPercent` (sticky, deterministic).
Implementation: `server/src/config/features.ts:isFeatureEnabledForUser()`.

---

## 1. Stage progression

| Stage | Audience | Flag setting | Duration | Promotion gate (ALL must pass) |
|---|---|---|---|---|
| **0 — Internal** | Sawan's phone + 1 QA tester | `FEATURE_STAFF_HR=true` on session env only; cohort_pct stays 0; manual allowlist | 48h | All 17 §17 acceptance checks pass (curl + screenshots); zero `pin_gate.cookie_tamper_detected` alerts; zero `payment_already_reversed_total` false-positives |
| **1 — Pilot (10%)** | `hash(userId) % 100 < 10` | `FEATURE_STAFF_HR=true`, `FEATURE_STAFF_HR_COHORT_PCT=10` | 7d | Error rate < 0.5% on Phase-6 routes (Sentry); p95 latency drift ≤ +50ms on `requireActiveBusiness`-gated routes (Grafana); zero open Sev-1/2 tickets touching Phase-6 keys; audit-coverage enforcer clean on every PR merged during pilot |
| **2 — Wide (50%)** | `hash(userId) % 100 < 50` | `FEATURE_STAFF_HR_COHORT_PCT=50` | 14d | Stage-1 gates remain green; zero new postmortem triggers fired (per architecture §20); support-ticket volume for Phase-6 surfaces does not exceed 2× baseline of an existing feature like Invoicing |
| **3 — GA (100%)** | All authenticated users | `FEATURE_STAFF_HR_COHORT_PCT=100` | 30d watch | Stage-2 gates remain green for 14d before declaring GA-stable |

**Why 48h not 24h at Stage 0:** PR3's pin-grace cookie is bound to the
JWT_SECRET via domain-separation prefix (`pin-grace-cookie-v1:`). A bug
in the prefix-mismatch alarm (Q1/Q2) wouldn't necessarily fire in the
first 24h if the test cohort doesn't replay a stale cookie. 48h gives a
natural cookie-expiry cycle (8h grace window × ~6) to surface the bug.

**Why 7d not 3d at Stage 1:** Payroll FINALIZE is a monthly action. We
need a real billing-cycle close to verify the
`PAYMENT_ALREADY_REVERSED` 409 catch-block doesn't regress under load.
Calendar-driven; cannot be compressed.

---

## 2. Pre-promotion checklist

Before promoting a stage, the on-call engineer (Sawan) confirms:

### 2.1 Backend health
- [ ] `node scripts/system-health.js --gold-standard --brief` → exit 0
- [ ] `node scripts/manifest-score.js --brief` → exit 0
- [ ] `npm run tsc` (server) → 0 errors
- [ ] `node scripts/enforce-audit-coverage.mjs --block` → "all covered"
- [ ] Sentry `error_rate` for Phase-6 route prefixes (`/api/hr/*`,
      `/api/payroll/*`, `/api/audit/*`, `/api/pin/*`) below 0.5% over
      the past 24h
- [ ] Grafana p95 latency for `requireActiveBusiness`-gated routes
      within +50ms of pre-PR0 baseline; if not, hold and apply S9 fix
      (Redis-store 60s cache; architecture §17.4)

### 2.2 Audit & PIN signals
- [ ] `pin_grace_cookie_tamper_total` not spiking (>5/min sustained for
      5min on any single IP is a hold-trigger)
- [ ] `payment_already_reversed_total` < 1% of `payroll_reverse_calls_total`
      (anything higher means UI is letting users double-click — see
      runbook)
- [ ] `audit_coverage_drift` check is green (no service in
      `audit-coverage.ts` SSOT missing an audit write)

### 2.3 Frontend signals
- [ ] Bundle size of `/hr/*` lazy chunk < 250KB gzipped (Vite report);
      if larger, audit @react-pdf payload before promoting
- [ ] No console errors in production sourcemap'd Sentry for Phase-6
      route paths
- [ ] Lighthouse mobile score on `/hr/employees` ≥ 85
- [ ] Manual smoke: open 320px DevTools viewport on `/hr/payroll/new`,
      verify save bar above bottom-nav, no horizontal scroll

### 2.4 Migrations + data integrity
- [ ] `SELECT COUNT(*) FROM "Payment" WHERE "amount" < 0` → 0 (architecture
      §20 postmortem trigger)
- [ ] `SELECT COUNT(*) FROM "Payment" p JOIN "Party" pt ON pt.id = p."partyId"
      WHERE p."type" IN ('PAYROLL_OUT', 'PAYROLL_IN') AND pt."type" != 'STAFF'`
      → 0 (S8 invariant)
- [ ] `SELECT COUNT(*) FROM "AuditLog" WHERE "businessId" IS NULL` → 0

### 2.5 Sign-off
- [ ] Sawan ACK on a Slack/issue thread: "promoting Phase 6 STAFF_HR
      to <stage> at <UTC timestamp>". Anchor for post-promotion incident
      timeline reconstruction.

If ANY box fails, **hold** the stage and triage with the runbook. Do not
promote on partial green.

---

## 3. Promotion procedure

Stage-N → Stage-N+1 takes ~5 minutes of human time, ~3 minutes of deploy
time. There is no "schedule a window" — Render rolling deploy is
zero-downtime, and the flag is read fresh on each request.

### 3.1 The promotion itself

1. On Render dashboard, open the API service env vars
2. Update `FEATURE_STAFF_HR_COHORT_PCT` to the new value (e.g. `10` → `50`)
3. Click "Save Changes" → Render auto-restarts the service
4. Confirm in Render deploy logs: `Service is live`
5. `curl https://api.hisaabpro.in/api/health` → 200 OK
6. `curl https://api.hisaabpro.in/api/health/detailed` → `db.status: ok`
7. (Optional) trigger a synthetic `/api/hr/employees` request from a known
   in-cohort user; verify 200, not 404 NOT_AVAILABLE
8. Update the rollout-status field in this doc (§5 below) with the new
   cohort and timestamp

### 3.2 PIN flag coupling

`FEATURE_TRANSACTION_PIN` defaults to `true` because PR3 already enrolled
all users. The cohort flag stays at 100. We never roll PIN out
piecewise — a 50/50 PIN cohort would mean half the users in a single
business can authorize FINALIZE without PIN, which violates the audit
narrative.

If we need to roll PIN BACK (e.g., a critical cookie-tamper false-positive
alarm), we set `FEATURE_TRANSACTION_PIN=false` for ALL users, log a
postmortem, then re-enable once root-caused. See
`RUNBOOK_PHASE6.md:pin_gate.cookie_tamper_detected alert fires`.

---

## 4. Rollback procedure

A rollback is **flag flip, not deploy revert**. The Phase 6 code stays
in main; only the gate changes.

### 4.1 Quick rollback (cohort shrink — 30 seconds)

If a single sub-cohort (10%, 50%) is paining out:

1. Render dashboard → API env → `FEATURE_STAFF_HR_COHORT_PCT` →
   set to the previous value (`10` → `0`, or `50` → `10`)
2. Save → wait for restart
3. Verify with a user known to be in the *now-excluded* bucket that
   `/api/hr/employees` returns 404 NOT_AVAILABLE
4. Post in the incident thread: "Rolled STAFF_HR cohort back from X% to
   Y% at <UTC ts>. Reason: <one line>. Postmortem to follow."

### 4.2 Full kill (Phase 6 off — 30 seconds)

If a global bug (audit-write corrupting a row, payroll FINALIZE crashing
the API, pin-cookie verification looping):

1. Render dashboard → API env → `FEATURE_STAFF_HR=false`
2. Render dashboard → API env → `FEATURE_STAFF_HR_COHORT_PCT=0`
3. Save → wait for restart
4. Verify: `/api/hr/employees` returns 404 NOT_AVAILABLE for any user
5. Verify: a customer-only flow (e.g., create-invoice) succeeds; no
   ambient breakage from the flag flip
6. Open Sev-1 ticket, page Sawan, start postmortem timer

### 4.3 PIN rollback (only if PIN itself is broken)

If `pin_gate.cookie_tamper_detected` is *sustained* (not a single user's
device clock skew) AND we can't root-cause within 30 minutes:

1. Render dashboard → API env → `FEATURE_TRANSACTION_PIN=false`
2. Save → wait for restart
3. Confirm: a PIN-gated route (e.g., POST /api/payroll/run/finalize)
   succeeds without a `pin_gate_grace` cookie
4. Note: this widens the FINALIZE attack surface to "authenticated
   user with owner role". Acceptable as a temporary measure for ≤ 24h.
   Escalate via the cookie-tamper runbook.

### 4.4 Data we DO NOT roll back

Schema changes (Payment.reversesPaymentId, AuditLog, Employee, etc.)
stay in place. The migrations are add-only and forward-compatible with
the pre-Phase-6 codebase. If a code rollback is required (rare —
flag-flip should cover 99% of cases), the migration is left applied;
the new tables/columns are just unused.

---

## 5. Rollout status (live state)

| Stage | Target | Actual flag setting | Timestamp (UTC) | Notes |
|---|---|---|---|---|
| 0 — Internal | Sawan + QA | `FEATURE_STAFF_HR=true` (session only) | _not yet_ | Awaiting Security Pass-2 + QA Gate |
| 1 — Pilot 10% | 10% cohort | `FEATURE_STAFF_HR_COHORT_PCT=10` | _not yet_ | |
| 2 — Wide 50% | 50% cohort | `FEATURE_STAFF_HR_COHORT_PCT=50` | _not yet_ | |
| 3 — GA 100% | All users | `FEATURE_STAFF_HR_COHORT_PCT=100` | _not yet_ | |

Update this table at every promotion. The timestamps double as the
incident-anchor for post-mortems ("we promoted at 14:23 UTC, the spike
started at 14:31 UTC, so it was the promotion not a noisy neighbour").

---

## 6. Monitoring dashboards

Reference dashboards (Grafana URLs — placeholders; replace with prod URLs
once provisioned):

- `grafana.internal/d/phase6-routes` — error rate + p95 by route prefix
- `grafana.internal/d/phase6-payroll` — FINALIZE calls/min,
  PAYMENT_ALREADY_REVERSED rate, reversal-lag distribution
- `grafana.internal/d/phase6-pin` — pin-verify success rate, lockout
  rate, cookie-tamper-detected per IP, cookie-tamper-detected per userId
- `grafana.internal/d/phase6-audit` — audit-write latency added to mutation
  paths (should be ≤ 5ms p95 since it's inside the same `$transaction`)

Alert rules (Prometheus-style):

- `error_rate_phase6 > 0.005 for 5m` → page Sawan
- `pin_gate_cookie_tamper_total > 5/min sustained 5m on any IP` → page Sawan
- `payment_already_reversed_total > 1% of payroll_reverse_calls_total
  over 10m` → ticket (not page)
- `payroll_finalize_duration_seconds_p95 > 5s for 5m` → ticket
- `audit_coverage_drift detected on main` → block CI, page Sawan

---

## 7. Communication plan

| Stage | Channel | Audience | Cadence |
|---|---|---|---|
| 0 | Slack #engineering | Sawan + QA | Real-time during cutover, then daily standup recap |
| 1 | Email (in-app) | 10% cohort | "New: Staff & HR is in preview — try it!" link to docs/staff-hr.md |
| 2 | In-app banner | 50% cohort | Persistent banner with "Switch to new Staff & HR" + feedback link |
| 3 | Email + push | All users | Full launch comm; cross-post to /blog/hisaabpro-payroll-launch |

Communication is intentionally minimal at stages 0-1. The earliest cohorts
shouldn't be incentivised to use new features they'll feel are still
under construction — silent shipping is the goal.

---

## 8. Decision tree for the on-call engineer

```
incident reported / alert fires on Phase 6 route
│
├─ Single user, isolated → ticket; observe; do nothing to flag
│
├─ Multiple users, single business → ticket; check business-level config
│                                    (suspendedAt, ownership transfer);
│                                    do nothing to flag
│
├─ Multiple businesses, same route → COHORT ROLLBACK (§4.1)
│
└─ All users, any Phase 6 route → FULL KILL (§4.2); page Sawan; postmortem
```

Default bias: roll back at the smallest cohort that contains the
incident. Re-promoting after a fix is cheap; re-shipping after a Sev-1
that touched 100% is expensive.
