# SCOPE — V2 Appointments Calendar (salon + clinic verticals)

> Status: DRAFT — revised after scope-auditor MUST_FIX pass
> Created: 2026-05-30
> Author: scope-writer
> Precedent: `docs/EPIC_vertical-v1-hourly-billing/architecture-critique.md` (additive `JobItemKind` + Decimal columns pattern, shipped 2026-05-29; V1 used EPIC_ directory layout, no SCOPE_*.md was produced)
> Reuse: V5 reminders pipeline (`ReminderRule` cron + `ORDER_DELIVERY` trigger), #130 SharedLink, existing `Party` / `Employee` / `BusinessVertical` models
> Owner: TBD · Effort: ~2 weeks · Tier: HIGH (onboarding blocker for salon + clinic)

## Summary

Salon and clinic owners cannot run their day without a calendar that
shows "who is coming at 3pm, with whom, for what". V2 adds a first-class
`Appointment` model, a day/week calendar UI, an employee-availability
slot picker, and a status state machine that funnels completed
appointments into either a Job (services vertical) or an Invoice (clinic
vertical) so billing remains the same SSOT.

## Problem statement

Today a salon owner who installs HisaabPro on day 1 cannot answer
"what's my 11am?" — they fall back to WhatsApp / a paper diary within
the first hour and never return. The same is true for a small clinic
with one doctor + one assistant. V1 (hourly billing on Jobs) gave us
a way to *bill* a salon visit but not to *schedule* one. Without V2 the
two highest-LTV verticals churn on day 1 and the vertical
go-to-market plan stalls.

Observed competitor floor (Vyapar, Khata Book, Petpooja): none of
them ship a real calendar; the ones that do (Fresha, Zenoti) are
priced 10x our point and assume a desktop reception terminal. Our
opportunity is a mobile-first calendar that a Rs-8K Android phone
running on 3G can actually use.

## Goals

- [MUST_SHIP] `Appointment` model — businessId-scoped, partyId + optional
  employeeId, startAt + durationMinutes, status enum, source enum,
  notes, idempotency key
- [MUST_SHIP] Day view + week view (mobile day-first, tablet/desktop
  week-first) rendered in the WebView with no horizontal scroll at 320px
- [MUST_SHIP] Create-appointment drawer: party search → service/duration
  → employee → slot picker → confirm
- [MUST_SHIP] Per-employee availability view (busy slots blocked,
  conflict detection at API level returns 409)
- [MUST_SHIP] Status state machine SCHEDULED → CONFIRMED → CHECKED_IN
  → COMPLETED / NO_SHOW / CANCELLED with audit trail
- [MUST_SHIP] Convert COMPLETED → Job (BusinessVertical SERVICES) or
  → Invoice (BusinessVertical CLINIC) preserving partyId, employeeId,
  appointmentId backref
- [MUST_SHIP] Offline create + status-change queues via existing
  `api()` mutation queue with `entityType: 'appointment'`; rejected
  PATCH replays surface a conflict toast + refetch (see MF6 below)
- [MUST_SHIP] 4 UI states on every screen (loading / error / empty /
  success) at 320 / 375 / 768 / 1024 / 1280 / 1536
- [MUST_SHIP] Translations EN + HI for every new string

- [SHOULD_SHIP] Recurring appointments (weekly / biweekly / monthly,
  bounded by `recurrenceEndAt`, max 52 occurrences expanded at create
  time — NOT lazy)
- [SHOULD_SHIP] SMS / WhatsApp reminder T-24h + T-2h via V5
  `ReminderRule` with new `APPOINTMENT_UPCOMING` trigger
- [SHOULD_SHIP] Waitlist queue per business per day; promote to
  SCHEDULED when a slot opens (manual promote in MVP)
- [SHOULD_SHIP] Customer-facing booking link (#130 SharedLink reuse) —
  party self-books, lands as `source: WEB`, status SCHEDULED, optional
  CONFIRMED gating
- [SHOULD_SHIP] Day-summary push notification at 8am (existing FCM
  pipeline)

- [NICE_TO_HAVE] Drag-to-reschedule on week view (desktop only)
- [NICE_TO_HAVE] Color-code by employee (already in employee model)
- [NICE_TO_HAVE] Print-friendly day sheet (A4 + 80mm thermal)

- [FUTURE_EPIC] Multi-resource booking (room + chair + therapist as
  separate resources with composite availability)
- [FUTURE_EPIC] Online payment at booking (Razorpay link before slot
  is held)
- [FUTURE_EPIC] Google / Apple calendar two-way sync
- [FUTURE_EPIC] Group appointments (yoga class, vaccination camp)
- [FUTURE_EPIC] Patient EMR / clinical notes (compliance scope —
  DPDP Act sensitive personal data, separate epic)
- [FUTURE_EPIC] Clinic-notes encryption at rest (envelope encryption
  with per-business DEK + KEK rotation + decrypt audit log). MVP
  ships notes plaintext with an in-UI banner for clinic vertical
  warning "Clinical notes are not encrypted at rest yet — do not
  store PHI". See MF5 below.

## User Flow

### Happy path — salon owner books a walk-in

1. Owner opens app → BottomNav "Calendar" → lands on day view (today)
2. Taps "+" FAB → CreateAppointment drawer opens (uses `<Drawer>` primitive)
3. Searches party "Priya" → picks existing or creates new (reuse
   `<PartySearch>` from V1)
4. Picks service "Haircut · 30 min" from saved service list (reuses
   `JobTemplate` if present, else free-text + duration)
5. Picks employee "Asha" — slot picker shows Asha's next free 30-min
   slots starting now (greyed: busy / past)
6. Confirms 3:00pm → API POST → optimistic insert into day view →
   success toast "Booked — Priya at 3:00pm with Asha"
7. At 3:00pm Asha taps the appointment → "Check in" → status
   CHECKED_IN → start timer (reuses V1 hourly billing)
8. After service: tap "Complete & bill" → opens Job creation pre-filled
   with appointmentId, partyId, employeeId, actualHours from check-in
   delta → owner saves Job → appointment status COMPLETED

### Happy path — clinic receptionist phone booking

1. Patient calls; receptionist opens Calendar → tomorrow → 11am slot
2. Same create flow, source = PHONE
3. Day before at 10am, V5 reminder fires WhatsApp template to patient
4. Patient arrives → CHECKED_IN → doctor sees → COMPLETED → "Bill
   now" opens Invoice pre-filled (clinic vertical), not Job

### Error paths (exact copy)

| Scenario | Message | Recovery |
|---|---|---|
| Slot taken (race) | "That slot was just taken. Pick another time." | Re-fetch availability, highlight next free slot |
| Past slot | "Can't book in the past. Pick a time after now." | Slot picker auto-scrolls to next valid 15-min boundary |
| No employee free | "No staff free at that time. Try a different time or staff." | Show next 3 free windows across all employees |
| Party required | "Pick a customer to book the appointment." | Focus party field |
| Network failed (online) | "Couldn't reach server. Retry?" | Retry button; create-flow does NOT queue mid-form (only on submit) |
| Network failed (offline submit) | "Saved — will sync when online" | Queued via `api()` offline queue; row shows pending pill |
| Status transition invalid | "Can't move from {from} to {to}." | Disable button rather than show error when possible |
| Queued PATCH rejected on replay | "Couldn't update {party}'s appointment — status no longer valid" | Drawer opens with server's current state; user can retry |
| Convert-to-Job when already converted | "Already billed — open Job #1234?" | Link to existing Job |

## Failure Mode Walkthrough

1. **Provider/dependency outage — WhatsApp/SMS gateway down 30 min**
   Reminders go through existing V5 retry queue (Postgres + cron, 3
   retries with exponential backoff). Calendar functionality is
   unaffected — reminders are async and best-effort. Day view shows
   a "Reminder pending" pill on rows where the latest dispatch row
   has status FAILED for >15 min so the owner can manually WhatsApp.

2. **Abuse spike — 100x traffic from rotating IPs hitting public
   booking link (#130 SharedLink)** Public booking endpoint sits
   behind existing per-link rate limit (10 req/min/link primitive)
   AND a per-business policy (200 bookings/day soft cap; above that
   incoming `source: WEB` appointments land in `PENDING_REVIEW`
   instead of SCHEDULED — owner approves manually). Captcha
   (hCaptcha existing key) triggers after 3 failed slot attempts
   per IP-link pair. HMAC signature (MF3) prevents leaked / replayed
   URLs from booking against rotated secrets.

3. **Database bloat — calendar query becomes slow as Appointments
   table reaches 100M rows** Composite index
   `(businessId, startAt)` + partial index on `status IN (SCHEDULED,
   CONFIRMED, CHECKED_IN)` keeps hot path < 30ms. Day/week query
   ALWAYS bounded by `startAt BETWEEN :from AND :to` with `:to -
   :from <= 31 days` enforced at route level. Cancelled/no-show rows
   older than 90 days move to `appointment_archive` via nightly
   cron (`scripts/cron/archive-appointments.ts`, retention: 7 years
   for clinic vertical per healthcare record norms; 2 years salon).

4. **Client-version lag — 30% of users on app 6+ months old** API
   versioning: `/api/v1/appointments` is additive-only. New status
   values (e.g. PENDING_REVIEW) ship as unknown-status-tolerant on
   FE (fallback to "Other"). Recurrence + waitlist endpoints are
   feature-gated by `BusinessFeature.APPOINTMENTS_V2_RECURRING` so
   old clients never see UI they can't handle.

5. **Regulatory change — DPDP Act tightens with 1-week notice on
   appointment notes** MVP ships plaintext notes with an explicit
   UI banner ("Clinical notes are not encrypted at rest yet — do
   not store PHI") for clinic vertical (see MF5). Export-for-
   deletion endpoint already exists at user level (Epic A);
   appointments join via partyId so cascade works without schema
   change. Encryption-at-rest is FUTURE_EPIC, gated on KEK rotation
   + audit pipeline being solid; SCOPE will not attempt half-measures.

6. **Cost runaway — reminders cost 5x** Per-business daily reminder
   cap (default 50 SMS/day, 200 WA/day) reuses V5 budget gate.
   Reminders auto-pause on cap hit and surface a banner in
   Settings → Reminders. Owner can raise cap (audit-logged).

7. **Insider abuse — engineer with DB access reads
   appointment notes** MVP: notes are plaintext, mitigated by (a)
   the in-UI banner discouraging PHI storage, (b) all DB access
   audited via existing pg-audit pipeline, (c) the
   `audit_log` row on every notes read at the API layer (still
   written even though storage is plaintext). Long-term mitigation
   is the FUTURE_EPIC envelope-encryption work.

## API Contract

All routes are `businessId`-scoped via middleware. Money fields (if any
in future) in paise (Int). Idempotency-Key header honoured on POST.

### POST /api/v1/appointments — create

```ts
interface CreateAppointmentReq {
  partyId: string;
  employeeId?: string;            // optional; null = "any staff"
  startAt: string;                // ISO 8601 with timezone
  durationMinutes: number;        // 5..480
  serviceLabel?: string;          // free text, e.g. "Haircut"
  jobTemplateId?: string;         // optional link to template
  notes?: string;                 // <= 2000 chars
  source: 'WEB' | 'PHONE' | 'WALKIN' | 'IN_APP';
  recurrence?: {                  // SHOULD_SHIP
    frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
    endAt: string;                // bounded; max 52 occurrences
  };
}

interface CreateAppointmentRes {
  success: true;
  data: {
    id: string;
    businessId: string;
    partyId: string;
    employeeId: string | null;
    startAt: string;
    endAt: string;                // app-computed startAt + duration; DB CHECK constraint enforces equality
    durationMinutes: number;
    status: 'SCHEDULED';
    source: CreateAppointmentReq['source'];
    notes: string | null;
    serviceLabel: string | null;
    jobTemplateId: string | null;
    recurrenceGroupId: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

// 409 on slot conflict
interface ConflictErr {
  success: false;
  error: {
    code: 'SLOT_CONFLICT';
    message: 'Slot already taken';
    conflictingAppointmentId?: string;   // only if same business
    nextFreeSlots?: string[];            // top 3 ISO timestamps
  };
}
```

### GET /api/v1/appointments?from=&to=&employeeId=

Returns `{ success: true, data: Appointment[] }`. `to - from <= 31 days`
enforced (400 `RANGE_TOO_WIDE` otherwise). Default sort `startAt ASC`.

### PATCH /api/v1/appointments/:id/status

```ts
interface StatusPatchReq {
  toStatus: 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
  reason?: string;       // required for CANCELLED + NO_SHOW
}
```

Validates state machine server-side. 409 `INVALID_TRANSITION` on bad edge.

### POST /api/v1/appointments/:id/convert

```ts
interface ConvertReq {
  target: 'JOB' | 'INVOICE';   // server enforces based on BusinessVertical
}
interface ConvertRes {
  success: true;
  data: { jobId?: string; invoiceId?: string };
}
```

Idempotent — second call returns the existing jobId/invoiceId.

### GET /api/v1/appointments/availability?employeeId=&date=

Returns busy ranges for one employee on one date (ISO date). Used by
slot picker.

**Cross-tenant guard (see MF4):** route MUST resolve `employeeId` via
`employee.businessId === req.user.businessId` before any further
query. Cross-tenant `employeeId` → 404 (NOT 403, NOT empty — see
Acceptance Criteria).

```ts
interface AvailabilityRes {
  success: true;
  data: {
    employeeId: string;
    date: string;
    busy: Array<{ startAt: string; endAt: string }>;
    workingHours: { startAt: string; endAt: string };
  };
}
```

### GET /api/v1/appointments/day-summary?date=&employeeId=

Aggregate for the 8am push: counts by status. Cached 60s. Same
cross-tenant guard as `/availability`: any `employeeId` in input
must be joined on `businessId === req.user.businessId` → 404 if not.

### Error envelope

`{ success: false, error: { code, message } }` — codes: `SLOT_CONFLICT`,
`INVALID_TRANSITION`, `PAST_SLOT`, `RANGE_TOO_WIDE`,
`PARTY_REQUIRED`, `EMPLOYEE_NOT_IN_BUSINESS`, `ALREADY_CONVERTED`,
`RECURRENCE_TOO_LONG`, `DURATION_OUT_OF_RANGE`,
`RATE_LIMITED`, `UNAUTHORIZED`.

## Data Model

**ASSUMPTION:** Additive migration only, following V1 precedent. No
column drops, no NOT-NULL adds without backfill. Migration ordering:
add tables → add enums → add indexes → add exclusion constraint
(MF1) → deploy → no data backfill needed (greenfield).

**Slot-conflict invariant (MF1) — see ARCHITECTURE §slot-conflict.**
PostgreSQL exclusion constraint using `btree_gist` extension and
`tstzrange(startAt, endAt)` overlap operator. `SELECT ... FOR UPDATE`
is NOT sufficient because two parallel INSERTs of new rows don't share
a row to lock — both transactions read zero overlap and both commit.
The exclusion constraint is the only race-safe primitive without
serialising the entire table. Constraint shape (exact DDL deferred to
ARCHITECTURE):

```sql
-- conceptual; ARCHITECTURE owns exact DDL + WHERE clause
EXCLUDE USING gist (
  employee_id WITH =,
  tstzrange(start_at, end_at) WITH &&
) WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'))
```

Migration prerequisites: `CREATE EXTENSION IF NOT EXISTS btree_gist;`
(safe, idempotent). Architect to confirm `employeeId` nullable + the
constraint's behaviour for the "any staff" case (likely a separate
constraint scoped to `WHERE employee_id IS NOT NULL`).

**`endAt` storage (SF1 — denormalize path chosen).** Application
layer writes `endAt = startAt + durationMinutes * interval` on every
create/update. A DB CHECK constraint enforces `endAt = startAt +
(durationMinutes || ' minutes')::interval` so app bugs cannot drift
the column. Prisma 5.x has no first-class generated-column syntax;
denormalize-with-CHECK is simpler than raw-SQL generated column and
avoids forking Prisma's introspection. Architect to confirm CHECK
constraint syntax in the migration.

**FK ondelete (MF2) — soft-delete + status-conditional restrict.**
Employee and Party rows use soft-delete (`deletedAt` timestamp).
Hard-delete is blocked by application logic, not FK, when any related
appointment is in an active status (`SCHEDULED | CONFIRMED |
CHECKED_IN`). When all related appointments are in terminal statuses
(`COMPLETED | NO_SHOW | CANCELLED`), the party/employee may be
soft-deleted; the appointment's FK is nullified (set to NULL) and the
historical name is preserved via a denormalized `employeeNameSnapshot
/ partyNameSnapshot` field on the appointment row. UI renders the
snapshot with a "(former)" badge. Architect owns the exact FK
`onDelete` choice (`SetNull` for terminal-status rows).

### Prisma additions

```prisma
enum AppointmentStatus {
  SCHEDULED
  CONFIRMED
  CHECKED_IN
  COMPLETED
  NO_SHOW
  CANCELLED
  PENDING_REVIEW   // SHOULD_SHIP — for public-link spam triage
}

enum AppointmentSource {
  WEB
  PHONE
  WALKIN
  IN_APP
}

enum RecurrenceFrequency {
  WEEKLY
  BIWEEKLY
  MONTHLY
}

model Appointment {
  id                  String   @id @default(cuid())
  businessId          String
  partyId             String?   // nullable to allow party soft-delete (MF2)
  partyNameSnapshot   String    // denormalized for "(former)" UI
  employeeId          String?
  employeeNameSnapshot String?  // denormalized for "(former)" UI
  startAt             DateTime
  durationMinutes     Int
  endAt               DateTime    // app-written; DB CHECK enforces equality with startAt + duration (SF1)
  status              AppointmentStatus @default(SCHEDULED)
  source              AppointmentSource
  serviceLabel        String?
  jobTemplateId       String?
  notes               String?     // MVP: plaintext; banner shown in clinic UI (MF5 + FUTURE_EPIC)
  recurrenceGroupId   String?
  convertedJobId      String?     @unique
  convertedInvoiceId  String?     @unique
  idempotencyKey      String?
  createdById         String
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  business   Business  @relation(...)
  party      Party?    @relation(...)   // SetNull when party soft-deleted with no active appointments (MF2)
  employee   Employee? @relation(...)   // SetNull when employee soft-deleted with no active appointments (MF2)
  recurrenceGroup AppointmentRecurrenceGroup? @relation(fields: [recurrenceGroupId], references: [id])

  @@index([businessId, startAt])
  @@index([businessId, employeeId, startAt])
  @@index([businessId, status, startAt])
  @@unique([businessId, idempotencyKey])
  // Exclusion constraint (MF1) added in raw SQL; not expressible in Prisma DSL.
}

model AppointmentRecurrenceGroup {
  id          String   @id @default(cuid())
  businessId  String
  frequency   RecurrenceFrequency
  startAt     DateTime
  endAt       DateTime
  createdAt   DateTime @default(now())

  appointments Appointment[]
  @@index([businessId])
}

model AppointmentStatusEvent {  // audit trail for state machine
  id            String   @id @default(cuid())
  appointmentId String
  fromStatus    AppointmentStatus?
  toStatus      AppointmentStatus
  reason        String?
  actorUserId   String
  createdAt     DateTime @default(now())

  appointment Appointment @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
  @@index([appointmentId, createdAt])
}

model AppointmentWaitlist {     // SHOULD_SHIP
  id          String   @id @default(cuid())
  businessId  String
  partyId     String
  employeeId  String?
  preferredDate DateTime
  notes       String?
  promotedAppointmentId String? @unique
  createdAt   DateTime @default(now())

  @@index([businessId, preferredDate])
}
```

### Ephemeral / hot table cleanup

| Table | Retention | Cleanup script | Frequency | Index |
|---|---|---|---|---|
| `Appointment` (CANCELLED, NO_SHOW) | 90 days hot → archive | `scripts/cron/archive-appointments.ts` | nightly 03:30 IST | `(businessId, status, startAt)` |
| `AppointmentStatusEvent` | follows parent (cascade) | n/a | n/a | parent FK |
| `AppointmentWaitlist` (preferredDate < today - 7d) | hard-delete | `scripts/cron/prune-waitlist.ts` | nightly 03:35 IST | `(businessId, preferredDate)` |

Clinic vertical archive retained 7 years per healthcare record norms;
salon vertical archive retained 2 years. Vertical detected from
`Business.vertical` at archive time.

### Existing-model touches

- `Job` — add nullable `appointmentId String?` + back-relation, index
  `(appointmentId)`. Additive only.
- `Invoice` — add nullable `appointmentId String?` + back-relation, index.
- `ReminderRule` — add new trigger enum value `APPOINTMENT_UPCOMING`.
  Additive enum value, safe.
- `BusinessFeature` — add `APPOINTMENTS_V2_RECURRING`,
  `APPOINTMENTS_V2_PUBLIC_BOOKING` flags (boolean columns or rows in
  feature table — **ASSUMPTION:** uses the existing row-based feature
  flag table; architect to confirm).
- `BusinessSettings` — add `publicBookingHmacSecret String?` (per-
  business HMAC key for SharedLink booking signatures; rotated by
  Settings → Public Links → "Reset booking link"). See MF3 / Security.

## Public Booking Link Signature (MF3)

Public booking endpoint authenticates the caller via HMAC-SHA256
signature over a canonical payload, NOT via session/cookie.

- **Algorithm:** HMAC-SHA256.
- **Secret:** Per-business `BusinessSettings.publicBookingHmacSecret`
  (32-byte random, generated server-side on first "Enable public
  booking" toggle). Rotated on Settings → Public Links → "Reset
  booking link" action — rotation invalidates every link previously
  issued for that business. Audit-logged.
- **Payload (conceptual; exact canonical encoding deferred to
  ARCHITECTURE §public-booking-signature):**
  ```
  { businessId, employeeId?, expiresAt }
  ```
  `employeeId` optional (omitted = "book any staff"). `expiresAt` is
  ISO-8601 UTC; tokens with `expiresAt < now()` are rejected with
  401.
- **Revocation:** Each issued link writes a `SharedLink` row with a
  `revokedAt` column (nullable). Server checks `revokedAt IS NULL`
  before honouring the signature. Owner-initiated rotation flips
  `revokedAt = now()` on all prior rows in addition to rotating the
  secret.
- **Reuse:** Matches #130 SharedLink HMAC discipline. The SharedLink
  table is the single source of truth for issued tokens; the public
  booking endpoint is one consumer.
- **Failure mode coverage:** Scenario 2 (abuse spike) — leaked links
  expire automatically and can be revoked en masse via secret
  rotation. Scenario 7 (insider abuse) — engineer-copied old links
  stop working after rotation.

## File Plan

| # | Path | Action | Est. Lines | Layer | Notes |
|---|---|---|---|---|---|
| 1 | `server/prisma/schema.prisma` | edit | +95 | schema | Additive: enums, Appointment, AppointmentRecurrenceGroup, AppointmentStatusEvent, AppointmentWaitlist, nullable FK on Job + Invoice, BusinessSettings.publicBookingHmacSecret |
| 2 | `server/prisma/migrations/<ts>_v2_appointments/migration.sql` | create | ~220 | migration | Tables + enums + indexes + nullable FK columns + `CREATE EXTENSION btree_gist` + exclusion constraint (MF1) + endAt CHECK constraint (SF1) |
| 3 | `server/src/features/appointments/appointment.types.ts` | create | ~80 | types | Domain types, status machine type, recurrence type |
| 4 | `server/src/features/appointments/appointment.constants.ts` | create | ~60 | constants | Status transition map, duration bounds, range cap (31d), recurrence cap (52), active-status set (for FK guard) |
| 5 | `server/src/features/appointments/appointment.schema.ts` | create | ~120 | schema | Zod `.strict()` for create/update/status/convert/availability/list |
| 6 | `server/src/features/appointments/appointment.utils.ts` | create | ~140 | utils | Pure: conflict check, state-machine validator, next-free-slot search, recurrence expansion, endAt computation |
| 7 | `server/src/features/appointments/appointment.repo.ts` | create | ~210 | transport | Prisma queries: list-by-range, find-conflicts (catches exclusion-constraint violation → 409), status-transition write+event, archive, cross-tenant employee resolve (MF4) |
| 8 | `server/src/features/appointments/appointment.service.ts` | create | ~230 | service | create / patch-status / convert / list / availability orchestration |
| 9 | `server/src/features/appointments/appointment-convert.service.ts` | create | ~180 | service | Job-or-Invoice branch by BusinessVertical, idempotent |
| 10 | `server/src/features/appointments/appointment-recurrence.service.ts` | create | ~150 | service | Recurrence expansion at create time, bounded |
| 11 | `server/src/features/appointments/appointment-waitlist.service.ts` | create | ~140 | service | Waitlist CRUD + manual promote (SHOULD_SHIP) |
| 12 | `server/src/features/appointments/appointment.routes.ts` | create | ~180 | route | Thin handlers; auth middleware; rate limits per route |
| 13 | `server/src/features/appointments/appointment-public.routes.ts` | create | ~180 | route | SharedLink HMAC-gated public booking endpoint (MF3, SHOULD_SHIP) |
| 14 | `server/src/features/appointments/public-booking-signature.ts` | create | ~100 | utils | HMAC-SHA256 sign/verify, canonical payload, expiry check (MF3) |
| 15 | `server/src/features/appointments/__tests__/appointment.service.test.ts` | create | ~230 | test | Conflict (exclusion constraint), state machine, convert idempotency, cross-tenant 404 (MF4) |
| 16 | `server/src/features/appointments/__tests__/appointment-recurrence.test.ts` | create | ~140 | test | Expansion bounds, edge dates |
| 17 | `server/src/features/appointments/__tests__/public-booking-signature.test.ts` | create | ~120 | test | HMAC verify, expiry, rotation-invalidates-old (MF3) |
| 18 | `server/src/features/reminders/reminder.constants.ts` | edit | +10 | constants | Add `APPOINTMENT_UPCOMING` trigger |
| 19 | `server/src/features/reminders/reminder-dispatch.ts` | edit | +40 | service | Wire APPOINTMENT_UPCOMING dispatcher (T-24h, T-2h) |
| 20 | `server/scripts/cron/archive-appointments.ts` | create | ~120 | script | Nightly archive of CANCELLED/NO_SHOW > 90d |
| 21 | `server/scripts/cron/prune-waitlist.ts` | create | ~60 | script | Nightly prune of waitlist rows with preferredDate < today-7d |
| 22 | `server/src/index.ts` | edit | +4 | route | Register new routers |
| 23 | `src/features/appointments/appointment.types.ts` | create | ~80 | types (FE) | Mirror of API types |
| 24 | `src/features/appointments/appointment.constants.ts` | create | ~70 | constants | Status labels, color tokens, slot grid (15-min) |
| 25 | `src/features/appointments/appointment.utils.ts` | create | ~150 | utils | Day-grid math, slot rendering, conflict UI hints |
| 26 | `src/features/appointments/appointment.service.ts` | create | ~140 | service | `api()` calls with entityType: 'appointment', entityLabel |
| 27 | `src/features/appointments/hooks/useAppointments.ts` | create | ~150 | hook | TanStack Query: list by range, invalidate on mutate |
| 28 | `src/features/appointments/hooks/useAvailability.ts` | create | ~120 | hook | Per-employee availability fetch, debounced |
| 29 | `src/features/appointments/hooks/useAppointmentMutations.ts` | create | ~200 | hook | create / patch-status / convert; tolerates `{}` offline return; surfaces replay-rejection toast + drawer (MF6) |
| 30 | `src/features/appointments/components/CalendarDayView.tsx` | create | ~200 | sub-component | Mobile primary; 320px no overflow; tabular-nums times |
| 31 | `src/features/appointments/components/CalendarWeekView.tsx` | create | ~220 | sub-component | Tablet+; 7-col grid; horizontal scroll only inside container |
| 32 | `src/features/appointments/components/AppointmentCard.tsx` | create | ~140 | sub-component | Status badge, party avatar, employee chip, "(former)" badge for soft-deleted refs |
| 33 | `src/features/appointments/components/CreateAppointmentDrawer.tsx` | create | ~230 | sub-component | `<Drawer>` primitive; party→service→employee→slot wizard |
| 34 | `src/features/appointments/components/SlotPicker.tsx` | create | ~200 | sub-component | 15-min grid, busy greyed, past disabled, keyboard nav |
| 35 | `src/features/appointments/components/StatusActionBar.tsx` | create | ~140 | sub-component | Buttons for valid next states only |
| 36 | `src/features/appointments/components/ConvertToBillSheet.tsx` | create | ~160 | sub-component | Branches Job vs Invoice based on vertical |
| 37 | `src/features/appointments/components/AppointmentEmptyState.tsx` | create | ~80 | sub-component | EmptyState wrapper, vertical-aware copy |
| 38 | `src/features/appointments/components/ClinicNotesBanner.tsx` | create | ~60 | sub-component | "Clinical notes are not encrypted at rest yet — do not store PHI" banner; clinic vertical only (MF5) |
| 39 | `src/features/appointments/pages/AppointmentsPage.tsx` | create | ~150 | page | Day/week toggle, FAB, 4 UI states |
| 40 | `src/features/appointments/pages/AppointmentDetailPage.tsx` | create | ~150 | page | Read view + status actions + notes + ClinicNotesBanner |
| 41 | `src/features/appointments/appointments.css` | create | ~200 | css | Grid, slot styles, dark mode parity via vars |
| 42 | `src/features/appointments/components/WaitlistSheet.tsx` | create | ~180 | sub-component | SHOULD_SHIP waitlist UI |
| 43 | `src/features/appointments/components/RecurrenceFields.tsx` | create | ~140 | sub-component | SHOULD_SHIP frequency + endAt |
| 44 | `src/lib/api-queue-replay.ts` | edit | +40 | lib | Surface failed-replay toast + open drawer for `appointment` entityType (MF6) |
| 45 | `src/routes.tsx` | edit | +6 | route | Register `/appointments` + `/appointments/:id` |
| 46 | `src/components/layout/BottomNav.tsx` | edit | +10 | nav | Conditional "Calendar" item for SALON + CLINIC verticals only |
| 47 | `src/lib/translations.en.ts` | edit | +85 | i18n | All new keys (incl. replay-rejection, clinic banner) |
| 48 | `src/lib/translations.hi.ts` | edit | +85 | i18n | All new keys (Hindi) |
| 49 | `src/features/appointments/__tests__/appointment.utils.test.ts` | create | ~160 | test | Slot math, conflict detection |
| 50 | `src/features/appointments/__tests__/CreateAppointmentDrawer.test.tsx` | create | ~180 | test | Drawer wizard, offline submit path |
| 51 | `src/features/appointments/__tests__/replay-rejection.test.tsx` | create | ~140 | test | Device-mode: offline PATCH → server-side conflict → toast + drawer open (MF6) |
| 52 | `docs/SCOPE_V2_APPOINTMENTS.md` | create | (this) | doc | This PRD |

Layer caps respected: every row ≤ 250 lines. Largest is #8 service at
230. If any row grows past 250 during build, split before commit.

## UI States (exact copy)

Every screen MUST render all four. Copy verified for EN + HI.

### `/appointments` (day view)

- **Loading:** `<ListSkeleton rows={6} />` with 60-min row heights pulsing
- **Error:** `<ErrorState message="Couldn't load appointments. Check your connection." onRetry />`
- **Empty:** `<EmptyState title="No appointments today" subtitle="Tap + to book your first one" action="Book appointment" />` — vertical-aware: salon shows scissors icon, clinic shows stethoscope
- **Success:** Day grid with 30-min slots; appointment cards in their time rows

### Slot picker

- **Loading:** Skeleton grid (6×4 cells pulsing)
- **Error:** `<ErrorState message="Couldn't load availability." onRetry />`
- **Empty (no free slots that day):** "No free slots on {date}. Next free: {nextDate} at {nextTime}." with a "Jump" button
- **Success:** Grid renders; busy slots greyed with cursor-not-allowed; selected slot highlighted

### Convert sheet

- **Loading:** `<Button loading>Creating…</Button>`
- **Error:** Toast `"Couldn't create {Job|Invoice}. Try again."`
- **Empty:** n/a
- **Success:** Toast `"{Job|Invoice} created · open?"` with link action

### Replay rejection (MF6)

- **Trigger:** Queued offline PATCH replays online and server returns 409 `INVALID_TRANSITION` (e.g. status was changed on another device).
- **Toast:** `"Couldn't update {party}'s appointment — status no longer valid"` with action `"Open"`.
- **Drawer:** Tapping "Open" (or the toast body) opens the appointment detail drawer with the server's current state freshly fetched, so the user can retry with full context.
- **Queue:** The failed mutation is dropped from the offline queue (not re-tried automatically); user retry is explicit.

### Clinic notes banner (MF5)

- **Where:** Top of `AppointmentDetailPage` when `Business.vertical === CLINIC` and the notes field is present.
- **Text:** `"Clinical notes are not encrypted at rest yet — do not store PHI"` (EN) / `"क्लिनिकल नोट्स अभी एन्क्रिप्टेड नहीं हैं — संवेदनशील स्वास्थ्य जानकारी न लिखें"` (HI).

### Autocomplete attributes

- Party search input: `autocomplete="off"` (custom party search, not browser)
- Notes textarea: `autocomplete="off"`
- Recurrence end date: `autocomplete="off"` (custom date picker)
- Public booking link — patient name: `autocomplete="name"`
- Public booking link — phone: `autocomplete="tel"`

## Mobile

- 375px primary layout: day view default; week view button collapses
  to icon
- 320px tested: appointment card name truncates to 12 chars +
  ellipsis; time stays full
- Capacitor specifics:
  - Drawer uses existing `<Drawer>` primitive (already handles
    `--safe-area-inset-bottom`)
  - Calendar grid container uses `overscroll-behavior: contain` so
    vertical scroll inside the day doesn't bubble to body
  - Date picker uses native `<input type="date">` (Android picker is
    fine for our 8K-phone audience; iOS later) **ASSUMPTION**
  - SMS/WA reminder cap shown via Capacitor LocalNotifications
    fallback when reminder gateway is rate-limited
  - No camera / share intents needed for V2
- Offline: create + status changes queue via `api()` mutation queue;
  day view falls back to last cached range (cacheReads opt-in on
  `/appointments` list — PII-safe because list scope is owner's own
  business). Rejected PATCH replays trigger the conflict toast +
  drawer reopen flow (MF6).

## UX Copy

- FAB label: `Book` (EN) / `बुक करें` (HI)
- Create-drawer header: `New appointment` / `नई अपॉइंटमेंट`
- Submit button (online): `Book appointment`
- Submit button (offline): `Book — will sync`
- Loading text: `Booking…` / `बुक हो रही है…`
- Success toast (online): `Booked — {party} at {time} with {employee}`
- Success toast (offline): `Saved — will sync when online`
- Error toast (slot conflict): `That slot was just taken. Pick another.`
- Replay-rejection toast (MF6): `Couldn't update {party}'s appointment — status no longer valid` · action `Open`
- Confirm cancel: `Cancel appointment? The customer will be notified if reminders are on.`  → buttons: `Keep · Cancel appointment`
- Confirm no-show: `Mark as no-show? This can't be billed later.` → `Keep · Mark no-show`
- Convert success: `Job #{n} created · Open` / `Invoice #{n} created · Open`
- Clinic notes banner: `Clinical notes are not encrypted at rest yet — do not store PHI`

## Edge Cases

| Scenario | Handling |
|---|---|
| Two devices book same slot at the same moment | PostgreSQL exclusion constraint (`btree_gist`, `tstzrange` overlap) on `Appointment(employeeId, [startAt, endAt))` rejects the loser at commit time → repo catches the constraint-violation error and returns 409 `SLOT_CONFLICT`. `SELECT ... FOR UPDATE` is intentionally NOT used (insufficient — see Data Model MF1 note). |
| Owner books with `employeeId=null` | Treated as "any staff"; conflict check skipped (constraint scoped to `WHERE employee_id IS NOT NULL`); appointment shown in "Unassigned" lane |
| Employee soft-deleted with FUTURE appointments | Blocked at application layer: "{employee} still has {N} upcoming appointments. Reassign or cancel them first." Reassign-or-cancel prompt. FK is NOT `Restrict` — restriction lives in the app guard, not the FK (MF2). |
| Employee soft-deleted with only TERMINAL appointments | Allowed. `employee.deletedAt` set; appointment FK nullified via `SetNull`; `employeeNameSnapshot` preserves the historical name; UI renders "(former)" badge. |
| Party soft-deleted with FUTURE appointments | Same pattern as employee. App guard blocks; owner reassigns or cancels first. |
| Party soft-deleted with only TERMINAL appointments | Allowed; same snapshot pattern. |
| Crossing DST / IST→other (rare for India) | All times stored UTC; UI renders in `Asia/Kolkata`; no DST in India so safe |
| Appointment crosses midnight | Allowed; rendered split across day boundary in week view; day view shows on start day with end-time annotation |
| Recurrence end > 52 occurrences | API 400 `RECURRENCE_TOO_LONG`; FE blocks at 52 in picker |
| Convert COMPLETED twice | Idempotent: returns existing jobId/invoiceId |
| Convert non-COMPLETED | 409 `INVALID_TRANSITION` |
| Public link spam | Per-link rate limit + per-business soft cap (above) |
| Public link signature invalid / expired / revoked | 401 `UNAUTHORIZED`. Owner sees "Reset booking link" CTA in Settings → Public Links. |
| Appointment in the past for backfill | Allowed only when `source: WALKIN` or `IN_APP` (owner backfilling); WEB/PHONE → 400 `PAST_SLOT` |
| Vertical changed mid-business-life | New vertical's convert target wins; old appointments retain backref to whatever they converted to |
| Owner edits notes after COMPLETED | Allowed; logged in `AppointmentStatusEvent` with toStatus = current, reason = "notes edited" |
| Offline PATCH replays against changed server state | Replay rejected with 409; FE shows toast `"Couldn't update {party}'s appointment — status no longer valid"` + opens drawer with server's current state; user can retry (MF6) |
| Cross-tenant `employeeId` in `/availability` or `/day-summary` | 404 (NOT 403, NOT empty). Route resolves `employeeId` via `employee.businessId === req.user.businessId` JOIN before any further query (MF4). |

## Security

- Auth: required on all routes except `/appointments/public/:linkToken`
  (SHOULD_SHIP) which uses SharedLink HMAC-SHA256 token validation
  (see MF3 Public Booking Link Signature section above)
- Role: owner + employee (employee scoped to their own
  appointments + business-wide read for receptionists — flag
  `Employee.role`)
- **Cross-tenant scoping invariant (MF4):** Every route that accepts
  an `employeeId` (or any other resource ID) from request input MUST
  resolve it via a JOIN/WHERE on `req.user.businessId` BEFORE any
  further query. Mismatch → 404 (not 403, not 200, not empty array).
  This is an architectural invariant, not a per-route detail. Audit
  enforces this in the Acceptance Criteria + QA Checklist.
- Rate limits:
  - Authenticated create: 60/min/business (primitive) + 1000/day
    (policy)
  - Public link create: 10/min/link (primitive) + 200/day/business
    (policy, above which → PENDING_REVIEW)
  - Availability GET: 120/min/user
  - hCaptcha on public link after 3 failed slot attempts per
    IP-link pair within 10 min
- Lockout policy:
  - Public link: 3 failed captchas in 1 hour → link soft-disabled
    for 1 hour; owner gets push
  - Auth: existing global lockout policy applies
- IDOR scope: every query joins on `businessId` from
  `req.user.businessId` (NEVER from client body); enforced by
  middleware + tested in audit
- CSRF: existing `csrf` middleware on all non-GET routes; public
  endpoint exempt but HMAC-signature-checked via SharedLink token (MF3)
- Audit log writes:
  - Every status transition → `AppointmentStatusEvent`
  - Every clinic-vertical notes read → `audit_log` (written at API
    boundary, regardless of storage encryption)
  - Every convert → existing billing audit log
  - Every public-booking-link rotation → `audit_log`
- Notes storage (MF5): MVP plaintext + in-UI banner discouraging PHI.
  Encryption-at-rest deferred to FUTURE_EPIC (envelope encryption
  with per-business DEK, KEK in env, decrypt audit pipeline) — see
  Out of Scope. Rationale: pgcrypto-with-no-decrypt-grant is incorrect
  (functions are SQL-callable; key control is the actual gate), and
  proper envelope encryption requires KEK rotation + audit pipeline
  that we don't have hardened yet. Shipping plaintext + banner is
  honest; shipping fake encryption is worse.

## Observability

### Analytics events (≤7)

| Event | Properties |
|---|---|
| `appointment_created` | `{ source, vertical, hasEmployee, hasRecurrence, durationMinutes }` |
| `appointment_status_changed` | `{ fromStatus, toStatus, vertical, hadReason }` |
| `appointment_converted` | `{ target: 'JOB'|'INVOICE', vertical, msSinceCheckIn }` |
| `appointment_slot_conflict` | `{ source, attemptCount }` |
| `appointment_calendar_viewed` | `{ view: 'day'|'week', vertical }` |
| `appointment_public_booking_completed` | `{ business_vertical, slotsShown }` |
| `appointment_reminder_sent` | `{ channel: 'SMS'|'WA', leadHours }` |

### Sentry alerts

- 409 SLOT_CONFLICT rate > 2% of creates / 5min → warn
- Convert failure rate > 1% / 5min → page
- Availability latency p95 > 500ms / 5min → warn
- Archive cron failure → page
- `appointment_replay_rejected` event volume spike (>10/min sustained) → warn (MF6 — implies users on flaky 2G are losing PATCH updates)

### Sentry events (non-alerting)

- `appointment_replay_rejected` — `{ appointmentId, attemptedStatus, currentStatus }` — fired client-side on every offline-PATCH rejection so we can measure how often the conflict happens in the wild (MF6)

### Metrics + dashboards

- `appointments.created.total{vertical,source}` counter
- `appointments.active.gauge{businessId}` (SCHEDULED+CONFIRMED+CHECKED_IN)
- `appointments.conversion.success.total{target}` counter
- `appointments.availability.duration_ms{p50,p95,p99}` histogram
- Grafana dashboard `appointments-v2` with conversion funnel
  (created → confirmed → checked_in → completed → converted)

### Cost alerts

- Reminders cost: alert at 1.5× 30-day rolling baseline per business
- Public-booking spend (captcha + SMS verify): alert at $X/day
  total (TBD with finance) **ASSUMPTION:** $50/day soft cap

## Test Infrastructure

- **Reserved test phone numbers:** `+91 9000000001` … `+91 9000000099`
  bypass real SMS/WA send (existing convention from V5). Test
  appointments created with these parties skip outbound dispatch but
  still write the `ReminderDispatch` row.
- **Sandbox WA template:** `appointment_reminder_test_v1` registered
  in Meta sandbox account; routed via `WA_GATEWAY=sandbox` env in
  CI.
- **Test business with SALON + CLINIC verticals:** Seed script
  `server/scripts/seed-appointments-test.ts` creates 1 business per
  vertical, 2 employees each, 50 mixed-status appointments. Used by
  E2E.
- **Time-freezing:** Jest fake timers + `MockDate` for slot math
  tests; Playwright uses `page.clock.install()` for the calendar
  E2E.
- **Cross-tenant fixture (MF4):** Seed creates `Business A` + `Business
  B`, each with one employee. E2E test signs in as A, hits
  `/availability?employeeId=<B.employee.id>` → expects 404.
- **Replay-rejection fixture (MF6):** E2E test uses two-device-mode
  Playwright: device 1 goes offline, queues `CHECKED_IN`; device 2
  online flips the same appointment to `COMPLETED`; device 1 reconnects;
  asserts toast + drawer open with current state.
- **CI test account isolation:** All test businesses share
  `cleanup_tag: 'ci-appointments-v2'`; nightly script wipes them.

## Accepted Trade-offs

- **No multi-resource booking.** Salon owners with a "chair" resource
  must over-load `employeeId` (one employee per chair). Justified:
  multi-resource is FUTURE_EPIC complexity (combinatorial availability
  search); 80% of MVP users have 1-3 staff and no chair contention.
- **Recurrence expanded eagerly, not lazy.** Max 52 rows per
  recurrence. Simpler queries, simpler edits ("edit this one" vs
  "edit series" is just a row vs row-group operation). Cost: more
  rows in DB; mitigated by archive policy.
- **`employeeId` nullable ("any staff").** Adds a code path but
  matches a real Indian SMB workflow ("walk in, whoever's free
  takes them"). Without it, owners would create a dummy "Any"
  employee — worse.
- **Day view default on mobile, not "agenda list".** Calendar feels
  more like a calendar. Agenda list is a NICE_TO_HAVE toggle.
- **No two-way Google/Apple sync.** FUTURE_EPIC. Reason: OAuth
  scope + sync conflict resolution is its own 2-week epic.
- **No drag-to-reschedule on mobile.** Hit targets too small at
  320px. Desktop-only NICE_TO_HAVE.
- **No online payment at booking.** FUTURE_EPIC. Reason: Razorpay
  hold-then-capture flow adds 5+ days; book-then-pay-on-arrival is
  the Indian SMB norm.
- **Clinic notes plaintext at rest in MVP (MF5).** Banner discourages
  PHI. Envelope encryption deferred to FUTURE_EPIC because it requires
  KEK rotation + decrypt audit pipeline that aren't hardened yet.
  Shipping honest plaintext + banner beats shipping fake encryption.
- **`endAt` denormalized + CHECK constraint, not generated column (SF1).**
  Prisma 5.x has no first-class generated-column syntax. App-layer
  computation + DB CHECK is simpler than raw-SQL generated column and
  avoids forking Prisma introspection.

## Resolved Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Time storage | UTC in DB, IST in UI | Standard; no DST in India |
| Slot granularity | 15 min | Matches salon/clinic norm; smaller adds noise |
| Duration bounds | 5–480 min | Covers haircut to half-day procedure |
| Calendar range cap | 31 days per query | Prevents accidental full-history fetch |
| Slot-conflict primitive (MF1) | PostgreSQL exclusion constraint (`btree_gist` + `tstzrange` overlap) | `SELECT FOR UPDATE` insufficient for parallel INSERTs of new rows — both transactions see zero overlap and both commit. Exclusion constraint is the only race-safe primitive without full-table serialization. |
| `endAt` storage (SF1) | App-write + DB CHECK constraint | Prisma has no generated-column DSL; CHECK enforces equality without raw-SQL fork |
| Employee/Party FK on soft-delete (MF2) | Status-conditional app guard; `SetNull` on FK when only terminal-status appointments remain | `Restrict`-everywhere makes employee offboarding impossible after any historical row. Soft-delete + snapshot preserves audit while allowing churn. |
| Convert target | Branch by `BusinessVertical` server-side | Single endpoint; FE doesn't need to know |
| Recurrence model | Eager expansion, max 52 | See trade-offs |
| Public booking auth (MF3) | HMAC-SHA256 over `{businessId, employeeId?, expiresAt}`, per-business secret, SharedLink row with `revokedAt`, owner-initiated rotation | Reuses #130 SharedLink HMAC discipline; revocation by row + secret rotation gives belt-and-suspenders |
| Status enum extensibility | FE tolerates unknown values | Future enum adds don't break old clients |
| Clinic notes encryption (MF5) | DEFER (plaintext + UI banner in MVP; envelope encryption is FUTURE_EPIC) | pgcrypto-with-no-decrypt-grant is incorrect; proper envelope encryption needs KEK rotation + audit pipeline we don't have hardened |
| Index strategy | `(businessId, startAt)` + status partial | Hot path < 30ms at 100M rows |
| Reminder lead times | T-24h + T-2h | Industry norm; reuses V5 |
| Offline PATCH replay rejection (MF6) | FE surfaces toast + reopens drawer with server state; failed mutation dropped from queue; Sentry event fired | Linear/Notion pattern; silent failure is the wrong default for a receptionist-on-2G persona |
| Cross-tenant scoping (MF4) | Every `employeeId` from input MUST resolve via `employee.businessId === req.user.businessId` JOIN; mismatch → 404 | Architectural invariant, not per-route detail. Matches `feedback_auth_req_user_shape.md` blindspot. |

## Out of Scope

- Multi-resource (room + chair + therapist) booking — `[FUTURE_EPIC]`
- Online payment at booking time — `[FUTURE_EPIC]`
- Google / Apple calendar two-way sync — `[FUTURE_EPIC]`
- Group / class appointments — `[FUTURE_EPIC]`
- Patient EMR / clinical notes structured fields — `[FUTURE_EPIC]`
- Clinic-notes encryption at rest (envelope encryption: per-business
  DEK, KEK in env, decrypt audit pipeline) — `[FUTURE_EPIC]` (MF5)
- Staff scheduling / shifts / payroll integration — covered by Phase 6
- Inventory deduction on service complete — `[FUTURE_EPIC]`
- Tax/GST on appointment — out of MVP per project rules
- iOS Capacitor build polish — when iOS is added separately
- Print-friendly day sheet — `[NICE_TO_HAVE]`

## Acceptance Criteria

### Backend

- [ ] `npx tsc -b --noEmit` clean
- [ ] `curl -X POST /api/v1/appointments` with valid body + auth → `{ success: true, data: { id, status: 'SCHEDULED', ... } }`
- [ ] Same `curl` without auth → 401
- [ ] Same `curl` with bad body (missing `partyId`) → 400 with `code: 'PARTY_REQUIRED'`
- [ ] Two concurrent POSTs for same `(employeeId, startAt)` → exactly one 201, one 409 `SLOT_CONFLICT` (verified against the exclusion constraint, not `FOR UPDATE`) (MF1)
- [ ] PATCH status SCHEDULED → COMPLETED (skipping CHECKED_IN) → 409 `INVALID_TRANSITION`
- [ ] POST convert on non-COMPLETED → 409
- [ ] POST convert twice on COMPLETED → 200 both times, same `jobId`/`invoiceId`
- [ ] GET list with `to - from > 31d` → 400 `RANGE_TOO_WIDE`
- [ ] Cross-business read attempt on POST/PATCH (manipulate `businessId` via token swap) → 404, not 200
- [ ] **Cross-tenant `/availability?employeeId=<other-tenant-employee-id>` → 404 (NOT 403, NOT empty array)** (MF4)
- [ ] **Cross-tenant `/day-summary?employeeId=<other-tenant>` → 404** (MF4)
- [ ] Public POST without valid HMAC signature → 401 (MF3)
- [ ] Public POST with HMAC signature past `expiresAt` → 401 (MF3)
- [ ] Public POST against revoked `SharedLink` row (`revokedAt IS NOT NULL`) → 401 (MF3)
- [ ] After "Reset booking link" rotation, previously-issued HMAC token → 401 (MF3)
- [ ] Recurrence with 53 occurrences → 400 `RECURRENCE_TOO_LONG`
- [ ] Employee soft-delete with ACTIVE appointment (SCHEDULED/CONFIRMED/CHECKED_IN) → blocked at app layer with "reassign first" error (MF2)
- [ ] Employee soft-delete with only TERMINAL appointments (COMPLETED/NO_SHOW/CANCELLED) → succeeds; appointment FK nulled; `employeeNameSnapshot` preserved (MF2)
- [ ] Party soft-delete equivalents to above (MF2)
- [ ] `endAt = startAt + durationMinutes * interval` CHECK constraint rejects mismatched writes (SF1)

### Frontend

- [ ] Screenshot: loading at 375px
- [ ] Screenshot: error at 375px
- [ ] Screenshot: empty at 375px
- [ ] Screenshot: success at 375px
- [ ] Day view at 320px — no horizontal scroll
- [ ] Week view at 1024px — 7 columns visible, no overflow
- [ ] Create drawer at 320px — submit button still tappable (≥44px)
- [ ] Dark mode parity — all 4 states verified light + dark
- [ ] Offline create — queues, success toast `"Saved — will sync when online"`, row appears with pending pill
- [ ] Going back online — queued create lands, pill disappears
- [ ] **Device-mode replay rejection (MF6):** device A goes offline, sets status to CHECKED_IN; device B (online) changes the same appointment to COMPLETED; device A reconnects; queued PATCH fails server-side → toast appears (`"Couldn't update {party}'s appointment — status no longer valid"`); drawer opens with server's current state (COMPLETED); Sentry event `appointment_replay_rejected` fired
- [ ] Clinic vertical detail page shows the plaintext-notes banner (MF5)
- [ ] Soft-deleted employee renders with "(former)" badge on historical appointments (MF2)
- [ ] EN + HI translations present for every visible string (no missing-key warnings in console)
- [ ] `node scripts/enforce.js` — 0 errors
- [ ] `node scripts/enforce-offline.mjs` — no new violations
- [ ] Every `api()` mutation passes `entityType: 'appointment'` + `entityLabel`

## QA Checklist (Verifier)

- [ ] PAGE_AUDIT_CHECKLIST A→N passes on `/appointments` and `/appointments/:id`
- [ ] All buttons use `<Button>`, all inputs `<Input>`, no `window.confirm`, no `alert()`
- [ ] All amounts (none in V2 directly, but in convert target) flow as paise Int
- [ ] All API calls via `api()`; mutations carry `entityType` + `entityLabel`
- [ ] All money/time columns use `tabular-nums`
- [ ] All translations land in both `translations.en.ts` and `translations.hi.ts`
- [ ] Status state machine matrix tested for every edge
- [ ] State machine writes `AppointmentStatusEvent` for every transition
- [ ] Slot conflict 409 reproduced in test with two parallel POSTs (exclusion-constraint path, not FOR UPDATE) (MF1)
- [ ] Convert idempotency verified (run twice, same row, no duplicate Job/Invoice)
- [ ] **Cross-tenant 404 verified via curl (MF4):**
  - `curl -H "Authorization: Bearer <tenant-A>" "/api/v1/appointments/availability?employeeId=<tenant-B-employee>&date=2026-06-01"` → 404
  - `curl -H "Authorization: Bearer <tenant-A>" "/api/v1/appointments/day-summary?employeeId=<tenant-B-employee>&date=2026-06-01"` → 404
- [ ] Clinic vertical notes plaintext banner visible (MF5); no fake-encryption claim anywhere in UI
- [ ] Public booking link HMAC verify + revocation + rotation tested (MF3)
- [ ] Archive cron runs in CI against seed data and moves > 90d CANCELLED rows
- [ ] BottomNav shows "Calendar" only for SALON + CLINIC verticals; hidden for others
- [ ] Reminder T-24h + T-2h dispatched for SCHEDULED + CONFIRMED only (not CANCELLED)
- [ ] Offline PATCH replay-rejection device-mode test passes (MF6)
- [ ] Employee/Party soft-delete status-conditional guard tested for all 6 status values (MF2)

## ASSUMPTIONS (flagged for product review)

1. Slot granularity = 15 min. Override if salon norm is 30.
2. Range cap = 31 days per list query. Override if a 90-day "month-on-month" view is needed.
3. Duration bounds 5–480 min. Override for procedures > 8h (likely none in MVP).
4. Recurrence eager expand, cap 52 occurrences. Override if "indefinite" recurrence is required (then we need lazy).
5. Salon archive 2y, clinic 7y. Override per legal counsel.
6. Reminder lead times T-24h + T-2h. Override if SMBs prefer T-12h + T-1h.
7. `employeeId` nullable ("any staff"). Override to required if every appointment must have a named staff.
8. Public booking lands `SCHEDULED` by default with optional CONFIRMED gating; soft cap above 200/day → PENDING_REVIEW. Override caps.
9. Clinic notes plaintext at rest in MVP with UI banner. Override only if KEK rotation + decrypt audit pipeline can be hardened inside V2 window (otherwise fake encryption is worse than honest plaintext).
10. Convert target by vertical: SERVICES → Job, CLINIC → Invoice. Override mapping if salon should bill direct Invoice too.
11. iOS deferred to a future build (Android-first per project rules). Date pickers use native input.
12. Capacitor LocalNotifications used as reminder fallback when WA/SMS rate-limited.
13. `BusinessFeature` uses existing row-based flag table — architect to confirm structural fit.
14. No structured "service catalog" model in V2 — reuses `JobTemplate` if present, else free-text `serviceLabel`. A real `Service` model is a separate epic.
15. Waitlist promote is manual (MVP). Auto-promote on cancellation is NICE_TO_HAVE.
16. `BusinessSettings.publicBookingHmacSecret` is a new nullable column; populated lazily on first "Enable public booking" toggle. Architect to confirm column location.

## Revision Log

- 2026-05-30 — Initial draft. No scope-auditor pass yet.
- 2026-05-30 — Revision pass after `docs/SCOPE_AUDIT_V2_APPOINTMENTS.md` (verdict: REVISE). Closures:
  - **MF1 (slot-conflict race).** Replaced `SELECT ... FOR UPDATE` model with PostgreSQL exclusion constraint (`btree_gist` extension + `EXCLUDE USING gist (employeeId WITH =, tstzrange(startAt, endAt) WITH &&)`) in Data Model, Edge Cases, Resolved Decisions, and Acceptance Criteria. Exact DDL deferred to ARCHITECTURE §slot-conflict. Noted explicitly why FOR UPDATE is insufficient (parallel INSERTs of new rows don't share a row to lock).
  - **MF2 (Employee/Party FK ondelete).** Changed from `Restrict` to soft-delete + status-conditional application-layer guard. FK becomes `SetNull` for terminal-status appointments; active-status (SCHEDULED/CONFIRMED/CHECKED_IN) appointments block soft-delete via app guard. Added `partyNameSnapshot` + `employeeNameSnapshot` denormalized fields for "(former)" badge UI. Acceptance criteria + edge cases updated.
  - **MF3 (SharedLink public booking signature).** Specified HMAC-SHA256 over `{businessId, employeeId?, expiresAt}` payload, per-business `BusinessSettings.publicBookingHmacSecret`, rotation via Settings → Public Links → "Reset booking link", `SharedLink.revokedAt` revocation column. Added Public Booking Link Signature section. Exact canonical encoding deferred to ARCHITECTURE §public-booking-signature. New file `public-booking-signature.ts` (#14) + test file (#17) added to File Plan.
  - **MF4 (cross-tenant availability leak).** Added explicit acceptance criteria: `/availability` and `/day-summary` with cross-tenant `employeeId` MUST return 404 (not 403, not empty). Added curl tests to QA Checklist. Promoted cross-tenant scoping to an architectural invariant in §Security. Updated `/availability` and `/day-summary` API Contract sections with the JOIN requirement.
  - **MF5 (clinic-notes encryption).** Chose DEFER path. Removed the incorrect "pgcrypto with no decrypt grant" model. MVP ships plaintext notes with an in-UI banner ("Clinical notes are not encrypted at rest yet — do not store PHI") for clinic vertical only. Envelope encryption (per-business DEK + KEK in env + decrypt audit pipeline) moved to FUTURE_EPIC under Goals + Out of Scope. New `ClinicNotesBanner.tsx` (#38) added to File Plan. Rationale documented in Resolved Decisions + Accepted Trade-offs.
  - **MF6 (offline status-PATCH replay rejection UX).** Added required FE behavior: `useApiQueue` / `useAppointmentMutations` surfaces failed-replay toast `"Couldn't update {party}'s appointment — status no longer valid"` + opens appointment drawer with server's current state. Added Sentry event `appointment_replay_rejected` with `{appointmentId, attemptedStatus, currentStatus}` + alert on volume spike. Added device-mode test acceptance criterion. New file `api-queue-replay.ts` edit (#44) + test file (#51) added to File Plan. New replay-rejection UI state added to UI States section.
  - **SF1 (endAt generated stored column).** Chose denormalize path. App-layer writes `endAt = startAt + durationMinutes * interval`; DB CHECK constraint enforces equality. Rationale: Prisma 5.x has no first-class generated-column syntax; denormalize + CHECK avoids raw-SQL fork. Migration prerequisite + acceptance criterion added.
  - **Precedent link fix.** Replaced broken `docs/SCOPE_VERTICAL_V1_HOURLY.md` citation with the actual artifact `docs/EPIC_vertical-v1-hourly-billing/architecture-critique.md`, and noted that V1 shipped using EPIC_ directory layout (no SCOPE_VERTICAL_V1_HOURLY.md was produced).
  - SHOULD_FIX items SF2-SF7 NOT addressed in this revision pass (deferred per audit guidance — only MF1-MF6 + SF1 are blockers). Will be addressed in follow-up if scope-auditor flags them as MUST_FIX on re-run.
