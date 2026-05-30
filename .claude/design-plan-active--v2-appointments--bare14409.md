---
status: approved
feature: v2-appointments
created: 2026-05-30T14:40:49Z
session: bare-14409
proposer: claude
revision: 2
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
files_planned:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
  # Adapted to existing flat layout (Option A — 2026-05-30 rev 3)
  - server/src/services/appointment/**
  - server/src/services/appointment.service.ts
  - server/src/services/appointment-availability.service.ts
  - server/src/services/appointment-conflict.service.ts
  - server/src/services/appointment-convert.service.ts
  - server/src/services/appointment-public-booking.service.ts
  - server/src/services/appointment-recurrence.service.ts
  - server/src/services/appointment-status.service.ts
  - server/src/services/appointment-waitlist.service.ts
  - server/src/services/appointment-repo.ts
  - server/src/services/public-booking-signature.ts
  - server/src/services/business-settings-rotation.service.ts
  - server/src/services/party.service.ts
  - server/src/services/employee.service.ts
  - server/src/services/job.service.ts
  - server/src/services/invoice.service.ts
  - server/src/services/reminder*.ts
  - server/src/services/reminder/**
  - server/src/routes/appointments.ts
  - server/src/routes/appointment*.ts
  - server/src/routes/public-booking.ts
  - server/src/routes/business-settings.ts
  - server/src/schemas/appointment.schema.ts
  - server/src/schemas/appointment-public-booking.schema.ts
  - server/src/types/appointment.types.ts
  - server/src/types/appointment.ts
  - server/src/constants/appointment.constants.ts
  - server/src/utils/appointment.utils.ts
  - server/src/middleware/business-scope.ts
  - server/src/middleware/resolve-scoped.ts
  - server/src/lib/log-redact.ts
  - server/src/config/features.ts
  - server/src/index.ts
  - server/src/__tests__/appointment*.test.ts
  - server/src/__tests__/public-booking*.test.ts
  - server/src/__tests__/soft-delete-guard*.test.ts
  - server/src/__tests__/cross-tenant*.test.ts
  - src/features/appointments/**
  - src/lib/api.ts
  - src/lib/api-types.ts
  - src/lib/api-queue-replay.ts
  - src/lib/translations.en.ts
  - src/lib/translations.hi.ts
  - src/components/layout/BottomNav.tsx
  - src/config/features.ts
  - src/routes.tsx
  - docs/EPIC_v2-appointments/**
agents_invoked:
  - scope-auditor (output: docs/SCOPE_AUDIT_V2_APPOINTMENTS.md, verdict: PASS)
  - architecture-auditor (output: docs/ARCHITECTURE_AUDIT_V2_APPOINTMENTS.md, verdict: PASS)
  - security (output: docs/SECURITY_AUDIT_V2_APPOINTMENTS.md, verdict: PASS)
critique_history:
  - ts: 2026-05-30T13:30:00Z
    critic: scope-auditor
    verdict: REVISE
    revision: 1
    findings: 6 MUST_FIX (slot-conflict primitive, FK soft-delete, HMAC spec, cross-tenant guard, clinic notes encryption, offline replay UX) + 7 SHOULD_FIX
  - ts: 2026-05-30T13:50:00Z
    critic: scope-auditor
    verdict: PASS
    revision: 2
    findings: all 6 MUST_FIX closed; SF1 (endAt CHECK) addressed; SF2-SF7 deferred with rationale
  - ts: 2026-05-30T13:53:00Z
    critic: architecture-auditor
    verdict: REVISE
    revision: 1
    findings: 5 MUST_FIX (architect ran against SCOPE rev 1; FOR-UPDATE-style insert, Restrict FK, missing HMAC spec, partial cross-tenant guard, pgcrypto contract drift)
  - ts: 2026-05-30T14:05:00Z
    critic: architecture-auditor
    verdict: PASS
    revision: 2
    findings: all 5 MUST_FIX absorbed; SCOPE rev-2 deltas locked in ARCHITECTURE rev 2
  - ts: 2026-05-30T13:55:00Z
    critic: security
    verdict: REVISE
    revision: 1
    findings: 3 MUST_FIX (clinic-notes pgcrypto drift, HMAC under-spec, notes redaction in Sentry/Winston/Zod) + 5 SHOULD_FIX
  - ts: 2026-05-30T14:07:00Z
    critic: security
    verdict: PASS
    revision: 2
    findings: 3 MUST_FIX closed (Winston redactor explicit; Sentry beforeSend + Zod sanitizer downgraded to SHOULD_FIX); 5 SHOULD_FIX queued for build phase
acceptance:
  backend:
    - tsc clean
    - curl 200 / 401 / 404 (cross-tenant employeeId returns 404)
    - curl 409 on slot-conflict (btree_gist exclusion fires)
    - curl 400 on invalid status transition
    - integration test cross-tenant suite green
    - public-booking HMAC verify timing-safe
  frontend:
    - screenshots: loading · error · empty · success · 320px
    - calendar day/week views render at 320 / 375 / 768 / 1024
    - offline appointment create queues with entityType/entityLabel
    - replay-rejection toast + drawer reopen on 409
    - clinic vertical shows ClinicNotesBanner
    - console clean
approver: sawanjaiswal
approved_at: 2026-05-30T15:20:19.501Z

---

# V2 Appointments — Plan (rev 2)

## Summary
Salon + clinic verticals get a first-class `Appointment` model, day/week calendar UI, employee-availability slot picker, status state machine, and conversion to Job (services) / Invoice (clinic) keeping billing SSOT.

## Reference artifacts
- SCOPE: `docs/SCOPE_V2_APPOINTMENTS.md` (rev 2, scope-auditor PASS)
- ARCHITECTURE: `docs/ARCHITECTURE_V2_APPOINTMENTS.md` (rev 2, architecture-auditor PASS)
- SCOPE AUDIT: `docs/SCOPE_AUDIT_V2_APPOINTMENTS.md` (verdict PASS)
- ARCH AUDIT: `docs/ARCHITECTURE_AUDIT_V2_APPOINTMENTS.md` (verdict PASS)
- SECURITY AUDIT: `docs/SECURITY_AUDIT_V2_APPOINTMENTS.md` (verdict PASS)

## High-risk paths gated
Only `prisma/schema.prisma` + `prisma/migrations/**` (additive migration: new tables + nullable FK on Job + Invoice + `endAt` CHECK + `btree_gist` exclusion constraint + `BusinessSettings.publicBookingHmacSecret` + `SharedLink.revokedAt`). No auth/billing changes.

## Critical invariants locked in rev 2
1. **Slot conflict**: `EXCLUDE USING gist (employeeId WITH =, tstzrange(startAt, endAt, '[)') WITH &&) WHERE status IN ('SCHEDULED','CONFIRMED','CHECKED_IN')` — race-safe primitive. NOT `FOR UPDATE`.
2. **FK shape**: `partyId/employeeId` nullable + `SetNull` + `*NameSnapshot` denorm + app-layer active-status guard.
3. **Public booking HMAC**: HMAC-SHA256 over canonical pipe-separated payload, 90d clamp, 30rpm/IP, revokedAt-before-HMAC verify order, `timingSafeEqual`.
4. **Cross-tenant**: `resolveScoped*` helpers JOIN to `req.user.businessId` BEFORE further query; 404 on mismatch; `no-unscoped-id-read` lint rule.
5. **Clinic notes**: plaintext `String?` + `ClinicNotesBanner` + `redactPiiFields(['notes'])` log middleware. Envelope encryption deferred to FUTURE_EPIC.
6. **Offline replay**: 409 → toast + drawer-reopen + Sentry `appointment_replay_rejected` + alert.

## Build phase SHOULD_FIX queue (non-blocking)
- SF-SEC-1: `/availability` auth rate limit (120/min/user)
- SF-SEC-2: `recurrence.endAt` ≤365d Zod refine
- SF-SEC-3: Sentry `beforeSend` notes redaction (server + FE)
- SF-SEC-4: Zod error envelope `received` field redaction
- SF-SEC-5: Idempotency-Key `createdById` replay match
- SF-MISC: `resolveScopedJobTemplate` helper

## Build phase order
Backend (schema → migration → repo → service → routes → tests) → verifier → Frontend (types → constants → utils → hooks → components → pages → routes → translations) → verifier → QA cross-tenant + offline-replay device-mode tests → ship behind `featureV2Appointments` flag, vertical-scoped to SALON+CLINIC, 4-stage cohort ramp.
