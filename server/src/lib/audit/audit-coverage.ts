/**
 * AUDIT COVERAGE SSOT (G1 closure).
 *
 * Single source of truth for every mutation service that MUST write an
 * `AuditLog` row inside its `$transaction`. Pre-commit hook
 * `scripts/enforce-audit-coverage.mjs` reads this file, opens each listed
 * service, and verifies an audit-write exists: the canonical `createAuditEntry`
 * writer (SSOT — `services/settings/audit.ts`), a raw create on the auditLog
 * delegate, or an `audit-emit` wrapper import.
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

  // ── Phase 7 Import (API.7) ────────────────────────────────────────────────
  // Every service that mutates an ImportJob writes an `import_job.*` audit
  // row inside its $transaction. Event names per ARCH §10:
  //   import_job.uploaded · parsed · row_dropped · dedup_resolved ·
  //   committed · parties.imported_batch · cancelled · expired
  { service: 'services/import/upload.service.ts',           ops: ['createImportJob'] },
  { service: 'services/import/parse.service.ts',            ops: ['runParseAndStage'] },
  { service: 'services/import/commit.service.ts',           ops: ['commitImportJob'] },
  // Phase 7 · 7.1B — commit.service.ts split. `commit.helpers.ts` no longer
  // writes audit rows (parties chunk moved to commit-parties.service.ts);
  // `commit-products.service.ts` is a 7.1B PR1 stub — full audit lands in
  // API.B3 alongside the per-row commit ladder.
  { service: 'services/import/commit-parties.service.ts',   ops: ['commitChunkParties'] },
  // Phase 7 · 7.1B API.B3 — products commit ladder writes
  // `products.imported_batch` (S6) inside its $transaction.
  { service: 'services/import/commit-products.service.ts',  ops: ['commitChunkProducts'] },
  // Phase 7 · 7.1C PR-C3 — invoice chunk commit emits `invoices.imported_batch`
  // (ARCH §6.4) inside its $transaction. One audit row per chunk; parallel
  // arrays preserve per-invoice provenance.
  { service: 'services/import/commit-invoices.service.ts',  ops: ['commitChunkInvoices'] },
  { service: 'services/import/cancel.service.ts',           ops: ['cancelImportJob'] },
  { service: 'services/import/audit-emit.ts',               ops: ['emitUploaded', 'emitParsed', 'emitRowDropped', 'emitDedupResolved', 'emitCommitted', 'emitPartiesUpdatedFromImport', 'emitProductsImportedBatch', 'emitProductsUpdatedFromImport', 'emitInvoicesImportedBatch', 'emitExpired'] },
  // 7.1C PR-C3 — invoice batched audit extracted from audit-emit.ts to
  // keep that file under the 250L cap; audit-emit.ts re-exports for back-compat.
  { service: 'services/import/audit-emit-invoices.ts',      ops: ['emitInvoicesImportedBatch'] },
  // Phase 7 · 7.1D PR-D4 — payments commit ladder writes
  // `payments.imported_batch` (PR-D3) inside its $transaction. The
  // audit-emit wrapper for payments lives alongside the commit service
  // (per-entity split to keep audit-emit.ts under cap).
  { service: 'services/import/commit-payments/commit-payments.service.ts', ops: ['commitChunkPayments'] },
  { service: 'services/import/commit-payments/audit-emit.ts',              ops: ['emitPaymentsImportedBatch'] },
  { service: 'jobs/import-retention.cron.ts',               ops: ['runImportRetentionCron'] },
  { service: 'services/import/erasure.service.ts',          ops: ['eraseImportData'] },
] as const

/** Total covered: 29 services (16 prior + 13 Phase-7 Import incl. 7.1B split + 7.1C invoices commit + audit-emit-invoices split + 7.1D payments commit + payments audit-emit). */
export const AUDIT_COVERAGE_COUNT = AUDIT_COVERED_SERVICES.length
