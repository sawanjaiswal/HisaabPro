/**
 * Switch-business audit hook — Phase 6 #138 tenancy elevation (PR2).
 *
 * Emits an `AuditLog` row scoped to the **target** business when a user
 * pivots to it via `POST /api/auth/switch-business`. The from-businessId
 * lives in the `changes` JSON column so a single query against the new
 * firm's audit table tells the new firm's owner who switched in and where
 * they came from.
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §3.2 + §17.1 acceptance gate
 * "Switch-business writes an AuditLog row with action='SWITCH'".
 *
 * Fire-and-forget by design — the switch itself MUST succeed even if the
 * audit insert hits a transient DB error. We log on failure so the gap is
 * visible in observability; we do NOT block the rotation.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'

export async function emitBusinessSwitchAudit(params: {
  actorUserId: string
  fromBusinessId: string | null
  toBusinessId: string
  toBusinessName?: string
  ipAddress?: string
  deviceInfo?: string
}): Promise<void> {
  const { actorUserId, fromBusinessId, toBusinessId, toBusinessName, ipAddress, deviceInfo } = params

  try {
    await prisma.auditLog.create({
      data: {
        businessId: toBusinessId,
        action: 'SWITCH',
        entityType: 'BusinessSwitch',
        entityId: toBusinessId,
        entityLabel: toBusinessName ?? null,
        userId: actorUserId,
        changes: { fromBusinessId, toBusinessId },
        ipAddress: ipAddress ?? null,
        deviceInfo: deviceInfo ?? null,
      },
    })
  } catch (err) {
    logger.error('auth.switch_business.audit_failed', {
      actorUserId,
      fromBusinessId,
      toBusinessId,
      err: err instanceof Error ? err.message : String(err),
    })
  }
}
