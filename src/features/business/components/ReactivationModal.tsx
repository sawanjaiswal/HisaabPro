/**
 * ReactivationModal — owner-only confirm + optional reason field for
 * reactivating a suspended business firm. Phase 6 #138 PR2 FE.
 *
 * Opened from <SuspendBanner> when state='firm-suspended' AND the active
 * member is the owner. Posts to PR2 BE: POST /api/businesses/:id/reactivate
 * and on success calls `refreshActiveBusiness()` so the banner disappears.
 */

import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { reactivateBusiness } from '../suspend.service'
import './reactivation-modal.css'
import { Textarea } from '@/components/ui/Textarea'

interface ReactivationModalProps {
  open: boolean
  businessId: string
  businessName: string
  onClose: () => void
}

const REASON_MAX_LEN = 240

export function ReactivationModal({
  open,
  businessId,
  businessName,
  onClose,
}: ReactivationModalProps) {
  const { t } = useLanguage()
  const { refreshActiveBusiness } = useAuth()
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      if (!dialog.open) dialog.showModal()
      // Defer focus to next paint so the dialog has settled
      requestAnimationFrame(() => closeBtnRef.current?.focus())
    } else if (dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !submitting) {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, submitting, onClose])

  const handleConfirm = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await reactivateBusiness({
        businessId,
        businessName,
        reason: reason.trim() || undefined,
      })
      await refreshActiveBusiness()
      toast.success(t.reactivateModalSuccess)
      setReason('')
      onClose()
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : t.reactivateModalError
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      className="reactivation-modal"
      aria-labelledby="reactivation-modal-title"
    >
      <div className="reactivation-modal__header">
        <h2 id="reactivation-modal-title" className="reactivation-modal__title">
          {t.reactivateModalTitle}
        </h2>
        <Button variant="none"
          ref={closeBtnRef}
          type="button"
          className="reactivation-modal__close"
          onClick={onClose}
          aria-label={t.reactivateModalCancel}
          disabled={submitting}
        >
          <X size={20} aria-hidden="true" />
        </Button>
      </div>

      <div className="reactivation-modal__body">
        <p className="reactivation-modal__desc">{t.reactivateModalBody}</p>

        <label className="reactivation-modal__label" htmlFor="reactivation-reason">
          {t.reactivateModalReasonLabel}
        </label>
        <Textarea
          id="reactivation-reason"
          className="reactivation-modal__textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={REASON_MAX_LEN}
          rows={3}
          placeholder={t.reactivateModalReasonHint}
          disabled={submitting}
        />
        <span className="reactivation-modal__charcount" aria-live="polite">
          {reason.length} / {REASON_MAX_LEN}
        </span>
      </div>

      <div className="reactivation-modal__footer">
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          {t.reactivateModalCancel}
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirm}
          loading={submitting}
          disabled={submitting}
        >
          {t.reactivateModalConfirm}
        </Button>
      </div>
    </dialog>
  )
}
