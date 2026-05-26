/**
 * Phase 7 · 7.1C PR-C1 — `createPartyTx` (ARCH M2).
 *
 * Verifies the tx-injectable variant:
 *   1. duplicate-phone guard fires (returns 409 DUPLICATE_ENTRY) and
 *      never reaches tx.party.create.
 *   2. import provenance (`importJobId` / `importedBy`) is persisted
 *      when supplied by the import path.
 *   3. STAFF rejection (M7 closure) is preserved by the refactor.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPartyTx } from '../create-tx.js'
import { AppError, ErrorCode } from '../../../lib/errors.js'

vi.mock('../helpers.js', () => ({
  requireGroup: vi.fn().mockResolvedValue(undefined),
}))

interface FakeTx {
  party: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
  partyAddress: { createMany: ReturnType<typeof vi.fn> }
  partyCustomFieldValue: { createMany: ReturnType<typeof vi.fn> }
  openingBalance: { create: ReturnType<typeof vi.fn> }
}

function makeTx(): FakeTx {
  return {
    party: { findFirst: vi.fn(), create: vi.fn() },
    partyAddress: { createMany: vi.fn() },
    partyCustomFieldValue: { createMany: vi.fn() },
    openingBalance: { create: vi.fn() },
  }
}

const baseInput = {
  name: 'Raju Traders',
  phone: '9876543210',
  email: null,
  companyName: null,
  type: 'CUSTOMER' as const,
  groupId: undefined,
  tags: [],
  gstin: null,
  pan: null,
  creditLimit: 0,
  creditLimitMode: 'DEFAULT' as const,
  notes: null,
  addresses: [],
  customFields: [],
  openingBalance: undefined,
  priceListId: undefined,
}

describe('createPartyTx (ARCH M2 — tx-injectable + provenance)', () => {
  let tx: FakeTx

  beforeEach(() => {
    tx = makeTx()
  })

  it('rejects duplicate phone with 409 DUPLICATE_ENTRY (does not call create)', async () => {
    tx.party.findFirst.mockResolvedValueOnce({ id: 'existing-1' })

    await expect(
      createPartyTx(tx as never, 'biz-1', baseInput as never, {}),
    ).rejects.toMatchObject({
      name: 'AppError',
      code: ErrorCode.DUPLICATE_ENTRY,
      statusCode: 409,
    })

    expect(tx.party.findFirst).toHaveBeenCalledWith({
      where: { businessId: 'biz-1', phone: '9876543210' },
      select: { id: true },
    })
    expect(tx.party.create).not.toHaveBeenCalled()
  })

  it('persists importJobId + importedBy when supplied (import path)', async () => {
    tx.party.findFirst.mockResolvedValueOnce(null)
    tx.party.create.mockResolvedValueOnce({
      id: 'new-1',
      name: 'Raju Traders',
      importJobId: 'job-1',
      importedBy: 'user-1',
    })

    await createPartyTx(tx as never, 'biz-1', baseInput as never, {
      importJobId: 'job-1',
      importedBy: 'user-1',
    })

    expect(tx.party.create).toHaveBeenCalledTimes(1)
    const arg = tx.party.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(arg.data).toMatchObject({
      businessId: 'biz-1',
      phone: '9876543210',
      importJobId: 'job-1',
      importedBy: 'user-1',
    })
  })

  it('omits importJobId/importedBy when opts empty (public createParty path)', async () => {
    tx.party.findFirst.mockResolvedValueOnce(null)
    tx.party.create.mockResolvedValueOnce({ id: 'new-2' })

    await createPartyTx(tx as never, 'biz-1', baseInput as never, {})

    const arg = tx.party.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect('importJobId' in arg.data).toBe(false)
    expect('importedBy' in arg.data).toBe(false)
  })

  it('rejects type=STAFF with 400 INVALID_PARTY_TYPE (M7 closure preserved)', async () => {
    const staff = { ...baseInput, type: 'STAFF' as const }

    await expect(
      createPartyTx(tx as never, 'biz-1', staff as never, {}),
    ).rejects.toBeInstanceOf(AppError)

    expect(tx.party.findFirst).not.toHaveBeenCalled()
    expect(tx.party.create).not.toHaveBeenCalled()
  })

  it('skips phone guard when phone is null (walk-in)', async () => {
    const walkIn = { ...baseInput, phone: null }
    tx.party.create.mockResolvedValueOnce({ id: 'walk-1' })

    await createPartyTx(tx as never, 'biz-1', walkIn as never, {})

    expect(tx.party.findFirst).not.toHaveBeenCalled()
    expect(tx.party.create).toHaveBeenCalled()
  })
})
