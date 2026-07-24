/** Cash Register — Void confirm dialog with optional reason field */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { useVoidCashEntry } from '../useCashRegisterMutations'
import { Textarea } from '@/components/ui/Textarea'
import { useLanguage } from '@/hooks/useLanguage'

interface Props {
  entryId: string
  businessId: string
  onClose: () => void
}

export function VoidConfirmDialog({ entryId, businessId, onClose }: Props) {
  const toast = useToast()
  const { t } = useLanguage()
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
      toast.success(t.cashRegToastEntryVoided)
      onClose()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.cashRegToastErrorVoid)
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
        <h2 id="void-dialog-title" className="cr-dialog__title">{t.cashRegVoidDialogTitle}</h2>
        <p id="void-dialog-desc" className="cr-dialog__desc">
          {t.cashRegVoidDialogDescription}
        </p>

        <label htmlFor="void-reason" className="cr-dialog__field-label">
          {t.cashRegLabelVoidReason}
        </label>
        <Textarea
          id="void-reason"
          className="cr-dialog__textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={256}
          placeholder={t.cashRegVoidReasonPlaceholder}
          rows={2}
          disabled={voidMutation.isPending}
        />

        <div className="cr-dialog__actions">
          <Button
            type="button"
            variant="ghost" size="md"
            onClick={onClose}
            disabled={voidMutation.isPending}
          >
            {t.cancel}
          </Button>
          <Button
            type="button"
            variant="destructive" size="md"
            onClick={() => void handleConfirm()}
            disabled={voidMutation.isPending}
            aria-busy={voidMutation.isPending}
          >
            {voidMutation.isPending
              ? <><Loader2 size={16} className="spinner" aria-hidden="true" /> {t.cashRegVoiding}</>
              : t.cashRegVoidDialogButton
            }
          </Button>
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
