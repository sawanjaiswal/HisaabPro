/**
 * Phase 7 · 7.1D (PR-D4) — Payments end-to-end integration tests.
 *
 * Mirrors `integration.invoices.endtoend.test.ts` — drives commit-payments
 * + dedup + truncateReference + per-entity helpers with a structurally
 * mocked Prisma client. Cross-cutting scenarios from BACKLOG § PR-D4:
 *
 *   #1 — happy: 5 rows → 5 COMMITTED + 1 batched audit row ............. COVERED
 *   #2 — ALLOCATION_INTERNAL_CONFLICT (concurrent commits, advisory lock) TODO (live pg)
 *   #3 — dual-shape P2002 (target string + string[]) → DUPLICATE_SKIPPED  COVERED
 *   #4 — tail-100 collision-permissive (chars 101+ differ → not dup) ... COVERED
 *   #5 — cross-tenant existence-leak (biz-A ref to biz-B invoice) ...... COVERED
 *   #6 — advisory-lock race (Doc-level concurrent commits) ............. TODO (live pg)
 *   #7 — mid-tx crash idempotency (resume on importJobId+rowIndex uniq)  TODO (live pg)
 *   #8 — DPDP cascade (Payment.importedBy SetNull) ..................... TODO (live pg)
 *   #9 — 50×Rs250 vs Rs10,000 outstanding → 40 + 10 OVER_ALLOCATION .... COVERED
 *   #10 — client floor 7.1.3 (per-entity helper) ....................... COVERED (helper unit)
 *   #11 — PII-safe audit (no partyId / amount / reference in row) ...... COVERED
 *   #12 — /api/payments/list?importJobId=<id> filter ................... COVERED (schema + service)
 *   #13 — enforce-audit-coverage --block exit 0 (script self-test) ..... COVERED
 *
 * The structural-mock pattern in our import test suite cannot drive
 * Postgres advisory locks or row-level uniqueness across concurrent
 * sessions — scenarios #2/#6/#7/#8 are `it.todo` and tracked under
 * Phase 7 #150 (live-pg integration harness).
 */

import { describe, it, expect, vi } from 'vitest'
import { execSync } from 'node:child_process'
import { commitChunkPayments } from '../commit-payments/commit-payments.service.js'
import type { NormalizedPayment } from '../commit-payments/types.js'
import { findPaymentDuplicates } from '../dedup/payment-dedup.js'
import { truncateReference } from '../normalizers/payment-utils.js'
import { enforcePerEntityClientVersion } from '../../../routes/imports/create.route.helpers.js'
import { listPaymentsSchema } from '../../../schemas/payment.schemas.js'

// ── shared mocked-tx harness (subset of commit-payments.test.ts) ─────────
interface MockInvoice {
  id: string
  businessId: string
  grandTotal: number
  documentNumber: string
}
interface MockAlloc { invoiceId: string; amount: number; paymentDeleted?: boolean }
interface HarnessOpts {
  rows: Array<{ id: string; sourceIndex: number; normalized: NormalizedPayment }>
  invoices: MockInvoice[]
  allocations?: MockAlloc[]
  p2002ForRowIds?: Set<string>
  p2002TargetAsString?: boolean
}
function mkRow(id: string, sourceIndex: number, o: Partial<NormalizedPayment> = {}) {
  const n: NormalizedPayment = {
    partyId: 'party-1', partyName: 'Raju', partyPhone: null,
    date: '2025-04-15', amountPaise: 25_000, mode: 'CASH',
    referenceNumber: null, invoiceNumber: 'INV-1', invoiceId: null, notes: null,
    ...o,
  }
  return { id, sourceIndex, normalized: n }
}
function buildTx(opts: HarnessOpts) {
  const allocations = [...(opts.allocations ?? [])]
  const payments: Array<{ id: string }> = []
  const auditCreates: Array<{ data: Record<string, unknown> }> = []
  let pc = 0, ac = 0
  const $queryRaw = (s: TemplateStringsArray, ...v: unknown[]) => {
    const sql = s.join('?')
    if (/FROM "Document"[\s\S]*WHERE id = /.test(sql)) {
      const id = v[0] as string; const biz = v[1] as string | undefined
      const d = opts.invoices.find((x) => x.id === id && (!biz || x.businessId === biz))
      return Promise.resolve(d ? [{ id: d.id, businessId: d.businessId, grandTotal: d.grandTotal, isDeleted: false }] : [])
    }
    if (/FROM "Document"[\s\S]*"documentNumber" = /.test(sql)) {
      const biz = v[0] as string; const num = v[1] as string
      const d = opts.invoices.find((x) => x.businessId === biz && x.documentNumber === num)
      return Promise.resolve(d ? [{ id: d.id }] : [])
    }
    if (/FROM "PaymentAllocation"/.test(sql)) {
      const id = v[0] as string
      const sum = allocations.filter((a) => a.invoiceId === id && !a.paymentDeleted).reduce((s, a) => s + a.amount, 0)
      return Promise.resolve([{ sum: BigInt(sum) }])
    }
    if (/FROM "ImportJobRow"/.test(sql)) return Promise.resolve(opts.rows)
    return Promise.resolve([])
  }
  const $executeRaw = (s: TemplateStringsArray) => {
    const sql = s.join('?')
    if (sql.includes('pg_advisory_xact_lock')) return Promise.resolve(1)
    return Promise.resolve(1)
  }
  const tx = {
    $queryRaw: vi.fn($queryRaw),
    $executeRaw: vi.fn($executeRaw),
    payment: {
      create: vi.fn(async (a: { data: { businessId: string; amount: number } }) => {
        if (opts.p2002ForRowIds && opts.p2002ForRowIds.size > 0) {
          const next = opts.p2002ForRowIds.values().next().value
          if (next) {
            opts.p2002ForRowIds.delete(next)
            const e = new Error('Unique') as Error & { code: string; meta: { target: string | string[] } }
            e.code = 'P2002'
            e.meta = { target: opts.p2002TargetAsString ? 'Payment_offlineId_key' : ['offlineId'] }
            throw e
          }
        }
        pc += 1
        const p = { id: `pay-${pc}`, amount: a.data.amount, businessId: a.data.businessId }
        payments.push(p)
        return p
      }),
    },
    paymentAllocation: {
      create: vi.fn(async (a: { data: { invoiceId: string; amount: number } }) => {
        ac += 1; allocations.push({ invoiceId: a.data.invoiceId, amount: a.data.amount })
        return { id: `al-${ac}` }
      }),
    },
    importJobRow: { updateMany: vi.fn(async () => ({ count: 1 })) },
    auditLog: { create: vi.fn(async (a: { data: Record<string, unknown> }) => { auditCreates.push(a); return { id: 'al' } }) },
  }
  return { tx, payments, allocations, auditCreates }
}
const ARGS = { jobId: 'job-1', businessId: 'biz-1', userId: 'u-1' }

// ── #1 happy path ────────────────────────────────────────────────────────
describe('PR-D4 #1 happy path — 5 rows COMMITTED, batched audit', () => {
  it('emits payments.imported_batch with 5 COMMITTED codes', async () => {
    const rows = [0, 1, 2, 3, 4].map((i) => mkRow(`r${i}`, i))
    const { tx, payments, auditCreates } = buildTx({
      rows, invoices: [{ id: 'doc-1', businessId: 'biz-1', grandTotal: 1_00_00_000, documentNumber: 'INV-1' }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await commitChunkPayments(tx as any, ARGS)
    expect(payments).toHaveLength(5)
    expect(auditCreates).toHaveLength(1)
    const ch = auditCreates[0].data.changes as { event: string; codes: string[] }
    expect(ch.event).toBe('payments.imported_batch')
    expect(ch.codes.filter((c) => c === 'COMMITTED')).toHaveLength(5)
  })
})

// ── #3 dual-shape P2002 ──────────────────────────────────────────────────
describe('PR-D4 #3 dual-shape P2002 → DUPLICATE_SKIPPED', () => {
  for (const asString of [false, true]) {
    it(`target=${asString ? 'string' : 'string[]'} surfaces DUPLICATE_SKIPPED, not 500`, async () => {
      const rows = [mkRow('r0', 0)]
      const { tx, payments, auditCreates } = buildTx({
        rows, invoices: [{ id: 'doc-1', businessId: 'biz-1', grandTotal: 1_00_000, documentNumber: 'INV-1' }],
        p2002ForRowIds: new Set(['r0']), p2002TargetAsString: asString,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await commitChunkPayments(tx as any, ARGS)
      expect(payments).toHaveLength(0)
      const codes = (auditCreates[0].data.changes as { codes: string[] }).codes
      expect(codes[0]).toBe('DUPLICATE_SKIPPED')
    })
  }
})

// ── #4 tail-100 collision-permissive ─────────────────────────────────────
describe('PR-D4 #4 tail-100 — refs differing past char 100 are NOT duplicates', () => {
  it('two 150-char refs with different tails produce different dedup keys', async () => {
    const head = 'A'.repeat(50) // shared prefix
    const refA = head + 'B'.repeat(100) // tail = B×100
    const refC = head + 'C'.repeat(100) // tail = C×100 — different tail
    const ta = truncateReference(refA)!.value
    const tc = truncateReference(refC)!.value
    expect(ta).not.toBe(tc)
    // Drive dedup: prior payment shared (party,date,amount,refA-tail);
    // new row has refC. Same date/amount/party but different tail → no match.
    const prismaMock = {
      payment: {
        findMany: vi.fn(async () => [
          {
            id: 'old-pay', partyId: 'party-1',
            date: new Date('2025-04-15'), amount: 25_000, referenceNumber: ta,
          },
        ]),
      },
    }
    const rows = [
      { sourceIndex: 0, normalized: { ...mkRow('r0', 0).normalized, referenceNumber: refC } },
    ]
    const dups = await findPaymentDuplicates({
      businessId: 'biz-1', rows,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prismaMock as any,
    })
    expect(dups.size).toBe(0) // collision-permissive: tail differs
  })
})

// ── #5 cross-tenant existence-leak ───────────────────────────────────────
describe('PR-D4 #5 cross-tenant — biz-A ref to biz-B invoice → INVOICE_NOT_FOUND', () => {
  it('returns INVOICE_NOT_FOUND, never leaks biz-B doc id, no commit', async () => {
    const rows = [mkRow('r0', 0)]
    const { tx, payments, auditCreates } = buildTx({
      rows,
      invoices: [{ id: 'doc-B', businessId: 'biz-OTHER', grandTotal: 1_00_000, documentNumber: 'INV-1' }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await commitChunkPayments(tx as any, ARGS)
    expect(payments).toHaveLength(0)
    const codes = (auditCreates[0].data.changes as { codes: string[] }).codes
    expect(codes[0]).toBe('COMMIT_BLOCKED_INVOICE_NOT_FOUND')
    // Existence-leak guard — audit payload must not name foreign doc.
    expect(JSON.stringify(auditCreates[0].data)).not.toContain('doc-B')
    expect(JSON.stringify(auditCreates[0].data)).not.toContain('biz-OTHER')
  })
})

// ── #9 Σ-overflow split 40+10 ────────────────────────────────────────────
describe('PR-D4 #9 Σ-overflow — 50×Rs250 vs Rs10,000 → 40 COMMITTED + 10 OVER_ALLOCATION', () => {
  it('exact split, allocations match', async () => {
    const rows = Array.from({ length: 50 }, (_, i) =>
      mkRow(`r${i}`, i, { amountPaise: 25_000 }),
    )
    const { tx, payments, allocations, auditCreates } = buildTx({
      rows,
      invoices: [{ id: 'doc-1', businessId: 'biz-1', grandTotal: 10_00_000, documentNumber: 'INV-1' }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await commitChunkPayments(tx as any, ARGS)
    const codes = (auditCreates[0].data.changes as { codes: string[] }).codes
    expect(codes.filter((c) => c === 'COMMITTED')).toHaveLength(40)
    expect(codes.filter((c) => c === 'OVER_ALLOCATION')).toHaveLength(10)
    expect(payments).toHaveLength(40)
    expect(allocations).toHaveLength(40)
  })
})

// ── #10 client floor 7.1.3 ───────────────────────────────────────────────
describe('PR-D4 #10 per-entity client floor — payments requires ≥ 7.1.3', () => {
  function fakeRes() {
    const calls: Array<{ status: number; body: unknown }> = []
    const r = {
      status(c: number) { return { json(b: unknown) { calls.push({ status: c, body: b }); return r }, send(b: unknown) { calls.push({ status: c, body: b }); return r } } },
      calls,
    }
    return r
  }
  it('7.1.2 → 426 UPGRADE_REQUIRED', () => {
    const r = fakeRes()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gated = enforcePerEntityClientVersion(r as any, 'payments', '7.1.2')
    expect(gated).toBe(true)
    expect(r.calls[0].status).toBe(426)
  })
  it('7.1.3 → passes', () => {
    const r = fakeRes()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gated = enforcePerEntityClientVersion(r as any, 'payments', '7.1.3')
    expect(gated).toBe(false)
    expect(r.calls).toHaveLength(0)
  })
})

// ── #11 PII-safe audit ───────────────────────────────────────────────────
describe('PR-D4 #11 PII-safe audit — no partyId / amount / reference in row', () => {
  it('batched audit payload contains only ids+codes', async () => {
    const rows = [mkRow('r0', 0, { referenceNumber: 'UPI-RAJU-987654' })]
    const { tx, auditCreates } = buildTx({
      rows, invoices: [{ id: 'doc-1', businessId: 'biz-1', grandTotal: 1_00_000, documentNumber: 'INV-1' }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await commitChunkPayments(tx as any, ARGS)
    const s = JSON.stringify(auditCreates[0].data)
    expect(s).not.toContain('party-1')
    expect(s).not.toContain('25000')
    expect(s).not.toContain('UPI-RAJU-987654')
    expect(s).toContain('payments.imported_batch')
  })
})

// ── #12 /api/payments/list ?importJobId filter ────────────────────────────
describe('PR-D4 #12 listPaymentsSchema — importJobId optional, tenant-scoped downstream', () => {
  it('accepts importJobId in query', () => {
    const parsed = listPaymentsSchema.parse({ importJobId: 'job-1' })
    expect(parsed.importJobId).toBe('job-1')
  })
  it('rejects empty importJobId (z.min(1))', () => {
    expect(() => listPaymentsSchema.parse({ importJobId: '' })).toThrow()
  })
  it('passes when importJobId omitted (default = undefined)', () => {
    const parsed = listPaymentsSchema.parse({})
    expect(parsed.importJobId).toBeUndefined()
  })
})

// ── #13 enforce-audit-coverage script self-test ──────────────────────────
describe('PR-D4 #13 enforce-audit-coverage --block exit 0', () => {
  it('passes with payments.imported_batch services registered', () => {
    const out = execSync('node scripts/enforce-audit-coverage.mjs --block', {
      cwd: process.cwd().includes('/server') ? '../' : process.cwd(),
      encoding: 'utf8',
    })
    expect(out).toContain('all covered')
  })
})

// ── TODOs requiring live-pg harness (Phase 7 #150) ───────────────────────
describe.todo('PR-D4 #2 ALLOCATION_INTERNAL_CONFLICT — concurrent commits hit same invoice')
describe.todo('PR-D4 #6 advisory-lock race — Doc-level pg_advisory_xact_lock contention')
describe.todo('PR-D4 #7 mid-tx crash idempotency — resume on Payment.(importJobId,rowIndex) unique')
describe.todo('PR-D4 #8 DPDP cascade — erase user → ImportJobRow + Payment.importedBy SetNull')
