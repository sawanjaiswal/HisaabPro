/**
 * EInvoiceCancelDialog — NIC cancel reason (1-4) + remarks ≤100.
 * Confirm/Dismiss. Works on 320px.
 *
 * A11y: Native <dialog> + focus trap + keyboard handlers.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { CancelReason } from './e-invoice.types'
import { CANCEL_REASON_LABELS } from './e-invoice.types'
import { Select, SelectItem } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

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
  const dialogRef = useRef<HTMLDialogElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const getFocusable = useCallback((): HTMLElement[] => {
    if (!dialogRef.current) return []
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      )
    )
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onDismiss()
        return
      }

      if (e.key !== 'Tab') return

      const focusable = getFocusable()
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [loading, onDismiss, getFocusable]
  )

  useEffect(() => {
    if (!open) return

    previousFocusRef.current = document.activeElement as HTMLElement
    dialogRef.current?.showModal()

    const id = setTimeout(() => {
      confirmRef.current?.focus()
    }, 50)

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(id)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  useEffect(() => {
    if (!open && dialogRef.current?.open) {
      dialogRef.current.close()
      previousFocusRef.current?.focus()
    }
  }, [open])

  const handleConfirm = () => {
    if (remarks.length > 100) {
      setError('Remarks must be 100 characters or fewer')
      return
    }
    setError('')
    onConfirm(reason, remarks)
  }

  const titleId = 'einvoice-cancel-title'
  const descId = 'einvoice-cancel-desc'
  const reasonId = 'einvoice-cancel-reason'
  const remarksId = 'einvoice-cancel-remarks'
  const errorId = 'einvoice-cancel-error'

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      style={{
        position: 'fixed',
        inset: 0,
        padding: 0,
        border: 'none',
        borderRadius: '12px',
        maxWidth: '420px',
        width: 'calc(100% - 2rem)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        zIndex: 50,
      }}
    >
      <div style={{ padding: '1.5rem' }}>
        <h2 id={titleId} style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>
          Cancel E-Invoice
        </h2>
        <p id={descId} style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #666)', marginBottom: '1rem' }}>
          Once cancelled, a new IRN must be generated for this document.
        </p>

        <label htmlFor={reasonId} style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
          Reason
        </label>
        <div style={{ marginBottom: '1rem' }}>
          <Select
            value={String(reason)}
            onValueChange={(v) => setReason(Number(v) as CancelReason)}
            disabled={loading}
            ariaLabel="Reason"
          >
            {REASONS.map((r) => (
              <SelectItem key={r} value={String(r)}>{CANCEL_REASON_LABELS[r]}</SelectItem>
            ))}
          </Select>
        </div>

        <label htmlFor={remarksId} style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
          Remarks <span style={{ fontWeight: 400, color: '#888' }}>(optional, max 100 chars)</span>
        </label>
        <Textarea
          id={remarksId}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          maxLength={100}
          rows={3}
          disabled={loading}
          placeholder="Additional details..."
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid var(--color-border, #d1d5db)',
            fontSize: '0.875rem',
            resize: 'none',
            fontFamily: 'inherit',
            backgroundColor: 'var(--color-surface, #fff)',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ fontSize: '0.75rem', color: '#888', textAlign: 'right', marginBottom: '0.5rem' }}>
          {remarks.length}/100
        </div>

        {error && (
          <p id={errorId} role="alert" style={{ color: 'var(--color-error, #dc2626)', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onDismiss}
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.625rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #d1d5db)',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Dismiss
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            aria-busy={loading}
            style={{
              flex: 1,
              padding: '0.625rem 1rem',
              borderRadius: '8px',
              background: 'var(--color-danger, #dc2626)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            {loading ? 'Cancelling...' : 'Confirm Cancel'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
