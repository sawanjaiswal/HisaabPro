/**
 * Cheque terminal-state regression (#92). A cheque that has reached any
 * outcome (CLEARED / BOUNCED / CANCELLED / RETURNED) is terminal — only a
 * PENDING cheque may be updated. The original guard omitted BOUNCED, letting a
 * bounced cheque be flipped back to CLEARED and erasing bouncedAt/bounceCharges.
 * Trace: .claude/fix-trace-cheque-terminal.md
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { updateChequeStatus } from './cheque.service.js'
import { prisma } from '../lib/prisma.js'

const cheque = (status: string) => ({ id: 'chq-1', status })

describe('updateChequeStatus — terminal-state guard (#92)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.cheque.update).mockResolvedValue({ id: 'chq-1' } as never)
  })

  it('rejects updating a BOUNCED cheque (regression — the bug)', async () => {
    vi.mocked(prisma.cheque.findFirst).mockResolvedValue(cheque('BOUNCED') as never)
    await expect(
      updateChequeStatus('biz-1', 'chq-1', { status: 'CLEARED', clearanceDate: new Date() } as never),
    ).rejects.toThrow(/already bounced/i)
    expect(prisma.cheque.update).not.toHaveBeenCalled()
  })

  it.each(['CLEARED', 'CANCELLED', 'RETURNED'])('rejects updating a %s cheque', async (status) => {
    vi.mocked(prisma.cheque.findFirst).mockResolvedValue(cheque(status) as never)
    await expect(
      updateChequeStatus('biz-1', 'chq-1', { status: 'BOUNCED' } as never),
    ).rejects.toThrow(/cannot be updated/i)
    expect(prisma.cheque.update).not.toHaveBeenCalled()
  })

  it('allows updating a PENDING cheque', async () => {
    vi.mocked(prisma.cheque.findFirst).mockResolvedValue(cheque('PENDING') as never)
    await updateChequeStatus('biz-1', 'chq-1', {
      status: 'BOUNCED', bounceCharges: 5000, bounceReason: 'Insufficient funds',
    } as never)
    expect(prisma.cheque.update).toHaveBeenCalledTimes(1)
  })
})
