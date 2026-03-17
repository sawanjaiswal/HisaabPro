/** Category — API service layer */

import { api } from '@/lib/api'
import type { Category } from './product.types'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CategoryInput {
  name: string
  color?: string
  sortOrder?: number
}

// ─── Categories CRUD ─────────────────────────────────────────────────────────

/**
 * Fetch all categories (predefined + custom), with optional name search.
 */
export async function getCategories(
  search?: string,
  signal?: AbortSignal
): Promise<Category[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return api<Category[]>(`/categories${qs}`, { signal })
}

/**
 * Create a new custom category. Returns the created category.
 */
export async function createCategory(
  data: CategoryInput,
  signal?: AbortSignal
): Promise<Category> {
  return api<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Update an existing custom category. Only CUSTOM categories can be edited.
 * Returns the updated category.
 */
export async function updateCategory(
  id: string,
  data: Partial<CategoryInput>,
  signal?: AbortSignal
): Promise<Category> {
  return api<Category>(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Delete a custom category.
 * `reassignTo` is required — all products move to the target category before deletion.
 */
export async function deleteCategory(
  id: string,
  reassignTo: string,
  signal?: AbortSignal
): Promise<void> {
  return api<void>(`/categories/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ reassignTo }),
    signal,
  })
}
