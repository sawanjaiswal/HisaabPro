/** ProductionRunCancelButton — destructive cancel with confirmation */

import { useState } from 'react'
import { XCircle, Loader2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { cancelProductionRun } from '../production-run.service'
import { prKeys } from '../hooks/useProductionRuns'

interface ProductionRunCancelButtonProps {
  runId: string
  bomName: string
  onCancelled: () => void
}

export function ProductionRunCancelButton({
  runId,
  bomName,
  onCancelled,
}: ProductionRunCancelButtonProps) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const handleCancel = async () => {
    setCancelling(true)
    try {
      await cancelProductionRun(runId, bomName)
      await queryClient.invalidateQueries({ queryKey: prKeys.all() })
      toast.success('Production run cancelled')
      onCancelled()
    } catch (err) {
      let msg = 'Failed to cancel run'
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_STATUS' || err.code === 'ALREADY_CANCELLED') {
          msg = 'This run cannot be cancelled'
        } else if (err.code === 'INSUFFICIENT_STOCK_TO_CANCEL') {
          msg = 'Cannot cancel — finished goods stock would go negative'
        } else {
          msg = err.message
        }
      }
      toast.error(msg)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-danger pr-cancel-btn"
        onClick={() => setConfirm(true)}
        disabled={cancelling}
        aria-label="Cancel production run"
        style={{ minHeight: 44 }}
      >
        {cancelling
          ? <><Loader2 size={16} className="btn-spinner" aria-hidden="true" /> Cancelling...</>
          : <><XCircle size={16} aria-hidden="true" /> Cancel Run</>
        }
      </button>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); void handleCancel() }}
        title="Cancel Production Run?"
        description="This will reverse all stock movements. Finished goods will be deducted and raw materials restored. This cannot be undone."
        confirmLabel="Cancel Run"
        cancelLabel="Keep Run"
        isDanger
        isLoading={cancelling}
      />
    </>
  )
}
