/** ComplianceCancelForm — reusable inline cancel form for e-invoice and e-way bill */

import React, { useState } from 'react'

interface ComplianceCancelFormProps {
  title: string
  placeholder?: string
  cancelling: boolean
  onConfirm: (reason: string) => Promise<void>
  onDismiss: () => void
}

export const ComplianceCancelForm: React.FC<ComplianceCancelFormProps> = ({
  title,
  placeholder = 'Enter reason for cancellation',
  cancelling,
  onConfirm,
  onDismiss,
}) => {
  const [reason, setReason] = useState('')
  const [validationError, setValidationError] = useState('')
  const [actionError, setActionError] = useState('')

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setValidationError('Please enter a cancellation reason')
      return
    }
    setValidationError('')
    setActionError('')
    try {
      await onConfirm(reason.trim())
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Cancellation failed')
    }
  }

  return (
    <div className="compliance-cancel-form" role="group" aria-label={title}>
      <p className="compliance-cancel-title">{title}</p>
      {actionError && <p className="compliance-inline-error" role="alert">{actionError}</p>}
      <div className="input-group">
        <label className="input-label" htmlFor="cancel-reason-input">Cancellation reason</label>
        <input
          id="cancel-reason-input"
          className="input"
          type="text"
          placeholder={placeholder}
          value={reason}
          onChange={e => { setReason(e.target.value); setValidationError('') }}
          maxLength={200}
          aria-describedby={validationError ? 'cancel-reason-error' : undefined}
        />
        {validationError && (
          <span id="cancel-reason-error" className="input-error" role="alert">
            {validationError}
          </span>
        )}
      </div>
      <div className="compliance-cancel-actions">
        <button
          type="button"
          className="btn btn-ghost btn-md"
          onClick={onDismiss}
          disabled={cancelling}
        >
          Dismiss
        </button>
        <button
          type="button"
          className="btn btn-destructive btn-md"
          onClick={handleConfirm}
          disabled={cancelling}
          aria-busy={cancelling}
        >
          {cancelling ? 'Cancelling…' : 'Confirm Cancel'}
        </button>
      </div>
    </div>
  )
}
