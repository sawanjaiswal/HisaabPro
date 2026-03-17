/** Bulk Selection — Shared hook for multi-select on list pages
 *
 * Provides select/deselect/toggle/selectAll/clear + selected count.
 * Works with any entity that has an `id: string` field.
 */

import { useState, useCallback, useMemo } from 'react'

interface UseBulkSelectReturn {
  /** Set of currently selected IDs */
  selectedIds: Set<string>
  /** Number of selected items */
  selectedCount: number
  /** Whether bulk mode is active (at least 1 selected) */
  isActive: boolean
  /** Whether a specific ID is selected */
  isSelected: (id: string) => boolean
  /** Toggle selection of a single ID */
  toggle: (id: string) => void
  /** Select all provided IDs */
  selectAll: (ids: string[]) => void
  /** Clear all selections and exit bulk mode */
  clear: () => void
}

export function useBulkSelect(): UseBulkSelectReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids))
  }, [])

  const clear = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  )

  const selectedCount = selectedIds.size
  const isActive = selectedCount > 0

  return useMemo(
    () => ({
      selectedIds,
      selectedCount,
      isActive,
      isSelected,
      toggle,
      selectAll,
      clear,
    }),
    [selectedIds, selectedCount, isActive, isSelected, toggle, selectAll, clear],
  )
}
