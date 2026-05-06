/**
 * EInvoiceCancelDialog — NIC cancel reason (1-4) + remarks ≤100.
 * Confirm/Dismiss. Works on 320px.
 */

import React, { useState } from 'react'
import type { CancelReason } from './e-invoice.types'
import { CANCEL_REASON_LABELS } from './e-invoice.types'

interface Props {
  open: boolean
  loading: boolean
  onConfirm: (reason: CancelReason, remarks: string) => void
  onDismiss: () => void
}

const REASONS = ([1, 2, 3, 4] as CancelReason[])

export const EInvoiceCancelDialog: React.FC<Props> = ({ open, loading, onConfirm, onDismiss }) => {
  const [reason, setReason] = useState<CancelReason>(1)
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState('')

  if (!open) return null

  const handleConfirm = () => {
    if (remarks.length > 100) {
      setError('Remarks must be 100 characters or fewer')
      return
    }
    setError('')
    onConfirm(reason, remarks)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cancel E-Invoice"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface, #fff)',
          borderRadius: '12px',
          padding: '1.5rem',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>
          Cancel E-Invoice
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #666)', marginBottom: '1rem' }}>
          Once cancelled, a new IRN must be generated for this document.
        </p>

        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
          Reason
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(Number(e.target.value) as CancelReason)}
          disabled={loading}
          style={{
            width: '100%', padding: '0.5rem 0.75rem',
            borderRadius: '8px', border: '1px solid var(--color-border, #d1d5db)',
            fontSize: '0.9rem', marginBottom: '1rem',
            backgroundColor: 'var(--color-surface, #fff)',
          }}
        >
          {REASONS.map((r) => (
            <option key={r} value={r}>{CANCEL_REASON_LABELS[r]}</option>
          ))}
        </select>

        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
          Remarks <span style={{ fontWeight: 400, color: '#888' }}>(optional, max 100 chars)</span>
        </label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          maxLength={100}
          rows={3}
          disabled={loading}
          placeholder="Additional details..."
          style={{
            width: '100%', padding: '0.5rem 0.75rem',
            borderRadius: '8px', border: '1px solid var(--color-border, #d1d5db)',
            fontSize: '0.875rem', resize: 'none', fontFamily: 'inherit',
            backgroundColor: 'var(--color-surface, #fff)',
          }}
        />
        <div style={{ fontSize: '0.75rem', color: '#888', textAlign: 'right', marginBottom: '0.5rem' }}>
          {remarks.length}/100
        </div>

        {error && (
          <p role="alert" style={{ color: 'var(--color-error, #dc2626)', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onDismiss}
            disabled={loading}
            style={{
              flex: 1, padding: '0.625rem 1rem', borderRadius: '8px',
              border: '1px solid var(--color-border, #d1d5db)',
              background: 'transparent', cursor: 'pointer', fontSize: '0.9rem',
            }}
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            aria-busy={loading}
            style={{
              flex: 1, padding: '0.625rem 1rem', borderRadius: '8px',
              background: 'var(--color-danger, #dc2626)', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
            }}
          >
            {loading ? 'Cancelling...' : 'Confirm Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
