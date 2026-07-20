/** Products — filter intents, derived from the raw filter state.
 *
 * The chip row speaks in intents ("show low stock", "this category") while the
 * query speaks in fields. Keeping the translation here stops the page from
 * carrying five one-line setters that all have to agree with each other —
 * picking a category must clear low-stock, and vice versa.
 */

import { DEFAULT_PRODUCT_FILTERS } from './product.constants'
import type { ProductFilters } from './product.types'

interface UseProductFilterActionsReturn {
  mode: 'all' | 'low'
  categoryActive: boolean
  filtersActive: boolean
  enableLowStock: () => void
  showAll: () => void
  toggleLowStock: () => void
  selectCategory: (categoryId: string | 'ALL') => void
  resetFilters: () => void
}

export function useProductFilterActions(
  filters: ProductFilters,
  setFilter: <K extends keyof ProductFilters>(key: K, value: ProductFilters[K]) => void,
): UseProductFilterActionsReturn {
  const enableLowStock = () => {
    setFilter('categoryId', undefined)
    setFilter('lowStockOnly', true)
  }

  return {
    mode: filters.lowStockOnly ? 'low' : 'all',
    categoryActive: Boolean(filters.categoryId),
    filtersActive:
      filters.status !== 'ACTIVE' ||
      filters.sortBy !== DEFAULT_PRODUCT_FILTERS.sortBy ||
      filters.sortOrder !== DEFAULT_PRODUCT_FILTERS.sortOrder,
    enableLowStock,
    showAll: () => {
      setFilter('categoryId', undefined)
      setFilter('lowStockOnly', false)
    },
    toggleLowStock: () =>
      filters.lowStockOnly ? setFilter('lowStockOnly', false) : enableLowStock(),
    selectCategory: (categoryId: string | 'ALL') => {
      setFilter('lowStockOnly', false)
      setFilter('categoryId', categoryId === 'ALL' ? undefined : categoryId)
    },
    resetFilters: () => {
      setFilter('status', 'ACTIVE')
      setFilter('sortBy', DEFAULT_PRODUCT_FILTERS.sortBy)
      setFilter('sortOrder', DEFAULT_PRODUCT_FILTERS.sortOrder)
    },
  }
}
