/**
 * EWayBillUpdatePartBDialog — vehicle update form + history list.
 *
 * A11y: Focus trap + Escape handler + label association.
 */

import React, { useState, useRef } from 'react'
import { useUpdatePartB } from './useEWayBill'
import type { PartBEntry } from './e-way-bill.types'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface Props {
  open: boolean
  documentId: string
  partBHistory: PartBEntry[]
  onDismiss: () => void
}

function formatTs(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

export const EWayBillUpdatePartBDialog: React.FC<Props> = ({ open, documentId, partBHistory, onDismiss }) => {
  const update = useUpdatePartB(documentId)
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [vehicleType, setVehicleType] = useState<'REGULAR' | 'ODC'>('REGULAR')
  const dialogRef = useRef<HTMLDivElement>(null)

  useFocusTrap(dialogRef, { active: open, onEscape: onDismiss, disabled: update.isPending })

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!vehicleNumber.trim()) return
    update.mutate(
      { vehicleNumber: vehicleNumber.trim(), vehicleType },
      {
        onSuccess: () => {
          setVehicleNumber('')
          onDismiss()
        },
      }
    )
  }

  function handleDismiss() {
    onDismiss()
  }

  const titleId = 'ewb-partb-title'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !update.isPending) handleDismiss()
      }}
    >
      <div
        ref={dialogRef}
        style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, padding: '1.5rem', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <h2 id={titleId} style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: '1rem' }}>Update Part B — Vehicle</h2>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label htmlFor="ewb-vehicle-number" style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                New Vehicle Number <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                id="ewb-vehicle-number"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="input"
                placeholder="MH12AB5678"
                maxLength={20}
                required
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label htmlFor="ewb-partb-vehicle-type" style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                Vehicle Type
              </label>
              <select
                id="ewb-partb-vehicle-type"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as 'REGULAR' | 'ODC')}
                className="input"
                style={{ width: '100%' }}
              >
                <option value="REGULAR">Regular</option>
                <option value="ODC">ODC (Over-Dimensional Cargo)</option>
              </select>
            </div>
          </div>

          {update.error && (
            <p role="alert" style={{ color: '#dc2626', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
              {(update.error as Error).message}
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary btn-md" onClick={handleDismiss} disabled={update.isPending} style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-md" disabled={update.isPending} style={{ flex: 1 }}>
              {update.isPending ? 'Updating...' : 'Update'}
            </button>
          </div>
        </form>

        {partBHistory.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem', color: '#555' }}>
              Vehicle History ({partBHistory.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {partBHistory.map((entry, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '8px', fontSize: '0.8125rem' }}>
                  <span style={{ fontWeight: 500 }}>{entry.vehicleNumber}</span>
                  <span style={{ color: '#888' }}>{formatTs(entry.updatedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
