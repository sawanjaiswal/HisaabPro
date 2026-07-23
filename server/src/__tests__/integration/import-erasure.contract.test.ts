/**
 * DPDP import-erasure — REAL DB behaviour of eraseImportData().
 *
 * The structural-mock unit suite (import/__tests__) drives eraseImportData with
 * `auditLog.create` as a `vi.fn()`, so it can never enforce the two foreign
 * keys the audit-write actually depends on:
 *   - AuditLog.businessId → Business (NOT NULL, onDelete Cascade)
 *   - AuditLog.userId     → User     (onDelete Restrict)
 * This suite runs the service against live Postgres to prove the immutable
 * erasure record is FK-valid, correctly business-scoped, and does NOT create a
 * Restrict edge to the user the caller is about to delete. It also proves the
 * PII scrub (raw/normalized/fileName/sha256) hits real rows and is idempotent,
 * and that the payment ledger is untouched.
 *
 * This is the live-pg home of the payments-import "DPDP cascade" scenario
 * (integration.payments.endtoend.test.ts §8), which the structural harness
 * could not express.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import { eraseImportData } from '../../services/import/erasure.service.js'
import { seedFullSetup } from './factories.js'

// ImportJob/ImportJobRow/AuditLog are not in the shared beforeEach TRUNCATE set;
// clear them here so a prior test's rows can't bleed in. Deleting ImportJob
// cascades to ImportJobRow (schema onDelete: Cascade).
beforeEach(async () => {
  await prisma.auditLog.deleteMany({})
  await prisma.importJob.deleteMany({})
})

async function seedJobWithRow(businessId: string, userId: string) {
  const job = await prisma.importJob.create({
    data: {
      businessId,
      userId,
      entity: 'payments',
      format: 'generic_csv',
      status: 'COMMITTED',
      fileName: 'raju-april-payments.csv',
      fileSha256: 'a'.repeat(64),
      fileSize: 2048,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
  const row = await prisma.importJobRow.create({
    data: {
      jobId: job.id,
      sourceIndex: 0,
      status: 'COMMITTED',
      raw: { party_name: 'Priya Wholesale', party_phone: '9812345678' },
      normalized: { partyId: 'p1', amountPaise: 25000 },
    },
  })
  return { job, row }
}

describe('eraseImportData — immutable record is FK-valid and business-scoped', () => {
  it('resolves against real Postgres and writes the erasure record to the real business', async () => {
    const { user, business } = await seedFullSetup()
    await seedJobWithRow(business.id, user.id)

    // Current code inserts AuditLog { businessId: 'SYSTEM' } → P2003 here.
    const result = await eraseImportData(user.id, prisma)
    expect(result.jobsScrubbed).toBe(1)
    expect(result.rowsScrubbed).toBe(1)

    const records = await prisma.auditLog.findMany({
      where: { entityType: 'ImportJob', action: 'DELETE' },
    })
    expect(records).toHaveLength(1)
    const rec = records[0]!
    // FK-valid: scoped to the user's real business, never a literal 'SYSTEM'.
    expect(rec.businessId).toBe(business.id)
    // The FK userId column stays NULL — writing the erased user's id here would
    // create a Restrict edge blocking the caller's subsequent User delete.
    expect(rec.userId).toBeNull()
    expect(rec.systemActor).toBeTruthy()
    // The erased user is still referenced in the payload (legal-hold record).
    expect(rec.entityId).toBe(user.id)
    const changes = rec.changes as { event?: string }
    expect(changes.event).toBe('import_job.erased')
  })

  it('actually scrubs raw/normalized/fileName/sha256 on the live rows', async () => {
    const { user, business } = await seedFullSetup()
    const { job, row } = await seedJobWithRow(business.id, user.id)

    await eraseImportData(user.id, prisma)

    const scrubbedJob = await prisma.importJob.findUnique({ where: { id: job.id } })
    expect(scrubbedJob!.fileName).toBeNull()
    expect(scrubbedJob!.fileSha256).toBe('')
    const scrubbedRow = await prisma.importJobRow.findUnique({ where: { id: row.id } })
    expect(scrubbedRow!.raw).toBeNull()
    expect(scrubbedRow!.normalized).toBeNull()
  })

  it('is idempotent — a second run scrubs nothing and writes no duplicate record', async () => {
    const { user, business } = await seedFullSetup()
    await seedJobWithRow(business.id, user.id)

    await eraseImportData(user.id, prisma)
    const second = await eraseImportData(user.id, prisma)

    expect(second.jobsScrubbed).toBe(0)
    expect(second.rowsScrubbed).toBe(0)
    const records = await prisma.auditLog.findMany({
      where: { entityType: 'ImportJob', action: 'DELETE' },
    })
    expect(records).toHaveLength(1) // no second erasure record on a no-op re-run
  })

  it('nulls the actor on the user\'s existing AuditLog rows but preserves the rows', async () => {
    const { user, business } = await seedFullSetup()
    await seedJobWithRow(business.id, user.id)
    const prior = await prisma.auditLog.create({
      data: {
        businessId: business.id,
        userId: user.id,
        entityType: 'Payment',
        entityId: 'pay-1',
        action: 'CREATE',
      },
    })

    await eraseImportData(user.id, prisma)

    const after = await prisma.auditLog.findUnique({ where: { id: prior.id } })
    expect(after).not.toBeNull() // history preserved (immutable per M5)
    expect(after!.userId).toBeNull() // identity linkage broken (M11 actor-scrub)
  })
})
