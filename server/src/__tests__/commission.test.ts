/**
 * Commission #128 — Integration tests.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §12.
 *
 * Covers:
 *  - 12.4  pickRuleForLine PRODUCT > CATEGORY > ALL specificity
 *  - 12.8  GET /commission/ledger cross-tenant staffUserId → 404 STAFF_NOT_FOUND
 *          (NOT 200-empty, NOT 403 — kills enumeration oracle, M4)
 *  - 12.12 void/restore symmetry — voidCommissionForPosSale writes one inverse
 *          row per source, idempotent on second run; restoreCommissionForPosSale
 *          writes inverse-of-VOID, idempotent
 *  - 12.12 ledgerSnapshot is DEEP CLONED — mutating the live rule after accrual
 *          does NOT bleed into the row's `meta.ruleSnapshot`
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '../app.js'
import {
  authAgent,
  anonAgent,
  mockOwnerPermission,
  mockStaffPermission,
  resetMocks,
  getMockPrisma,
  TEST_USER,
} from './helpers.js'
import { pickRuleForLine } from '../services/commission/commission-match.utils.js'
import {
  cloneRuleSnapshot,
  cloneFromPriorMeta,
} from '../services/commission/commission-snapshot.utils.js'
import {
  voidCommissionForPosSale,
  restoreCommissionForPosSale,
} from '../services/pos/pos-commission-symmetry.js'
import type { CommissionRuleDTO } from '../services/commission/commission-rule.service.js'

vi.mock('../middleware/rate-limit.js', async (importOriginal) => {
  const { rateLimitPassthrough } = await import('./helpers.js')
  return rateLimitPassthrough(importOriginal)
})

const app = createApp()

beforeEach(() => {
  resetMocks()
  // resetMocks() only clears `mockPrisma`'s direct-key vi.fns ($transaction,
  // etc.) — the Proxy-lazy model methods (mp.businessUser.findFirst etc.)
  // live in a closed-over modelCache that resetMocks can't reach. Call
  // vi.clearAllMocks() to wipe call history on every vi.fn() in scope.
  vi.clearAllMocks()
})

// ─── Helpers ───────────────────────────────────────────────────────────────

function mkRule(overrides: Partial<CommissionRuleDTO> = {}): CommissionRuleDTO {
  return {
    id: 'r-default',
    businessId: 'biz-test-1',
    name: 'default',
    scope: 'ALL',
    scopeId: null,
    mode: 'PERCENT_NET',
    rateBps: 500,
    flatPerUnitPaise: null,
    appliesTo: 'BOTH',
    staffUserIds: [],
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: 'u-1',
    ...overrides,
  }
}

// ─── 12.4 — Specificity (PRODUCT > CATEGORY > ALL) ─────────────────────────

describe('pickRuleForLine — specificity (test 12.4)', () => {
  const allRule = mkRule({ id: 'r-all', scope: 'ALL', scopeId: null })
  const catRule = mkRule({ id: 'r-cat', scope: 'CATEGORY', scopeId: 'cat-1' })
  const prodRule = mkRule({ id: 'r-prod', scope: 'PRODUCT', scopeId: 'prod-1' })

  it('picks PRODUCT when product, category, and ALL all match', () => {
    const winner = pickRuleForLine(
      [allRule, catRule, prodRule],
      { productId: 'prod-1', categoryId: 'cat-1', quantity: 1, basisPaise: 10000 }
    )
    expect(winner?.id).toBe('r-prod')
  })

  it('falls back to CATEGORY when PRODUCT rule does not match', () => {
    const winner = pickRuleForLine(
      [allRule, catRule, prodRule],
      { productId: 'other-prod', categoryId: 'cat-1', quantity: 1, basisPaise: 10000 }
    )
    expect(winner?.id).toBe('r-cat')
  })

  it('falls back to ALL when neither PRODUCT nor CATEGORY match', () => {
    const winner = pickRuleForLine(
      [allRule, catRule, prodRule],
      { productId: 'other-prod', categoryId: 'other-cat', quantity: 1, basisPaise: 10000 }
    )
    expect(winner?.id).toBe('r-all')
  })

  it('tie-break within same scope: newest createdAt wins', () => {
    const older = mkRule({
      id: 'r-old', scope: 'PRODUCT', scopeId: 'prod-1',
      createdAt: new Date('2025-01-01T00:00:00Z'),
    })
    const newer = mkRule({
      id: 'r-new', scope: 'PRODUCT', scopeId: 'prod-1',
      createdAt: new Date('2026-04-01T00:00:00Z'),
    })
    const winner = pickRuleForLine(
      [older, newer],
      { productId: 'prod-1', categoryId: 'cat-1', quantity: 1, basisPaise: 10000 }
    )
    expect(winner?.id).toBe('r-new')
  })

  it('returns null when nothing matches', () => {
    const onlyProd = mkRule({ scope: 'PRODUCT', scopeId: 'prod-X' })
    const winner = pickRuleForLine(
      [onlyProd],
      { productId: 'prod-Y', categoryId: null, quantity: 1, basisPaise: 10000 }
    )
    expect(winner).toBeNull()
  })
})

// ─── 12.8 — Cross-tenant 404 (M4) ─────────────────────────────────────────

describe('GET /api/commission/ledger?staffUserId=<other> — cross-tenant (test 12.8)', () => {
  it('returns 401 without auth', async () => {
    const res = await anonAgent(app).get('/api/commission/ledger?periodYearMonth=2026-04')
    expect(res.status).toBe(401)
  })

  it('returns 403 for staff without commission.view_all when probing another user', async () => {
    mockStaffPermission(['commission.view'])
    const res = await authAgent(app)
      .get('/api/commission/ledger?periodYearMonth=2026-04&staffUserId=u-other')
    expect(res.status).toBe(403)
  })

  it('returns 404 STAFF_NOT_FOUND for cross-tenant staffUserId (M4)', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    // assertStaffInBusiness: businessUser.findFirst returns null
    mp.businessUser.findFirst.mockResolvedValue(null)
    const res = await authAgent(app)
      .get('/api/commission/ledger?periodYearMonth=2026-04&staffUserId=u-other-tenant')
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error?.code).toBe('STAFF_NOT_FOUND')
    expect(mp.commissionLedger.findMany).not.toHaveBeenCalled()
    expect(mp.commissionLedger.aggregate).not.toHaveBeenCalled()
  })

  it('owner viewing own ledger bypasses the cross-tenant precheck', async () => {
    mockOwnerPermission()
    const mp = getMockPrisma()
    mp.commissionLedger.findMany.mockResolvedValue([])
    mp.commissionLedger.aggregate.mockResolvedValue({
      _sum: { commissionPaise: 0 }, _count: { _all: 0 },
    })
    // No staffUserId param — falls into "own" path, no precheck call.
    const res = await authAgent(app).get('/api/commission/ledger?periodYearMonth=2026-04')
    expect(res.status).toBe(200)
    expect(mp.businessUser.findFirst).not.toHaveBeenCalled()
    expect(res.body.data.summary.periodYearMonth).toBe('2026-04')
  })
})

// ─── 12.12 — Deep-clone snapshot (M1) ──────────────────────────────────────

describe('cloneRuleSnapshot — deep clone (test 12.12, M1)', () => {
  it('returns a forensic copy that survives source mutation', () => {
    const rule = mkRule({ id: 'r-1', name: 'original', rateBps: 500 })
    const snap = cloneRuleSnapshot(rule)

    // Mutate the source in every way the admin UI might.
    rule.name = 'MUTATED'
    rule.rateBps = 9999
    rule.appliesTo = 'INVOICE'

    // Snapshot is untouched — proves DEEP clone, not reference share.
    expect(snap.name).toBe('original')
    expect(snap.rateBps).toBe(500)
    expect(snap.appliesTo).toBe('BOTH')
    expect(snap.ruleId).toBe('r-1')
  })

  it('flattens Date → ISO string (defensive vs Date references)', () => {
    const rule = mkRule({ createdAt: new Date('2026-04-01T12:34:56Z') })
    const snap = cloneRuleSnapshot(rule)
    expect(typeof snap.createdAt).toBe('string')
    expect(snap.createdAt).toBe('2026-04-01T12:34:56.000Z')
    expect(typeof snap.snapshotAt).toBe('string')
  })
})

describe('cloneFromPriorMeta — re-snapshot from ledger meta (test 12.12, M1)', () => {
  it('extracts ruleSnapshot from prior meta and deep-clones it', () => {
    const snap = {
      ruleId: 'r-1', name: 'original', scope: 'ALL', scopeId: null,
      mode: 'PERCENT_NET', rateBps: 500, flatPerUnitPaise: null,
      appliesTo: 'BOTH', createdAt: '2026-01-01T00:00:00.000Z',
      snapshotAt: '2026-04-01T00:00:00.000Z',
    }
    const meta = { ruleSnapshot: snap, source: 'POS', appliedAt: '2026-04-01T00:00:00.000Z' }
    const re = cloneFromPriorMeta(meta)
    expect(re).not.toBeNull()
    expect(re?.name).toBe('original')
    expect(re?.rateBps).toBe(500)
    // Mutating the source meta does not affect the new snapshot.
    snap.name = 'MUTATED'
    expect(re?.name).toBe('original')
  })

  it('returns null when prior meta has no ruleSnapshot', () => {
    expect(cloneFromPriorMeta(null)).toBeNull()
    expect(cloneFromPriorMeta({})).toBeNull()
    expect(cloneFromPriorMeta({ source: 'POS' })).toBeNull()
  })
})

// ─── 12.12 — Void / Restore symmetry ──────────────────────────────────────

describe('voidCommissionForPosSale (test 12.12)', () => {
  it('writes one inverse-paise row per source, deep-cloning meta', async () => {
    const mp = getMockPrisma()
    const sourceMeta = { ruleSnapshot: { ruleId: 'r-1', name: 'orig', scope: 'ALL', scopeId: null, mode: 'PERCENT_NET', rateBps: 500, flatPerUnitPaise: null, appliesTo: 'BOTH', createdAt: '2026-01-01T00:00:00.000Z', snapshotAt: '2026-04-01T00:00:00.000Z' }, source: 'POS', appliedAt: '2026-04-01T00:00:00.000Z' }
    mp.commissionLedger.findMany
      // 1st call — sourceRows
      .mockResolvedValueOnce([
        {
          id: 'src-1', staffUserId: TEST_USER.userId, ruleId: 'r-1',
          basisPaise: 10000, commissionPaise: 500, periodYearMonth: '2026-04',
          documentId: null, meta: sourceMeta,
        },
      ])
      // 2nd call — existingVoids (none)
      .mockResolvedValueOnce([])
    mp.commissionLedger.create.mockResolvedValue({ id: 'void-1' })

    const tx = mp as unknown as Parameters<typeof voidCommissionForPosSale>[0]
    const out = await voidCommissionForPosSale(tx, 'biz-test-1', 'pos-1')
    expect(out).toEqual({ sourceRowsFound: 1, reversalRowsWritten: 1 })

    expect(mp.commissionLedger.create).toHaveBeenCalledTimes(1)
    const writeArg = mp.commissionLedger.create.mock.calls[0][0].data
    expect(writeArg.commissionPaise).toBe(-500) // inverse
    expect(writeArg.meta.source).toBe('VOID')
    expect(writeArg.meta.voidOf).toBe('src-1')
    expect(writeArg.meta.ruleSnapshot.name).toBe('orig') // re-cloned from src
  })

  it('idempotent — second run on already-voided sale writes zero rows', async () => {
    const mp = getMockPrisma()
    mp.commissionLedger.findMany
      .mockResolvedValueOnce([
        {
          id: 'src-1', staffUserId: TEST_USER.userId, ruleId: 'r-1',
          basisPaise: 10000, commissionPaise: 500, periodYearMonth: '2026-04',
          documentId: null, meta: {},
        },
      ])
      .mockResolvedValueOnce([
        { meta: { voidOf: 'src-1' } }, // already voided
      ])
    const tx = mp as unknown as Parameters<typeof voidCommissionForPosSale>[0]
    const out = await voidCommissionForPosSale(tx, 'biz-test-1', 'pos-1')
    expect(out).toEqual({ sourceRowsFound: 1, reversalRowsWritten: 0 })
    expect(mp.commissionLedger.create).not.toHaveBeenCalled()
  })

  it('zero source rows short-circuits to {0, 0}', async () => {
    const mp = getMockPrisma()
    mp.commissionLedger.findMany.mockResolvedValueOnce([])
    const tx = mp as unknown as Parameters<typeof voidCommissionForPosSale>[0]
    const out = await voidCommissionForPosSale(tx, 'biz-test-1', 'pos-1')
    expect(out).toEqual({ sourceRowsFound: 0, reversalRowsWritten: 0 })
    expect(mp.commissionLedger.create).not.toHaveBeenCalled()
  })
})

describe('restoreCommissionForPosSale (test 12.12 — reverse)', () => {
  it('writes inverse-of-VOID rows, deep-cloning the VOID snapshot', async () => {
    const mp = getMockPrisma()
    const voidMeta = { ruleSnapshot: { ruleId: 'r-1', name: 'orig', scope: 'ALL', scopeId: null, mode: 'PERCENT_NET', rateBps: 500, flatPerUnitPaise: null, appliesTo: 'BOTH', createdAt: '2026-01-01T00:00:00.000Z', snapshotAt: '2026-04-01T00:00:00.000Z' }, source: 'VOID', voidOf: 'src-1', appliedAt: '2026-04-02T00:00:00.000Z' }
    mp.commissionLedger.findMany
      .mockResolvedValueOnce([
        {
          id: 'void-1', staffUserId: TEST_USER.userId, ruleId: 'r-1',
          basisPaise: 10000, commissionPaise: -500, periodYearMonth: '2026-04',
          documentId: null, meta: voidMeta,
        },
      ])
      .mockResolvedValueOnce([])
    mp.commissionLedger.create.mockResolvedValue({ id: 'rest-1' })

    const tx = mp as unknown as Parameters<typeof restoreCommissionForPosSale>[0]
    const out = await restoreCommissionForPosSale(tx, 'biz-test-1', 'pos-1')
    expect(out).toEqual({ sourceRowsFound: 1, reversalRowsWritten: 1 })

    const writeArg = mp.commissionLedger.create.mock.calls[0][0].data
    expect(writeArg.commissionPaise).toBe(500) // inverse of -500 — back to original
    expect(writeArg.meta.source).toBe('RESTORE')
    expect(writeArg.meta.restoreOf).toBe('void-1')
    expect(writeArg.meta.ruleSnapshot.name).toBe('orig')
  })

  it('idempotent — second restore writes zero rows', async () => {
    const mp = getMockPrisma()
    mp.commissionLedger.findMany
      .mockResolvedValueOnce([
        {
          id: 'void-1', staffUserId: TEST_USER.userId, ruleId: 'r-1',
          basisPaise: 10000, commissionPaise: -500, periodYearMonth: '2026-04',
          documentId: null, meta: { ruleSnapshot: {} },
        },
      ])
      .mockResolvedValueOnce([
        { meta: { restoreOf: 'void-1' } },
      ])
    const tx = mp as unknown as Parameters<typeof restoreCommissionForPosSale>[0]
    const out = await restoreCommissionForPosSale(tx, 'biz-test-1', 'pos-1')
    expect(out).toEqual({ sourceRowsFound: 1, reversalRowsWritten: 0 })
    expect(mp.commissionLedger.create).not.toHaveBeenCalled()
  })
})

// ─── Rule validation — POST /commission/rules ──────────────────────────────

describe('POST /api/commission/rules — validation (S2)', () => {
  it('returns 400 for rateBps > 10000 (S2 — 100% cap)', async () => {
    mockOwnerPermission()
    const res = await authAgent(app)
      .post('/api/commission/rules')
      .send({
        name: 'Bad rate',
        scope: 'ALL',
        mode: 'PERCENT_NET',
        rateBps: 15000,
        appliesTo: 'BOTH',
        staffUserIds: [],
        isActive: true,
      })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 401 without auth', async () => {
    const res = await anonAgent(app)
      .post('/api/commission/rules')
      .send({
        name: 'X', scope: 'ALL', mode: 'PERCENT_NET',
        rateBps: 500, appliesTo: 'BOTH', staffUserIds: [], isActive: true,
      })
    expect(res.status).toBe(401)
  })

  it('returns 403 for staff without commission.configure', async () => {
    mockStaffPermission(['commission.view'])
    const res = await authAgent(app)
      .post('/api/commission/rules')
      .send({
        name: 'X', scope: 'ALL', mode: 'PERCENT_NET',
        rateBps: 500, appliesTo: 'BOTH', staffUserIds: [], isActive: true,
      })
    expect(res.status).toBe(403)
  })
})
