/** Party Custom Fields — API service layer */

import { api } from '@/lib/api'
import type { CustomFieldType, CustomFieldValue } from './party.types'

// ─── Local types ─────────────────────────────────────────────────────────────

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
    entityType: 'custom-field',
    entityLabel: data.name ?? 'New custom field',
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
    entityType: 'custom-field',
    entityLabel: data.name ?? 'Custom field update',
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
    entityType: 'custom-field',
    entityLabel: 'Delete custom field',
  })
}

// ─── Re-export types consumers will need ────────────────────────────────────
export type { CustomFieldValue }
