/** Party Management — API service layer */

import { api } from '@/lib/api'
import type {
  PartyListResponse,
  PartyDetail,
  PartyFilters,
  PartyFormData,
  PartyAddress,
  PartyPricingItem,
  PartyGroup,
  CustomFieldValue,
  CustomFieldType,
} from './party.types'

// ─── Local types for endpoints not covered by party.types ────────────────────

export interface PartyAddressInput extends Omit<PartyAddress, 'id'> {}

export interface PartyPricingInput {
  items: Array<Omit<PartyPricingItem, 'productName'>>
}

export interface PartyGroupInput {
  name: string
  description?: string
  color: string
}

export interface CustomFieldDefinition {
  id: string
  entityType: 'PARTY'
  name: string
  fieldType: CustomFieldType
  isRequired: boolean
  options?: string[] // for DROPDOWN fields
  createdAt: string
  updatedAt: string
}

export interface CustomFieldInput {
  entityType: 'PARTY'
  name: string
  fieldType: CustomFieldType
  isRequired?: boolean
  options?: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a query string from PartyFilters, omitting undefined/null values
 * and the 'ALL' type sentinel (backend expects no `type` param when all).
 */
function buildPartyQuery(filters: Partial<PartyFilters>): string {
  const params = new URLSearchParams()

  const {
    page,
    limit,
    search,
    type,
    groupId,
    hasOutstanding,
    isActive,
    sortBy,
    sortOrder,
  } = filters

  if (page !== undefined) params.set('page', String(page))
  if (limit !== undefined) params.set('limit', String(limit))
  if (search !== undefined && search !== '') params.set('search', search)
  if (type !== undefined && type !== 'ALL') params.set('type', type)
  if (groupId !== undefined) params.set('groupId', groupId)
  if (hasOutstanding !== undefined) params.set('hasOutstanding', String(hasOutstanding))
  if (isActive !== undefined) params.set('isActive', String(isActive))
  if (sortBy !== undefined) params.set('sortBy', sortBy)
  if (sortOrder !== undefined) params.set('sortOrder', sortOrder)

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// ─── Party CRUD ───────────────────────────────────────────────────────────────

/**
 * Fetch paginated party list with optional filters.
 * Returns parties, pagination meta, and outstanding summary.
 */
export async function getParties(
  filters: Partial<PartyFilters> = {},
  signal?: AbortSignal
): Promise<PartyListResponse> {
  return api<PartyListResponse>(`/parties${buildPartyQuery(filters)}`, { signal })
}

/**
 * Fetch full detail for a single party by ID.
 */
export async function getParty(
  id: string,
  signal?: AbortSignal
): Promise<PartyDetail> {
  return api<PartyDetail>(`/parties/${id}`, { signal })
}

/**
 * Create a new party. Returns the full party detail.
 */
export async function createParty(
  data: PartyFormData,
  signal?: AbortSignal
): Promise<PartyDetail> {
  return api<PartyDetail>('/parties', {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Update an existing party. Accepts partial form data.
 * Returns the updated party detail.
 */
export async function updateParty(
  id: string,
  data: Partial<PartyFormData>,
  signal?: AbortSignal
): Promise<PartyDetail> {
  return api<PartyDetail>(`/parties/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Delete a party. Soft delete by default; pass hard=true for permanent.
 */
export async function deleteParty(
  id: string,
  hard = false,
  signal?: AbortSignal
): Promise<void> {
  return api<void>(`/parties/${id}${hard ? '?hard=true' : ''}`, {
    method: 'DELETE',
    signal,
  })
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

// ─── Custom Fields ────────────────────────────────────────────────────────────

/**
 * Fetch all custom field definitions for the PARTY entity type.
 */
export async function getPartyCustomFields(
  signal?: AbortSignal
): Promise<CustomFieldDefinition[]> {
  return api<CustomFieldDefinition[]>('/custom-fields?entityType=PARTY', { signal })
}

/**
 * Create a new custom field definition. Returns the created definition.
 */
export async function createCustomField(
  data: CustomFieldInput,
  signal?: AbortSignal
): Promise<CustomFieldDefinition> {
  return api<CustomFieldDefinition>('/custom-fields', {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Update an existing custom field definition. Returns the updated definition.
 */
export async function updateCustomField(
  id: string,
  data: Partial<Omit<CustomFieldInput, 'entityType'>>,
  signal?: AbortSignal
): Promise<CustomFieldDefinition> {
  return api<CustomFieldDefinition>(`/custom-fields/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Delete a custom field definition.
 * Note: deleting a field removes its values from all parties.
 */
export async function deleteCustomField(
  id: string,
  signal?: AbortSignal
): Promise<void> {
  return api<void>(`/custom-fields/${id}`, {
    method: 'DELETE',
    signal,
  })
}

// ─── Re-export types consumers will need ────────────────────────────────────
export type { CustomFieldValue }
