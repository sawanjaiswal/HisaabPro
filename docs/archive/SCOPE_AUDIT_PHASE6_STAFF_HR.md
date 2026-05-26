---
audit_of: docs/SCOPE_PHASE6_STAFF_HR.md
auditor: scope-auditor
audited_at: 2026-05-17T21:42:00+05:30
verdict: PASS_WITH_GAPS
must_ship_gaps: 0
should_ship_gaps: 7
future_epic_recommendations: 4
dh_reuse_spot_check: PASS (10 of 10 backend reuse claims verified at the DH path; FE component renamed but functionally present)
audit_format_reference: docs/SCOPE_AUDIT_EPIC_D_crm_loyalty.md (prior PASS template)
---

# SCOPE Audit — Phase 6 Staff & HR (#135 #136 #137 #138 #139 #140)

## Verdict

**PASS_WITH_GAPS**

All hard MUST_SHIP checks from the audit brief PASS:

- §6.5 explicitly commits to **NO JWT shape change** for #138 → tenancy stays on
  existing `businessId` claim → does NOT trigger the token-shape-change
  rule in CLAUDE.md (line 181). #138 still triggers the schema + auth.service
  + permission.ts paths, which scope-writer correctly enumerated in
  `high_risk_paths_touched` (lines 11-16). Architect+security ceremony is
  still mandatory but for schema/audit reasons, not for token-shape reasons.
- §3 #138 line 1 + §7 Risk A01 + §10 PR0 all converge on the same
  deliverable: `docs/TENANCY_AUDIT.md` written by architect BEFORE schema
  PR1 ships. Cross-tenant leak hunt is in scope.
- DH `auth-pin` reuse claims are honest — 10 of 10 backend files spot-checked
  exist at `/Users/sawanjaiswal/DudhHisaab/src/services/auth-pin/`. No hallucination.
- All 6 features carry user-story + acceptance (mobile + desktop where
  applicable) + Prisma data shape + key endpoints + FE pages list (§4).
- §6.4 explicitly enumerates new permission keys per feature: `hr.view`,
  `hr.employee.write`, `hr.attendance.write`, `hr.attendance.self`,
  `hr.payroll.view`, `hr.payroll.run`, `hr.advance.view`, `hr.advance.write`,
  `audit.view`, `audit.view_full`, `audit.export`. Plus per-class PIN route
  keys in §3 #140 (10 route-classes). Architect can pre-plan PR1 perms-data
  edit from this list.
- §8 enumerates 8 new tables + 2 column extensions, names migration
  ordering rule (add → backfill → make-NOT-NULL not violated because all
  new columns are nullable or have defaults), and itemizes the 3 ephemeral
  tables with cleanup cron specs.
- §6.2 offline matrix is complete — distinguishes ONLINE-ONLY (payroll
  run, switch firm, PIN verify) from queueable (attendance, advance,
  employee CRUD) with the required `entityType`/`entityLabel` discipline.
- §6.1 budgets ~255 EN+HI translation keys across 4 namespaces with
  parity assertion via `check-translations.mjs`.

The gaps below are **SHOULD_SHIP** — defensible to defer with explicit
acknowledgment, but each one will cost time later if not pre-resolved.
None block architect from running. Architect can absorb 4 of the 7 in
the ARCHITECTURE doc directly; the remaining 3 should round-trip back to
scope-writer for v2.

## MUST_SHIP gaps (epic blocked until addressed)

**None.** This SCOPE has passed every hard-gate check from the audit brief.

Specifically, on each item the audit instructions said must block:

| Check | Result | Evidence |
|---|---|---|
| #138 JWT-vs-session decision committed | PASS | §6.5 explicitly: "NO. Keep `TokenPayload` shape stable. PIN grace lives in `req.session.pinVerifiedAt`" |
| #138 cross-tenant audit is a deliverable | PASS | §10 PR0 lists `docs/TENANCY_AUDIT.md` as the first build artifact, BEFORE any schema change; §7 Risk A01 mitigation 1 reinforces |
| DH `auth-pin` files real | PASS | 10 of 10 backend reuse claims verified at `/Users/sawanjaiswal/DudhHisaab/src/services/auth-pin/` |
| All 6 features have story + criteria + data + endpoints + FE pages | PASS | §4 has all six in identical structure (#135 lines 362-449, #136 450-557, #137 559-609, #138 612-657, #139 660-697, #140 699-758) |
| Permission keys enumerated | PASS | §6.4 lines 859-895 |
| Migrations spelled out + ordering | PASS | §8 lines 1018-1063 |
| Offline rules respected | PASS | §6.2 lines 814-832 — `entityType`/`entityLabel` named, online-only flows isolated |
| Translation budget | PASS | §6.1 lines 803-810 |

## SHOULD_SHIP gaps (architect or scope-writer fixes; do not block this stage)

### Gap 1: Audit-coverage backfill blast-radius is under-specified

- **What's missing:** §3 #139 "Audit coverage backfill" lists 20 service names
  and §10 PR8b is the build slot, but the SCOPE does not state the
  **risk-management approach** for editing 20 production services inside one
  PR. Each service edit is a touch on already-shipped Phase 1-5 code; the
  diff for `payroll-run`, `commission-rule-edit`, `loyalty-program-edit`,
  `posSale-void` together hits Epic D paths and the new Phase 6 payroll
  paths — easy to slip in regression.
- **Failure mode:** Insider abuse mitigation depends on EVERY mutation
  writing the trail. If the backfill PR omits even one service (say,
  `recurring-pause`) — silent gap, possibly months before noticed.
- **Industry pattern:** Stripe's audit logger uses a **single
  `withAudit(action, ctx, fn)` higher-order function** wrapped around every
  mutation, enforced by ESLint rule that any service `function *.*Mutation`
  must be wrapped. AWS CloudTrail uses **declarative coverage table** in
  CI — list of "all known mutating endpoints" with `audited: bool` next to
  each.
- **Recommended fix (architect-absorbable):** Add to ARCHITECTURE a
  `services/audit-coverage.json` file enumerating every mutation service.
  PR8b updates the JSON + the service. `scripts/audit-coverage.mjs`
  (already referenced in §15 QA but not specified in §10 file plan)
  reads the JSON and fails CI if a service named `*-write|*-create|*-delete|*-void|*-run|*-suspend` exists without a matching entry. Defensible to defer if architect itemizes the 20 services in their
  File Plan with `audited: true` flags.
- **Severity:** SHOULD_SHIP

### Gap 2: Multi-firm "Suspended in this firm" message leaks membership existence

- **What's missing:** §3 #138 and §4 #138 both promise a "Suspended badge"
  on the switcher. Threat model: Priya was suspended from Amit's
  Distribution business 2 weeks ago. She opens the switcher and sees
  "Amit's Distribution — Suspended". This **confirms the membership ever
  existed**, which is a soft information-leak. Better behavior is to
  REMOVE the firm from her switcher list entirely (per the §4 acceptance
  "Suspended `BusinessUser` rows disappear from `businesses[]`
  immediately"). But §3 line 249 says "show... 'Suspended in this firm'
  badge for revoked memberships" — these two statements contradict.
- **Failure mode:** UI design ambiguity will get resolved at build time
  with whoever-is-implementing's preference, not by product intent.
- **Industry pattern:** Slack's workspace switcher REMOVES suspended
  workspaces silently. Salesforce LEAVES THEM with a "Contact admin"
  state. Both are defensible — the SCOPE must pick one.
- **Recommended fix:** Scope-writer disambiguates §3 line 249 vs §4
  line 626 in v2. Default recommendation: **REMOVE from switcher** (line
  626 wins) since `getMe` already filters them per §4. Delete the
  "Suspended badge" line from §3 #138.
- **Severity:** SHOULD_SHIP

### Gap 3: Payroll-run reversal is gated but the SCOPE doesn't specify side-effects on the cash ledger

- **What's missing:** §3 #136 `[MUST_SHIP]` line 209 says payroll generates
  a `PAYROLL_OUT` Payment row. §9 #136 line 1112 says "Reverse run
  requires Approval + PIN gate". But **what happens to the original 12
  Payment rows when a run is reversed?** Two options: (a) the 12 rows are
  marked `voidedAt`, (b) 12 compensating `PAYROLL_IN` Payment rows are
  written. The SCOPE doesn't pick.
- **Failure mode:** Cash register at 6 months shows wrong totals for any
  business that reversed a payroll run. Discovered by an accountant
  doing reconciliation = trust-busting moment.
- **Industry pattern:** QuickBooks uses **compensating entries** (option
  b) — original entries are immutable, reversals are new rows with a
  `reversesPaymentId` link. ZohoBooks does the same. This preserves the
  audit trail (#139's whole premise).
- **Recommended fix (architect-absorbable):** ARCHITECTURE picks option
  (b) compensating entries. Adds `Payment.reversesPaymentId String?` to
  the existing Payment model (1-column additive migration that fits in
  PR2). Document on the `PayrollRun.status='REVERSED'` row.
- **Severity:** SHOULD_SHIP

### Gap 4: Geofence consent flow lacks an explicit "withdrawn consent" pathway

- **What's missing:** §7 Risk N1 covers DPDP consent on geofence-on toggle.
  But DPDP §6(4) requires that consent be **withdrawable at any time as
  easily as it was given**. The SCOPE has the on-flow but not the
  off-flow: what happens to the 3 months of `Attendance.geofenceFlag`
  rows when the employee withdraws consent? And the cached lat/lng
  business config?
- **Failure mode:** First DPDP complaint = "I withdrew geofence consent
  60 days ago and you still have geofence flags on me" — a data-subject
  rights violation, fineable under DPDP Act.
- **Industry pattern:** GDPR Article 17 / DPDP §12 "right to erasure"
  workflow: on consent withdrawal, business config row
  (`Employee.geofenceEnabled=false`) AND a flag-clear cron retroactively
  scrubs `geofenceFlag` on existing rows (or sets them all to `null`
  with `geofenceConsentWithdrawnAt` stamp). The flag becomes
  "indeterminate", not retroactively False — preserves attendance truth
  while honoring consent.
- **Recommended fix (architect-absorbable):** Add `Employee.geofenceConsentWithdrawnAt
  DateTime?` to schema. Audit-log row on toggle-off. Daily cron
  (`employee-geofence-scrub.cron.ts`) sets `Attendance.geofenceFlag` to
  null for the affected employee's rows post-withdrawal date.
- **Severity:** SHOULD_SHIP

### Gap 5: PIN-gate "PIN_REQUIRED" 401 response shape will break the existing 401-refresh interceptor

- **What's missing:** Phase 6 introduces `401 PIN_REQUIRED` (§3 #140 line
  329) as a NEW 401 sub-type. But HP's existing `api()` interceptor
  (`src/lib/api.ts` + `src/lib/auth.ts`) treats 401 as **auth-expired →
  silent refresh → retry**. A 401 PIN_REQUIRED will trigger a refresh
  attempt that succeeds (the token is fine), then retry the original
  request, which will return 401 PIN_REQUIRED again → infinite loop or
  premature logout. The SCOPE does not call out this interaction.
- **Failure mode:** First PIN-gated action after PR6 deploys will silently
  fail with the wrong UX. Manifests as "delete invoice button does
  nothing" or "logged out unexpectedly".
- **Industry pattern:** Stripe uses **402 Payment Required** for billing
  re-auth, **403 PIN_REQUIRED** for step-up. Choosing 401 is fine ONLY
  if the response body carries a sub-code AND the interceptor branches
  on it.
- **Recommended fix:** Either (a) change to `403 PIN_REQUIRED` (so the
  existing 401 interceptor never fires) — RECOMMENDED for least-blast-radius;
  or (b) `api.ts` must learn to inspect 401 body for `code: PIN_REQUIRED`
  and route to `<PinGateSheet>` instead of refresh+retry. Either choice
  is OK; SCOPE must commit, and PR4 (PinGateSheet) must include the
  api.ts change with an integration test exercising the loop.
- **Severity:** SHOULD_SHIP

### Gap 6: Payroll preview compute lives on the server but isn't priced for cost-runaway scenarios

- **What's missing:** §4 #136 line 541 has `POST /api/payroll/runs/preview`
  as a pure-compute endpoint. §13 Failure Mode 6 covers payslip PDF cost
  (client-side, free) but doesn't cover the preview endpoint, which on a
  20-staff business with a misbehaving client refreshing on every
  keystroke can issue many calls per minute. Each call is a
  `Attendance.findMany(business, month)` + per-employee compute.
- **Failure mode:** A retry-loop bug in PR6 frontend or a malicious
  user-script issuing 1000 previews/min = Postgres CPU spike, noisy
  neighbor for the rest of the tenants on Render Starter shared db.
- **Industry pattern:** Stripe Checkout's `preview` and Tax `calculate`
  endpoints are **rate-limited per-business** (Stripe: 100/min on
  preview). Per-business cap is the right primitive — per-IP doesn't
  work for offices.
- **Recommended fix (architect-absorbable):** Add
  `rateLimitPerBusiness('payroll.preview', 60, '1m')` on the preview
  route. Use existing `niceRateLimit` middleware. Document in §3 #136 +
  §13 Failure Mode 6.
- **Severity:** SHOULD_SHIP

### Gap 7: §14 reuse table itemizes 13 DH files but §3 #140 claims "15 files" — three are unaccounted for

- **What's missing:** §3 #140 line 314 says "Port DudhHisaab's auth-pin
  service tree (... 15 files) as server/src/services/security-pin/*."
  §14 lists only 10 backend reuse entries + 3 frontend = 13. The actual
  DH backend `auth-pin` directory has 15 files; the 3 unmentioned ones
  are `device-list.service.ts`, `device-revoke.service.ts`, and
  `sibling-device-notice.service.ts` + `sibling-device-revoke.service.ts`
  + `pin-status.service.ts` + `pin-hash.util.ts` (so actually >3
  unaccounted; some of these may be DH-specific device pairing).
- **Failure mode:** Architect's File Plan will be off by 4-5 files. Build
  agents either skip them (leaving lockout-status / device-list features
  broken in HP) or include them (turning a 13-file port into 17 files,
  blowing the file-count estimate of "~55 backend files").
- **Industry pattern:** N/A — this is a documentation hygiene issue, not
  a security/scale issue.
- **Recommended fix:** Scope-writer reconciles §3 line 314 with §14 in
  v2 — either lower the "15 files" claim to match §14's 13, OR expand
  §14 to itemize all 15 with explicit `[OUT_OF_SCOPE]` tags on
  `sibling-device-*` and `device-list/revoke` (which are DH multi-device
  features; HP doesn't have UserDevicePin model so they're N/A).
  Architect can resolve at File-Plan time but scope-writer is the
  right owner.
- **Severity:** SHOULD_SHIP

## FUTURE_EPIC items — tier placement is correct

| Item | SCOPE tier | Confirmed |
|---|---|---|
| Biometric / face-recognition attendance | FUTURE_EPIC | YES — needs camera + ML + DPDP biometric consent ceremony |
| Self-service employee PWA | FUTURE_EPIC | YES — separate Capacitor target |
| PF/ESI/TDS auto-compute (statutory deductions) | FUTURE_EPIC | YES — Phase 7 compliance epic; slabs change yearly and hard-coding = regulatory liability |
| Direct UPI/bank transfer payout (RazorpayX) | FUTURE_EPIC | YES — needs separate RazorpayX integration SCOPE |
| Form 16 / 24Q generation | FUTURE_EPIC | YES — Phase 7 GST expansion |
| Shared parties across firms | FUTURE_EPIC | YES — outstanding-balance merge is the hard part |
| Per-firm subscription | FUTURE_EPIC | YES — today User-level plan; revisit when multi-firm has >1000 users |
| Audit revert/rollback execution | FUTURE_EPIC | YES — per-entity reverse logic is large |
| Tamper-evident audit Merkle chain | FUTURE_EPIC | YES — post-ISO 27001 compliance epic |
| S3 audit archive bucket | FUTURE_EPIC | YES — Phase 7 ops; hook ships in Phase 6 |
| WebAuthn/hardware-key transaction gate | FUTURE_EPIC | YES — wiring exists, v2 polish |
| Biometric unlock for PIN gate | NICE_TO_HAVE | YES — extends existing pattern; tier placement correct (NICE_TO_HAVE is one notch above FUTURE_EPIC which is fine) |
| Weekly/fortnightly payroll cycles | SHOULD_SHIP scaffolded | YES — enum present, build is MONTHLY only |

All FUTURE_EPIC placements correct.

## DH reuse spot-check results

**Backend `/Users/sawanjaiswal/DudhHisaab/src/services/auth-pin/`** — 15 files:

```
device-list.service.ts                  (NOT mentioned in §14 port table — likely OUT_OF_SCOPE for HP)
device-revoke.service.ts                (NOT mentioned in §14)
dummy-hash.ts                            verified — §14 row 7
pin-biometric.service.ts                 verified — §14 row 5
pin-hash.util.ts                        (NOT mentioned in §14 — should be ported if pin-set/verify ported)
pin-lockout.service.ts                   verified — §14 row 1
pin-reset.service.ts                     verified — §14 row 4
pin-set.service.ts                       verified — §14 row 3
pin-status.service.ts                   (NOT mentioned in §14)
pin-verify.service.ts                    verified — §14 row 2
sibling-device-notice.service.ts        (NOT mentioned in §14)
sibling-device-revoke.service.ts        (NOT mentioned in §14)
turnstile-gate.service.ts                verified — §14 row 6
weak-pin.util.ts                         verified — §14 row 8
```

Plus `__tests__/` mirror with 13 test files.

**Constants:** `/Users/sawanjaiswal/DudhHisaab/src/constants/pin-auth.constants.ts` — EXISTS (2683B). Verified.

**Cron:** `/Users/sawanjaiswal/DudhHisaab/src/jobs/pin-gc.job.ts` — EXISTS (5019B). Verified.

**Frontend `/Users/sawanjaiswal/DudhHisaab/frontend/src/features/auth-pin/`** — present, but file name in §14 row 11 is `PinPad.tsx`; actual DH file is `PinKeypad.tsx`. The pattern is faithful but the cited filename is wrong by 3 chars. Pages exist:
`PinSetupPage.tsx`, `PinSetupPromptPage.tsx`, `PinVerifyPage.tsx`, `PinResetPage.tsx`.
Hooks exist: `usePinVerify.ts`, `usePinStatusGate.ts`, `useAppLockTimeout.ts`, `useBiometric.ts`, `usePinReset.ts`, `usePinSetup.ts`, `usePinStatus.ts`.

**Verdict on DH reuse honesty:** PASS with one filename typo (`PinPad.tsx` → `PinKeypad.tsx`) and the 6-file under-count flagged as Gap 7 above. **No hallucinated files.** Every backend service named in §14 exists at the claimed path with the claimed approximate size.

## Cross-session learnings applied

Source: `/Users/sawanjaiswal/.claude/learnings/scope-writer-blindspots-2026-05-15-auth.md`.

| Blindspot | Applied in SCOPE? | Where |
|---|---|---|
| #1 Test/dev magic OTP | YES | §8 line 1079 + §11 Q22 — reused `9999999990-9999999999` range |
| #2 Lockout policy (not just primitive) | YES | §3 #140 lines 318-321 — explicit 5/30min + 20/1h + Turnstile thresholds |
| #3 SIM-swap detection | N/A correctly | §12 row #3 explicit — PIN gates an already-authenticated session, SIM-swap is OTP login domain |
| #4 Adapter pattern over deprecation | N/A correctly | §12 row #4 — all Phase 6 routes are additive |
| #5 Ephemeral-table cleanup cron | YES | §8 cleanup table lines 1066-1074 — all 3 ephemeral tables have cron + retention + index |
| #6 Adapter telemetry | N/A correctly | §12 row #6 |
| #7 First-time vs existing-user failure | N/A correctly | §12 row #7 — PIN setup is for authenticated users only |
| #8 Provider abstraction | YES | §3 #136 scaffolds payroll-cycle enum even though MVP MONTHLY-only |
| #9 Tier every recommendation | YES | every §3 line ends with `[MUST_SHIP]` / `[SHOULD_SHIP]` / etc. — explicit blindspot-#9 closure noted in §3 line 167 |
| #10 Autofill/autocomplete | YES | §12 row #10 — `inputmode="numeric"` + `autocomplete="one-time-code"` on PinPad |
| #11 SMS template multi-channel | YES (N/A flagged) | §12 row #11 — PIN reset OTP reuses existing MSG91 template |
| #12 Stateful gate collisions | YES | §12 row #12 — `requireRecentPin` runs AFTER `auth` + `requirePermission`; tested |
| #13 Self-X check leak analysis | YES | §12 row #13 + §7 Risk N1 — geofence-flag is SILENT to avoid leaking employee location to cashier UI |
| #14 Analytics events ≤ 7/flow | YES | §12 row #14 — per-feature event counts itemized; max is 5 (PIN flow) |

**All 14 entries from the cross-session learnings file are addressed.** Zero unaddressed blindspots from prior auth/OTP-domain SCOPE failures.

## Failure-mode walkthrough coverage (auditor's 7-scenario check)

The SCOPE §13 covers all 7 standard scenarios:

| Scenario | SCOPE §13 row | Mitigation present? |
|---|---|---|
| 1. Provider/dependency outage | Row 1 (MSG91 30-min outage) | YES — Aisensy WhatsApp fallback; support contact CTA; existing-PIN flows continue |
| 2. Abuse spike (100x normal traffic, rotating IPs) | Row 2 | YES — per-user + per-IP throttle + Turnstile gate |
| 3. Database growth (100M rows) | Row 3 (Attendance 100M rows) | YES — composite index `(businessId, date)`; partition deferred |
| 4. Client-version lag (30% on app 6+ months old) | Row 4 | YES — server `X-Min-App-Version` header; PIN-not-set users unaffected |
| 5. Regulatory change (1-week notice) | Row 5 (DPDP §8 amendment) | YES — single constant `AUDIT_HOT_DAYS=180`; flip + deploy |
| 6. Cost runaway (5x provider cost spike) | Row 6 | PARTIAL — covers PDF (client-side, free) and WhatsApp share cost cap, but does NOT cover the payroll-preview compute fan-out (Gap 6 above) |
| 7. Insider abuse (engineer with DB access) | Row 7 | YES — ROLE_CHANGE audit row; AdminAction trail; quarterly review; Phase 7 tamper-evident chain |

**Failure-mode coverage:** 6.5 of 7 (preview cost-runaway is the Gap 6 noted).

## Open clarifying questions — P0 default presence check

The audit brief flagged §11 questions Q11.4, Q11.7, Q11.12, Q11.16, Q11.19 as P0 blockers requiring pre-baked defaults. Spot check:

| Q | SCOPE line | Default present? |
|---|---|---|
| Q11.4 Pro-ration formula | line 1203-1205 | YES — `net = baseNet * (present + halfDay*0.5 + paidLeave) / workingDays` |
| Q11.7 Payslip language | line 1213 | YES — English only in MVP |
| Q11.12 Suspend membership requires what | line 1226-1228 | YES — PIN gate + audit row + SMS to suspended user |
| Q11.16 CSV export max rows | line 1240 | YES — 10,000 rows; larger → 202 ASYNC_EXPORT_REQUIRED |
| Q11.19 Grace duration | line 1251-1252 | YES — 5 min per route-class, configurable |

All 5 P0 defaults present. No escalation needed.

## What the SCOPE got right (preserve through revisions)

1. **#138 elevation framing.** Rather than greenfield, SCOPE correctly
   identified that Business/BusinessUser/JWT-businessId/switch-business
   route ALL ship already (§2 line 100-119). Phase 6 work is audit
   wiring + UI polish + 2 nullable columns. This framing alone saves
   probably 40% of architect time.
2. **§6.5 JWT decision committed.** Explicitly REJECTING the two
   tempting JWT extensions (`firms[]` claim, `pinVerifiedAt` claim)
   with reasons. Architect won't waste cycles re-litigating these.
3. **DH reuse table (§14) names exact paths.** Even the file-size hints
   are recoverable from the paths. Spot-check passed without finding a
   hallucinated file.
4. **Idempotency anchor for payroll explicit.** §3 #136 line 199 +
   schema `@@unique([businessId, periodYearMonth, cycle])` on PayrollRun
   gives the architect a free idempotency guarantee at the DB layer.
   Better than relying on application-level dedupe.
5. **Snapshot-immutability for payslip is principled.** §3 #137 +
   PayslipSnapshot schema explicitly freeze every field at run time.
   No "join back to Employee" trap that would break legal
   reproducibility 18 months out.
6. **Audit row INSIDE `$transaction` (Risk A09 mitigation).**
   Mirrors Epic D's loyalty-accrual pattern. Architect can reuse the
   exact wrapper.
7. **Online-only flows isolated.** §6.2 explicitly lists payroll-run,
   firm-switch, PIN-verify as online-only. Avoids the common offline-bug
   class where money-out actions get queued and double-fire.
8. **Permission keys named with action-level granularity.** §6.4
   `hr.attendance.write` vs `hr.attendance.self` distinction is exactly
   the right level — owner can let staff clock themselves in without
   letting them mark others.
9. **Failure-mode walkthrough section (v2 mandatory) present.** §13 is
   the section the auditor would BLOCK on if missing; it's present and
   substantive.

## Recommended next step

**PROCEED TO ARCHITECT.** No MUST_SHIP gaps. The 7 SHOULD_SHIP items
break down as:

- **Architect can absorb in ARCHITECTURE doc (4):** Gap 1 (audit
  coverage table), Gap 3 (compensating Payment rows), Gap 4 (geofence
  consent withdrawal cron), Gap 6 (payroll-preview rate limit).
- **Scope-writer round-trip recommended in v2 (3):** Gap 2 (suspended-firm
  badge contradiction), Gap 5 (PIN_REQUIRED 401 vs 403 decision — affects
  api.ts contract), Gap 7 (DH reuse file count reconciliation).

Architect should call out the 4 architect-absorbed gaps explicitly in the
ARCHITECTURE doc's "Open SCOPE deltas" section so scope-writer can fold
them back into the next SCOPE revision. The 3 scope-writer items can
be queued as v2 SCOPE edits without blocking the build PRs.

Security agent (mandatory after architect per CLAUDE.md high-risk-paths
rule — touched paths: schema.prisma, auth.service.ts, permission.ts,
audit*.service.ts) should pay special attention to Gap 5 (the 401-loop
risk) because that interacts with the existing auth interceptor.

**End of audit.**
