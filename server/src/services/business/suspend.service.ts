/**
 * Business suspend/reactivate — Phase 6 #138 tenancy elevation (PR2).
 *
 * Two firm-level operations exposed via `POST /api/businesses/:id/suspend`
 * and `POST /api/businesses/:id/reactivate`. Both are owner-only and write
 * a single AuditLog row inside the same `$transaction` as the column flip
 * so the trail is atomic (no orphan suspends without an audit, no orphan
 * audits without a state change).
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §3.5 + §10.4 + §17.1.
 *
 * Member-level suspend (`POST /api/businesses/:id/members/:userId/suspend`)
 * is intentionally out of scope for PR2 per the task brief — firm-level
 * pause is the canonical "this firm is offline" gesture; member-level kicks
 * land in a later PR if the workflow demands them.
 *
 * Auth model:
 *   - Caller MUST be the firm owner (role='owner' on the BusinessUser row).
 *   - The `requireOwner()` route middleware already enforces this against
 *     `req.user.businessId`. This service re-asserts the same invariant
 *     against the URL-`:id` to defeat any IDOR where the owner of biz1
 *     forges a path-param to suspend biz2. Defense-in-depth: the service
 *     trusts neither the route nor the JWT alone for the target firm id.
 */

import { prisma } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import { createAuditEntry } from '../settings/audit.js'

/**
 * Suspend a firm — sets `Business.suspendedAt = now()`. The next request
 * scoped to this firm fails `requireActiveBusiness` with 403 FIRM_SUSPENDED.
 *
 * Owner-only. Re-asserts ownership inside the transaction (defense-in-depth
 * against any future route mis-mounting that skips `requireOwner()`).
 *
 * @returns the suspended Business row (with suspendedAt set)
 * @throws AppError(PERMISSION_DENIED, 403) if caller is not the firm owner
 * @throws AppError(NOT_FOUND, 404) if the business does not exist
 */
export async function suspendBusiness(params: {
  actorUserId: string
  businessId: string
  reason: string
  ipAddress?: string
  deviceInfo?: string
}) {
  const { actorUserId, businessId, reason, ipAddress, deviceInfo } = params

  return prisma.$transaction(async (tx) => {
    const bu = await tx.businessUser.findUnique({
      where: { userId_businessId: { userId: actorUserId, businessId } },
      select: { role: true, isActive: true, status: true },
    })
    if (!bu || !bu.isActive || bu.status !== 'ACTIVE' || bu.role !== 'owner') {
      throw new AppError(ErrorCode.PERMISSION_DENIED, 403, 'Only the firm owner can suspend this business')
    }

    const existing = await tx.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, suspendedAt: true },
    })
    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, 'Business not found')
    }

    // Idempotent: re-suspending an already-suspended firm is a no-op success
    // (same row returned, same audit row NOT written). Avoids audit-log spam
    // on retries.
    if (existing.suspendedAt) return existing

    const business = await tx.business.update({
      where: { id: businessId },
      data: { suspendedAt: new Date() },
      select: { id: true, name: true, suspendedAt: true },
    })

    await createAuditEntry({
      businessId,
      action: 'SUSPEND_FIRM',
      entityType: 'Business',
      entityId: businessId,
      entityLabel: business.name,
      userId: actorUserId,
      reason,
      ipAddress: ipAddress ?? null,
      deviceInfo: deviceInfo ?? null,
    }, tx)

    return business
  })
}

/**
 * Reactivate a firm — clears `Business.suspendedAt`. The next request scoped
 * to this firm passes `requireActiveBusiness` cleanly.
 *
 * Owner-only with the same defense-in-depth check as `suspendBusiness`.
 *
 * @throws AppError(PERMISSION_DENIED, 403) if caller is not the firm owner
 * @throws AppError(NOT_FOUND, 404) if the business does not exist
 */
export async function reactivateBusiness(params: {
  actorUserId: string
  businessId: string
  ipAddress?: string
  deviceInfo?: string
}) {
  const { actorUserId, businessId, ipAddress, deviceInfo } = params

  return prisma.$transaction(async (tx) => {
    const bu = await tx.businessUser.findUnique({
      where: { userId_businessId: { userId: actorUserId, businessId } },
      select: { role: true, isActive: true, status: true },
    })
    if (!bu || !bu.isActive || bu.status !== 'ACTIVE' || bu.role !== 'owner') {
      throw new AppError(ErrorCode.PERMISSION_DENIED, 403, 'Only the firm owner can reactivate this business')
    }

    const existing = await tx.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, suspendedAt: true },
    })
    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, 'Business not found')
    }

    // Idempotent: reactivating an already-active firm is a no-op success.
    if (!existing.suspendedAt) return existing

    const business = await tx.business.update({
      where: { id: businessId },
      data: { suspendedAt: null },
      select: { id: true, name: true, suspendedAt: true },
    })

    await createAuditEntry({
      businessId,
      action: 'REACTIVATE_FIRM',
      entityType: 'Business',
      entityId: businessId,
      entityLabel: business.name,
      userId: actorUserId,
      ipAddress: ipAddress ?? null,
      deviceInfo: deviceInfo ?? null,
    }, tx)

    return business
  })
}
