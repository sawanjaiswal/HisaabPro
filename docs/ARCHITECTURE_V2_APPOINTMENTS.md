# ARCHITECTURE — V2 Appointments Calendar (Salon + Clinic)

> Status: REV 2 — absorbed SCOPE rev-2 deltas per `ARCHITECTURE_AUDIT_V2_APPOINTMENTS.md`
> Created: 2026-05-30 (rev 2: 2026-05-30)
> Author: architect
> Input SCOPE: `docs/SCOPE_V2_APPOINTMENTS.md` (rev 2, scope-auditor PASS)
> Precedent: V1 hourly billing (shipped 2026-05-29), Phase 6 Employee model, #150 optimistic locking, #130 SharedLink
> Stack: React 19 + TS + Tailwind 4 + Capacitor 8, Express + Prisma + PostgreSQL
> Tier: HIGH · Effort: ~2 weeks · Rollout: flag `FEATURE_APPOINTMENTS_V2`

---

## 1. Module Map

Packages touched (additive-only — no breaking change to V1 surface):

| Package / area | Touched | Why |
|---|---|---|
| `server/prisma/schema.prisma` | edit | New tables, enums, nullable FKs on `Job` + `Invoice` |
| `server/prisma/migrations/<ts>_v2_appointments/` | create | Single additive migration (table + enum + index + nullable FK + `btree_gist` exclusion constraint) |
| `server/src/features/appointments/` | create | New feature module: types, constants, schema (Zod), utils, repo, service, routes |
| `server/src/features/appointments/public.routes.ts` | create | Public booking surface gated by SharedLink token (#130 reuse) |
| `server/src/features/reminders/` | edit | Add `APPOINTMENT_UPCOMING` trigger to existing V5 cron + dispatcher |
| `server/src/features/jobs/job.service.ts` | edit | `createFromAppointment(appointmentId)` constructor reuse |
| `server/src/features/invoices/invoice.service.ts` | edit | `createFromAppointment(appointmentId)` constructor reuse |
| `server/src/features/parties/party.service.ts` | edit | App-layer guard on soft-delete: block if active appointments exist |
| `server/src/features/employees/employee.service.ts` | edit | App-layer guard on soft-delete: block if active appointments exist |
| `server/src/middleware/business-scope.ts` | edit (audit) | Ensure all new routes joined-on `req.user.businessId` |
| `server/src/lib/log-redact.ts` | edit | Add `notes` to PII redaction list (clinic banner accompanies) |
| `server/scripts/cron/archive-appointments.ts` | create | Nightly archive of CANCELLED / NO_SHOW > 90d |
| `server/scripts/cron/prune-waitlist.ts` | create | Nightly waitlist prune |
| `shared/enums.ts` (or `src/lib/api-types.ts` mirror) | edit | Expose `AppointmentStatus`, `AppointmentSource`, `RecurrenceFrequency` to FE |
| `src/features/appointments/` | create | 6-layer FE split (types → constants → utils → hooks → components → page) |
| `src/lib/api-queue-replay.ts` | edit | 409 replay handler emits Sentry `appointment_replay_rejected` + reopens detail drawer |
| `src/routes.tsx` | edit | Register `/appointments` and `/appointments/:id` |
| `src/components/layout/BottomNav.tsx` | edit | Conditional "Calendar" item for SALON + CLINIC verticals (under flag) |
| `src/lib/translations.en.ts` / `translations.hi.ts` | edit | All new keys |
| `src/config/features.ts` (server + FE) | edit | `FEATURE_APPOINTMENTS_V2` flag |
| `docs/SCOPE_V2_APPOINTMENTS.md` | exists | input |
| `docs/ARCHITECTURE_V2_APPOINTMENTS.md` | create | this doc |

Reuse (no new code, just integration):

- `<Drawer>`, `<EmptyState>`, `<Skeleton>`, `<ListSkeleton>`, `<ErrorState>`, `<Button>`, `<Input>`, `<Select>`, `<Textarea>`, `<ConfirmDialog>`, `<Badge>`, `<PartyAvatar>` — all from existing UI primitives
- `<PartySearch>` from V1
- `api()` from `src/lib/api.ts` (offline queue + idempotency)
- V5 `ReminderRule` cron + dispatcher (Postgres + node-cron, exponential backoff)
- #130 SharedLink HMAC + 60 rpm/IP rate limiter
- #150 `bumpVersionOrConflict`-style atomic-conditional pattern for status transitions and convert

---

## 2. Data Model — Prisma additions

All additive. NO existing column drops, NO NOT-NULL adds on existing tables.
Two nullable back-refs are added to existing tables (`Job.appointmentId`,
`Invoice.appointmentId`) — both nullable so existing rows are valid as-is.
Two new nullable columns added to existing settings/sharedlink tables for
public-booking signature SSOT (§10.1.1).

### 2.1 Enums (new)

```prisma
enum AppointmentStatus {
  SCHEDULED
  CONFIRMED
  CHECKED_IN
  COMPLETED
  NO_SHOW
  CANCELLED
  PENDING_REVIEW   // SHOULD_SHIP — public-link spam triage bucket
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
```

`ReminderRuleTrigger` (existing enum) **gains** one value:
`APPOINTMENT_UPCOMING`. Prisma treats added enum values as
additive-safe (no rewrite of old rows).

### 2.2 `Appointment`

```prisma
model Appointment {
  id                   String   @id @default(cuid())
  businessId           String
  partyId              String?              // nullable — SetNull on party soft-delete in TERMINAL status
  partyNameSnapshot    String               // denorm — renders "(former) Rahul" when partyId IS NULL
  employeeId           String?              // null = "any staff" OR employee soft-deleted in terminal status
  employeeNameSnapshot String               // denorm — renders "(former) Sita" when employeeId IS NULL
  startAt              DateTime             // UTC
  durationMinutes      Int                  // 5..480
  endAt                DateTime             // app-computed = startAt + duration; written by service layer
  status               AppointmentStatus    @default(SCHEDULED)
  source               AppointmentSource
  serviceLabel         String?
  jobTemplateId        String?
  notes                String?              // MVP plaintext; encryption deferred to FUTURE_EPIC per SCOPE MF5
  recurrenceGroupId    String?
  convertedJobId       String?   @unique
  convertedInvoiceId   String?   @unique
  idempotencyKey       String?
  version              Int       @default(0) // optimistic-lock cursor (status transitions + convert)
  createdById          String
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  business        Business                    @relation(fields: [businessId], references: [id], onDelete: Restrict)
  party           Party?                      @relation(fields: [partyId],    references: [id], onDelete: SetNull)
  employee        Employee?                   @relation(fields: [employeeId], references: [id], onDelete: SetNull)
  recurrenceGroup AppointmentRecurrenceGroup? @relation(fields: [recurrenceGroupId], references: [id])
  statusEvents    AppointmentStatusEvent[]

  // Hot path: day/week list by business & range
  @@index([businessId, startAt])
  // Slot-conflict / per-employee availability (kept as a covering b-tree;
  // the EXCLUSION constraint owns correctness — see §3.2)
  @@index([businessId, employeeId, startAt])
  // Party detail page reverse lookup
  @@index([partyId, startAt])
  // Status-bucket scans (archive cron, KPI dashboards)
  @@index([businessId, status, startAt])
  // Idempotency
  @@unique([businessId, idempotencyKey])
}
```

Notes:
- `endAt` is **stored** (not computed-column) so we can index range overlap. It is the service layer's responsibility to keep `endAt = startAt + durationMinutes * 60s`. A migration-time CHECK constraint enforces this:
  ```sql
  ALTER TABLE "Appointment"
    ADD CONSTRAINT appointment_endat_matches_duration
    CHECK (EXTRACT(EPOCH FROM (endAt - startAt)) = durationMinutes * 60);
  ```
- `version` enables the #150 atomic-conditional pattern for status transitions and convert (see §4).
- `notes` is plaintext UTF-8 — encryption at rest deferred to FUTURE_EPIC. A `ClinicNotesBanner.tsx` renders on `AppointmentDetailPage` for `Business.vertical === CLINIC` warning "Clinical notes are not encrypted at rest yet — do not store PHI". Server-side log + Sentry middleware redacts the `notes` field on all log/event paths (`redactPiiFields(['notes'])`).
- `partyNameSnapshot` / `employeeNameSnapshot` are written by the service on every create and on every edit-time-slot (re-snapshot if FK swaps). FE renders `party?.name ?? partyNameSnapshot` with a `(former)` badge when `partyId IS NULL`.

### 2.3 `AppointmentRecurrenceGroup`

```prisma
model AppointmentRecurrenceGroup {
  id          String              @id @default(cuid())
  businessId  String
  frequency   RecurrenceFrequency
  startAt     DateTime
  endAt       DateTime
  occurrences Int                 // count materialized; for analytics / quick edit-series ops
  createdAt   DateTime            @default(now())

  appointments Appointment[]
  @@index([businessId])
}
```

### 2.4 `AppointmentStatusEvent` (audit trail)

```prisma
model AppointmentStatusEvent {
  id            String             @id @default(cuid())
  appointmentId String
  fromStatus    AppointmentStatus?
  toStatus      AppointmentStatus
  reason        String?
  actorUserId   String
  createdAt     DateTime           @default(now())

  appointment Appointment @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
  @@index([appointmentId, createdAt])
}
```

Every accepted state transition writes one row inside the same Prisma transaction as the status update — atomic.

### 2.5 `AppointmentWaitlist` (SHOULD_SHIP)

```prisma
model AppointmentWaitlist {
  id                    String   @id @default(cuid())
  businessId            String
  partyId               String
  employeeId            String?
  preferredDate         DateTime
  notes                 String?
  promotedAppointmentId String?  @unique
  createdAt             DateTime @default(now())

  @@index([businessId, preferredDate])
}
```

### 2.6 Existing-table additions

```prisma
model Job {
  // ...existing fields...
  appointmentId String? @unique
  appointment   Appointment? @relation("JobFromAppointment", fields: [appointmentId], references: [id])
  @@index([appointmentId])
}

model Invoice {
  // ...existing fields...
  appointmentId String? @unique
  appointment   Appointment? @relation("InvoiceFromAppointment", fields: [appointmentId], references: [id])
  @@index([appointmentId])
}

model BusinessSettings {
  // ...existing fields...
  publicBookingHmacSecret  Bytes?      // 32-byte random; generated on first "Enable public booking"; rotated via Settings UI
  publicBookingSecretVersion Int        @default(0)  // monotonic; incremented on rotation
}

model SharedLink {
  // ...existing fields...
  revokedAt   DateTime?                 // checked BEFORE HMAC verify (timing-safe); rotation flips this for ALL prior rows
}
```

Both `@unique` on `appointmentId` so the convert flow is idempotent at the DB
layer (a second convert just re-reads the existing row, never creates a
duplicate).

### 2.7 Domain invariants

- Every `Appointment` is scoped by `businessId`; every read path filters on `req.user.businessId` (server-side, never client-supplied). See §11.0 cross-tenant guard invariant.
- **Soft-delete rules (Party / Employee):**
  - If the related party/employee has any appointment in ACTIVE status (`SCHEDULED`, `CONFIRMED`, `CHECKED_IN`) — soft-delete is **blocked** at the app layer with `409 HAS_ACTIVE_APPOINTMENTS` (see app-layer guard below).
  - If only TERMINAL rows remain (`COMPLETED`, `NO_SHOW`, `CANCELLED`, `PENDING_REVIEW`) — soft-delete succeeds; FK is nullified via `ON DELETE SET NULL`; the row preserves its `partyNameSnapshot` / `employeeNameSnapshot` for historical rendering.
- **App-layer guard** (in `party.service.ts` and `employee.service.ts`):
  ```ts
  const activeCount = await prisma.appointment.count({
    where: { partyId, status: { in: ['SCHEDULED','CONFIRMED','CHECKED_IN'] } }
  })
  if (activeCount > 0) {
    throw new ConflictError(`${name} has ${activeCount} upcoming appointments. Reassign or cancel first.`)
  }
  ```
  FK ON DELETE is `SetNull` — NOT `Restrict`. The restriction lives in the app guard so that ops scripts and admin tools see the same business rule.
- `employeeId IS NULL` ⇒ "any staff" OR employee deleted post-completion; conflict exclusion constraint's `WHERE` clause naturally skips NULL employees (gist `=` is NULL-safe-excluding) — see §3.2.
- `startAt < endAt` always; CHECK constraint above.
- `durationMinutes ∈ [5, 480]`; enforced at Zod + service layer.
- `convertedJobId` XOR `convertedInvoiceId` — at most one set; once set, the appointment is terminal (no further status transitions, only notes edits).

---

## 3. Migration plan

### 3.1 Command

```bash
# In server/
npx prisma migrate dev --name v2_appointments
```

Generates a single migration file:
`server/prisma/migrations/20260530120000_v2_appointments/migration.sql`

### 3.2 Migration content (ordered)

```sql
-- 0. Extensions (required for EXCLUDE constraint)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Enums (new)
CREATE TYPE "AppointmentStatus" AS ENUM (
  'SCHEDULED','CONFIRMED','CHECKED_IN','COMPLETED','NO_SHOW','CANCELLED','PENDING_REVIEW'
);
CREATE TYPE "AppointmentSource" AS ENUM ('WEB','PHONE','WALKIN','IN_APP');
CREATE TYPE "RecurrenceFrequency" AS ENUM ('WEEKLY','BIWEEKLY','MONTHLY');

-- 2. Enum extension (existing)
ALTER TYPE "ReminderRuleTrigger" ADD VALUE IF NOT EXISTS 'APPOINTMENT_UPCOMING';

-- 3. Tables
CREATE TABLE "AppointmentRecurrenceGroup" (...);
CREATE TABLE "Appointment" (
  -- ...columns including partyNameSnapshot TEXT NOT NULL, employeeNameSnapshot TEXT NOT NULL...
  -- partyId TEXT NULL, employeeId TEXT NULL, notes TEXT NULL...
  CONSTRAINT appointment_endat_matches_duration
    CHECK (EXTRACT(EPOCH FROM ("endAt" - "startAt")) = "durationMinutes" * 60)
);
CREATE TABLE "AppointmentStatusEvent" (...);
CREATE TABLE "AppointmentWaitlist" (...);

-- 3a. Slot-conflict primitive — DECLARATIVE EXCLUSION CONSTRAINT
-- Per SCOPE rev-2 MF1. Postgres enforces this regardless of isolation
-- level, app-tier retry logic, or future query rewrites. Active rows
-- (SCHEDULED/CONFIRMED/CHECKED_IN) for the same employeeId cannot have
-- overlapping [startAt, endAt) ranges. Terminal-status rows are excluded
-- from the constraint so a CANCELLED appointment doesn't block re-booking
-- the same slot. NULL employeeId rows are naturally excluded by the gist
-- equality operator.
ALTER TABLE "Appointment"
  ADD CONSTRAINT appointment_no_overlap
  EXCLUDE USING gist (
    "employeeId" WITH =,
    tstzrange("startAt", "endAt", '[)') WITH &&
  ) WHERE ("status" IN ('SCHEDULED','CONFIRMED','CHECKED_IN'));

-- 4. Indexes
CREATE INDEX "Appointment_businessId_startAt_idx"             ON "Appointment"("businessId","startAt");
CREATE INDEX "Appointment_businessId_employeeId_startAt_idx"  ON "Appointment"("businessId","employeeId","startAt");
CREATE INDEX "Appointment_partyId_startAt_idx"                ON "Appointment"("partyId","startAt");
CREATE INDEX "Appointment_businessId_status_startAt_idx"      ON "Appointment"("businessId","status","startAt");
CREATE UNIQUE INDEX "Appointment_businessId_idempotencyKey_key" ON "Appointment"("businessId","idempotencyKey");
-- partial index for hot statuses (calendar render):
CREATE INDEX "Appointment_hot_idx" ON "Appointment"("businessId","startAt")
  WHERE "status" IN ('SCHEDULED','CONFIRMED','CHECKED_IN');

-- 5. Additive nullable FKs on existing tables (SetNull, not Restrict)
ALTER TABLE "Job"     ADD COLUMN "appointmentId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "appointmentId" TEXT;
CREATE UNIQUE INDEX "Job_appointmentId_key"     ON "Job"("appointmentId");
CREATE UNIQUE INDEX "Invoice_appointmentId_key" ON "Invoice"("appointmentId");
ALTER TABLE "Job"     ADD CONSTRAINT "Job_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL;

-- 6. Public-booking signature SSOT
ALTER TABLE "BusinessSettings" ADD COLUMN "publicBookingHmacSecret" BYTEA;
ALTER TABLE "BusinessSettings" ADD COLUMN "publicBookingSecretVersion" INT NOT NULL DEFAULT 0;
ALTER TABLE "SharedLink"       ADD COLUMN "revokedAt" TIMESTAMPTZ;
CREATE INDEX "SharedLink_revokedAt_idx" ON "SharedLink"("revokedAt");
```

### 3.3 Ordering rules respected

- Extensions → enums first → new tables → EXCLUSION constraint → indexes → existing-table nullable column adds last.
- **No backfill needed** — this is a greenfield feature module. All existing rows remain valid because every new column is either on new tables or nullable on existing ones.
- **No NOT-NULL adds.** Future migration (post-launch hardening) might tighten constraints once data exists; out of scope for this epic.

### 3.4 Rollback plan

If the migration ships and breaks production:

1. Toggle `FEATURE_APPOINTMENTS_V2=false` in env (Render dashboard) — instantly hides all UI surface, blocks all new writes via route-level flag check. Recovery time: <60s.
2. The schema additions are inert without the flag (nothing reads from them, no constraints reference non-V2 paths).
3. If the schema must be reverted (extreme case — e.g. enum bug breaking other migrations), generate a down-migration:
   ```sql
   ALTER TABLE "Job"     DROP CONSTRAINT "Job_appointmentId_fkey";
   ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_appointmentId_fkey";
   ALTER TABLE "Job"     DROP COLUMN "appointmentId";
   ALTER TABLE "Invoice" DROP COLUMN "appointmentId";
   ALTER TABLE "BusinessSettings" DROP COLUMN "publicBookingHmacSecret";
   ALTER TABLE "BusinessSettings" DROP COLUMN "publicBookingSecretVersion";
   ALTER TABLE "SharedLink"       DROP COLUMN "revokedAt";
   ALTER TABLE "Appointment" DROP CONSTRAINT appointment_no_overlap;
   DROP TABLE "AppointmentStatusEvent";
   DROP TABLE "AppointmentWaitlist";
   DROP TABLE "Appointment";
   DROP TABLE "AppointmentRecurrenceGroup";
   DROP TYPE "AppointmentStatus";
   DROP TYPE "AppointmentSource";
   DROP TYPE "RecurrenceFrequency";
   -- Note: cannot remove enum values from ReminderRuleTrigger; leave 'APPOINTMENT_UPCOMING' orphan (harmless).
   -- btree_gist extension left in place (harmless).
   ```
4. Run via `npx prisma migrate resolve --rolled-back <ts>_v2_appointments` then redeploy prior commit.

Primary expected rollback is **flag-off**, not schema-revert.

---

## 4. Slot-conflict algorithm — declarative exclusion constraint

### 4.1 Goal

Two devices submitting `POST /api/v1/appointments` for overlapping
(employeeId, [startAt, endAt]) windows must result in exactly one 201
and one 409. No double-booking, no read-modify-write race. **The
correctness invariant is enforced by Postgres declaratively** (§3.2
EXCLUSION constraint) — independent of isolation level, app retry
logic, or future query rewrites. App code only needs to catch the
violation.

### 4.2 Pattern: plain INSERT + catch `23P01`

**Layer A — Insert and let the DB enforce:**

```ts
// Plain INSERT — no Serializable required, no NOT EXISTS predicate, no FOR UPDATE.
// The appointment_no_overlap EXCLUSION constraint (§3.2) is the primitive.
try {
  const row = await tx.appointment.create({
    data: {
      businessId, partyId, employeeId,
      partyNameSnapshot, employeeNameSnapshot,
      startAt, endAt, durationMinutes,
      status: 'SCHEDULED', source, serviceLabel, jobTemplateId,
      notes, recurrenceGroupId, idempotencyKey,
      version: 0, createdById: userId,
    },
  });
  return { status: 201, row };
} catch (e) {
  // exclusion_violation — overlap with an active appointment for this employee
  if ((e as any).code === 'P2010' && (e as any).meta?.code === '23P01') {
    const conflicting = await findConflictingActiveAppointment(tx, {
      businessId, employeeId, startAt, endAt,
    });
    return { status: 409, body: conflictBody(conflicting) };
  }
  // idempotency-key replay (P2002 on @@unique([businessId, idempotencyKey]))
  if ((e as any).code === 'P2002' && (e as any).meta?.target?.includes('idempotencyKey')) {
    const existing = await tx.appointment.findFirst({
      where: { businessId, idempotencyKey },
    });
    return { status: 200, row: existing };
  }
  throw e;
}
```

**Notes on the catch logic:**
- Postgres SQLSTATE `23P01` = `exclusion_violation`. Prisma surfaces this as `P2010` with `meta.code === '23P01'` (raw error path) or via the raw exec path. The repo helper `appointment-conflict.repo.ts` normalises both.
- The `NOT EXISTS` / Serializable transaction pattern from rev 1 is **rescinded** (see §17 — deviation removed). The EXCLUSION constraint is the single primitive.

**Layer B — Conflict body (tenant-scoped, no cross-tenant id leak):**

Conflicting appointment lookup is filtered by `businessId = req.user.businessId`
so we never echo a foreign id. If the conflicting row belongs to another
business (impossible under correct scoping, but defensive), we return
the body without `conflictingAppointmentId`:

```ts
{
  success: false,
  error: {
    code: 'SLOT_CONFLICT',
    message: 'That slot was just taken. Pick another time.',
    conflictingAppointmentId: sameBusiness ? row.id : undefined,
    startAt: row.startAt.toISOString(),
    endAt:   row.endAt.toISOString(),
    nextFreeSlots: top3FreeSlotsForEmployee(...),  // best-effort
  },
}
```

### 4.3 `employeeId IS NULL` ("any staff")

The EXCLUSION constraint's gist `=` operator is NULL-safe-excluding: two rows
with `employeeId IS NULL` are NOT considered overlapping by the constraint
(they pass), so "any staff" appointments can stack on the same time slot.
This matches the SCOPE Accepted Trade-off — "any staff" is a workflow
loophole the owner accepts. No app-side branching required.

### 4.4 Status-transition + convert atomicity

Status transitions and convert use the same #150 conditional pattern via
`version`:

```ts
// Inside $transaction
const updated = await tx.appointment.updateMany({
  where: {
    id: appointmentId,
    businessId,                                  // tenant guard
    status: VALID_FROM_STATES_FOR[toStatus],     // state-machine guard
    version: knownVersion,                       // optimistic-lock guard
  },
  data: {
    status: toStatus,
    version: { increment: 1 },
    updatedAt: new Date(),
  },
});
if (updated.count !== 1) {
  // Either: wrong state, stale version, or wrong tenant → all → 409
  throw new InvalidTransitionError({ from: known, to: toStatus });
}
await tx.appointmentStatusEvent.create({
  data: { appointmentId, fromStatus: known, toStatus, reason, actorUserId },
});
```

Same shape for convert: condition `convertedJobId IS NULL` (or
`convertedInvoiceId IS NULL`) on the updateMany; `count === 0` ⇒
already converted ⇒ idempotent re-read of existing job/invoice id.

### 4.5 Recurrence: per-occurrence atomic insert

Recurrence expansion runs N (≤52) `appointment.create` calls in a single
transaction. Any single EXCLUSION violation aborts the whole transaction
(so the owner doesn't end up with a half-booked series). Error body lists
the first conflicting occurrence date so the FE can prompt "skip this date
or change time?".

---

## 4b. Status state machine — server-enforced

Implemented as a constant map in
`server/src/features/appointments/appointment.constants.ts` and
validated at the top of every PATCH handler before the transaction.

| From → To | SCHEDULED | CONFIRMED | CHECKED_IN | COMPLETED | NO_SHOW | CANCELLED | PENDING_REVIEW |
|-----------|-----------|-----------|------------|-----------|---------|-----------|----------------|
| SCHEDULED | — | ✅ | ✅ | ❌ (must check-in) | ✅ | ✅ | ❌ |
| CONFIRMED | ❌ | — | ✅ | ❌ (must check-in) | ✅ | ✅ | ❌ |
| CHECKED_IN | ❌ | ❌ | — | ✅ | ❌ (already arrived) | ✅ | ❌ |
| COMPLETED | ❌ | ❌ | ❌ | — | ❌ | ❌ | ❌ (terminal) |
| NO_SHOW | ❌ | ❌ | ❌ | ❌ | — | ❌ | ❌ (terminal) |
| CANCELLED | ❌ | ❌ | ❌ | ❌ | ❌ | — | ❌ (terminal) |
| PENDING_REVIEW | ✅ (approve) | ✅ | ❌ | ❌ | ❌ | ✅ (reject) | — |

Reason field is **required** for `CANCELLED` and `NO_SHOW`; Zod enforces.

Terminal states (COMPLETED, NO_SHOW, CANCELLED): only notes-edit is
allowed; every notes edit writes a synthetic
`AppointmentStatusEvent { fromStatus: terminal, toStatus: terminal, reason: 'notes edited' }`
for the audit trail.

---

## 5. API Contracts

All routes mounted at `/api/v1/appointments`. Auth required except
`/public/*`. Business scope: `req.user.businessId` derived from
JWT — never read from request body. See §11.0 cross-tenant guard
invariant.

### 5.1 `POST /api/v1/appointments` — create

Zod request (`server/src/features/appointments/appointment.schema.ts`):
```ts
export const CreateAppointmentSchema = z.object({
  partyId: z.string().cuid(),
  employeeId: z.string().cuid().nullable().optional(),
  startAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(5).max(480),
  serviceLabel: z.string().max(120).optional(),
  jobTemplateId: z.string().cuid().optional(),
  notes: z.string().max(2000).optional(),
  source: z.enum(['WEB','PHONE','WALKIN','IN_APP']),
  recurrence: z.object({
    frequency: z.enum(['WEEKLY','BIWEEKLY','MONTHLY']),
    endAt: z.string().datetime({ offset: true }),
  }).optional(),
}).strict();
```

Responses:
- 201 → `{ success: true, data: AppointmentDTO }`
- 400 → `PARTY_REQUIRED` | `PAST_SLOT` | `DURATION_OUT_OF_RANGE` | `RECURRENCE_TOO_LONG` | `RANGE_TOO_WIDE`
- 401 → `UNAUTHORIZED`
- 404 → `EMPLOYEE_NOT_IN_BUSINESS` | `PARTY_NOT_IN_BUSINESS` (404 not 403 to avoid existence-leak; see §11.0)
- 409 → `SLOT_CONFLICT` `{ conflictingAppointmentId?, startAt, endAt, nextFreeSlots?[] }`
- 429 → `RATE_LIMITED`

Idempotency: `Idempotency-Key` header honoured (server-side LRU + DB unique guard).

### 5.2 `GET /api/v1/appointments`

```
GET /api/v1/appointments?from=<iso>&to=<iso>&employeeId=<cuid?>&status=<csv?>
```
- 400 if `to - from > 31d` (`RANGE_TOO_WIDE`).
- Response: `{ success: true, data: AppointmentDTO[], pagination: { hasMore, nextCursor } }`.
- Cursor pagination (project rule): cursor = `(startAt, id)` tuple; default page size 200, max 500.
- `employeeId` resolved via §11.0 helper before query.

### 5.3 `GET /api/v1/appointments/:id`

- 200 / 404 / 401.
- `notes` returned as plaintext UTF-8; no decryption branch (encryption deferred to FUTURE_EPIC).
- Clinic vertical: server writes `audit_log` row on every clinic-notes read.

### 5.4 `PATCH /api/v1/appointments/:id/status`

```ts
export const StatusPatchSchema = z.object({
  toStatus: z.enum(['CONFIRMED','CHECKED_IN','COMPLETED','NO_SHOW','CANCELLED']),
  reason: z.string().max(500).optional(),
  expectedVersion: z.number().int().nonnegative(),
}).strict().refine(
  (d) => !(['CANCELLED','NO_SHOW'].includes(d.toStatus)) || (d.reason && d.reason.length >= 3),
  { message: 'reason required', path: ['reason'] },
);
```

- 200 → `{ success: true, data: AppointmentDTO }`
- 409 → `INVALID_TRANSITION` `{ from, to, currentStatus }` (covers state-machine + stale-version + tenant-mismatch — uniform body; `currentStatus` echoed for offline replay UX, see §8.3)

### 5.5 `PATCH /api/v1/appointments/:id` — edit (notes, time-slot if not terminal)

Body shape similar to create but all fields optional. Time-slot edits go
through the EXCLUSION constraint (§4.2). If `partyId` or `employeeId`
changes, the service re-snapshots `partyNameSnapshot` /
`employeeNameSnapshot` in the same transaction.

### 5.6 `POST /api/v1/appointments/:id/convert`

```ts
export const ConvertSchema = z.object({
  target: z.enum(['JOB','INVOICE']),
  expectedVersion: z.number().int().nonnegative(),
}).strict();
```

- Server validates: `appointment.status === 'COMPLETED'`, `target` matches `business.vertical` (SERVICES→JOB, CLINIC→INVOICE). Mismatch → 400 `VERTICAL_MISMATCH`.
- Idempotent: if `convertedJobId` / `convertedInvoiceId` already set, return existing id with 200.
- Response: `{ success: true, data: { jobId?: string, invoiceId?: string } }`.

### 5.7 `GET /api/v1/appointments/availability`

```
GET /api/v1/appointments/availability?employeeId=<cuid>&date=<YYYY-MM-DD>
```

Returns busy ranges for one employee on one date + their working hours
from `Employee.workingHours` JSON (Phase 6 model).

```ts
{
  success: true,
  data: {
    employeeId: string;
    date: string;
    timeZone: 'Asia/Kolkata';
    workingHours: { startAt: string; endAt: string };
    busy: Array<{ startAt: string; endAt: string; appointmentId: string }>;
  }
}
```

`employeeId` resolved via §11.0 helper → 404 on cross-tenant.

### 5.8 `GET /api/v1/appointments/day-summary`

Aggregate for the 8am push. Cached 60s in-memory per `(businessId, date)`.

### 5.9 `POST /api/v1/appointments/public/:linkToken` (SHOULD_SHIP — public booking)

- Gated by `FEATURE_APPOINTMENTS_V2_PUBLIC_BOOKING`.
- Token parsed and verified per §10.1.1 (HMAC-SHA256, per-business secret, `revokedAt IS NULL`, `expiresAt > now`).
- 30 rpm/IP on `/api/public/booking/*` + 200/day/business policy cap (above → `PENDING_REVIEW`).
- hCaptcha after 3 failed slot attempts per IP-link pair in 10 min.
- Body: same as `CreateAppointmentSchema` minus `source` (server forces `WEB`), plus `customerName`, `customerPhone` (creates Party if not exists, scoped to the link's business).
- Lands as `status: SCHEDULED` by default; if day's WEB-source count > 200, lands as `PENDING_REVIEW` (owner manually approves via PATCH).

### 5.10 `GET /api/v1/appointments/public/:linkToken/availability`

Read-only availability for the public booking page.
- Returns only the next 14 days.
- Hides party PII (no employee names beyond a stable opaque label, e.g. "Staff A").
- Returns ONLY `{ slots: [{ startAt, endAt, employeeId? (opaque) }] }`.
- Opaque mapping is `HMAC(linkToken-secret, employeeId)` truncated to 8 chars — refreshed when SharedLink is rotated.

### 5.11 `POST /api/business/settings/rotate-booking-secret` — rotation flow

- Authenticated; OWNER role only.
- In a single transaction:
  1. Generates a new 32-byte random secret → writes `BusinessSettings.publicBookingHmacSecret`, increments `publicBookingSecretVersion`.
  2. `UPDATE "SharedLink" SET "revokedAt" = NOW() WHERE "businessId" = $1 AND "revokedAt" IS NULL` — all prior links invalidated immediately.
  3. Writes `audit_log` row `{ action: 'PUBLIC_BOOKING_SECRET_ROTATED', actorUserId, businessId, version }`.
- Response: `{ success: true, data: { version, rotatedLinks: <count> } }`.

### 5.12 Error envelope (shared)

```ts
{ success: false, error: { code: string, message: string, [hint: any] } }
```

Error codes (complete list): `SLOT_CONFLICT`, `INVALID_TRANSITION`,
`PAST_SLOT`, `RANGE_TOO_WIDE`, `PARTY_REQUIRED`,
`EMPLOYEE_NOT_IN_BUSINESS`, `PARTY_NOT_IN_BUSINESS`, `ALREADY_CONVERTED`,
`RECURRENCE_TOO_LONG`, `DURATION_OUT_OF_RANGE`, `VERTICAL_MISMATCH`,
`HAS_ACTIVE_APPOINTMENTS`, `LINK_EXPIRED`, `LINK_REVOKED`,
`RATE_LIMITED`, `UNAUTHORIZED`, `INTERNAL`.

Full TS interfaces live in `docs/API_CONTRACTS_V2_APPOINTMENTS.md`
(generated alongside this doc — single source for FE mirror types).

---

## 6. FE Architecture — 6-layer split

Path: `src/features/appointments/`. Every file ≤ 250 lines (see File Plan §13 for exact splits).

| Layer | Files |
|---|---|
| **types** | `appointment.types.ts` (mirrors API DTOs + FE-only `CalendarSlot`, `SlotPickerState`) |
| **constants** | `appointment.constants.ts` (status labels, status→badge-variant map, slot grid = 15 min, range cap = 31d, recurrence cap = 52, color tokens for status pills) |
| **utils** | `appointment.utils.ts` (slot math: `toSlotGrid`, `findFreeSlots`, `mergeBusyRanges`, `isPastSlot`, `formatTimeRange`, `nextRoundSlot`) |
| **service** | `appointment.service.ts` (thin `api()` wrappers — all mutations carry `entityType: 'appointment'` + `entityLabel`) |
| **hooks** | `hooks/useAppointments.ts`, `hooks/useAvailability.ts`, `hooks/useAppointmentMutations.ts`, `hooks/useAppointmentForm.ts`, `hooks/useCalendarView.ts` (view state: day/week, current date, navigation) |
| **components** | `CalendarDayView`, `CalendarWeekView`, `AppointmentCard`, `CreateAppointmentDrawer`, `SlotPicker`, `StatusActionBar`, `ConvertToBillSheet`, `AppointmentEmptyState`, `WaitlistSheet`, `RecurrenceFields`, `ClinicNotesBanner` |
| **pages** | `pages/AppointmentsPage.tsx`, `pages/AppointmentDetailPage.tsx` |
| **css** | `appointments.css` (grid layout, slot styles, var-token-only — dark-mode parity automatic) |
| **i18n** | edits to `src/lib/translations.en.ts` + `translations.hi.ts` only |

### 6.1 Reused primitives (no new code)

- `<Drawer>` for the create-appointment wizard
- `<EmptyState>` for empty day / empty availability
- `<Skeleton>` / `<ListSkeleton>` for loading
- `<ErrorState>` for error
- `<Button>`, `<Input>`, `<Select>`, `<Textarea>`, `<ConfirmDialog>`, `<Badge>`, `<PartyAvatar>`
- `<PartySearch>` from V1 (drives party selection in the create wizard)
- `useToast()` for success/error toasts
- `useLanguage()` for `t.keyName` reads

### 6.2 State management

- Server data → **TanStack Query**: queries keyed by `['appointments', { from, to, employeeId, status }]`; mutations invalidate that range + day-summary.
- View state (day/week toggle, current date) → **local `useState`** in `AppointmentsPage` via `useCalendarView`. NOT Zustand — no cross-route sharing needed.
- Wizard form state → local `useReducer` inside `CreateAppointmentDrawer` (party → service → employee → slot is a small state machine).

### 6.3 State machine (FE wizard)

```
IDLE → PICKING_PARTY → PICKING_SERVICE → PICKING_EMPLOYEE → PICKING_SLOT
                                                            ↓
                                                       CONFIRMING
                                                            ↓
                                       SUBMITTING → (SUCCESS | ERROR)
                                                            ↓
                                                      IDLE (reset)
```

Back navigation is allowed at every step; SUBMITTING is non-cancellable
once dispatched (the `api()` queue takes over offline).

### 6.4 `AppointmentCard` rendering — snapshots

```tsx
const displayParty    = party?.name    ?? partyNameSnapshot;
const displayEmployee = employee?.name ?? employeeNameSnapshot;
const isFormerParty    = partyId    == null;
const isFormerEmployee = employeeId == null;
return (
  <>
    <span>{displayParty} {isFormerParty && <Badge variant="muted">{t.formerParty}</Badge>}</span>
    <span>{displayEmployee} {isFormerEmployee && <Badge variant="muted">{t.formerStaff}</Badge>}</span>
  </>
);
```

### 6.5 `ClinicNotesBanner`

Renders on `AppointmentDetailPage` when `Business.vertical === 'CLINIC'`,
above the notes field:

> "Clinical notes are not encrypted at rest yet — do not store PHI."

i18n keys `clinicNotes.banner.title` / `clinicNotes.banner.body`.

---

## 7. Calendar render strategy

### 7.1 Mobile (< 768px) — day view default

- Single vertical scroll list of 30-min rows, 06:00 → 22:00 (configurable from `Employee.workingHours` later).
- Appointment cards positioned by `top: f(startAt) px`, `height: f(durationMinutes) px`.
- Virtualization: **NOT needed at 100 slots/day**. The list height is bounded (16 hours × 60 min / 30 min = 32 rows = ~2400px). All in-DOM, smooth on a Rs-8K Android.
- 320px breakpoint: appointment card name truncates to 12 chars + ellipsis; time stays full (4 chars + dash).
- `overscroll-behavior: contain` on the scroll container so day scroll doesn't bubble to body (Capacitor edge-to-edge rule C11).

### 7.2 Tablet / Desktop (≥ 768px) — week view

- 7-column grid (Mon–Sun), each column = vertical day timeline.
- Horizontal scroll **inside the calendar container only** (sticky day-header bar at top, sticky time-of-day gutter at left).
- At 1024px: 7 columns visible without horizontal scroll. At 768px: 5 columns visible with internal horizontal scroll.
- Tap targets ≥44px preserved on desktop.

### 7.3 Virtualization decision

- **Day view:** no virtualization (bounded ~32 rows).
- **Week view:** no virtualization for the grid itself (7 × 32 = 224 cells, fine). Appointments within a cell are absolute-positioned — if a single cell has >20 overlapping appointments, we collapse extras into a `+N more` chip that opens a sheet. Realistic clinic max is ~16 patients/day/doctor; we'll never hit the limit on real data.
- **Month view:** **NOT shipped in V2**. Listed in NICE_TO_HAVE.

### 7.4 Busy-clinic stress (100 slots/day)

- 100 slots × 4 fields per card = 400 nodes, well within React reconciler budget on the target hardware.
- Initial query cost: indexed `(businessId, startAt)` range scan, < 30ms at 100M rows (verified pattern from V1).
- Network payload: 100 × ~300 bytes = ~30KB gzipped → well under any budget.

### 7.5 Performance budget

| Metric | Target |
|---|---|
| LCP on `/appointments` (4G, day with 30 appts) | < 2.5s |
| INP on slot tap | < 200ms |
| CLS during day-view render | < 0.05 |
| Per-route chunk gzipped (appointments feature) | ≤ 80KB |
| GET /appointments p95 (200 rows) | < 150ms |
| POST /appointments p95 (with EXCLUSION check) | < 200ms |

Code-split: `AppointmentsPage` and `AppointmentDetailPage` lazy-loaded via
`React.lazy`. SlotPicker + CalendarWeekView lazy-loaded inside the page
(not pulled until first day→week toggle).

---

## 8. Offline behavior

### 8.1 Writes — full offline queue support

All mutations go through `api()`:

```ts
await api('/api/v1/appointments', {
  method: 'POST',
  body: JSON.stringify(payload),
  entityType: 'appointment',
  entityLabel: `${partyName} @ ${formatTimeShort(startAt)}`,
});
```

- `entityType: 'appointment'` (singular noun, per OFFLINE_RULES.md Rule 2).
- `entityLabel`: human-readable composite — `"Priya @ 3:00pm"`.
- Status PATCH: `entityLabel = "${partyName}: ${fromStatus}→${toStatus}"`.
- Convert: `entityLabel = "${partyName} → ${target === 'JOB' ? 'Job' : 'Invoice'}"`.
- All mutation hooks tolerate the optimistic `{}` return — no deref of `data.id` without an `if`.

### 8.2 Reads — network-only (no cache)

- Slot data is volatile (multiple devices booking simultaneously). Caching it would mislead the user about availability.
- All `GET` calls use the **default** `cacheReads: false`.
- Trade-off: when fully offline, `/appointments` lands on `<ErrorState onRetry />`. The day view does NOT show stale cached data. This is intentional — a stale calendar in a salon is worse than no calendar.
- Day-summary push at 8am is best-effort (FCM, fires online only).

### 8.3 Offline conflict / replay resolution

- **Slot conflict (409 SLOT_CONFLICT) on queued create:** toast `"Couldn't book {label} — slot taken. Re-book?"` with an action that re-opens the create drawer pre-filled. Sentry breadcrumb only (expected outcome).
- **Status replay rejected (409 INVALID_TRANSITION) on queued PATCH:** the appointment's status moved server-side while the device was offline (e.g. another device cancelled it).
  - Toast: `"Couldn't update {party}'s appointment — status no longer valid"`.
  - Action: refetch the appointment, then **re-open `AppointmentDetailPage`-equivalent drawer** with server's current state.
  - Emits Sentry event `appointment_replay_rejected { appointmentId, attemptedStatus, currentStatus }` (non-alerting, but feeds the §12.2 spike alert).
- Handler lives in `src/lib/api-queue-replay.ts` (edit, see File Plan #29a). Test in `src/features/appointments/__tests__/replay-rejection.test.tsx`.

### 8.4 Idempotency-key contract

- FE generates `Idempotency-Key` (cuid) at submit time, stores it with the queued mutation in IDB.
- Server's `@@unique([businessId, idempotencyKey])` swallows duplicates from queue-flush retries.
- Replay returns the originally-created row with 200 (not 201) so the UI doesn't double-toast.

---

## 9. Reminders integration (SHOULD_SHIP)

### 9.1 Reuse V5 + Epic A pipeline

The reminder pipeline already exists:
- `ReminderRule` table — owner-configured per-business rules.
- `ReminderDispatch` table — one row per outbound send (queued, sent, failed, retry-count).
- `node-cron` job (every 5 min) → finds rules whose `nextRunAt <= now` → enqueues dispatches.
- Dispatcher worker → pops dispatch rows → calls SMS/WA gateway → records result.

### 9.2 New trigger

`ReminderRuleTrigger.APPOINTMENT_UPCOMING` (enum addition, §2.1).

```ts
// reminder-dispatch.ts (edit)
case 'APPOINTMENT_UPCOMING': {
  const upcoming = await prisma.appointment.findMany({
    where: {
      businessId: rule.businessId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      startAt: {
        gte: addHours(now, rule.leadHours - 0.0833), // ±5 min tolerance
        lte: addHours(now, rule.leadHours + 0.0833),
      },
      // de-dup: don't re-send if a dispatch row exists for this (rule, appointment)
      NOT: { reminderDispatches: { some: { ruleId: rule.id } } },
    },
    include: { party: true, employee: true },
  });
  for (const appt of upcoming) {
    await enqueueDispatch({ ruleId, appointmentId: appt.id, ... });
  }
  break;
}
```

### 9.3 Default rules seeded per business (flag-gated)

When `FEATURE_APPOINTMENTS_V2_REMINDERS=true` for a business:
- T-24h SMS (text template `appointment_reminder_24h`)
- T-2h WhatsApp (template `appointment_reminder_2h` — Meta-approved)

Both off by default; owner toggles in Settings → Reminders.

### 9.4 Budget cap

Reuses V5 per-business daily budget gate. Cap defaults: 50 SMS/day, 200 WA/day. Hit → auto-pause, banner in Settings.

### 9.5 Schema impact on `ReminderDispatch`

Existing `ReminderDispatch` already has `metadata Json?` — we'll store
`{ appointmentId }` there (no schema change).

---

## 10. Public booking integration (SHOULD_SHIP)

### 10.1 Reuse #130 SharedLink envelope, own signature spec

One `SharedLink` row per business (owner enables in Settings → "Get my
booking link"). Token format and verification are spec'd in §10.1.1 — they
do NOT reuse the generic SharedLink HMAC because public booking needs a
per-business secret with rotation (SCOPE rev-2 MF3).

### 10.1.1 Public-booking signature spec (SCOPE rev-2 MF3 — LOCKED)

**Secret:**
- `BusinessSettings.publicBookingHmacSecret` — `Bytea`, 32 random bytes, server-generated on first "Enable public booking" toggle.
- `BusinessSettings.publicBookingSecretVersion` — `Int`, monotonic; incremented on rotation.
- Rotated via `POST /api/business/settings/rotate-booking-secret` (§5.11) — clears prior secret, increments version, sets `SharedLink.revokedAt = NOW()` for ALL prior rows in the same tx, writes audit log.

**Canonical payload** (pipe-separated to prevent field-injection; empty string for absent `employeeId`, NOT null):

```
${businessId}|${employeeId ?? ''}|${expiresAt.toISOString()}
```

**Signature:**
```
base64url(HMAC-SHA256(secret, canonical))
```

**Token wire format** (passed as `:linkToken` URL segment):
```
<base64url(payload-json)>.<signature>
```

where `payload-json = { businessId, employeeId?, expiresAt }`.

**Verification order** (server, on every public route hit):
1. Parse token → payload + signature. Malformed → 401 `LINK_INVALID`.
2. Find the `SharedLink` row by `businessId` from payload.
3. **`revokedAt IS NOT NULL` → 401 `LINK_REVOKED`** (checked BEFORE HMAC verify; constant-time string compare on `revokedAt` field).
4. `expiresAt <= now()` → 401 `LINK_EXPIRED`.
5. Recompute HMAC over canonical payload using `BusinessSettings.publicBookingHmacSecret`. `timingSafeEqual` against provided signature. Mismatch → 401 `LINK_INVALID`.
6. Proceed.

**Constraints:**
- `expiresAt` clamped to ≤ 90 days from now at token-mint time (server enforces; Settings UI shows expiry).
- Rate limit: 30 req/min per IP on `/api/public/booking/*` (separate from generic SharedLink limiter).
- All public-booking events log `{ tokenVersion, businessId }` (never the raw token).

### 10.2 Rate limits

- **30 rpm/IP** on public-booking routes (§10.1.1).
- **200 bookings/day/business** (policy gate inside service). Above cap → land as `PENDING_REVIEW` (not blocked outright).
- **hCaptcha** triggered after 3 failed slot attempts per `(IP, linkToken)` pair within 10 min.
- **Link soft-disable**: 3 failed captchas in 1 hour → SharedLink marked `revokedAt = now()`; owner gets push notification. (Reuses the §10.1.1 `revokedAt` column.)

### 10.3 PII surface cuts

The public surface MUST NOT expose any other-party data:

| Public sees | Does NOT see |
|---|---|
| Business name + vertical | Other parties' names, phones, totals |
| Available time slots | Other appointments' details |
| Employee opaque labels ("Staff A", "Staff B") | Real employee names/phones |
| Service labels (from a curated `publicServices` list — explicit owner opt-in) | All JobTemplates |

Implementation:
- Availability query returns only `{ startAt, endAt, employeeOpaqueId }`. The mapping `employeeOpaqueId → employeeId` is per-link (HMAC of `(publicBookingHmacSecret, linkToken-version, employeeId)`, truncated to 8 chars). Rotation rotates the mapping automatically.
- Public service list comes from `BusinessSetting.publicServices` (curated by owner) — out of scope to architect here, defaults to empty (= free-text only).

### 10.4 Public route surface

- `GET /api/v1/appointments/public/:linkToken/availability?date=`
- `POST /api/v1/appointments/public/:linkToken` — body validated by `PublicCreateAppointmentSchema`:

```ts
export const PublicCreateAppointmentSchema = z.object({
  customerName: z.string().min(1).max(80),
  customerPhone: z.string().regex(/^[6-9]\d{9}$/),  // Indian mobile
  employeeOpaqueId: z.string().optional(),
  startAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(5).max(480),
  serviceLabel: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
  captchaToken: z.string().optional(),  // required if challenge triggered
}).strict();
```

- Server creates / upserts `Party` (by `(businessId, phone)`), then runs the same EXCLUSION-backed conflict primitive as authenticated create.
- Source is forced to `WEB`; `createdById = SYSTEM_PUBLIC_BOOKING_USER_ID` (seed user).
- Token verified per §10.1.1 BEFORE any DB write.

---

## 11. Security model

### 11.0 Cross-tenant guard — architectural invariant (SCOPE rev-2 MF4)

> **Every route consuming an input resource ID (`employeeId`, `partyId`, `appointmentId`, `jobId`, `invoiceId`) MUST resolve the entity via a JOIN to `req.user.businessId` BEFORE any further query. Mismatch → 404 (not 403, not 200, not empty array).**

This is an invariant, not a per-route detail. It applies to (non-exhaustive):

| Route | Input IDs |
|---|---|
| `POST   /api/v1/appointments`              | `partyId`, `employeeId?` |
| `GET    /api/v1/appointments`              | `employeeId?` (query) |
| `GET    /api/v1/appointments/:id`          | `id` |
| `PATCH  /api/v1/appointments/:id`          | `id`, possibly new `partyId`/`employeeId` |
| `PATCH  /api/v1/appointments/:id/status`   | `id` |
| `POST   /api/v1/appointments/:id/convert`  | `id` |
| `GET    /api/v1/appointments/availability` | `employeeId` |
| `GET    /api/v1/appointments/day-summary`  | (no input ID; pure businessId scope) |
| public `POST/GET /public/:linkToken*`      | `employeeOpaqueId` (resolved against linkToken's `businessId`) |

**Canonical helpers** (live in `appointment.repo.ts` per File Plan #7):

```ts
// returns row or throws NotFoundError → 404 (never 403, never empty)
async function resolveScopedEmployee(id: string, businessId: string): Promise<Employee>
async function resolveScopedParty(id: string, businessId: string): Promise<Party>
async function resolveScopedAppointment(id: string, businessId: string): Promise<Appointment>
```

Every route MUST call the helper for every input ID before any downstream
query. Direct `prisma.X.findUnique({ where: { id } })` for an input-supplied
ID is a lint error — a static check added to `scripts/enforce.js` (rule
`no-unscoped-id-read`) flags `prisma.(appointment|party|employee|job|invoice).findUnique`
followed by `{ where: { id` without a `businessId:` key within the same object
literal. Codemod follow-up tracked in §15.

**Tests:** every route accepting an input resource ID has a dedicated
cross-tenant 404 test in `*.integration.test.ts` (§15.2 mandate, not generic).

### 11.1 BusinessId scoping audit (every query)

A checklist applied to **every** new repo/service method (complements §11.0):

- [ ] All `prisma.appointment.findMany` / `findFirst` / `findUnique` filters include `businessId`.
- [ ] All `update` / `updateMany` / `delete` operations include `businessId` in `where`.
- [ ] All raw SQL includes `"businessId" = ${businessId}` in WHERE clauses.
- [ ] `businessId` is derived from `req.user.businessId` (JWT claim) — **never** from `req.body` or `req.query`.
- [ ] Cross-business lookups (e.g. party for a public booking) match the SharedLink's `businessId` — never trust client-supplied `businessId`.
- [ ] 404 (not 403) on cross-business access attempts to avoid existence leaks.

A static check is added to `scripts/enforce.js` (project enforcer): pattern
`prisma.appointment.(findMany|findFirst|update|delete)` must be followed
within 5 lines by either `businessId:` or a `// SCOPE_OK <reason>` comment.

### 11.2 Public booking surface cuts

See §10.3. In addition:
- Public endpoints exempt from CSRF (no cookie session), but every state-changing call requires SharedLink token + signature per §10.1.1.
- Public-created `Party` rows tagged `source: 'PUBLIC_BOOKING'` so the owner can see how the customer entered the system.

### 11.3 Employee-availability cross-tenant guard

Covered by §11.0 invariant. `GET /availability?employeeId=...` calls
`resolveScopedEmployee(employeeId, req.user.businessId)` before reading
busy ranges. Mismatch → 404. Public availability uses `employeeOpaqueId`;
the reverse mapping is validated against the link's `businessId`
(established via §10.1.1 verification) before the lookup.

### 11.4 PII in calendar view

- The day/week view shows **party label only** (name) — never phone, never email, never address.
- Tapping a card opens the detail page, which shows phone + a "Call" intent (Capacitor `tel:` link) — that page is auth-required.
- Public availability response: zero PII.

### 11.5 Clinic notes — plaintext + banner (SCOPE rev-2 MF5 — LOCKED)

V2 ships clinic notes as **plaintext UTF-8**. Encryption-at-rest is deferred
to FUTURE_EPIC (see §19 + Risk #3). SCOPE rev 2 explicitly rejects
pgcrypto-with-env-key-only because:
- pgcrypto functions are SQL-callable; key control is the actual gate, not the role split.
- Proper envelope encryption requires KEK rotation + audit pipeline not yet hardened.
- "Shipping plaintext + banner is honest; shipping fake encryption is worse."

**What ships in V2:**
- `Appointment.notes String?` (plaintext).
- `ClinicNotesBanner.tsx` (File Plan #46a) rendered on `AppointmentDetailPage` when `Business.vertical === 'CLINIC'` — copy: "Clinical notes are not encrypted at rest yet — do not store PHI".
- Server logs + Sentry middleware: `redactPiiFields(['notes'])` strips `notes` from every log line and event payload.
- `audit_log` row on every clinic-notes READ (kept — that part is right).
- Owner education in Settings copy ("for sensitive PHI use your existing EMR").

### 11.6 DB role split

- `app_rw` (application runtime): SELECT, INSERT, UPDATE, DELETE on `Appointment*`. Sees `notes` plaintext (no decrypt grant exists — there is no key to grant).
- `analyst_ro` (engineers' analytics role): SELECT on `Appointment` — sees `notes` plaintext. This is the honest state; analytics SQL on `Appointment` MUST exclude the `notes` column at the query level (enforced by code review on dashboards repo).
- The `app_decrypt` role from rev 1 is **removed**.

---

## 12. Observability

### 12.1 Analytics events (8 — 7 product + 1 Sentry-only)

| Event | Properties | Emit site |
|---|---|---|
| `appointment_created` | `{ source, vertical, hasEmployee, hasRecurrence, durationMinutes }` | `appointment.service.ts → createAppointment` success |
| `appointment_status_changed` | `{ fromStatus, toStatus, vertical, hadReason }` | `appointment.service.ts → patchStatus` success |
| `appointment_slot_conflict_409` | `{ source, attemptCount, employeeIdHash }` | `appointment.service.ts → createAppointment` conflict branch |
| `appointment_no_show` | `{ vertical, leadDays, hadReminderSent }` | `patchStatus → NO_SHOW` |
| `appointment_completed_to_invoice` | `{ target: 'JOB'|'INVOICE', vertical, msSinceCheckIn }` | `appointment-convert.service.ts` success |
| `appointment_calendar_viewed` | `{ view: 'day'|'week', vertical }` | FE `useCalendarView` on mount + toggle |
| `appointment_public_booking_completed` | `{ vertical, slotsShown, captchaShown }` | `appointment-public.routes.ts → POST` success |
| `appointment_reminder_sent` | `{ channel: 'SMS'|'WA', leadHours, vertical }` | `reminder-dispatch.ts → APPOINTMENT_UPCOMING` send success |
| `appointment_replay_rejected` *(Sentry-only, non-alerting metric)* | `{ appointmentId, attemptedStatus, currentStatus }` | `src/lib/api-queue-replay.ts → on 409 INVALID_TRANSITION` |

### 12.2 Sentry alerts

- 409 SLOT_CONFLICT rate > 2% of creates over 5 min → warn
- Convert failure rate > 1% over 5 min → page
- Availability latency p95 > 500ms over 5 min → warn
- Archive cron failure → page
- `appointment_replay_rejected` event rate > 10/min sustained 5 min → warn (signals client-side clock drift or a buggy mutation flow)

### 12.3 Metrics + dashboards

- `appointments.created.total{vertical,source}` counter
- `appointments.active.gauge{businessId}` (SCHEDULED+CONFIRMED+CHECKED_IN)
- `appointments.conversion.success.total{target}` counter
- `appointments.availability.duration_ms{p50,p95,p99}` histogram
- Grafana dashboard `appointments-v2` with funnel: created → confirmed → checked_in → completed → converted.

### 12.4 Cost alerts

- Reminders cost: alert at 1.5× 30-day rolling baseline per business.
- Public-booking spend (captcha + SMS verify): soft cap $50/day (per SCOPE ASSUMPTION 8).

---

## 13. File Plan (HARD GATE)

Layer caps respected: every row ≤ 250 lines. Build phase: **API** (backend) before **FE** (frontend) before **Cron** (scripts). Tests interleaved with their target layer.

| # | Path | Action | Est. Lines | Layer | Build phase |
|---|---|---|---|---|---|
| 1 | `server/prisma/schema.prisma` | edit | +105 | schema | API |
| 2 | `server/prisma/migrations/20260530120000_v2_appointments/migration.sql` | create | ~215 | migration | API |
| 3 | `server/src/features/appointments/appointment.types.ts` | create | ~80 | types | API |
| 4 | `server/src/features/appointments/appointment.constants.ts` | create | ~70 | constants | API |
| 5 | `server/src/features/appointments/appointment.schema.ts` | create | ~150 | schema (Zod) | API |
| 6 | `server/src/features/appointments/appointment.utils.ts` | create | ~160 | utils (pure) | API |
| 7 | `server/src/features/appointments/appointment.repo.ts` | create | ~220 | transport | API |
| 8 | `server/src/features/appointments/appointment-conflict.repo.ts` | create | ~120 | transport | API |
| 9 | `server/src/features/appointments/appointment.service.ts` | create | ~230 | service | API |
| 10 | `server/src/features/appointments/appointment-status.service.ts` | create | ~180 | service | API |
| 11 | `server/src/features/appointments/appointment-convert.service.ts` | create | ~180 | service | API |
| 12 | `server/src/features/appointments/appointment-recurrence.service.ts` | create | ~150 | service | API |
| 13 | `server/src/features/appointments/appointment-availability.service.ts` | create | ~160 | service | API |
| 14 | `server/src/features/appointments/appointment-waitlist.service.ts` | create | ~140 | service | API |
| 14a | `server/src/features/appointments/public-booking-signature.ts` | create | ~110 | utils | API |
| 14b | `server/src/features/appointments/__tests__/public-booking-signature.test.ts` | create | ~140 | test | API |
| 15 | `server/src/features/appointments/appointment.routes.ts` | create | ~200 | route | API |
| 16 | `server/src/features/appointments/appointment-public.routes.ts` | create | ~180 | route | API |
| 16a | `server/src/features/business/settings-rotation.service.ts` | create | ~90 | service | API |
| 16b | `server/src/features/business/settings.routes.ts` | edit | +30 | route | API |
| 17 | `server/src/features/reminders/reminder.constants.ts` | edit | +10 | constants | API |
| 18 | `server/src/features/reminders/reminder-dispatch.ts` | edit | +45 | service | API |
| 18a | `server/src/features/parties/party.service.ts` | edit | +30 | service | API |
| 18b | `server/src/features/employees/employee.service.ts` | edit | +30 | service | API |
| 18c | `server/src/lib/log-redact.ts` | edit | +10 | utils | API |
| 19 | `server/scripts/cron/archive-appointments.ts` | create | ~130 | script | Cron |
| 20 | `server/scripts/cron/prune-waitlist.ts` | create | ~70 | script | Cron |
| 21 | `server/scripts/seed-appointments-test.ts` | create | ~140 | script | Cron |
| 22 | `server/src/index.ts` | edit | +6 | route registration | API |
| 23 | `server/src/config/features.ts` | edit | +4 | flag | API |
| 24 | `server/src/features/appointments/__tests__/appointment.service.test.ts` | create | ~230 | test | API |
| 25 | `server/src/features/appointments/__tests__/appointment-conflict.test.ts` | create | ~200 | test | API |
| 26 | `server/src/features/appointments/__tests__/appointment-status.test.ts` | create | ~180 | test | API |
| 27 | `server/src/features/appointments/__tests__/appointment-convert.test.ts` | create | ~160 | test | API |
| 28 | `server/src/features/appointments/__tests__/appointment-recurrence.test.ts` | create | ~140 | test | API |
| 28a | `server/src/features/appointments/__tests__/cross-tenant.integration.test.ts` | create | ~180 | test | API |
| 28b | `server/src/features/appointments/__tests__/soft-delete-guard.test.ts` | create | ~120 | test | API |
| 29 | `shared/enums.ts` (or `src/lib/api-types.ts`) | edit | +25 | types (shared) | FE |
| 29a | `src/lib/api-queue-replay.ts` | edit | +40 | utils | FE |
| 30 | `src/features/appointments/appointment.types.ts` | create | ~90 | types | FE |
| 31 | `src/features/appointments/appointment.constants.ts` | create | ~80 | constants | FE |
| 32 | `src/features/appointments/appointment.utils.ts` | create | ~170 | utils | FE |
| 33 | `src/features/appointments/appointment.service.ts` | create | ~150 | service | FE |
| 34 | `src/features/appointments/hooks/useAppointments.ts` | create | ~150 | hook | FE |
| 35 | `src/features/appointments/hooks/useAvailability.ts` | create | ~120 | hook | FE |
| 36 | `src/features/appointments/hooks/useAppointmentMutations.ts` | create | ~190 | hook | FE |
| 37 | `src/features/appointments/hooks/useAppointmentForm.ts` | create | ~180 | hook | FE |
| 38 | `src/features/appointments/hooks/useCalendarView.ts` | create | ~100 | hook | FE |
| 39 | `src/features/appointments/components/CalendarDayView.tsx` | create | ~210 | sub-component | FE |
| 40 | `src/features/appointments/components/CalendarWeekView.tsx` | create | ~230 | sub-component | FE |
| 41 | `src/features/appointments/components/AppointmentCard.tsx` | create | ~150 | sub-component | FE |
| 42 | `src/features/appointments/components/CreateAppointmentDrawer.tsx` | create | ~240 | sub-component | FE |
| 43 | `src/features/appointments/components/SlotPicker.tsx` | create | ~210 | sub-component | FE |
| 44 | `src/features/appointments/components/StatusActionBar.tsx` | create | ~140 | sub-component | FE |
| 45 | `src/features/appointments/components/ConvertToBillSheet.tsx` | create | ~160 | sub-component | FE |
| 46 | `src/features/appointments/components/AppointmentEmptyState.tsx` | create | ~80 | sub-component | FE |
| 46a | `src/features/appointments/components/ClinicNotesBanner.tsx` | create | ~60 | sub-component | FE |
| 47 | `src/features/appointments/components/WaitlistSheet.tsx` | create | ~190 | sub-component | FE |
| 48 | `src/features/appointments/components/RecurrenceFields.tsx` | create | ~140 | sub-component | FE |
| 49 | `src/features/appointments/pages/AppointmentsPage.tsx` | create | ~150 | page | FE |
| 50 | `src/features/appointments/pages/AppointmentDetailPage.tsx` | create | ~160 | page | FE |
| 51 | `src/features/appointments/appointments.css` | create | ~230 | css | FE |
| 52 | `src/routes.tsx` | edit | +8 | route | FE |
| 53 | `src/components/layout/BottomNav.tsx` | edit | +12 | nav | FE |
| 54 | `src/config/features.ts` | edit | +4 | flag | FE |
| 55 | `src/lib/translations.en.ts` | edit | +95 | i18n | FE |
| 56 | `src/lib/translations.hi.ts` | edit | +95 | i18n | FE |
| 57 | `src/features/appointments/__tests__/appointment.utils.test.ts` | create | ~180 | test | FE |
| 58 | `src/features/appointments/__tests__/CreateAppointmentDrawer.test.tsx` | create | ~200 | test | FE |
| 59 | `src/features/appointments/__tests__/SlotPicker.test.tsx` | create | ~160 | test | FE |
| 60 | `src/features/appointments/__tests__/useAppointmentMutations.test.ts` | create | ~150 | test | FE |
| 60a | `src/features/appointments/__tests__/replay-rejection.test.tsx` | create | ~140 | test | FE |
| 61 | `docs/API_CONTRACTS_V2_APPOINTMENTS.md` | create | ~250 | doc | API |

Every estimate ≤ 250L. Largest rows (#9, #42, #51) are at 230–240 — if any
crosses 250 during build, split a sub-file before commit (e.g. extract
`appointment.service.ts` → `appointment-create.service.ts` + leave list/read
in the parent).

---

## 14. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| EXCLUSION constraint conflict rate higher than expected under concurrent booking spikes | Low | Med | Constraint is declarative; conflicts surface as clean 409s. Sentry alert at 2% / 5 min (§12.2). No retry/backoff needed at app tier. |
| Recurrence eager expansion (52 rows) bloats DB on widespread adoption | Med | Med | Archive cron + `recurrenceGroupId` index → cheap "delete whole series" op. Reassess at 10K active recurrences. |
| **Plaintext PHI accidentally entered in clinic notes** | Med | High | `ClinicNotesBanner` on every detail page render in CLINIC vertical; owner education in Settings copy; log + Sentry redaction of `notes` field; FUTURE_EPIC tracks envelope encryption (§19). |
| Public booking link leaks employee identity via opaque-id correlation | Med | Med | Opaque id = HMAC(secret-version, employeeId) — refreshes on rotation. Rotation flow exposed in Settings (§5.11). |
| FE state-machine drift from server (new status added server-side) | Med | Low | FE tolerates unknown status (renders as "Other"); SCOPE Resolved Decision. |
| Capacitor date picker UX on cheap Android phones | Med | Low | Native picker tested on Redmi 9A (target floor); fallback custom picker = FUTURE if data shows drop-off. |
| `endAt` CHECK constraint blocks future "open-ended" appointments | Low | Low | V2 has no open-ended; if needed later, the CHECK must be relaxed via migration. |
| Reminder cost spike (clinic with 200 patients/day × 2 reminders) | Med | Med | V5 budget cap (50 SMS, 200 WA per day, per business). Owner notified on cap. |
| Convert idempotency race (two devices tap "Convert" simultaneously) | Low | Med | DB `@@unique` on `convertedJobId` + #150 conditional update — last-wins is safe (returns existing). |
| `btree_gist` extension absent on Render Postgres | Low | High | Migration `CREATE EXTENSION IF NOT EXISTS btree_gist` is idempotent. Verify on staging before promotion to prod (smoke test #1 of pre-deploy checklist). |
| Soft-delete guard race (delete request + new appointment create within same ms) | Low | Low | App-layer guard runs in same tx as soft-delete; EXCLUSION constraint provides defence-in-depth for the appointment side. |

---

## 15. Test Plan

### 15.1 Unit (server)

- `appointment.utils.test.ts` — `findFreeSlots`, `mergeBusyRanges`, `isPastSlot`, recurrence date generation, edge cases (DST not relevant in IST; month-end recurrence; leap-year Feb 29).
- `appointment-status.test.ts` — every cell of the state machine matrix (correct → 200, incorrect → 409, terminal → 409 except notes-edit).
- `appointment-conflict.test.ts` — two parallel `create` calls, one wins via `23P01`; idempotency-key replay returns same row 200; `employeeId IS NULL` skips guard (two concurrent inserts both succeed).
- `appointment-convert.test.ts` — convert COMPLETED → JOB returns id; convert again → same id, 200; convert non-COMPLETED → 409; convert wrong vertical → 400.
- `appointment-recurrence.test.ts` — 52 occurrences boundary, 53 → 400, partial-overlap mid-series aborts whole tx.
- `public-booking-signature.test.ts` (File Plan #14b) — canonical payload encoding; signature verification timing-safe; `revokedAt IS NOT NULL` rejected before HMAC verify; expired token rejected; rotation invalidates all prior tokens; field-injection attempts via `|` in business name rejected.
- `soft-delete-guard.test.ts` (File Plan #28b) — party with active appointment → 409; party with only terminal → succeeds + FK SetNull + snapshot preserved.

### 15.2 Integration (server, curl trio + cross-tenant mandate)

For every route accepting an input resource ID:
- 200/201 happy path
- 401 (no JWT)
- 400 (invalid body)
- **404 (cross-business id) — MANDATORY per §11.0 invariant, one test per (route × input-ID)**
- 409 where applicable (conflict + invalid-transition)

`cross-tenant.integration.test.ts` (File Plan #28a) exhaustively exercises
the §11.0 route table: every (route, input-ID) cell has a dedicated 404
test where the ID belongs to a different business.

### 15.3 FE

- `appointment.utils.test.ts` — slot grid math, busy-range merging.
- `CreateAppointmentDrawer.test.tsx` — wizard state machine; offline submit path (queues `{}` return, toast `"Saved — will sync when online"`); online submit happy path.
- `SlotPicker.test.tsx` — busy-cell greyed; past-cell disabled; keyboard nav; tap target ≥44px at 320px.
- `useAppointmentMutations.test.ts` — tolerates `{}` offline return; doesn't deref `data.id` without guard; invalidates correct query keys.
- `replay-rejection.test.tsx` (File Plan #60a) — queued status PATCH replays as 409 INVALID_TRANSITION → toast renders correct copy; detail-drawer reopens with refetched current state; Sentry `appointment_replay_rejected` event emitted with attempted + current status.

### 15.4 4-UI-state screenshots (manual + Playwright)

For both `/appointments` and `/appointments/:id`:
- loading / error / empty / success
- at 320, 375, 768, 1024, 1280, 1536
- light + dark mode

Stored under `playwright/screenshots/v2-appointments/`.

### 15.5 E2E (Playwright)

- Salon happy path (SCOPE §"User Flow #1"): seed business + employee + party → owner books at 3pm → checks in → completes → converts to Job. Assert each side effect.
- Clinic happy path: same shape, converts to Invoice. `ClinicNotesBanner` visible above notes field.
- Public booking happy path: load link → pick slot → submit → server creates Party + Appointment + lands `SCHEDULED`.
- Public-link rotation: owner rotates → prior link → 401 LINK_REVOKED.
- Slot conflict E2E: two pages, same time, one wins (EXCLUSION constraint).

### 15.6 Performance

- `scripts/perf-budget.js` extended with `/appointments` budget (LCP < 2.5s, route chunk ≤ 80KB).
- Lighthouse run in CI on `/appointments` before each release.

### 15.7 Lint codemod follow-up

- Add `no-unscoped-id-read` rule to `scripts/enforce.js` (per §11.0). Tracked as a separate small PR after main epic merges.

---

## 16. Rollout Plan

### 16.1 Feature flag

Backend (`server/src/config/features.ts`):
```ts
export const FEATURES = {
  APPOINTMENTS_V2: process.env.FEATURE_APPOINTMENTS_V2 === 'true',
  APPOINTMENTS_V2_RECURRING: process.env.FEATURE_APPOINTMENTS_V2_RECURRING === 'true',
  APPOINTMENTS_V2_PUBLIC_BOOKING: process.env.FEATURE_APPOINTMENTS_V2_PUBLIC_BOOKING === 'true',
  APPOINTMENTS_V2_REMINDERS: process.env.FEATURE_APPOINTMENTS_V2_REMINDERS === 'true',
} as const;
```

Frontend (`src/config/features.ts`):
```ts
export const FEATURES = {
  APPOINTMENTS_V2: import.meta.env.VITE_FEATURE_APPOINTMENTS_V2 === 'true',
  // ...
} as const;
```

Route check (server): every appointment route returns 404 if `FEATURES.APPOINTMENTS_V2 === false`.

UI check (FE): `BottomNav` hides Calendar item if flag off; `routes.tsx` redirects `/appointments` → `/dashboard` if flag off. (Belt + braces — flag is checked at both layers.)

### 16.2 Vertical scoping

The "Calendar" surface appears in BottomNav (or More menu, depending on existing UX) **only** when both:
- `FEATURES.APPOINTMENTS_V2 === true`, AND
- `business.vertical IN ('SALON', 'CLINIC')`.

Other verticals never see the entry point (their bottom nav is unchanged). Direct URL access returns 404. This matches Phase 6 precedent.

### 16.3 Cohort ramp

Like Phase 6 hourly billing:

| Stage | Audience | Flag value | Gate before next |
|---|---|---|---|
| 0. Internal | Sawan's test businesses (SALON + CLINIC seed) | `FEATURE_APPOINTMENTS_V2=true` for those userIds via middleware | Curl 200/401/400/409 + screenshots of 4 UI states |
| 1. 10% | `hash(businessId) % 10 === 0` AND vertical IN (SALON, CLINIC) | percentage gate in middleware | 24h: error rate < 0.5%, p95 < 200ms, no Sentry pages |
| 2. 50% | `hash(businessId) % 2 === 0` AND vertical IN (SALON, CLINIC) | same | 48h: same gates |
| 3. 100% | all SALON + CLINIC | `FEATURE_APPOINTMENTS_V2=true` everywhere | 7-day soak; Grafana dashboard reviewed |
| 4. Other verticals | NICE_TO_HAVE — defer per vertical roadmap | — | — |

### 16.4 Sub-flags

- `APPOINTMENTS_V2_RECURRING`: ship at Stage 2 (50%). Less critical, gives us a clean rollback if recurrence has bugs without blocking core calendar.
- `APPOINTMENTS_V2_PUBLIC_BOOKING`: ship at Stage 3 (100%). Public surface gets a full week of soak first.
- `APPOINTMENTS_V2_REMINDERS`: ship at Stage 2 (50%). Per-business opt-in even when flag is on.

### 16.5 Kill-switch

Setting `FEATURE_APPOINTMENTS_V2=false` in Render env at any stage:
- Hides all UI within ~60s (Vercel FE rebuild + cache bust).
- Returns 404 on all backend routes immediately.
- Existing data is preserved (no destructive action).
- Cron jobs (archive, prune, reminder dispatch for `APPOINTMENT_UPCOMING`) self-no-op when flag is false.

---

## 17. SCOPE Conformance Map

Every SCOPE MUST_SHIP, SHOULD_SHIP, accepted trade-off, resolved decision, and ephemeral cleanup pinned to an artifact. Rev-2 deltas reflected.

| SCOPE decision / goal | Architecture artifact | Status |
|---|---|---|
| MUST_SHIP: `Appointment` model (businessId-scoped, party+employee, startAt+duration, status, source, idempotencyKey) | `Appointment` model §2.2 + File Plan #1, #2 | OK |
| MUST_SHIP: Day view + week view, no 320px overflow | `CalendarDayView.tsx` / `CalendarWeekView.tsx` File Plan #39, #40 + §7 | OK |
| MUST_SHIP: Create-appointment drawer (party→service→employee→slot) | `CreateAppointmentDrawer.tsx` File Plan #42 + §6.3 state machine | OK |
| MUST_SHIP: Per-employee availability + 409 on conflict | `GET /availability` §5.7 + EXCLUSION constraint §3.2 + §4 | OK |
| MUST_SHIP: Status state machine SCHEDULED→…→COMPLETED/NO_SHOW/CANCELLED + audit | §4b table + `AppointmentStatusEvent` §2.4 + `appointment-status.service.ts` File Plan #10 | OK |
| MUST_SHIP: Convert COMPLETED → Job (SERVICES) / Invoice (CLINIC) | `appointment-convert.service.ts` File Plan #11 + §5.6 | OK |
| MUST_SHIP: Offline create + status queue with `entityType: 'appointment'` | §8.1 + `useAppointmentMutations.ts` File Plan #36 | OK |
| MUST_SHIP: 4 UI states at 320/375/768/1024/1280/1536 | §7 responsive strategy + §15.4 screenshot matrix | OK |
| MUST_SHIP: Translations EN + HI | File Plan #55, #56 | OK |
| **MF1: EXCLUSION constraint (btree_gist) primitive — not FOR UPDATE, not NOT EXISTS** | §3.2 migration + §4.2 catch-23P01 + Risk #10 | **OK** (rev 2) |
| **MF2: Nullable FKs + SetNull + party/employeeNameSnapshot + app-layer active-guard** | §2.2 schema + §2.7 invariants + §6.4 render + File Plan #18a, #18b, #28b | **OK** (rev 2) |
| **MF3: HMAC-SHA256 over `{businessId, employeeId?, expiresAt}` + per-business secret + SharedLink.revokedAt + rotation flow** | §2.6 (BusinessSettings + SharedLink columns) + §10.1.1 + §5.11 + File Plan #14a, #14b, #16a, #16b | **OK** (rev 2) |
| **MF4: Cross-tenant JOIN guard architectural invariant** | §11.0 (new section) + canonical helpers + lint rule + File Plan #28a cross-tenant integration suite | **OK** (rev 2) |
| **MF5: Clinic notes ship plaintext + `ClinicNotesBanner` (encryption deferred to FUTURE_EPIC)** | §2.2 (`notes String?`) + §11.5 + Risk #3 + §19 FUTURE_EPIC + File Plan #46a (banner) + #18c (log redact) | **OK** (rev 2) |
| **MF6: Offline replay UX (409 conflict toast + detail drawer reopen + Sentry event + alert)** | §8.3 + §12.1 event #8 + §12.2 alert + File Plan #29a, #60a | **OK** (rev 2) |
| **SF1: Denormalized `endAt` + CHECK constraint** | §2.2 + §3.2 CHECK | OK |
| SHOULD_SHIP: Recurring appointments, eager-expand, max 52 | `AppointmentRecurrenceGroup` §2.3 + `appointment-recurrence.service.ts` #12 + flag `APPOINTMENTS_V2_RECURRING` §16.4 | OK |
| SHOULD_SHIP: SMS/WA reminder T-24h + T-2h via V5 + new trigger | §9 + flag `APPOINTMENTS_V2_REMINDERS` + analytics event `appointment_reminder_sent` §12.1 | OK |
| SHOULD_SHIP: Waitlist per business per day, manual promote | `AppointmentWaitlist` §2.5 + `appointment-waitlist.service.ts` #14 + `WaitlistSheet.tsx` #47 | OK |
| SHOULD_SHIP: Customer-facing booking link (#130 envelope reuse, own signature spec) | `appointment-public.routes.ts` File Plan #16 + §10 + §10.1.1 | OK |
| SHOULD_SHIP: 8am day-summary push | `GET /day-summary` §5.8 + uses existing FCM pipeline (no new infra) | OK |
| NICE_TO_HAVE: Drag-to-reschedule on desktop | Not in File Plan | MISSING — FUTURE_EPIC (§19, post-100% rollout) |
| NICE_TO_HAVE: Color-code by employee | Already in Employee model; consumed in `AppointmentCard.tsx` #41 | OK |
| NICE_TO_HAVE: Print-friendly day sheet | Not in File Plan | MISSING — FUTURE_EPIC |
| Resolved: UTC in DB, IST in UI | §2.2 (startAt `DateTime` UTC) + §7 render in `Asia/Kolkata` | OK |
| Resolved: 15-min slot granularity | `appointment.constants.ts` File Plan #4 + #31 | OK |
| Resolved: Duration bounds 5–480 min | Zod schema #5 + CHECK constraint §2.2 | OK |
| Resolved: 31-day range cap | Zod + route handler §5.2 | OK |
| Resolved: Conflict detection DB-level (rev 2: EXCLUSION not FOR UPDATE) | §3.2 + §4.2 | OK |
| Resolved: Convert target branched by `BusinessVertical` server-side | §5.6 + `appointment-convert.service.ts` | OK |
| Resolved: Recurrence eager-expand, max 52 | Above | OK |
| Resolved: Public booking auth = SharedLink envelope + HMAC signature + hCaptcha | §10 + §10.1.1 | OK |
| Resolved: FE tolerates unknown enum values | §6.2 + Risk #5 | OK |
| Resolved: Notes — plaintext + banner in V2 (rev 2 swap) | §11.5 + §2.2 | OK |
| Resolved: Index `(businessId, startAt)` + status partial | §2.2 + migration §3.2 (includes partial index for hot statuses) | OK |
| Resolved: Reminder lead times T-24h + T-2h | §9.3 default seeded rules | OK |
| Accepted trade-off: No multi-resource | FUTURE_EPIC; `employeeId` overloaded as resource for MVP | OK |
| Accepted trade-off: Recurrence eager not lazy | §2.3 stores group; rows materialized at create | OK |
| Accepted trade-off: `employeeId` nullable | §2.2 + §4.3 conflict-skip behaviour of EXCLUSION on NULL | OK |
| Accepted trade-off: Day view default on mobile | §7.1 | OK |
| Ephemeral cleanup: `appointment_archive` after 90d for CANCELLED/NO_SHOW | `scripts/cron/archive-appointments.ts` File Plan #19 | OK |
| Ephemeral cleanup: waitlist prune preferredDate < today-7d | `scripts/cron/prune-waitlist.ts` File Plan #20 | OK |
| Retention: 7y clinic, 2y salon archive | §2 cleanup table + branch in archive script | OK |
| Analytics: 7 product events + `appointment_reminder_sent` + Sentry-only `appointment_replay_rejected` | §12.1 table (8 rows) | OK |
| Error codes (complete) | §5.12 | OK |
| Autocomplete attrs on public-link customer fields | `appointment-public.routes.ts` consumer FE will set `autocomplete="name"` / `"tel"` per SCOPE — noted in File Plan public surface page (out of architecture scope; gated by FE-builder checklist) | OK |
| QA: Status state machine matrix tested every edge | §15.1 unit + §15.2 integration | OK |
| QA: BottomNav shows Calendar only for SALON+CLINIC | §16.2 + File Plan #53 | OK |
| QA: Cross-tenant 404 per (route × input-ID) | §15.2 + File Plan #28a | OK |
| Failure mode #1 (provider outage) | V5 retry queue reused — §9 + Risk #8 | OK |
| Failure mode #2 (abuse spike on public link) | §10.2 rate limits + PENDING_REVIEW soft cap + rotation §5.11 | OK |
| Failure mode #3 (DB bloat at 100M rows) | §2.2 indexes + partial index + archive cron | OK |
| Failure mode #4 (client-version lag) | API v1 additive + flag-gated features + FE unknown-status tolerance + replay UX §8.3 | OK |
| Failure mode #5 (DPDP tightening) | §11.5 banner + redact + audit + FUTURE_EPIC encryption | OK |
| Failure mode #6 (reminder cost runaway) | §9.4 budget cap reuse | OK |
| Failure mode #7 (insider abuse) | §11.6 role split + audit log + dashboards-must-exclude-notes review rule | OK |

### Deviations from SCOPE

**None remaining in rev 2.** The rev-1 deviation rationalising
`INSERT … WHERE NOT EXISTS` under Serializable isolation as
"equivalent to FOR UPDATE" is **rescinded** — SCOPE rev 2 locked the
EXCLUSION constraint as the only race-safe primitive, and §3.2 / §4.2
adopt it directly.

---

## 18. Failure-Mode Implementation

| Failure mode | SCOPE mitigation | Architecture site |
|---|---|---|
| Provider outage (WA/SMS down 30 min) | V5 retry + "Reminder pending" pill | `reminder-dispatch.ts` reused (File Plan #18) + FE pill in `AppointmentCard.tsx` #41 |
| Abuse spike on public link | per-link rate limit + per-business soft cap + hCaptcha + rotation | `appointment-public.routes.ts` #16 + §10.2 + §5.11 |
| DB bloat at 100M rows | composite index + partial index + range cap + archive cron | §2.2 indexes + §3.2 partial idx + §5.2 `RANGE_TOO_WIDE` + `archive-appointments.ts` #19 |
| Client-version lag | additive API + flag-gated features + tolerant FE enums + offline replay UX | §16 flag matrix + §6.2 + §8.3 |
| DPDP regulatory tightening | banner + log redact + audit-on-read; envelope encryption FUTURE_EPIC | §11.5 + §18c log-redact + §19 |
| Reminder cost runaway | per-business daily cap | §9.4 reuses V5 budget gate |
| Insider abuse (DB-level note reads) | role split + audit log + dashboards-must-exclude-notes review rule | §11.6 |

---

## 19. Open Questions (escalated ASSUMPTIONs) + FUTURE_EPIC list

The following SCOPE ASSUMPTIONs are **locked** in this architecture (most),
or escalated as open questions for product/Sawan decision (a few).

### Locked

| # | ASSUMPTION | Decision | Site |
|---|---|---|---|
| 1 | Slot granularity = 15 min | LOCKED | `appointment.constants.ts` |
| 2 | Range cap = 31 days | LOCKED | `appointment.constants.ts` + §5.2 |
| 3 | Duration bounds 5–480 min | LOCKED | Zod + CHECK constraint |
| 4 | Recurrence eager, cap 52 | LOCKED | §2.3 + recurrence service |
| 6 | Reminder lead times T-24h + T-2h | LOCKED as defaults; owner-overridable per rule | §9.3 |
| 7 | `employeeId` nullable ("any staff") | LOCKED | §2.2 + §4.3 |
| 8 | Public booking SCHEDULED by default, > 200/day → PENDING_REVIEW | LOCKED | §10.2 |
| 10 | Convert target by vertical (SERVICES→Job, CLINIC→Invoice) | LOCKED | §5.6 |
| 11 | iOS deferred; Android-first | LOCKED | per project rules |
| 14 | No structured Service model in V2; reuse JobTemplate else free-text | LOCKED | `serviceLabel` + optional `jobTemplateId` in schema |
| 15 | Waitlist promote manual in MVP | LOCKED | §2.5 + `appointment-waitlist.service.ts` |

### Open (default chosen, flagged for Sawan)

| # | ASSUMPTION | Default chosen | Why default | Owner decision needed |
|---|---|---|---|---|
| 5 | Salon archive 2y, clinic 7y | **Lock at 2y/7y** | Matches industry norms; can extend without data loss | Confirm with legal counsel before public launch |
| 9 | Notes encryption only for clinic | **Plaintext + banner in V2; encryption FUTURE_EPIC** | SCOPE rev 2 MF5 — fake encryption worse than honest plaintext | Confirm FUTURE_EPIC priority post-100% rollout |
| 12 | LocalNotifications fallback when WA/SMS rate-limited | **Lock on** | Free, no infra | Confirm UX team is OK with native-notification copy |
| 13 | `BusinessFeature` uses existing row-based flag table | **Lock as-is** | Already proven in V5 | None — confirmed by code search of `BusinessFeature` table usage |

### FUTURE_EPIC backlog (tracked post-100%)

- **Clinic-notes envelope encryption** — per-business DEK, KEK rotation, decrypt audit log. Pre-reqs: KMS choice (AWS KMS vs pgcrypto-with-rotation-tooling), `notes_key_version` column on `Appointment`, decrypt audit consumer.
- **Drag-to-reschedule on desktop week view** — promote NICE_TO_HAVE once 100% ramp completes.
- **Print-friendly day sheet** — promote NICE_TO_HAVE.

All open items have a default chosen and a path to ship. None block
architecture sign-off.

---

## 20. Revision Log

| Date | Rev | Note |
|---|---|---|
| 2026-05-30 | 1 | Initial draft. Awaiting architecture-auditor pass. Companion `API_CONTRACTS_V2_APPOINTMENTS.md` to be generated as File Plan #61. |
| 2026-05-30 | 2 | Absorbed SCOPE rev-2 deltas (MF1 exclusion constraint, MF2 SetNull+snapshots, MF3 HMAC spec, MF4 invariant, MF5 plaintext+banner, MF6 replay UX) per `ARCHITECTURE_AUDIT_V2_APPOINTMENTS.md`. |
