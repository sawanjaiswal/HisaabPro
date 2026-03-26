/** DeleteBatchDialog — Confirmation dialog for batch deletion */

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useLanguage } from '@/hooks/useLanguage'

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
  const { t } = useLanguage()
  return (
    <ConfirmDialog
      open={true}
      onClose={onCancel}
      onConfirm={onConfirm}
      title={t.deleteBatchTitle}
      description={`This will permanently remove batch ${batchNumber}. This cannot be undone.`}
      confirmLabel="Delete"
      isLoading={isDeleting}
    />
  )
}
