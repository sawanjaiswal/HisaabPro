/**
 * Permission middleware — enforces role-based access control.
 * Requires auth middleware to run first (req.user must have businessId).
 *
 * Usage:
 *   router.post('/invoices', auth, requirePermission('invoicing.create'), asyncHandler(...))
 *   router.delete('/staff', auth, requireOwner(), asyncHandler(...))
 */

import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.js'
import { sendError } from '../lib/response.js'

/**
 * Middleware factory — checks if the authenticated user has a specific permission
 * in their active business.
 *
 * Owners always pass (role === 'owner' bypasses permission lookup).
 */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user
    if (!user) {
      sendError(res, 'Authentication required', 'UNAUTHORIZED', 401)
      return
    }

    const { userId, businessId } = user

    if (!businessId) {
      sendError(res, 'No active business', 'NO_BUSINESS', 403)
      return
    }

    const bu = await prisma.businessUser.findUnique({
      where: { userId_businessId: { userId, businessId } },
      select: {
        role: true,
        status: true,
        isActive: true,
        roleRef: { select: { permissions: true } },
      },
    })

    if (!bu || !bu.isActive || bu.status !== 'ACTIVE') {
      sendError(res, 'Access denied', 'FORBIDDEN', 403)
      return
    }

    // Owners bypass permission checks
    if (bu.role === 'owner') {
      next()
      return
    }

    const permissions = bu.roleRef?.permissions ?? []
    if (!permissions.includes(permission)) {
      sendError(
        res,
        `You do not have permission to ${permission.replace('.', ' ')}`,
        'FORBIDDEN',
        403
      )
      return
    }

    next()
  }
}

/**
 * Middleware — only business owner can proceed.
 * Used for: delete business, manage staff, modify settings.
 */
export function requireOwner() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user
    if (!user) {
      sendError(res, 'Authentication required', 'UNAUTHORIZED', 401)
      return
    }

    const { userId, businessId } = user

    if (!businessId) {
      sendError(res, 'No active business', 'NO_BUSINESS', 403)
      return
    }

    const bu = await prisma.businessUser.findUnique({
      where: { userId_businessId: { userId, businessId } },
      select: { role: true, isActive: true, status: true },
    })

    if (!bu || !bu.isActive || bu.status !== 'ACTIVE') {
      sendError(res, 'Access denied', 'FORBIDDEN', 403)
      return
    }

    if (bu.role !== 'owner') {
      sendError(res, 'Only the business owner can perform this action', 'OWNER_REQUIRED', 403)
      return
    }

    next()
  }
}
