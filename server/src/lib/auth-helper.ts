/**
 * M1 — Auth context helper.
 *
 * Centralises the `req.user.userId` + `req.activeBusiness.id` extraction
 * so every import route reads them through one validated path. This
 * exists because dropping `undefined` into Prisma `where` clauses
 * silently strips the tenant filter and yields cross-tenant IDOR
 * (see MEMORY.md > feedback_auth_req_user_shape).
 *
 * Both ids are validated as non-empty strings; if either is missing the
 * middleware ordering is broken upstream (auth → requireActiveBusiness
 * must precede every import route) and we 500 loudly rather than
 * continue with a partial context.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md File Plan row 4
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md M1
 */

import type { Request } from 'express'
import { AppError, ErrorCode } from './errors.js'
import type { AuthContext } from '../types/import.types.js'

export function getAuth(req: Request): AuthContext {
  const userId = req.user?.userId
  const businessId = req.activeBusiness?.id
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new AppError(
      ErrorCode.INTERNAL_ERROR,
      500,
      'req.user.userId missing — middleware order broken',
    )
  }
  if (typeof businessId !== 'string' || businessId.length === 0) {
    throw new AppError(
      ErrorCode.INTERNAL_ERROR,
      500,
      'req.activeBusiness.id missing — middleware order broken',
    )
  }
  return { userId, businessId }
}
