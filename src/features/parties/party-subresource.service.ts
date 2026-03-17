/** Party sub-resources — Address & Pricing API services */

import { api } from '@/lib/api'
import type {
  PartyAddress,
  PartyPricingItem,
} from './party.types'

// ─── Local types ─────────────────────────────────────────────────────────────

export interface PartyAddressInput extends Omit<PartyAddress, 'id'> {}

export interface PartyPricingInput {
  items: Array<Omit<PartyPricingItem, 'productName'>>
}

// ─── Address sub-resource ─────────────────────────────────────────────────────

/**
 * Add an address to a party. Returns the newly created address.
 */
export async function addPartyAddress(
  partyId: string,
  data: PartyAddressInput,
  signal?: AbortSignal
): Promise<PartyAddress> {
  return api<PartyAddress>(`/parties/${partyId}/addresses`, {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Update an existing address on a party. Returns the updated address.
 */
export async function updatePartyAddress(
  partyId: string,
  addressId: string,
  data: Partial<PartyAddressInput>,
  signal?: AbortSignal
): Promise<PartyAddress> {
  return api<PartyAddress>(`/parties/${partyId}/addresses/${addressId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Delete an address from a party.
 */
export async function deletePartyAddress(
  partyId: string,
  addressId: string,
  signal?: AbortSignal
): Promise<void> {
  return api<void>(`/parties/${partyId}/addresses/${addressId}`, {
    method: 'DELETE',
    signal,
  })
}

// ─── Pricing sub-resource ────────────────────────────────────────────────────

/**
 * Replace all custom pricing for a party.
 * Sends the full pricing array — backend does a replace, not a merge.
 * Returns the updated pricing list.
 */
export async function updatePartyPricing(
  partyId: string,
  items: PartyPricingInput['items'],
  signal?: AbortSignal
): Promise<PartyPricingItem[]> {
  return api<PartyPricingItem[]>(`/parties/${partyId}/pricing`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
    signal,
  })
}
