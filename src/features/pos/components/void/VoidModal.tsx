/** POS — Void sale confirmation modal with reason input */

import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

interface VoidModalProps {
  receiptNumber: string
  isVoiding:     boolean
  onConfirm:     (reason: string) => void
  onCancel:      () => void
}

const MIN_REASON_LEN = 3

export function VoidModal({
  receiptNumber,
  isVoiding,
  onConfirm,
  onCancel,
}: VoidModalProps) {
  const { t }    = useLanguage()
  const [reason, setReason] = useState('')
  const canSubmit = reason.trim().length >= MIN_REASON_LEN && !isVoiding

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (canSubmit) onConfirm(reason.trim())
  }

  return (
    <div
      className="pos-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t.posVoidTitle ?? 'Void sale'}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="pos-modal pos-modal--danger">
        <div className="pos-modal__header">
          <AlertTriangle size={18} className="pos-modal__danger-icon" aria-hidden="true" />
          <h2 className="pos-modal__title">{t.posVoidTitle ?? 'Void sale'}</h2>
          <button
            type="button"
            className="pos-modal__close"
            onClick={onCancel}
            aria-label={t.cancel ?? 'Cancel'}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pos-modal__body">
          <p className="pos-modal__desc">
            {(t.posVoidConfirmText ?? 'Void sale {receipt}? This will reverse all stock movements.')
              .replace('{receipt}', receiptNumber)}
          </p>

          <label className="pos-modal__label" htmlFor="void-reason">
            {t.posVoidReason ?? 'Reason'} *
          </label>
          <textarea
            id="void-reason"
            className="pos-modal__textarea"
            rows={3}
            minLength={MIN_REASON_LEN}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.posVoidReasonPlaceholder ?? 'Enter reason (min 3 characters)'}
            required
            autoFocus
          />

          <div className="pos-modal__actions">
            <button
              type="button"
              className="pos-modal__cancel-btn"
              onClick={onCancel}
              disabled={isVoiding}
            >
              {t.cancel ?? 'Cancel'}
            </button>
            <button
              type="submit"
              className="pos-modal__danger-btn"
              disabled={!canSubmit}
              aria-busy={isVoiding}
            >
              {isVoiding ? (t.posVoiding ?? 'Voiding…') : (t.posVoidConfirm ?? 'Void sale')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
