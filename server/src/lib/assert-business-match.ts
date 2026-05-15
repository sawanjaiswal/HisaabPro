/**
 * P2.8 — Reject URL `:businessId` mismatch with JWT businessId.
 *
 * No cross-tenant leak via service code (services always use req.user!.businessId),
 * but a silent path-mismatch confuses audit logs and downstream consumers.
 */
import type { Request, Response } from 'express'
import { sendError } from './response.js'

export function assertBusinessIdMatch(req: Request, res: Response): boolean {
  if (req.params.businessId !== req.user!.businessId) {
    sendError(res, 'Business mismatch', 'FORBIDDEN', 403)
    return false
  }
  return true
}
