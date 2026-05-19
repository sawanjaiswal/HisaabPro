/**
 * Phase 7 · 7.1C PR-C3 — party-resolver unit tests.
 *
 * Covers:
 *   - exact (name, phone) match
 *   - name-only match → PARTY_NAME_ONLY_MATCH warning
 *   - REQUIRE_PARTIES_FIRST → PARTY_NOT_FOUND
 *   - MATCH_OR_FLY_CREATE → advisory lock invoked + createPartyTx called
 *   - Lock key is M10 length-prefixed (no separator collision)
 *   - Post-lock re-check returns sibling-INSERTed party (race defence)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError, ErrorCode } from '../../../../lib/errors.js'

const { createPartyTxMock } = vi.hoisted(() => ({
  createPartyTxMock: vi.fn(),
}))
vi.mock('../../../party/create-tx.js', () => ({
  createPartyTx: createPartyTxMock,
}))

import {
  buildFlyCreateLockKey,
  namePhoneKey,
  resolvePartyForInvoice,
} from '../party-resolver.js'

interface FakeTx {
  $executeRaw: ReturnType<typeof vi.fn>
  party: { findFirst: ReturnType<typeof vi.fn> }
}

function buildTx(): FakeTx {
  return {
    $executeRaw: vi.fn(async () => 1),
    party: { findFirst: vi.fn(async () => null) },
  }
}

function emptySnapshot() {
  return { byNamePhone: new Map(), byName: new Map() }
}

beforeEach(() => {
  createPartyTxMock.mockReset()
  createPartyTxMock.mockResolvedValue({ id: 'new-party-id' })
})

describe('buildFlyCreateLockKey (M10 length-prefix)', () => {
  it('produces distinct keys for ambiguous-pipe inputs', () => {
    const a = buildFlyCreateLockKey('biz', 'ab|c traders', '9999')
    const b = buildFlyCreateLockKey('biz', 'ab', 'c traders|9999')
    expect(a).not.toBe(b)
  })

  it('encodes lengths of every component', () => {
    expect(buildFlyCreateLockKey('B', 'raju', '9')).toBe('1:B|4:raju|1:9')
  })
})

describe('resolvePartyForInvoice', () => {
  it('exact (name, phone) → BY_NAME_AND_PHONE', async () => {
    const tx = buildTx()
    const snapshot = {
      byNamePhone: new Map([
        [namePhoneKey('raju', '9999999990'), { id: 'p1', nameLower: 'raju', phone: '9999999990' }],
      ]),
      byName: new Map(),
    }
    const r = await resolvePartyForInvoice({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx: tx as any,
      businessId: 'biz',
      jobId: 'job1',
      userId: 'u1',
      snapshot,
      candidate: { name: 'Raju', phone: '9999999990' },
      mode: 'MATCH_OR_FLY_CREATE',
    })
    expect(r).toEqual({ partyId: 'p1', matchedBy: 'BY_NAME_AND_PHONE' })
    expect(tx.$executeRaw).not.toHaveBeenCalled()
    expect(createPartyTxMock).not.toHaveBeenCalled()
  })

  it('name-only (no source phone) → BY_NAME_ONLY + warning', async () => {
    const tx = buildTx()
    const row = { id: 'p2', nameLower: 'raju', phone: '' }
    const snapshot = {
      byNamePhone: new Map(),
      byName: new Map([['raju', [row]]]),
    }
    const r = await resolvePartyForInvoice({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx: tx as any,
      businessId: 'biz',
      jobId: 'job1',
      userId: 'u1',
      snapshot,
      candidate: { name: 'Raju', phone: null },
      mode: 'MATCH_OR_FLY_CREATE',
    })
    expect(r.matchedBy).toBe('BY_NAME_ONLY')
    expect(r.warning).toBe('PARTY_NAME_ONLY_MATCH')
    expect(r.partyId).toBe('p2')
  })

  it('REQUIRE_PARTIES_FIRST + no match → PARTY_NOT_FOUND', async () => {
    const tx = buildTx()
    await expect(
      resolvePartyForInvoice({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tx: tx as any,
        businessId: 'biz',
        jobId: 'job1',
        userId: 'u1',
        snapshot: emptySnapshot(),
        candidate: { name: 'Brand New', phone: '9888888888' },
        mode: 'REQUIRE_PARTIES_FIRST',
      }),
    ).rejects.toThrowError(AppError)
    expect(createPartyTxMock).not.toHaveBeenCalled()
  })

  it('MATCH_OR_FLY_CREATE → acquires advisory lock + calls createPartyTx', async () => {
    const tx = buildTx()
    const r = await resolvePartyForInvoice({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx: tx as any,
      businessId: 'biz',
      jobId: 'job1',
      userId: 'u1',
      snapshot: emptySnapshot(),
      candidate: { name: 'Brand New', phone: '9888888888' },
      mode: 'MATCH_OR_FLY_CREATE',
    })
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1) // advisory lock
    expect(tx.party.findFirst).toHaveBeenCalledTimes(1) // post-lock re-check
    expect(createPartyTxMock).toHaveBeenCalledTimes(1)
    const callArgs = createPartyTxMock.mock.calls[0]
    expect(callArgs[3]).toEqual({ importJobId: 'job1', importedBy: 'u1' })
    expect(r).toEqual({ partyId: 'new-party-id', matchedBy: 'FLY_CREATED' })
  })

  it('post-lock re-check returns sibling-INSERTed party (race defence)', async () => {
    const tx = buildTx()
    tx.party.findFirst.mockResolvedValueOnce({ id: 'sibling-inserted-id' })
    const r = await resolvePartyForInvoice({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx: tx as any,
      businessId: 'biz',
      jobId: 'job1',
      userId: 'u1',
      snapshot: emptySnapshot(),
      candidate: { name: 'Racy', phone: '9000000001' },
      mode: 'MATCH_OR_FLY_CREATE',
    })
    expect(r).toEqual({ partyId: 'sibling-inserted-id', matchedBy: 'FLY_CREATED' })
    expect(createPartyTxMock).not.toHaveBeenCalled()
  })

  it('PARTY_NOT_FOUND error code matches AppError taxonomy', async () => {
    const tx = buildTx()
    try {
      await resolvePartyForInvoice({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tx: tx as any,
        businessId: 'biz',
        jobId: 'job1',
        userId: 'u1',
        snapshot: emptySnapshot(),
        candidate: { name: 'X', phone: null },
        mode: 'REQUIRE_PARTIES_FIRST',
      })
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).code).toBe(ErrorCode.PARTY_NOT_FOUND)
    }
  })
})
