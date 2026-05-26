/**
 * Phase 7 · 7.1D PR-D3 — commitChunkPayments unit + integration tests.
 *
 * Mocked tx → no real Postgres. Asserts:
 *   - happy path: 5 rows → 5 COMMITTED, 1 batched audit row, allocations
 *   - Σ-overflow scenario: 50×Rs250 vs Rs10,000 outstanding → 40+10
 *   - INVOICE_NOT_FOUND: marked, not thrown
 *   - DUPLICATE_SKIPPED: P2002 → row marked, chunk continues
 *   - cross-tenant: businessB row hitting businessA invoice → not_found
 *   - soft-deleted Payment: not counted against allocation budget
 *   - dual-shape P2002 detection: target as string AND as array
 *
 * The mock-tx pattern is structural — we DO NOT exercise real Prisma.
 * The over-allocation-guard uses raw SQL; the mock interprets the SQL
 * shape and returns the prepared in-memory state.
 */

import { describe, it, expect, vi } from 'vitest'
import { commitChunkPayments } from '../commit-payments/commit-payments.service.js'
import type { NormalizedPayment } from '../commit-payments/types.js'

interface MockInvoice {
  id: string
  businessId: string
  grandTotal: number
  documentNumber: string
  isDeleted?: boolean
}
interface MockAllocation {
  invoiceId: string
  amount: number
  paymentDeleted?: boolean
}

interface BuildOpts {
  rows: Array<{ id: string; sourceIndex: number; normalized: NormalizedPayment }>
  invoices: MockInvoice[]
  allocations?: MockAllocation[]
  /** Make payment.create throw P2002 for these rowIds (dup detection). */
  p2002ForRowIds?: Set<string>
  /** Use string target instead of array on the P2002 error. */
  p2002TargetAsString?: boolean
}

function mkRow(
  id: string,
  sourceIndex: number,
  overrides: Partial<NormalizedPayment> = {},
) {
  const n: NormalizedPayment = {
    partyId: 'party-1',
    partyName: 'Raju',
    partyPhone: null,
    date: '2025-04-15',
    amountPaise: 25_000, // Rs 250
    mode: 'CASH',
    referenceNumber: null,
    invoiceNumber: 'INV-1',
    invoiceId: null,
    notes: null,
    ...overrides,
  }
  return { id, sourceIndex, normalized: n }
}

function buildTx(opts: BuildOpts) {
  // Mutable ledger — allocations grow as payments commit.
  const allocations: MockAllocation[] = [...(opts.allocations ?? [])]
  const payments: Array<{ id: string; amount: number; businessId: string }> = []
  let paymentCounter = 0
  let allocCounter = 0
  const auditCreates: Array<{ data: Record<string, unknown> }> = []
  const importJobRowUpdates: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = []
  const rawErrorMarks: Array<{ rowId: string; code: string }> = []

  function $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
    const sql = strings.join('?')
    // Document lookup by id (over-allocation-guard + resolver verify)
    if (/FROM "Document"[\s\S]*WHERE id = /.test(sql)) {
      const id = values[0] as string
      const biz = values[1] as string | undefined
      const doc = opts.invoices.find(
        (d) => d.id === id && (!biz || d.businessId === biz) && !d.isDeleted,
      )
      if (sql.includes('FOR UPDATE')) {
        return Promise.resolve(
          doc
            ? [
                {
                  id: doc.id,
                  businessId: doc.businessId,
                  grandTotal: doc.grandTotal,
                  isDeleted: false,
                },
              ]
            : [],
        )
      }
      return Promise.resolve(doc ? [{ id: doc.id }] : [])
    }
    // Document lookup by documentNumber (resolver)
    if (/FROM "Document"[\s\S]*"documentNumber" = /.test(sql)) {
      const biz = values[0] as string
      const num = values[1] as string
      const doc = opts.invoices.find(
        (d) => d.businessId === biz && d.documentNumber === num && !d.isDeleted,
      )
      return Promise.resolve(doc ? [{ id: doc.id }] : [])
    }
    // Σ active allocations
    if (/FROM "PaymentAllocation"/.test(sql)) {
      const invoiceId = values[0] as string
      const sum = allocations
        .filter((a) => a.invoiceId === invoiceId && !a.paymentDeleted)
        .reduce((s, a) => s + a.amount, 0)
      return Promise.resolve([{ sum: BigInt(sum) }])
    }
    // Staged-row SELECT
    if (/FROM "ImportJobRow"/.test(sql)) {
      return Promise.resolve(opts.rows)
    }
    return Promise.resolve([])
  }

  function $executeRaw(strings: TemplateStringsArray, ...values: unknown[]) {
    const sql = strings.join('?')
    // Advisory lock — no-op.
    if (sql.includes('pg_advisory_xact_lock')) return Promise.resolve(1)
    // markRowError UPDATE
    if (sql.includes('UPDATE "ImportJobRow"') && sql.includes("'ERROR'")) {
      const code = values[0] as string
      const rowId = values[2] as string
      rawErrorMarks.push({ rowId, code })
      return Promise.resolve(1)
    }
    return Promise.resolve(1)
  }

  const tx = {
    $queryRaw: vi.fn($queryRaw),
    $executeRaw: vi.fn($executeRaw),
    payment: {
      create: vi.fn(async (args: { data: { amount: number; businessId: string } }) => {
        // Look up the current rowId via the last raw-error marks is fragile;
        // P2002 trigger is configured per-call via the opts side-channel.
        if (opts.p2002ForRowIds && opts.p2002ForRowIds.size > 0) {
          // Pop one id from the set per call.
          const next = opts.p2002ForRowIds.values().next().value
          if (next) {
            opts.p2002ForRowIds.delete(next)
            const err = new Error('Unique constraint failed') as Error & {
              code: string
              meta: { target: string | string[] }
            }
            err.code = 'P2002'
            err.meta = {
              target: opts.p2002TargetAsString
                ? 'Payment_offlineId_key'
                : ['offlineId'],
            }
            throw err
          }
        }
        paymentCounter += 1
        const p = {
          id: `payment-${paymentCounter}`,
          amount: args.data.amount,
          businessId: args.data.businessId,
        }
        payments.push(p)
        return p
      }),
    },
    paymentAllocation: {
      create: vi.fn(async (args: { data: { invoiceId: string; amount: number } }) => {
        allocCounter += 1
        allocations.push({ invoiceId: args.data.invoiceId, amount: args.data.amount })
        return { id: `alloc-${allocCounter}` }
      }),
    },
    importJobRow: {
      updateMany: vi.fn(async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        importJobRowUpdates.push(args)
        return { count: 1 }
      }),
    },
    auditLog: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        auditCreates.push(args)
        return { id: 'al' }
      }),
    },
  }

  return { tx, payments, allocations, auditCreates, importJobRowUpdates, rawErrorMarks }
}

const ARGS = { jobId: 'job-pay', businessId: 'biz-1', userId: 'u-1' }

describe('commitChunkPayments — happy path', () => {
  it('5 rows → 5 COMMITTED, 1 batched audit row, allocations recorded', async () => {
    const rows = [0, 1, 2, 3, 4].map((i) =>
      mkRow(`r${i}`, i, { invoiceNumber: 'INV-1' }),
    )
    const { tx, payments, allocations, auditCreates } = buildTx({
      rows,
      invoices: [
        {
          id: 'doc-1',
          businessId: 'biz-1',
          grandTotal: 1_00_00_000, // huge invoice
          documentNumber: 'INV-1',
        },
      ],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await commitChunkPayments(tx as any, ARGS)
    expect(payments).toHaveLength(5)
    expect(allocations).toHaveLength(5)
    expect(result.createdPartyIds).toHaveLength(5)
    expect(result.done).toBe(true)
    expect(auditCreates).toHaveLength(1)
    const ch = auditCreates[0].data.changes as {
      event: string
      count: number
      paymentIds: string[]
      codes: string[]
    }
    expect(ch.event).toBe('payments.imported_batch')
    expect(ch.count).toBe(5)
    expect(ch.codes.every((c) => c === 'COMMITTED')).toBe(true)
    // PII guard — audit must NOT carry partyId / amount / reference.
    expect(JSON.stringify(ch)).not.toContain('party-1')
    expect(JSON.stringify(ch)).not.toContain('25000')
  })
})

describe('commitChunkPayments — Σ overflow (CRITICAL spec scenario)', () => {
  it('50 × Rs250 against Rs10,000 outstanding → 40 COMMITTED + 10 OVER_ALLOCATION', async () => {
    // 50 rows, each 25_000 paise (Rs 250). Invoice grandTotal = 10_00_000
    // paise (Rs 10,000). 40 × 25_000 = 10_00_000 exactly → row 41 fails.
    const rows = Array.from({ length: 50 }, (_, i) =>
      mkRow(`r${i}`, i, { invoiceNumber: 'INV-1', amountPaise: 25_000 }),
    )
    const { tx, payments, allocations, auditCreates } = buildTx({
      rows,
      invoices: [
        {
          id: 'doc-1',
          businessId: 'biz-1',
          grandTotal: 10_00_000, // Rs 10,000
          documentNumber: 'INV-1',
        },
      ],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await commitChunkPayments(tx as any, ARGS)
    // EXACT split — 40 committed, 10 over-allocation.
    expect(payments).toHaveLength(40)
    expect(allocations).toHaveLength(40)
    const codes = (auditCreates[0].data.changes as { codes: string[] }).codes
    const committed = codes.filter((c) => c === 'COMMITTED').length
    const overAlloc = codes.filter((c) => c === 'OVER_ALLOCATION').length
    expect(committed).toBe(40)
    expect(overAlloc).toBe(10)
    expect(committed + overAlloc).toBe(50)
  })
})

describe('commitChunkPayments — INVOICE_NOT_FOUND', () => {
  it('row references missing invoice → marked, chunk continues', async () => {
    const rows = [
      mkRow('r0', 0, { invoiceNumber: 'INV-MISSING' }),
      mkRow('r1', 1, { invoiceNumber: 'INV-1' }),
    ]
    const { tx, payments, auditCreates } = buildTx({
      rows,
      invoices: [
        { id: 'doc-1', businessId: 'biz-1', grandTotal: 1_00_000, documentNumber: 'INV-1' },
      ],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await commitChunkPayments(tx as any, ARGS)
    expect(payments).toHaveLength(1) // only the valid one committed
    const codes = (auditCreates[0].data.changes as { codes: string[] }).codes
    expect(codes[0]).toBe('COMMIT_BLOCKED_INVOICE_NOT_FOUND')
    expect(codes[1]).toBe('COMMITTED')
  })
})

describe('commitChunkPayments — DUPLICATE_SKIPPED (P2002)', () => {
  it('Prisma P2002 with target as string[] → row marked DUPLICATE_SKIPPED', async () => {
    const rows = [mkRow('r0', 0), mkRow('r1', 1)]
    const { tx, payments, auditCreates } = buildTx({
      rows,
      invoices: [
        { id: 'doc-1', businessId: 'biz-1', grandTotal: 1_00_000, documentNumber: 'INV-1' },
      ],
      p2002ForRowIds: new Set(['r0']),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await commitChunkPayments(tx as any, ARGS)
    expect(payments).toHaveLength(1)
    const codes = (auditCreates[0].data.changes as { codes: string[] }).codes
    expect(codes[0]).toBe('DUPLICATE_SKIPPED')
    expect(codes[1]).toBe('COMMITTED')
  })

  it('Prisma P2002 with target as string → also marked DUPLICATE_SKIPPED (dual-shape)', async () => {
    const rows = [mkRow('r0', 0)]
    const { tx, payments, auditCreates } = buildTx({
      rows,
      invoices: [
        { id: 'doc-1', businessId: 'biz-1', grandTotal: 1_00_000, documentNumber: 'INV-1' },
      ],
      p2002ForRowIds: new Set(['r0']),
      p2002TargetAsString: true, // <- legacy Prisma target shape
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await commitChunkPayments(tx as any, ARGS)
    expect(payments).toHaveLength(0)
    const codes = (auditCreates[0].data.changes as { codes: string[] }).codes
    expect(codes[0]).toBe('DUPLICATE_SKIPPED')
  })
})

describe('commitChunkPayments — cross-tenant isolation', () => {
  it('row hitting an invoice in another business → INVOICE_NOT_FOUND', async () => {
    const rows = [mkRow('r0', 0, { invoiceNumber: 'INV-1' })]
    // Invoice exists, but in biz-OTHER, not biz-1 (our caller).
    const { tx, payments, auditCreates } = buildTx({
      rows,
      invoices: [
        {
          id: 'doc-other',
          businessId: 'biz-OTHER',
          grandTotal: 1_00_000,
          documentNumber: 'INV-1',
        },
      ],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await commitChunkPayments(tx as any, ARGS)
    expect(payments).toHaveLength(0)
    const codes = (auditCreates[0].data.changes as { codes: string[] }).codes
    expect(codes[0]).toBe('COMMIT_BLOCKED_INVOICE_NOT_FOUND')
  })
})

describe('commitChunkPayments — soft-deleted Payment ignored by Σ', () => {
  it('soft-deleted payment does NOT count against allocation budget', async () => {
    // Invoice = Rs 1_000 (1_00_000 paise). Existing soft-deleted
    // allocation of Rs 800. New row wants Rs 1_000 — should succeed
    // because the soft-deleted one doesn't count.
    const rows = [mkRow('r0', 0, { amountPaise: 1_00_000 })]
    const { tx, payments } = buildTx({
      rows,
      invoices: [
        { id: 'doc-1', businessId: 'biz-1', grandTotal: 1_00_000, documentNumber: 'INV-1' },
      ],
      allocations: [
        { invoiceId: 'doc-1', amount: 80_000, paymentDeleted: true },
      ],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await commitChunkPayments(tx as any, ARGS)
    expect(payments).toHaveLength(1)
  })
})

describe('commitChunkPayments — empty chunk', () => {
  it('zero staged rows → done=true, no audit row', async () => {
    const { tx, auditCreates } = buildTx({ rows: [], invoices: [] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await commitChunkPayments(tx as any, ARGS)
    expect(result).toEqual({ createdPartyIds: [], sourceIndices: [], done: true })
    expect(auditCreates).toHaveLength(0)
  })
})
