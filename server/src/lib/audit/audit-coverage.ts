/**
 * AUDIT COVERAGE SSOT (G1 closure).
 *
 * Single source of truth for every mutation service that MUST write an
 * `AuditLog` row inside its `$transaction`. Pre-commit hook
 * `scripts/enforce-audit-coverage.mjs` reads this file, opens each listed
 * service, and verifies a `tx.auditLog.create(` or `prisma.auditLog.create(`
 * call exists in the file (or it is imported from an audit-writer helper).
 *
 * Services in this list that lack an audit-write FAIL the commit.
 *
 * Layout:
 *   - Path is RELATIVE to `server/src/` so the enforcer can resolve cleanly
 *     from repo root.
 *   - `ops` enumerates the named exports in that file expected to write
 *     audit. Reserved for the deeper AST walk planned for PR7+; the v1
 *     enforcer only verifies presence of `auditLog.create` in the file.
 *
 * Current state (PR1B): all 22 entries are EXPECTED MISSING — PR7 wires
 * each service to actually call `tx.auditLog.create`. The enforcer in PR1B
 * runs in REPORT-ONLY mode (does not block); PR7 flips it to BLOCKING.
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §7 (full list) + §18 PR7 plan.
 */

export interface AuditCoverageEntry {
  /** Path relative to server/src/ (e.g. 'services/payment/create.ts'). */
  service: string
  /** Named exports expected to write audit rows. Informational; the v1 enforcer scans the whole file. */
  ops: readonly string[]
}

export const AUDIT_COVERED_SERVICES: readonly AuditCoverageEntry[] = [
  // ── Phase 6 net new (6 services) ──────────────────────────────────────────
  { service: 'services/hr/employee.service.ts',             ops: ['createEmployee', 'updateEmployee', 'deleteEmployee'] },
  { service: 'services/hr/attendance.service.ts',           ops: ['upsertAttendanceBatch'] },
  { service: 'services/payroll/payroll-run.service.ts',     ops: ['finalizePayrollRun', 'reversePayrollRun'] },
  { service: 'services/security-pin/pin-verify.service.ts', ops: ['verifyPin'] },

  // ── Phase 6 backfill (16 pre-existing mutations) ──────────────────────────
  { service: 'services/party/update-delete.ts',             ops: ['updateParty', 'deleteParty'] },
  { service: 'services/document/delete.ts',                 ops: ['deleteDocument'] },
  { service: 'services/document/update.ts',                 ops: ['updateDocument'] },
  { service: 'services/payment/update-delete.ts',           ops: ['updatePayment', 'deletePayment'] },
  { service: 'services/settings/staff.ts',                  ops: ['inviteMember', 'removeMember'] },
  { service: 'services/settings/roles.ts',                  ops: ['mutateRole'] },
  { service: 'services/settings/app-settings.ts',           ops: ['updateAppSettings'] },
  { service: 'services/settings/transaction-lock.ts',       ops: ['setTransactionLock'] },
  { service: 'services/settings/approvals.ts',              ops: ['updateApprovalPolicy'] },
  { service: 'services/settings/pin.ts',                    ops: ['pinHashRotation'] },
  { service: 'services/shared-link.service.ts',             ops: ['revokeSharedLink'] },
  { service: 'services/recurring/crud.ts',                  ops: ['mutateRecurring'] },
  { service: 'services/loyalty/loyalty-program.service.ts', ops: ['mutateLoyaltyProgram'] },
] as const

/** Total covered: 16 services covering 22 distinct ops (6 Phase-6 + 16 backfill). */
export const AUDIT_COVERAGE_COUNT = AUDIT_COVERED_SERVICES.length
