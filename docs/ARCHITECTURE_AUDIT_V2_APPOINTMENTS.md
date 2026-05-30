verdict: PASS

---
audit_of: ARCHITECTURE_V2_APPOINTMENTS.md (rev 2)
scope_ref: SCOPE_V2_APPOINTMENTS.md (rev 2, scope-auditor PASS, 2026-05-30)
auditor: architecture-auditor
audited_at: 2026-05-30T20:07:00+05:30
verdict: PASS
must_fix_gaps: 0
should_fix_gaps: 0
future_epic_recommendations: 2
scope_conformance_breaks: 0
---

# Architecture Audit — V2 Appointments Calendar (rev 2)

## Verdict

**PASS.** All six rev-1 MUST_FIX SCOPE conformance breaks are closed against
SCOPE rev 2. File plan is bounded (largest row 240L, every row ≤ 250),
Revision Log row dated 2026-05-30 rev 2 is present, prior "Deviations from
SCOPE" rationale explicitly rescinded.

Ready for build phase (pending security re-audit + `bin/approve-plan`).

## MF closure verification

| MF | SCOPE rev-2 requirement | Architecture rev-2 site | Status |
|---|---|---|---|
| **MF1** | `CREATE EXTENSION btree_gist` + `appointment_no_overlap` EXCLUDE constraint with terminal-status WHERE; §17 deviation rescinded; no FOR-UPDATE fallback | §3.2 lines 274–311 (extension + EXCLUDE with `WHERE ("status" IN ('SCHEDULED','CONFIRMED','CHECKED_IN'))`); §4.2 plain INSERT + catch `23P01`; §17 "Deviations" explicitly says "None remaining in rev 2 … rescinded" | **CLOSED** |
| **MF2** | `partyId String?` + `employeeId String?` + both `*NameSnapshot` cols + `onDelete: SetNull`; app-layer active-status guard; `(former)` badge | §2.2 (`partyId String?`, `employeeId String?`, `partyNameSnapshot String`, `employeeNameSnapshot String`, both `onDelete: SetNull`); §2.7 app-layer guard with `['SCHEDULED','CONFIRMED','CHECKED_IN']`; §6.4 `<Badge variant="muted">{t.formerParty}</Badge>` render | **CLOSED** |
| **MF3** | HMAC-SHA256 canonical `${businessId}\|${employeeId ?? ''}\|${expiresAt.toISOString()}`, base64url, revokedAt-before-HMAC verify order, 90d clamp, 30 rpm/IP; rotation endpoint; new columns | §10.1.1 (full spec with verification order: parse → revokedAt → expiresAt → HMAC timingSafeEqual; 90d clamp; 30 rpm); §5.11 `POST /api/business/settings/rotate-booking-secret`; §2.6 `BusinessSettings.publicBookingHmacSecret Bytes?` + `SharedLink.revokedAt DateTime?` | **CLOSED** |
| **MF4** | Top-level cross-tenant guard invariant + route table + canonical helpers + lint rule | §11.0 explicit invariant statement + 9-route table + `resolveScopedEmployee/Party/Appointment` helpers + `no-unscoped-id-read` lint rule (§15.7 follow-up) | **CLOSED** |
| **MF5** | `notes String?` plaintext; pgcrypto entirely removed; `ClinicNotesBanner.tsx` + log redaction; FUTURE_EPIC; honest §11.6 | §2.2 `notes String?` with MVP-plaintext comment; §11.5 explicitly removes pgcrypto (rebuts old plan); §11.6 `app_decrypt` role explicitly removed; File Plan #46a `ClinicNotesBanner.tsx` (60L); #18c `log-redact.ts` edit; §19 FUTURE_EPIC envelope encryption | **CLOSED** |
| **MF6** | 409 INVALID_TRANSITION → toast + detail drawer reopen + Sentry `appointment_replay_rejected`; alert; row added | §8.3 detail drawer reopen with refetch; §12.1 row 9 (`appointment_replay_rejected` Sentry-only, with emit site); §12.2 alert "`appointment_replay_rejected` > 10/min sustained 5 min → warn"; File Plan #29a `api-queue-replay.ts` edit + #60a `replay-rejection.test.tsx` | **CLOSED** |

## File Plan check

- 61 rows + sub-rows (14a, 14b, 16a, 16b, 18a–c, 28a–b, 29a, 46a, 60a). Every estimate ≤ 250L.
- Largest rows: #9 `appointment.service.ts` (230L), #42 `CreateAppointmentDrawer.tsx` (240L), #40 `CalendarWeekView.tsx` (230L), #51 `appointments.css` (230L) — all under cap with explicit split-on-growth note (line 1221–1224).

## Revision Log check

Line 1502: `| 2026-05-30 | 2 | Absorbed SCOPE rev-2 deltas (MF1 exclusion constraint, MF2 SetNull+snapshots, MF3 HMAC spec, MF4 invariant, MF5 plaintext+banner, MF6 replay UX) per ARCHITECTURE_AUDIT_V2_APPOINTMENTS.md. |` — present and correctly dated.

## What stayed strong from rev 1

- State-machine matrix §4b (untouched, still complete with terminal handling + notes-edit synthetic audit row).
- Additive-only migration §3 with extension → enums → tables → EXCLUDE → indexes ordering correct.
- 4-stage cohort ramp §16 with sub-flag staggering and < 60s kill-switch.
- Cursor pagination, Zod `.strict()`, complete error code list §5.12.
- §7 calendar render virtualization decision argued from real numbers.
- §8 offline write-queue OFFLINE_RULES.md-conformant.

## Future-epic recommendations (informational only — do not block)

- **Clinic-notes envelope encryption** — already tracked in §19 FUTURE_EPIC with KMS + key-version + audit consumer pre-reqs. No action required at architecture phase; preserve when scope-writer opens that epic.
- **Drag-to-reschedule on desktop week view + print-friendly day sheet** — both correctly listed in §19 FUTURE_EPIC backlog post-100% rollout.

## Cross-session learnings applied

No `~/.claude/learnings/architecture-blindspots-*.md` exists. Two candidate
entries from the rev-1 audit remain valid lessons for future epics:

1. **"Architect rebutting SCOPE rev 1 against SCOPE rev 2"** — re-check
   "Deviations from SCOPE" sections when SCOPE has been revised mid-flight.
   Rev 2 architect correctly rescinded the deviation.
2. **"pgcrypto-with-no-decrypt-grant is theatre"** — confirmed valid; rev 2
   replaced it with honest plaintext + banner + redact pipeline.

## Sign-off

Architecture rev 2 is fit for build. **Ready for build phase (pending
security re-audit + `bin/approve-plan`).**
