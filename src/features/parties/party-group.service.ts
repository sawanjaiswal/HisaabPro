/** Party Groups — API service layer */

import { api } from '@/lib/api'
import type { PartyGroup } from './party.types'

// ─── Local types ─────────────────────────────────────────────────────────────

export interface PartyGroupInput {
  name: string
  description?: string
  color: string
}

// ─── Party Groups ─────────────────────────────────────────────────────────────

/**
 * Fetch all party groups, with optional search filter.
 */
export async function getPartyGroups(
  search?: string,
  signal?: AbortSignal
): Promise<PartyGroup[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return api<PartyGroup[]>(`/party-groups${qs}`, { signal })
}

/**
 * Create a new party group. Returns the created group.
 */
export async function createPartyGroup(
  data: PartyGroupInput,
  signal?: AbortSignal
): Promise<PartyGroup> {
  return api<PartyGroup>('/party-groups', {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Update an existing party group. Returns the updated group.
 */
export async function updatePartyGroup(
  id: string,
  data: Partial<PartyGroupInput>,
  signal?: AbortSignal
): Promise<PartyGroup> {
  return api<PartyGroup>(`/party-groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Delete a party group. Parties in the group are unassigned, not deleted.
 */
export async function deletePartyGroup(
  id: string,
  signal?: AbortSignal
): Promise<void> {
  return api<void>(`/party-groups/${id}`, {
    method: 'DELETE',
    signal,
  })
}
