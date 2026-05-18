-- =====================================================================
-- Phase 6 — Staff & HR — schema core (PR1A)
-- =====================================================================
-- Architecture: docs/ARCHITECTURE_PHASE6_STAFF_HR.md §2.1 (new tables),
-- §2.2 (column-level changes), §2.4 (migration sequence), §7.5 (audit
-- search), §8.3 (Payment.reversesPaymentId), §8.5 (Employee↔STAFF Party).
--
-- Pure-additive migration. No backfill phase. Every new column is either
-- nullable or has a default, so existing rows are not touched.
--
-- The shipped baseline schema.prisma has 51 lines of pre-existing drift
-- against the migration history (ReminderLog index re-orderings,
-- {CollectionCadence,PaymentLink,PromiseToPay}.updatedAt DROP DEFAULT,
-- Product.weightedAvgCostPaise SET NOT NULL, Batch/PaymentLink/Product/
-- PromiseToPay/StockAlert/StockVerificationItem index reshuffles). Those
-- deltas are out of scope for PR1A and are explicitly EXCLUDED from this
-- migration so we don't ship unrelated mutations as part of the HR epic.
-- (They live in /tmp/baseline_drift.sql in the dev environment; a separate
-- hygiene PR should reconcile them.)
-- =====================================================================

-- =====================================================================
-- 1. Column additions to existing tables
-- =====================================================================

-- AlterTable — AuditLog: full-text search vector (§7.5) + per-row redaction record (§7.6).
-- searchVector is tsvector (Prisma Unsupported); GIN index + trigger appear at the end.
-- redactedFields defaults to empty object so existing rows roll forward cleanly.
ALTER TABLE "AuditLog"
  ADD COLUMN "redactedFields" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "searchVector" tsvector;

-- AlterTable — Business: firm-level suspend timestamp (§3.5; requireActiveBusiness FIRM_SUSPENDED 403)
ALTER TABLE "Business" ADD COLUMN "suspendedAt" TIMESTAMP(3);

-- AlterTable — BusinessUser: member-level suspend audit trail (§3.5).
-- `status='SUSPENDED'` already exists; these columns capture WHO + WHEN.
ALTER TABLE "BusinessUser"
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "suspendedById" TEXT;

-- AlterTable — Payment: reversal pointer (§8.3, A04.1 closure v2.3).
-- Pure additive ADD COLUMN nullable + UNIQUE INDEX + FK self-ref. No backfill.
-- `@unique` enforces "no reversal of a reversal" at the DB level: a second
-- attempt to write the same reversesPaymentId triggers Prisma P2002, which
-- the service translates to AppError(PAYROLL_ALREADY_REVERSED, 409).
ALTER TABLE "Payment" ADD COLUMN "reversesPaymentId" TEXT;

-- =====================================================================
-- 2. New tables (8) — architecture §2.1
-- =====================================================================

-- CreateTable — Employee (paired 1:1 with a STAFF Party; see §8.5)
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "partyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "designation" TEXT,
    "dailyRate" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable — Attendance (one row per Employee per date)
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "overtimeMin" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable — EmployeeAdvance (paise; subtracted by payroll-compute)
CREATE TABLE "EmployeeAdvance" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidBackAt" TIMESTAMP(3),
    "paymentId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "EmployeeAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable — PayrollRun (parent; state DRAFT → FINALIZED → REVERSED)
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalNet" INTEGER NOT NULL DEFAULT 0,
    "finalizedAt" TIMESTAMP(3),
    "finalizedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable — Payroll (child; one per Employee per PayrollRun)
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "presentDays" INTEGER NOT NULL,
    "halfDays" INTEGER NOT NULL,
    "overtimeMin" INTEGER NOT NULL,
    "advanceTotalPaise" INTEGER NOT NULL,
    "deductionsPaise" INTEGER NOT NULL,
    "grossPaise" INTEGER NOT NULL,
    "netPaise" INTEGER NOT NULL,
    "paymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable — PayslipSnapshot (immutable, frozen JSON blob at FINALIZE)
CREATE TABLE "PayslipSnapshot" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayslipSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable — PinPhoneLockout (DH-port verbatim; PIN-verify throttle)
CREATE TABLE "PinPhoneLockout" (
    "id" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PinPhoneLockout_pkey" PRIMARY KEY ("id")
);

-- CreateTable — PinResetToken (DH-port verbatim; single-use hash store)
CREATE TABLE "PinResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PinResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable — AuditLogRedaction (per-business custom field redaction)
CREATE TABLE "AuditLogRedaction" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "AuditLogRedaction_pkey" PRIMARY KEY ("id")
);

-- =====================================================================
-- 3. Indexes on new tables + on new columns
-- =====================================================================

-- Employee
CREATE UNIQUE INDEX "Employee_partyId_key" ON "Employee"("partyId");
CREATE INDEX "Employee_businessId_isDeleted_idx" ON "Employee"("businessId", "isDeleted");
CREATE INDEX "Employee_businessId_name_idx" ON "Employee"("businessId", "name");
CREATE UNIQUE INDEX "Employee_businessId_partyId_key" ON "Employee"("businessId", "partyId");

-- Attendance
CREATE INDEX "Attendance_businessId_date_idx" ON "Attendance"("businessId", "date");
CREATE UNIQUE INDEX "Attendance_businessId_employeeId_date_key" ON "Attendance"("businessId", "employeeId", "date");

-- EmployeeAdvance
CREATE INDEX "EmployeeAdvance_businessId_employeeId_idx" ON "EmployeeAdvance"("businessId", "employeeId");
CREATE INDEX "EmployeeAdvance_businessId_paidBackAt_idx" ON "EmployeeAdvance"("businessId", "paidBackAt");

-- PayrollRun
CREATE INDEX "PayrollRun_businessId_status_idx" ON "PayrollRun"("businessId", "status");
CREATE UNIQUE INDEX "PayrollRun_businessId_fromDate_toDate_key" ON "PayrollRun"("businessId", "fromDate", "toDate");

-- Payroll
CREATE INDEX "Payroll_businessId_employeeId_idx" ON "Payroll"("businessId", "employeeId");
CREATE UNIQUE INDEX "Payroll_businessId_payrollRunId_employeeId_key" ON "Payroll"("businessId", "payrollRunId", "employeeId");

-- PayslipSnapshot
CREATE UNIQUE INDEX "PayslipSnapshot_payrollId_key" ON "PayslipSnapshot"("payrollId");

-- PinPhoneLockout
CREATE UNIQUE INDEX "PinPhoneLockout_phoneE164_key" ON "PinPhoneLockout"("phoneE164");
CREATE INDEX "PinPhoneLockout_phoneE164_idx" ON "PinPhoneLockout"("phoneE164");

-- PinResetToken
CREATE UNIQUE INDEX "PinResetToken_tokenHash_key" ON "PinResetToken"("tokenHash");
CREATE INDEX "PinResetToken_userId_idx" ON "PinResetToken"("userId");
CREATE INDEX "PinResetToken_expiresAt_idx" ON "PinResetToken"("expiresAt");

-- AuditLogRedaction
CREATE UNIQUE INDEX "AuditLogRedaction_businessId_entityType_fieldPath_key" ON "AuditLogRedaction"("businessId", "entityType", "fieldPath");

-- New indexes on existing tables
CREATE INDEX "BusinessUser_businessId_suspendedAt_idx" ON "BusinessUser"("businessId", "suspendedAt");
CREATE UNIQUE INDEX "Payment_reversesPaymentId_key" ON "Payment"("reversesPaymentId");

-- =====================================================================
-- 4. Foreign keys (additive — every parent already exists)
-- =====================================================================

-- BusinessUser.suspendedById → User
ALTER TABLE "BusinessUser"
  ADD CONSTRAINT "BusinessUser_suspendedById_fkey"
  FOREIGN KEY ("suspendedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Payment.reversesPaymentId → Payment (self-ref; SET NULL preserves the
-- reversal row's existence if the original is hard-deleted, though hard
-- delete should never happen — Payment uses soft-delete).
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_reversesPaymentId_fkey"
  FOREIGN KEY ("reversesPaymentId") REFERENCES "Payment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Employee FKs
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_businessId_fkey"  FOREIGN KEY ("businessId")  REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey"      FOREIGN KEY ("userId")      REFERENCES "User"("id")     ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_partyId_fkey"     FOREIGN KEY ("partyId")     REFERENCES "Party"("id")    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id")     ON DELETE RESTRICT ON UPDATE CASCADE;

-- Attendance FKs
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_businessId_fkey"  FOREIGN KEY ("businessId")  REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey"  FOREIGN KEY ("employeeId")  REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id")     ON DELETE RESTRICT ON UPDATE CASCADE;

-- EmployeeAdvance FKs
ALTER TABLE "EmployeeAdvance" ADD CONSTRAINT "EmployeeAdvance_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeAdvance" ADD CONSTRAINT "EmployeeAdvance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeAdvance" ADD CONSTRAINT "EmployeeAdvance_paymentId_fkey"  FOREIGN KEY ("paymentId")  REFERENCES "Payment"("id")  ON DELETE SET NULL ON UPDATE CASCADE;

-- PayrollRun FKs
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_businessId_fkey"    FOREIGN KEY ("businessId")    REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id")     ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_createdById_fkey"   FOREIGN KEY ("createdById")   REFERENCES "User"("id")     ON DELETE RESTRICT ON UPDATE CASCADE;

-- Payroll FKs
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_businessId_fkey"   FOREIGN KEY ("businessId")   REFERENCES "Business"("id")   ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_employeeId_fkey"   FOREIGN KEY ("employeeId")   REFERENCES "Employee"("id")   ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_paymentId_fkey"    FOREIGN KEY ("paymentId")    REFERENCES "Payment"("id")    ON DELETE SET NULL ON UPDATE CASCADE;

-- PayslipSnapshot FKs
ALTER TABLE "PayslipSnapshot" ADD CONSTRAINT "PayslipSnapshot_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayslipSnapshot" ADD CONSTRAINT "PayslipSnapshot_payrollId_fkey"  FOREIGN KEY ("payrollId")  REFERENCES "Payroll"("id")  ON DELETE RESTRICT ON UPDATE CASCADE;

-- PinResetToken FK
ALTER TABLE "PinResetToken" ADD CONSTRAINT "PinResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AuditLogRedaction FKs
ALTER TABLE "AuditLogRedaction" ADD CONSTRAINT "AuditLogRedaction_businessId_fkey"  FOREIGN KEY ("businessId")  REFERENCES "Business"("id") ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "AuditLogRedaction" ADD CONSTRAINT "AuditLogRedaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id")     ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================================
-- 5. AuditLog full-text search — GIN index + trigger (raw SQL; §7.5)
-- =====================================================================
-- Per .claude/rules/PRISMA_MIGRATION_RULES.md, GIN indexes on tsvector are
-- raw-SQL only; we MUST NOT add @@index([searchVector]) to schema.prisma
-- because Prisma would generate a duplicate B-tree alongside the GIN.
--
-- The trigger keeps searchVector synchronized with the four auditable text
-- fields (action, entityType, entityLabel, reason). On INSERT or UPDATE
-- of any of those columns, searchVector is recomputed via to_tsvector. The
-- audit-search service issues `WHERE searchVector @@ websearch_to_tsquery('english', $1)`
-- (A03.1 closure v2.3 — websearch_ accepts Google-style queries without
-- crashing on user-typed FTS operators like R&D, (test), it's).

CREATE OR REPLACE FUNCTION audit_log_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := to_tsvector(
    'english',
    coalesce(NEW."action", '')       || ' ' ||
    coalesce(NEW."entityType", '')   || ' ' ||
    coalesce(NEW."entityLabel", '')  || ' ' ||
    coalesce(NEW."reason", '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_search_vector_trigger
BEFORE INSERT OR UPDATE OF "action", "entityType", "entityLabel", "reason"
ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION audit_log_search_vector_update();

CREATE INDEX "AuditLog_searchVector_idx"
  ON "AuditLog" USING GIN ("searchVector");
