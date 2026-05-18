/**
 * Suspend / reactivate a business firm.
 *
 * Phase 6 #138 PR2 FE — thin wrapper around PR2 BE routes.
 *
 *   POST /api/businesses/:id/suspend     (owner-only; emits AuditLog)
 *   POST /api/businesses/:id/reactivate   (owner-only; emits AuditLog)
 *
 * Both pass `entityType: 'business'` + `entityLabel: <business name>` so the
 * offline-queue UI shows a meaningful label per OFFLINE_RULES rule 2.
 */

import { api } from '@/lib/api'

export interface SuspendBusinessRequest {
  businessId: string
  businessName: string
  reason?: string
}

export interface SuspendBusinessResponse {
  business: {
    id: string
    name: string
    suspendedAt: string | null
  }
}

/**
 * Suspend the firm. Owner-only; server returns 403 NOT_OWNER for non-owners.
 * Idempotent: re-suspending a paused firm returns 200 with no new audit row.
 */
export async function suspendBusiness({
  businessId,
  businessName,
  reason,
}: SuspendBusinessRequest): Promise<SuspendBusinessResponse> {
  return api<SuspendBusinessResponse>(`/businesses/${businessId}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || undefined }),
    entityType: 'business',
    entityLabel: businessName,
  })
}

/**
 * Reactivate the firm. Owner-only; server returns 403 NOT_OWNER for non-owners.
 * Idempotent: reactivating an already-active firm returns 200 with no new audit row.
 */
export async function reactivateBusiness({
  businessId,
  businessName,
  reason,
}: SuspendBusinessRequest): Promise<SuspendBusinessResponse> {
  return api<SuspendBusinessResponse>(`/businesses/${businessId}/reactivate`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || undefined }),
    entityType: 'business',
    entityLabel: businessName,
  })
}

/**
 * Suspend-state predicates for the active business.
 * Centralised so TenantChip + SuspendBanner agree on the priority order.
 *
 *   1. firm-suspended (set by owner) — highest priority; affects all members
 *   2. member-suspended (this user's seat is paused)
 *   3. active
 */
export type SuspendState = 'active' | 'firm-suspended' | 'member-suspended'

export function deriveSuspendState(business: {
  suspendedAt?: string | null
  businessSuspendedAt?: string | null
} | null): SuspendState {
  if (!business) return 'active'
  if (business.businessSuspendedAt) return 'firm-suspended'
  if (business.suspendedAt) return 'member-suspended'
  return 'active'
}
