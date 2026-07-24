/** ProductionRunCancelButton — destructive cancel with confirmation */

import { useState } from 'react'
import { XCircle, Loader2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/context/LanguageContext'
import { ApiError } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { cancelProductionRun } from '../production-run.service'
import { prKeys } from '../hooks/useProductionRuns'
import { Button } from '@/components/ui/Button'

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
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const handleCancel = async () => {
    setCancelling(true)
    try {
      await cancelProductionRun(runId, bomName)
      await queryClient.invalidateQueries({ queryKey: prKeys.all() })
      toast.success(t.prRunCancelled)
      onCancelled()
    } catch (err) {
      let msg = t.prCancelFailed
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_STATUS' || err.code === 'ALREADY_CANCELLED') {
          msg = t.prCannotBeCancelled
        } else if (err.code === 'INSUFFICIENT_STOCK_TO_CANCEL') {
          msg = t.prCancelNegativeStock
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
      <Button variant="none"
        type="button"
        className="btn btn-danger pr-cancel-btn"
        onClick={() => setConfirm(true)}
        disabled={cancelling}
        aria-label={t.prCancelRunAria}
        style={{ minHeight: 44 }}
      >
        {cancelling
          ? <><Loader2 size={16} className="btn-spinner" aria-hidden="true" /> {t.prCancelling}</>
          : <><XCircle size={16} aria-hidden="true" /> {t.prCancelRun}</>
        }
      </Button>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); void handleCancel() }}
        title={t.prCancelRunTitle}
        description={t.prCancelRunDesc}
        confirmLabel={t.prCancelRun}
        cancelLabel={t.prKeepRun}
        isDanger
        isLoading={cancelling}
      />
    </>
  )
}
