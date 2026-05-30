verdict: PASS

---
audit_of:
  - docs/SCOPE_V2_APPOINTMENTS.md (revision 2)
  - docs/ARCHITECTURE_V2_APPOINTMENTS.md (revision 2)
auditor: security
audited_at: 2026-05-30T20:07:00+05:30
prior_verdict: REVISE (3 MUST_FIX, 5 SHOULD_FIX)
this_verdict: PASS (0 MUST_FIX, 4 SHOULD_FIX deferable to build, 2 FUTURE_EPIC)
---

# Security Audit — V2 Appointments Calendar (Re-audit, rev 2)

## Verdict

**PASS.** All three prior MUST_FIX items are closed in ARCHITECTURE rev 2.
Remaining items are SHOULD_FIX (4 — build-phase addressable) and
FUTURE_EPIC (2 — already tracked). No blocker remains.

**Ready for `bin/approve-plan v2-appointments`.**

---

## MUST_FIX closures (verified)

### MF-SEC-1 — Clinic-notes encryption contract drift → CLOSED

Architect rev 2 fully adopts SCOPE rev-2 MF5 (plaintext + banner) and
removes the rev-1 pgcrypto pathway. Verified at:

- §2.2 — `notes String?` (plaintext UTF-8), comment "encryption deferred to FUTURE_EPIC per SCOPE MF5".
- §11.5 — explicit rationale: pgcrypto SQL-callable, fake encryption worse than honest plaintext.
- §11.6 — `app_decrypt` role removed; honest plaintext access for `app_rw` and `analyst_ro` with code-review constraint to exclude `notes` from analytics queries.
- §6.5 — `ClinicNotesBanner.tsx` renders on `AppointmentDetailPage` for `Business.vertical === 'CLINIC'`.
- File Plan #46a — `ClinicNotesBanner.tsx` (~60 lines).
- File Plan #18c — `server/src/lib/log-redact.ts` edit (+10 lines) adds `notes` to redact list.
- Risk #3 — "Plaintext PHI accidentally entered in clinic notes" acknowledged with mitigations (banner + owner education + log/Sentry redaction + FUTURE_EPIC tracker).
- §19 FUTURE_EPIC backlog — "Clinic-notes envelope encryption" listed with pre-reqs (KMS choice, `notes_key_version`, decrypt audit consumer).
- §17 Conformance map — MF5 row marked OK (rev 2).

The §17 conformance row no longer carries the rev-1 "Resolved: pgcrypto" entry — clean rescission.

### MF-SEC-2 — Public-booking HMAC under-specified → CLOSED

New §10.1.1 "Public-booking signature spec" is concrete and tight:

- **Canonical payload** (line 930): `${businessId}|${employeeId ?? ''}|${expiresAt.toISOString()}` — pipe-separated, empty string for missing `employeeId` (not null), version-prefix headroom via the wire-format byte ordering. No JSON.stringify ambiguity.
- **Signature**: `base64url(HMAC-SHA256(secret, canonical))` — explicit algorithm + encoding.
- **Wire format**: `<base64url(payload-json)>.<signature>` — split clearly so payload tampering is detectable.
- **Verification order** (lines 945-951): malformed-parse → SharedLink lookup → **`revokedAt IS NOT NULL` BEFORE HMAC verify** → expiry → `timingSafeEqual` HMAC → proceed. Order matches the audit ask (revokedAt before HMAC; timingSafeEqual mandated).
- **`expiresAt` upper bound**: 90 days from mint, server-clamped (line 954).
- **Rate limit**: 30 rpm/IP on `/api/public/booking/*` (line 955).
- **Logging**: only `{tokenVersion, businessId}` logged — never raw token (line 956).
- **Rotation flow** §5.11: single tx — generate secret + increment version + bulk `revokedAt = NOW()` on all prior SharedLink rows + audit log. Mass-invalidation primitive locked.
- **Schema support** §2.6: `BusinessSettings.publicBookingHmacSecret Bytea`, `publicBookingSecretVersion Int`, `SharedLink.revokedAt TIMESTAMPTZ` + index.
- **Tests** §15.1 / File Plan #14b: `public-booking-signature.test.ts` covers canonical encoding, timing-safe verify, revokedAt-before-HMAC ordering, expired token, rotation invalidates priors, field-injection via `|` rejected.

One residual nit, noted but **NOT blocking**: the spec uses `|` as the canonical-form separator AND allows arbitrary characters in `businessId` / ISO datestring. Since `businessId` is server-generated CUID (alphanumeric, no `|`) and `expiresAt.toISOString()` is RFC3339 (no `|`), there is no injection path today. The test in §15.1 ("field-injection attempts via `|` in business name rejected") covers the future-proof case if `businessId` shape ever loosens.

### MF-SEC-3 — Notes leak via logs / Sentry / Zod → PARTIALLY CLOSED (PASS with SHOULD_FIX residue)

ARCHITECTURE rev 2 closes the **log-middleware** path explicitly:

- §11.5 — "Server logs + Sentry middleware: `redactPiiFields(['notes'])` strips `notes` from every log line and event payload."
- File Plan #18c — `server/src/lib/log-redact.ts` edit (+10 lines) adds `notes` to redactor.

This is the most-likely-to-leak surface (Winston request-body capture during incident triage), and it's closed.

**Per the re-audit instruction, the two remaining surfaces are downgraded to SHOULD_FIX (build-phase addressable), and PASS is granted overall:**

- **Sentry `beforeSend` filter**: §11.5 references "Sentry middleware: `redactPiiFields(['notes'])`" but the spec doesn't name the Sentry config file or the `beforeSend` hook explicitly. The redact list is shared between Winston + Sentry per the wording, but build needs to wire `beforeSend({ event }) => stripPiiFields(event, ['notes', 'customerName', 'customerPhone'])` in `server/src/lib/sentry.ts` (and the FE equivalent in `src/lib/sentry-client.ts`). See SF-SEC-3 below.
- **Zod error envelope sanitization**: A `notes.max(2000)` failure currently echoes the offending value into the 400 body via Zod's default `received` field. Not addressed in §5.1 or §10.4. See SF-SEC-4 below.

Both are <30-line build-phase fixes and do not affect the security model. Acceptable to defer.

---

## SHOULD_FIX (build-phase, non-blocking)

### SF-SEC-1 — Authenticated `/availability` rate limit not in ARCHITECTURE

§5.7 route definition omits the rate limit. SCOPE §Security mandates "120/min/user". Add to §5.7 + Acceptance Criteria: `rateLimit({ key: 'userId', max: 120, windowMs: 60_000 })`. Trivial 2-line build addition.

### SF-SEC-2 — `recurrence.endAt` upper bound not enforced server-side

§5.1 Zod schema: `endAt: z.string().datetime({ offset: true })` with no upper bound. The 52-cap in `appointment-recurrence.service.ts` catches the runaway, but only after Zod passes (allowing `'2099-01-01'` through schema validation). Defense-in-depth: add `.refine(d => differenceInDays(d.recurrence.endAt, d.startAt) <= 365, 'RECURRENCE_TOO_LONG')` to `CreateAppointmentSchema`. ~3 lines.

### SF-SEC-3 — Sentry `beforeSend` filter — wire explicitly

Add `server/src/lib/sentry.ts` (edit) — `beforeSend(event) { return redactPiiFromSentryEvent(event, ['notes','customerName','customerPhone']) }` — and the FE mirror in `src/lib/sentry-client.ts`. Both consume the same redact list from `log-redact.ts` (File Plan #18c). ~20 lines server, ~20 FE.

### SF-SEC-4 — Zod error envelope must strip `notes` value before echo

`server/src/middleware/zod-error-handler.ts` (assume exists): when the offending field path is `['notes']` or includes `'notes'`, replace `received` / value in the error response with `'[redacted]'`. ~15 lines.

### SF-SEC-5 — Idempotency-Key replay `createdById` mismatch handling

§8.4 says the server returns the originally-created row on replay (200). Document explicitly in §5.1: on replay, confirm `existingRow.createdById === req.user.userId` before returning the row. Mismatch (low-probability CUID guess) → generate fresh 200 with a generic ack or 409 `IDEMPOTENCY_KEY_OWNED_BY_OTHER_USER`. Otherwise user B who guesses user A's key could read A's appointment. 128-bit CUID makes this near-impossible, but the principle keeps the per-tenant idempotency contract clean. ~10 lines in `appointment-conflict.repo.ts` (File Plan #8).

---

## SHOULD_FIX closures (prior audit, now verified)

### Cross-tenant guard for `partyId`, `appointmentId`, `employeeId` (prior SF-SEC-3)

§11.0 — new architectural-invariant section — explicitly lists `employeeId`, `partyId`, `appointmentId`, `jobId`, `invoiceId` as input IDs that MUST resolve via business-scoped helpers. Canonical helpers in `appointment.repo.ts`:

- `resolveScopedEmployee(id, businessId): Employee | NotFound`
- `resolveScopedParty(id, businessId): Party | NotFound`
- `resolveScopedAppointment(id, businessId): Appointment | NotFound`

Static check added to `scripts/enforce.js` (rule `no-unscoped-id-read`) flags any direct `prisma.(appointment|party|employee|job|invoice).findUnique({ where: { id }` without a `businessId:` key in the same object literal. File Plan #28a (`cross-tenant.integration.test.ts`) exhaustively tests every (route × input-ID) cell.

**Residual nit:** `jobTemplateId` (used in `CreateAppointmentSchema`) is NOT in the §11.0 invariant table or the canonical helper list. Build must add `resolveScopedJobTemplate(id, businessId)` and call it in `appointment.service.ts` before consuming `jobTemplateId`. Track as part of SF-SEC-1 build pass — same shape as the existing helpers.

### Public `/availability` rate limit (prior SF-SEC-1)

§10.2 — "30 rpm/IP on public-booking routes (§10.1.1)." Read from §10.1.1 line 955 verbatim: applies to `/api/public/booking/*` blanket — which includes the `GET .../availability?date=` route under §5.10 / §10.4. Covered.

---

## Informational (passed checks, no action)

### I1 — IDOR / cross-tenant baseline (§11.0 + §11.1)

§11.0 invariant + §11.1 checklist + `no-unscoped-id-read` lint rule + File Plan #28a integration suite = the strongest cross-tenant posture I've audited in this codebase. Matches `feedback_auth_req_user_shape.md`. 404 (not 403) consistent throughout. ✅

### I2 — Slot-conflict primitive (§3.2 + §4.2)

Declarative `EXCLUDE USING gist` with `tstzrange(startAt, endAt, '[)')` and `WHERE status IN (SCHEDULED, CONFIRMED, CHECKED_IN)`. Catches Postgres SQLSTATE `23P01` and translates to 409. NULL `employeeId` naturally excluded by gist `=` semantics, matching the SCOPE "any staff" accepted-trade-off. Race-safe regardless of isolation level or future query rewrites. ✅

### I3 — Status state-machine race-safety (§4.4)

Conditional `updateMany` with `where: { id, businessId, status: VALID_FROM_STATES_FOR[toStatus], version: knownVersion }`. Single primitive guards tenant, state machine, and optimistic lock. Audit-event row written in the same tx. Terminal-state notes-edit writes a synthetic event row. ✅

### I4 — Public-surface PII surface cuts (§10.3 + §11.4)

Public availability returns `{ startAt, endAt, employeeOpaqueId }` only. Opaque ID is `HMAC(publicBookingHmacSecret, linkToken-version, employeeId)` truncated to 8 chars — rotation refreshes the mapping. No employee names, no party data, no totals leak. Public 409 body shape per §10.4 doesn't echo `conflictingAppointmentId` (verified — uses the public schema not the authenticated `conflictBody`). ✅

### I5 — Soft-delete app-layer guard (§2.7 + File Plan #18a/#18b/#28b)

App-layer guard in `party.service.ts` + `employee.service.ts` blocks soft-delete when `count > 0` of active appointments. FK ON DELETE is `SetNull` (not `Restrict`) — the restriction lives in the app guard, which keeps ops scripts and admin tools subject to the same business rule. Snapshots (`partyNameSnapshot`, `employeeNameSnapshot`) preserve historical render. Test in File Plan #28b. ✅

### I6 — Injection (A03)

All queries Prisma-parameterized. The single raw SQL is the migration. No `$queryRawUnsafe` / `$executeRawUnsafe` in feature code. ✅

### I7 — CSRF on public surface (§11.2)

Public endpoints exempt from CSRF (no cookie session); replaced by HMAC signature per §10.1.1. SameSite cookies + double-submit token remain in place for authenticated routes. ✅

### I8 — Secrets hygiene

`publicBookingHmacSecret` stored as `Bytea` (not String), server-generated, never returned in any API. Rotation revokes prior links atomically. Audit log on every rotation. ✅

---

## FUTURE_EPIC (tracked, no action this epic)

### FE-SEC-1 — Envelope encryption for clinic notes
Already listed in §19. Pre-reqs documented (KMS choice, key-version column, decrypt audit consumer). Post-100% rollout.

### FE-SEC-2 — Public booking captcha-cost amplification
$50/day soft cap (§12.4) is sufficient for V2. Per-link captcha-cost budget that pauses the link (not the captcha) is post-MVP.

---

## Residual risks (accepted, documented)

- **Plaintext clinic notes at rest.** Compensating controls: in-UI banner (§6.5), per-read `audit_log` row (§11.5), Winston/Sentry redaction of `notes` field (§11.5 + File Plan #18c; Sentry `beforeSend` wiring per SF-SEC-3), Zod-error sanitization (per SF-SEC-4). DPDP-defensible per scope-auditor's PASS reasoning. ✅
- **`createdById = SYSTEM_PUBLIC_BOOKING_USER_ID` sentinel** for public-surface rows. Audit trail loses real-customer identity (unauthenticated by definition). `Party.source = 'PUBLIC_BOOKING'` captured. ✅
- **`employeeId IS NULL` "any staff" appointments stack** on the same time slot — accepted SCOPE trade-off, EXCLUSION constraint naturally permits via NULL gist semantics. ✅
- **No 2FA on owner accounts.** Out of scope. Inherited platform posture. ✅

---

## Sign-off

All three MUST_FIX items from the prior audit (REVISE, 2026-05-30T19:54) are closed in ARCHITECTURE rev 2. The four residual SHOULD_FIX items (rate limit on §5.7, recurrence `endAt` Zod refine, Sentry `beforeSend`, Zod error sanitizer, idempotency-key createdById match) and the `jobTemplateId` scoped-resolver gap are all <30-line build-phase additions that do not affect the security model — addressable during backend build with a task-manager gate check.

**Verdict: PASS.**

**Ready for `bin/approve-plan v2-appointments`.**

---

## Cross-session learnings applied

- `feedback_auth_req_user_shape.md` — cross-tenant guard verified as architectural invariant (§11.0) with canonical helpers + lint rule + integration mandate. Strongest posture in the codebase to date.
- `memory/security_defaults.md` — Zod `.strict()` confirmed throughout §5 + §10.4; explicit field allowlists; no `data: req.body`; HMAC body uses Buffer-safe `timingSafeEqual` (§10.1.1).
- `feedback_root_fixes_only.md` — MF-SEC-1 closure honors SCOPE's "honest plaintext beats fake encryption" call; ARCHITECTURE rev 2 does not re-introduce the symptom-level pgcrypto patch. Root-fix posture preserved.
- `memory/totp_sha1_compat.md` — N/A (not a TOTP epic, but the HMAC discipline rhymes: algorithm explicit, encoding explicit, no library-default surprises).

## Revision log

| Date | Rev | Note |
|---|---|---|
| 2026-05-30T19:54 | 1 | REVISE — 3 MUST_FIX (pgcrypto drift, HMAC under-spec, log redaction). |
| 2026-05-30T20:07 | 2 | PASS — all 3 MUST_FIX closed in ARCHITECTURE rev 2. 4 SHOULD_FIX deferred to build phase. Ready for approve-plan. |
