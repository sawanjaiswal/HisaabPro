verdict: PASS
---
audit_of: docs/SCOPE_V2_APPOINTMENTS.md
auditor: scope-auditor
audited_at: 2026-05-30T19:51:00+05:30
revision_audited: 2 (2026-05-30 revision pass)
must_fix_gaps: 0
should_fix_gaps_addressed: 1
should_fix_gaps_deferred: 6
future_epic_recommendations: 3
---

# SCOPE Audit — V2 Appointments Calendar (Re-audit, Revision 2)

## Verdict

**PASS.** All six MUST_FIX gaps from the prior audit
(`2026-05-30T19:41:00+05:30`) are closed with concrete, race-safe,
architecturally honest mechanisms. The revision did not paper over
problems — it picked the correct primitive in each case
(exclusion constraint, not FOR UPDATE; SetNull + app guard, not
Restrict; HMAC-SHA256 + revokedAt, not bearer-cookie; explicit 404 on
cross-tenant, not 403; plaintext + banner, not fake encryption; replay
toast + Sentry event, not silent drop). Broken precedent link is fixed.
SF1 (endAt) resolved via denormalize + CHECK.

**Ready for architect handoff.** (Acknowledged: architect already ran in
parallel against revision 1. This audit unlocks the next critique pair
— architect can now finalize ARCHITECTURE.md §slot-conflict and
§public-booking-signature against the revised SCOPE without contract drift.)

---

## MUST_FIX closure validation

### MF1 — Slot-conflict exclusion constraint — CLOSED

- `btree_gist` extension cited (line 335: `CREATE EXTENSION IF NOT EXISTS btree_gist`).
- `EXCLUDE USING gist (employee_id WITH =, tstzrange(start_at, end_at) WITH &&) WHERE (status NOT IN ('CANCELLED','NO_SHOW'))` shown in §Data Model (lines 327-333).
- `SELECT ... FOR UPDATE` explicitly disclaimed as insufficient with the correct reason ("two parallel INSERTs of new rows don't share a row to lock — both transactions read zero overlap and both commit"). Cited in §Data Model, §Edge Cases (line 667), §Resolved Decisions (line 839), and §Acceptance Criteria (line 875).
- Migration row (#2 in File Plan) explicitly includes "CREATE EXTENSION btree_gist + exclusion constraint (MF1)".
- Null-employee branch handled (constraint scoped `WHERE employee_id IS NOT NULL`, line 668).

### MF2 — Employee/Party soft-delete FK pattern — CLOSED

- FK changed from `Restrict` to `SetNull` (Prisma model lines 411-412 with comments).
- App-layer guard checks active-status set `{SCHEDULED, CONFIRMED, CHECKED_IN}` and blocks soft-delete; `appointment.constants.ts` (#4) holds the active-status set.
- Terminal-status appointments (`COMPLETED | NO_SHOW | CANCELLED`) allow soft-delete with FK nullification.
- `employeeNameSnapshot` + `partyNameSnapshot` denormalized fields added to model (lines 391, 393) for "(former)" badge UI.
- Edge cases lines 669-672 cover both active and terminal branches for both Employee and Party.
- Acceptance criteria lines 888-890 test both branches per entity.

### MF3 — Public-booking HMAC — CLOSED

- Algorithm: HMAC-SHA256 (line 491).
- Canonical payload: `{businessId, employeeId?, expiresAt}` (line 503).
- Per-business secret: `BusinessSettings.publicBookingHmacSecret`, 32-byte random, server-generated (lines 484-486, 494-497).
- Rotation: Settings → Public Links → "Reset booking link" action; audit-logged (line 498).
- Revocation: `SharedLink.revokedAt` column; rotation flips `revokedAt = now()` on prior rows (lines 508-511).
- Exact canonical encoding deferred to ARCHITECTURE §public-booking-signature — appropriate scope handoff.
- New files: `public-booking-signature.ts` (#14) + test (#17) in File Plan.
- Acceptance criteria lines 883-886 test the four failure modes (no-sig, expired, revoked, post-rotation).

### MF4 — Cross-tenant guard — CLOSED

- Promoted to "architectural invariant" in §Security (lines 694-699): every route accepting `employeeId` from input MUST JOIN on `req.user.businessId` BEFORE further query.
- `/availability` and `/day-summary` API contract explicitly call out the guard (lines 280-283, 300-301).
- 404 (not 403, not empty) specified consistently — lines 282, 684, 697, 881-882.
- QA Checklist includes literal curl commands for both routes (lines 925-927).
- Test infra adds cross-tenant fixture (lines 789-791).
- Aligns with `feedback_auth_req_user_shape.md` blindspot — cited in Resolved Decisions (line 850).

### MF5 — Clinic-notes encryption — CLOSED (DEFER path)

- Hand-wavy "no decrypt grant" model is GONE.
- DEFER path chosen explicitly: plaintext + banner in MVP, envelope encryption (per-business DEK + KEK + decrypt audit) moved to FUTURE_EPIC (lines 82-87, 854-860).
- Banner copy specified EN + HI (lines 615, 661).
- `ClinicNotesBanner.tsx` (#38) in File Plan; clinic-vertical-only render.
- Honest rationale documented (lines 723-730, 846): "shipping fake encryption is worse."
- Compensating control: every clinic-notes read still writes `audit_log` row at API boundary regardless of storage (lines 719-720).

### MF6 — Offline replay rejection UX — CLOSED

- Toast string specified verbatim EN: `"Couldn't update {party}'s appointment — status no longer valid"` (lines 608, 657).
- Drawer-reopen behavior: tap toast/action opens detail drawer with server's freshly fetched current state (line 609).
- Failed mutation explicitly dropped from queue (no auto-retry) — line 610.
- Sentry event `appointment_replay_rejected` with `{appointmentId, attemptedStatus, currentStatus}` (line 756).
- Alert wired on volume spike (>10/min sustained) — line 752.
- Device-mode acceptance criterion present (line 905) with full sequence: device A offline CHECKED_IN, device B online COMPLETED, A reconnects, toast + drawer + Sentry.
- Two-device Playwright fixture added to test infra (lines 792-795).
- New files: `api-queue-replay.ts` edit (#44) + `replay-rejection.test.tsx` (#51).

---

## SHOULD_FIX status

- **SF1 — `endAt` generated stored column.** ADDRESSED. Denormalize + DB CHECK constraint chosen (correct for Prisma 5.x). Acceptance criterion added (line 891). Migration row #2 includes the CHECK.
- **SF2-SF7.** Deferred per revision log (line 967). Acceptable: none are launch-blocking. Architect or scope-writer should pick them up post-handoff if any prove material during build.

## Other validation

- **Broken precedent link.** FIXED. Header now cites `docs/EPIC_vertical-v1-hourly-billing/architecture-critique.md` (line 6) with a note that V1 used EPIC_ directory layout. Verified the path is plausible (matches the git history pattern).
- **Revision Log.** Present and dated 2026-05-30, lists all 6 MF closures + SF1 + precedent fix (lines 957-967). Compliant.
- **File Plan discipline.** Still 250-line-cap-compliant; largest row #8 service at 230 (line 577). New rows #14, #17, #38, #44, #51 align with closures.
- **No new emoji, no new claude-branding** in the SCOPE.

## What the SCOPE got right (preserve through any future revisions)

- The exclusion-constraint reasoning (lines 318-338) is exactly the depth architect needs and exactly the depth product doesn't. Don't compress it on the next revision; it's the single most leverage-bearing paragraph in the doc.
- The MF5 "honest plaintext beats fake encryption" call is the right one. Resist any well-meaning attempt to add `pgcrypto` "encryption" in the next pass without the KEK pipeline.
- Two-device Playwright fixture for MF6 is rare-and-correct; most teams only test the happy path.
- Cross-tenant 404-not-403 discipline matches the project's existing IDOR posture (`feedback_auth_req_user_shape.md`).

## Cross-session learnings applied

- `feedback_auth_req_user_shape.md` — caught the cross-tenant `employeeId` leak in audit #1; SCOPE now cites this directly in Resolved Decisions (line 850) and treats it as an invariant.
- `feedback_root_fixes_only.md` — informed rejection of `SELECT FOR UPDATE` (symptom-level) in favor of exclusion constraint (root-level), and rejection of "no decrypt grant" theatre in favor of honest plaintext + banner.

---

## Sign-off

All six MUST_FIX gaps closed with mechanisms that survive review at month 6
in production. Verdict: **PASS**. **Ready for architect handoff.** SF2-SF7
deferred-with-rationale is acceptable for an MVP-tier epic; revisit only if
build-phase friction surfaces them.
