/** Cash Register — Void confirm dialog with optional reason field */

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { useVoidCashEntry } from '../useCashRegisterMutations'

interface Props {
  entryId: string
  businessId: string
  onClose: () => void
}

export function VoidConfirmDialog({ entryId, businessId, onClose }: Props) {
  const toast = useToast()
  const voidMutation = useVoidCashEntry(businessId)
  const [reason, setReason] = useState('')

  const handleConfirm = async () => {
    const idempotencyKey = await buildKey(entryId)
    try {
      await voidMutation.mutateAsync({
        businessId,
        id: entryId,
        reason: reason.trim() || null,
        idempotencyKey,
      })
      toast.success('Entry voided')
      onClose()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not void entry.')
    }
  }

  // We use a custom dialog instead of ConfirmDialog since we need a reason field
  return (
    <dialog
      open
      className="modal cr-dialog"
      role="alertdialog"
      aria-labelledby="void-dialog-title"
      aria-describedby="void-dialog-desc"
    >
      <div className="cr-dialog__body">
        <h2 id="void-dialog-title" className="cr-dialog__title">Void this entry?</h2>
        <p id="void-dialog-desc" className="cr-dialog__desc">
          This entry will be marked as voided. You can restore it later.
        </p>

        <label htmlFor="void-reason" className="cr-dialog__field-label">
          Reason (optional)
        </label>
        <textarea
          id="void-reason"
          className="cr-dialog__textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={256}
          placeholder="e.g. entered by mistake"
          rows={2}
          disabled={voidMutation.isPending}
        />

        <div className="cr-dialog__actions">
          <button
            type="button"
            className="btn btn-ghost btn-md"
            onClick={onClose}
            disabled={voidMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-destructive btn-md"
            onClick={() => void handleConfirm()}
            disabled={voidMutation.isPending}
            aria-busy={voidMutation.isPending}
          >
            {voidMutation.isPending
              ? <><Loader2 size={16} className="spinner" aria-hidden="true" /> Voiding…</>
              : 'Void Entry'
            }
          </button>
        </div>
      </div>
    </dialog>
  )
}

async function buildKey(entryId: string): Promise<string> {
  const material = `void|${entryId}|${crypto.randomUUID()}`
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
