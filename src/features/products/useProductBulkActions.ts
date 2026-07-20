/** Products — bulk-select action wiring (delete / print labels / export).
 *
 * Extracted from ProductsPage to keep the page under the 250-line budget.
 * Owns the delete-in-flight flag and builds the BulkActionBar action list.
 */

import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { deleteProduct } from './product.service'
import type { BulkAction } from '@/components/ui/BulkActionBar'

interface UseProductBulkActionsArgs {
  selectedIds: Set<string>
  selectedCount: number
  clear: () => void
  refresh: () => void
  openLabelPrint: () => void
}

interface UseProductBulkActionsReturn {
  bulkActions: BulkAction[]
  isBulkDeleting: boolean
}

export function useProductBulkActions({
  selectedIds,
  selectedCount,
  clear,
  refresh,
  openLabelPrint,
}: UseProductBulkActionsArgs): UseProductBulkActionsReturn {
  const toast = useToast()
  const { t } = useLanguage()
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  const handleBulkDelete = useCallback(async () => {
    const count = selectedCount
    setIsBulkDeleting(true)
    try {
      const ids = Array.from(selectedIds)
      await Promise.all(ids.map((id) => deleteProduct(id)))
      toast.success(`${count} ${count === 1 ? t.product : t.productsLabel} ${t.delete.toLowerCase()}`)
      clear()
      refresh()
    } catch {
      toast.error(t.failedDeleteProducts)
    } finally {
      setIsBulkDeleting(false)
    }
  }, [selectedIds, selectedCount, clear, refresh, toast, t])

  const handlePrintLabels = useCallback(() => {
    if (selectedCount === 0) {
      toast.info(t.selectProductsToPrint)
      return
    }
    openLabelPrint()
  }, [selectedCount, openLabelPrint, toast, t])

  const bulkActions: BulkAction[] = [
    { id: 'delete', label: t.delete, icon: 'delete', isDanger: true, onClick: handleBulkDelete },
    { id: 'print-labels', label: t.printLabels, icon: 'export', onClick: handlePrintLabels },
    { id: 'export', label: t.export, icon: 'export', onClick: () => toast.info(t.exportComingSoon) },
  ]

  return { bulkActions, isBulkDeleting }
}
