/**
 * POST /api/auth/switch-business — audit hook — Phase 6 #138 PR2.
 *
 * Acceptance gate (architecture §17.1): "Switch-business writes an
 * AuditLog row with action='SWITCH'" — and (per §3.2) the row MUST be
 * scoped to the TARGET firm so that target's owner can see who pivoted
 * in and where they came from.
 *
 * We mock the auth.service module so we don't need to stand up a real
 * BusinessUser row for the switch itself; we then verify the
 * `emitBusinessSwitchAudit` hook fired against the auto-mocked prisma
 * with the correct businessId / action / changes shape.
 *
 * The hook is fire-and-forget: if the AuditLog insert fails, the switch
 * still succeeds. We cover both paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '../app.js'
import { authAgent, mockAuthPass, resetMocks, getMockPrisma, TEST_USER } from './helpers.js'

// Mock the auth service rotation logic but let the real audit hook run
// against auto-mocked prisma. The hook lives at services/auth/switch-business-audit.ts
// and is imported separately by the route, so this mock leaves it alone.
vi.mock('../services/auth.service.js', () => ({
  switchBusiness: vi.fn(),
  setTokenCookies: vi.fn(),
}))
import * as authService from '../services/auth.service.js'

const app = createApp()

const TARGET_BIZ_ID = 'biz-target-1'
const TARGET_BIZ_NAME = 'Target Firm'
const MOCK_TOKENS = { accessToken: 'access-tok-new', refreshToken: 'refresh-tok-new' }

beforeEach(() => {
  resetMocks()
  vi.clearAllMocks()
})

describe('POST /api/auth/switch-business — AuditLog SWITCH hook', () => {
  it('writes an AuditLog row scoped to the TARGET firm with action=SWITCH', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    vi.mocked(authService.switchBusiness).mockResolvedValue({
      tokens: MOCK_TOKENS,
      business: { id: TARGET_BIZ_ID, name: TARGET_BIZ_NAME, businessType: 'retail' },
    })
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-switch-1' })

    const res = await authAgent(app)
      .post('/api/auth/switch-business')
      .send({ businessId: TARGET_BIZ_ID })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // The audit row MUST be scoped to the target firm (so target's owner sees it),
    // action MUST be 'SWITCH', and the `changes` JSON MUST carry both the
    // fromBusinessId and toBusinessId for forensic context.
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        businessId: TARGET_BIZ_ID,
        action: 'SWITCH',
        entityType: 'BusinessSwitch',
        entityId: TARGET_BIZ_ID,
        entityLabel: TARGET_BIZ_NAME,
        userId: TEST_USER.userId,
        changes: { fromBusinessId: TEST_USER.businessId, toBusinessId: TARGET_BIZ_ID },
      }),
    }))
  })

  it('still returns 200 when the audit insert fails (fire-and-forget)', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()
    vi.mocked(authService.switchBusiness).mockResolvedValue({
      tokens: MOCK_TOKENS,
      business: { id: TARGET_BIZ_ID, name: TARGET_BIZ_NAME, businessType: 'retail' },
    })
    // Audit insert blows up — must not block the rotation.
    mockPrisma.auditLog.create.mockRejectedValue(new Error('db: connection reset'))

    const res = await authAgent(app)
      .post('/api/auth/switch-business')
      .send({ businessId: TARGET_BIZ_ID })

    expect(res.status).toBe(200)
    expect(res.body.data.business.id).toBe(TARGET_BIZ_ID)
    // Rotation still happened — switchBusiness was invoked.
    expect(authService.switchBusiness).toHaveBeenCalledTimes(1)
  })

  it('does NOT write an audit row when the switch is rejected as ALREADY_ACTIVE', async () => {
    mockAuthPass()
    const mockPrisma = getMockPrisma()

    const res = await authAgent(app)
      .post('/api/auth/switch-business')
      .send({ businessId: TEST_USER.businessId })  // switching to current = no-op

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('ALREADY_ACTIVE')
    expect(authService.switchBusiness).not.toHaveBeenCalled()
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled()
  })
})
