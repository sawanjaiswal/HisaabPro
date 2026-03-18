/** Items Library — Pure utility functions */

import { SEED_ITEMS } from './items-library.constants'
import type { LibraryItem } from './items-library.types'

/**
 * Search library items by name or category.
 * Returns filtered + paginated results.
 */
export function searchLibraryItems(
  query: string,
  category: string | null,
  page: number,
  pageSize: number,
): { items: LibraryItem[]; total: number; hasMore: boolean } {
  let filtered = SEED_ITEMS

  if (category) {
    filtered = filtered.filter((item) => item.category === category)
  }

  if (query.trim()) {
    const lower = query.toLowerCase()
    filtered = filtered.filter((item) =>
      item.name.toLowerCase().includes(lower) ||
      item.hsn?.includes(lower),
    )
  }

  const total = filtered.length
  const start = (page - 1) * pageSize
  const items = filtered.slice(start, start + pageSize)

  return { items, total, hasMore: start + pageSize < total }
}

/**
 * Get a library item by ID.
 */
export function getLibraryItemById(id: string): LibraryItem | undefined {
  return SEED_ITEMS.find((item) => item.id === id)
}
