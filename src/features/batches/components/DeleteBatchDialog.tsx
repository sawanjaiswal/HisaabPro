/** DeleteBatchDialog — Confirmation dialog for batch deletion */

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface DeleteBatchDialogProps {
  batchNumber: string
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteBatchDialog({
  batchNumber,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteBatchDialogProps) {
  return (
    <ConfirmDialog
      open={true}
      onClose={onCancel}
      onConfirm={onConfirm}
      title="Delete Batch?"
      description={`This will permanently remove batch ${batchNumber}. This cannot be undone.`}
      confirmLabel="Delete"
      isLoading={isDeleting}
    />
  )
}
