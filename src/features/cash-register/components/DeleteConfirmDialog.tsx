/** Cash Register — Hard-delete confirm dialog (owner-only, voided entries only) */

import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useDeleteCashEntry } from '../useCashRegisterMutations'

interface Props {
  entryId: string
  businessId: string
  onClose: () => void
}

export function DeleteConfirmDialog({ entryId, businessId, onClose }: Props) {
  const toast = useToast()
  const deleteMutation = useDeleteCashEntry(businessId)

  const handleConfirm = async () => {
    const idempotencyKey = await buildKey(entryId)
    try {
      await deleteMutation.mutateAsync({ businessId, id: entryId, idempotencyKey })
      toast.success('Entry deleted')
      onClose()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete entry.')
    }
  }

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={() => void handleConfirm()}
      title="Delete permanently?"
      description="This cannot be undone. Only voided entries can be deleted."
      confirmLabel="Delete"
      cancelLabel="Cancel"
      isDanger
      isLoading={deleteMutation.isPending}
    />
  )
}

async function buildKey(entryId: string): Promise<string> {
  const material = `delete|${entryId}|${crypto.randomUUID()}`
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
