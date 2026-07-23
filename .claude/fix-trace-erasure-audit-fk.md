---
symptom: eraseImportData() throws a P2003 foreign-key violation the moment it runs against a real Postgres DB, because its immutable audit-write inserts an AuditLog row with businessId "SYSTEM" (no such Business exists) — and a second latent FK bug sets userId on that row, which would block the User deletion the caller performs next.
root_cause_file: server/src/services/import/erasure.service.ts:99
root_cause_reason: The DPDP erasure record is written with a placeholder businessId ("SYSTEM") that has no backing Business row, violating the NOT-NULL FK AuditLog.businessId → Business (onDelete Cascade); and with userId set, creating a Restrict FK edge to the user the orchestrator is about to delete.
---

## 5-whys

1. Why does eraseImportData fail against a real DB?
   → Its final step inserts an AuditLog row with `businessId: 'SYSTEM'`, and
     Postgres rejects the insert with P2003 (FK violation).
2. Why is that a FK violation?
   → `AuditLog.businessId` is a NOT-NULL column with `@relation(... onDelete:
     Cascade)` to `Business.id`. No `Business` row has id `'SYSTEM'`, so the
     insert has no parent to reference.
3. Why was `'SYSTEM'` used at all?
   → The service comment (lines 96-97) admits "businessId is unknown at this
     layer (one user may span businesses) so we leave it on the caller." The
     literal `'SYSTEM'` was a placeholder for that unknown — but it was still
     written as a real insert, not deferred.
4. Why did no test catch it?
   → The only coverage is a structural-mock unit suite where `auditLog.create`
     is a `vi.fn()` — it never enforces the FK, so the placeholder looked fine.
     There was no live-DB test exercising this service (Phase 7 #150 harness
     didn't exist until the integration contract suite landed).
5. Why is setting `userId` on the record also wrong?
   → `AuditLog.userId → User onDelete: Restrict`. The caller (per lines 50-53)
     runs this BEFORE deleting the User. A fresh AuditLog row carrying
     `userId = <that user>` creates a Restrict edge that BLOCKS the very
     deletion this service is meant to precede — the comment assumes the FK
     "dangles" after delete, but Restrict forbids the delete instead.

## Hypothesis

The immutable erasure record must be FK-valid on both columns. The real
businessId(s) are knowable here — they are the `businessId` of the user's own
`ImportJob` rows (the scrub does not change them). The record is a
system-initiated action, so the `AuditLog.userId` FK column must stay NULL and
the actor recorded via `systemActor` (the model's field for exactly this:
"cron/system actors use systemActor instead"); the erased user's id lives in
the payload (`changes` / `entityId`, both non-FK), which is precisely what the
service header already says ("only the payload references the userId"). Writing
one record per distinct business the user imported into, gated on an actual
scrub having happened (idempotent re-runs stay no-ops), fixes both FK bugs.

## Failing test

server/src/__tests__/integration/import-erasure.contract.test.ts — a live-DB
test that seeds a user + business + ImportJob + ImportJobRow, calls
eraseImportData against real Postgres, and expects it to resolve and write an
FK-valid, correctly-scoped erasure record. Red on current code: the
`businessId: 'SYSTEM'` insert throws P2003 before any assertion runs.
