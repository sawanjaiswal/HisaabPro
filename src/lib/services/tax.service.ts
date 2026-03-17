/** Shared tax service — list/delete/seed used by useTaxCategories hook */

import { api } from '@/lib/api'
import type { TaxCategory } from '@/lib/types/tax.types'

export async function listTaxCategories(businessId: string): Promise<TaxCategory[]> {
  return api<TaxCategory[]>(`/tax-categories?businessId=${businessId}`)
}

export async function deleteTaxCategory(id: string): Promise<void> {
  return api<void>(`/tax-categories/${id}`, { method: 'DELETE' })
}

export async function seedDefaultTaxCategories(businessId: string): Promise<TaxCategory[]> {
  return api<TaxCategory[]>('/tax-categories/seed-defaults', {
    method: 'POST',
    body: JSON.stringify({ businessId }),
    headers: { 'Content-Type': 'application/json' },
  })
}
