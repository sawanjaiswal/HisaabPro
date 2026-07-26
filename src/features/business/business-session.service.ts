/**
 * Acquiring a business — the one place it happens.
 *
 * Every business-scoped route reads `businessId` from the JWT claim, never from
 * the URL. A session minted before the account had a business carries `''`, so
 * a shop that plainly exists in the database is invisible to the server until
 * the token is re-minted: the Roles list 400s on a foreign key, staff cannot be
 * invited, and lists come back empty with no error to show the user.
 *
 * Creating and joining therefore both end in `/auth/switch-business`, the
 * endpoint that owns token minting and cookie rotation. This module exists so
 * that a fourth way to acquire a business cannot be written without it — the
 * knowledge used to live in a comment in the onboarding hook, and the two
 * call-sites added later did not have it.
 * See .claude/fix-trace-business-session-activation.md.
 */

import { api } from '@/lib/api'
import * as authLib from '@/lib/auth'
import type { CreateBusinessInput } from './business.types'

export interface AcquiredBusiness {
  id: string
  name: string
  businessType?: string
}

interface CreateBusinessResponse {
  business: AcquiredBusiness
}

/**
 * Point the session at `businessId`.
 *
 * Failure is not fatal: the business exists regardless, and the next request
 * re-authenticates through the normal 401/refresh path. Surfacing it would turn
 * a rate-limited re-mint into "your signup failed", which is both wrong and —
 * for a single-use invite code — unrecoverable.
 */
async function activateSession(businessId: string): Promise<void> {
  try {
    await authLib.switchBusiness(businessId)
  } catch {
    // Intentionally swallowed — see above.
  }
}

export async function createBusiness(input: CreateBusinessInput): Promise<AcquiredBusiness> {
  const response = await api<CreateBusinessResponse>('/businesses', {
    method: 'POST',
    body: JSON.stringify(input),
    entityType: 'business',
    entityLabel: input.name,
  })

  // Offline, api() resolves `{}` — there is no business yet and nothing to
  // activate; the queued mutation runs when the connection returns.
  const business = response?.business
  if (!business?.id) return { id: '', name: input.name }

  await activateSession(business.id)
  return business
}

export async function joinBusinessWithCode(
  code: string,
): Promise<Awaited<ReturnType<typeof authLib.joinBusiness>>> {
  const result = await authLib.joinBusiness(code)
  if (result?.business?.id) await activateSession(result.business.id)
  return result
}
