/** Unit, Unit Conversion & Inventory Settings — API service layer */

import { api } from '@/lib/api'
import type { Unit, UnitConversion, InventorySettings } from './product.types'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UnitInput {
  name: string
  symbol: string
}

export interface UnitConversionInput {
  fromUnitId: string
  toUnitId: string
  factor: number
}

export interface InventorySettingsInput {
  stockValidationMode?: 'WARN_ONLY' | 'HARD_BLOCK'
  skuPrefix?: string
  skuAutoGenerate?: boolean
  lowStockAlertFrequency?: 'ONCE' | 'DAILY' | 'EVERY_TIME'
  lowStockAlertEnabled?: boolean
  /** 0–3 */
  decimalPrecisionQty?: number
  defaultCategoryId?: string
  defaultUnitId?: string
}

// ─── Units CRUD ──────────────────────────────────────────────────────────────

/**
 * Fetch all units (predefined + custom), with optional name/symbol search.
 */
export async function getUnits(
  search?: string,
  signal?: AbortSignal
): Promise<Unit[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return api<Unit[]>(`/units${qs}`, { signal })
}

/**
 * Create a new custom unit. Returns the created unit.
 */
export async function createUnit(
  data: UnitInput,
  signal?: AbortSignal
): Promise<Unit> {
  return api<Unit>('/units', {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Update an existing custom unit. Only CUSTOM units can be edited.
 * Returns the updated unit.
 */
export async function updateUnit(
  id: string,
  data: Partial<UnitInput>,
  signal?: AbortSignal
): Promise<Unit> {
  return api<Unit>(`/units/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Delete a custom unit.
 * Fails if any products still reference this unit — reassign products first.
 */
export async function deleteUnit(
  id: string,
  signal?: AbortSignal
): Promise<void> {
  return api<void>(`/units/${id}`, {
    method: 'DELETE',
    signal,
  })
}

// ─── Unit Conversions ────────────────────────────────────────────────────────

/**
 * Fetch all unit conversions for this business.
 * The server also stores the reverse direction — this returns both.
 */
export async function getUnitConversions(
  signal?: AbortSignal
): Promise<UnitConversion[]> {
  return api<UnitConversion[]>('/unit-conversions', { signal })
}

/**
 * Create a new unit conversion (e.g. 1 box = 12 pcs).
 * Server automatically creates the reverse (1 pcs = 0.0833 box).
 * Returns the forward conversion record.
 */
export async function createUnitConversion(
  data: UnitConversionInput,
  signal?: AbortSignal
): Promise<UnitConversion> {
  return api<UnitConversion>('/unit-conversions', {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Delete a unit conversion by ID.
 * Server deletes both the forward and reverse conversion records.
 */
export async function deleteUnitConversion(
  id: string,
  signal?: AbortSignal
): Promise<void> {
  return api<void>(`/unit-conversions/${id}`, {
    method: 'DELETE',
    signal,
  })
}

// ─── Inventory Settings ──────────────────────────────────────────────────────

/**
 * Fetch business-level inventory settings (global stock validation mode,
 * SKU prefix, low-stock alert config, default category/unit, etc.).
 */
export async function getInventorySettings(
  signal?: AbortSignal
): Promise<InventorySettings> {
  return api<InventorySettings>('/settings/inventory', { signal })
}

/**
 * Update inventory settings. Accepts partial updates — only changed fields needed.
 * Returns the full updated settings object.
 */
export async function updateInventorySettings(
  data: InventorySettingsInput,
  signal?: AbortSignal
): Promise<InventorySettings> {
  return api<InventorySettings>('/settings/inventory', {
    method: 'PUT',
    body: JSON.stringify(data),
    signal,
  })
}
