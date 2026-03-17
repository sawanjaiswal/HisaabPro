/** GST & Tax — API service layer
 *
 * All monetary values are in PAISE (integer) — the server and client both
 * use paise. Display conversion is done at the component level via formatCurrency.
 *
 * API base: the `api()` helper already prepends API_URL, so paths start at /
 * (not /api). The `api()` wrapper throws on failure and returns data directly.
 * Server routes are mounted at /tax-categories, /hsn, /gstin.
 */

import { api } from '@/lib/api'
import type {
  TaxCategory,
  TaxCategoryFormData,
  HsnCode,
  GstinVerifyResult,
} from './tax.types'

// ─── Tax Categories ───────────────────────────────────────────────────────────

// Shared functions re-exported from lib (used by shared hook)
export { listTaxCategories, deleteTaxCategory, seedDefaultTaxCategories } from '@/lib/services/tax.service'

export async function createTaxCategory(
  businessId: string,
  data: TaxCategoryFormData,
): Promise<TaxCategory> {
  return api<TaxCategory>('/tax-categories', {
    method: 'POST',
    body: JSON.stringify({ ...data, businessId }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function updateTaxCategory(
  id: string,
  data: Partial<TaxCategoryFormData>,
): Promise<TaxCategory> {
  return api<TaxCategory>(`/tax-categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── HSN / SAC Search ─────────────────────────────────────────────────────────

export async function searchHsnCodes(
  query: string,
  limit = 20,
): Promise<HsnCode[]> {
  return api<HsnCode[]>(
    `/hsn/search?q=${encodeURIComponent(query)}&limit=${limit}`,
  )
}

export async function getHsnCode(code: string): Promise<HsnCode> {
  return api<HsnCode>(`/hsn/${code}`)
}

// ─── GSTIN ────────────────────────────────────────────────────────────────────

/**
 * Validate GSTIN format server-side (format + checksum, no external call).
 * Faster than verifyGstin — use for inline form validation.
 */
export async function validateGstinRemote(gstin: string): Promise<GstinVerifyResult> {
  return api<GstinVerifyResult>('/gstin/validate', {
    method: 'POST',
    body: JSON.stringify({ gstin }),
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Verify GSTIN against the GST portal (legalName, status, type).
 * Slower — use only when user explicitly requests verification.
 */
export async function verifyGstin(gstin: string): Promise<GstinVerifyResult> {
  return api<GstinVerifyResult>('/gstin/verify', {
    method: 'POST',
    body: JSON.stringify({ gstin }),
    headers: { 'Content-Type': 'application/json' },
  })
}
