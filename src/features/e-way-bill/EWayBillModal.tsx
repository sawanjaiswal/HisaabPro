/**
 * EWayBillModal — auto-prompted after invoice save.
 * Form: transporter details + distance + transport mode + vehicle.
 * A11y: Focus trap + Escape handler + label association.
 */

import React, { useState, useRef } from 'react'
import { useGenerateEWayBill } from './useEWayBill'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface Props {
  documentId: string
  open: boolean
  onDismiss: () => void
  onSuccess?: () => void
}

const fieldStyle = { display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }
const requiredSpan = <span style={{ color: '#dc2626' }}>*</span>

export const EWayBillModal: React.FC<Props> = ({ documentId, open, onDismiss, onSuccess }) => {
  const generate = useGenerateEWayBill(documentId)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState({
    transportMode: 'ROAD' as 'ROAD' | 'RAIL' | 'AIR' | 'SHIP',
    transporterName: '',
    transporterGstin: '',
    transporterPhone: '',
    vehicleNumber: '',
    vehicleType: 'REGULAR' as 'REGULAR' | 'ODC',
    distance: '',
    fromPincode: '',
    toPincode: '',
  })

  useFocusTrap(dialogRef, { active: open, onEscape: onDismiss, disabled: generate.isPending })

  if (!open) return null

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    generate.mutate(
      {
        transportMode: form.transportMode,
        transporterName: form.transporterName || undefined,
        transporterId: form.transporterGstin || undefined,
        vehicleNumber: form.vehicleNumber || undefined,
        vehicleType: form.vehicleType,
        distance: Number(form.distance),
        fromPincode: form.fromPincode,
        toPincode: form.toPincode,
      },
      {
        onSuccess: () => {
          onSuccess?.()
          onDismiss()
        },
      }
    )
  }

  function handleDismiss() {
    onDismiss()
  }

  const titleId = 'ewaybill-modal-title'

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
        if (e.target === e.currentTarget && !generate.isPending) handleDismiss()
      }}
    >
      <div
        ref={dialogRef}
        style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <h2 id={titleId} style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: '1rem' }}>Generate E-Way Bill</h2>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

            <div>
              <label htmlFor="ewb-transport-mode" style={fieldStyle}>
                Transport Mode {requiredSpan}
              </label>
              <select
                id="ewb-transport-mode"
                value={form.transportMode}
                onChange={(e) => set('transportMode', e.target.value as typeof form.transportMode)}
                className="input"
                style={{ width: '100%' }}
              >
                <option value="ROAD">Road</option>
                <option value="RAIL">Rail</option>
                <option value="AIR">Air</option>
                <option value="SHIP">Ship</option>
              </select>
            </div>

            <div>
              <label htmlFor="ewb-transporter-name" style={fieldStyle}>Transporter Name</label>
              <input
                id="ewb-transporter-name"
                value={form.transporterName}
                onChange={(e) => set('transporterName', e.target.value)}
                className="input"
                placeholder="Transporter name"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label htmlFor="ewb-transporter-gstin" style={fieldStyle}>Transporter GSTIN</label>
              <input
                id="ewb-transporter-gstin"
                value={form.transporterGstin}
                onChange={(e) => set('transporterGstin', e.target.value)}
                className="input"
                placeholder="15-digit GSTIN (optional)"
                maxLength={15}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label htmlFor="ewb-vehicle-no" style={fieldStyle}>Vehicle No</label>
                <input
                  id="ewb-vehicle-no"
                  value={form.vehicleNumber}
                  onChange={(e) => set('vehicleNumber', e.target.value)}
                  className="input"
                  placeholder="MH12AB1234"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label htmlFor="ewb-vehicle-type" style={fieldStyle}>Vehicle Type</label>
                <select
                  id="ewb-vehicle-type"
                  value={form.vehicleType}
                  onChange={(e) => set('vehicleType', e.target.value as typeof form.vehicleType)}
                  className="input"
                  style={{ width: '100%' }}
                >
                  <option value="REGULAR">Regular</option>
                  <option value="ODC">ODC</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="ewb-distance" style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                Distance (km) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                id="ewb-distance"
                type="number"
                value={form.distance}
                onChange={(e) => set('distance', e.target.value)}
                className="input"
                placeholder="300"
                min={1}
                required
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label htmlFor="ewb-from-pincode" style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  From Pincode <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="ewb-from-pincode"
                  value={form.fromPincode}
                  onChange={(e) => set('fromPincode', e.target.value)}
                  className="input"
                  placeholder="400001"
                  maxLength={6}
                  pattern="\d{6}"
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label htmlFor="ewb-to-pincode" style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  To Pincode <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="ewb-to-pincode"
                  value={form.toPincode}
                  onChange={(e) => set('toPincode', e.target.value)}
                  className="input"
                  placeholder="560001"
                  maxLength={6}
                  pattern="\d{6}"
                  required
                  style={{ width: '100%' }}
                />
              </div>
            </div>

          </div>

          {generate.error && (
            <p role="alert" style={{ color: '#dc2626', fontSize: '0.8125rem', marginTop: '0.75rem' }}>
              {(generate.error as Error).message}
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary btn-md" onClick={handleDismiss} disabled={generate.isPending} style={{ flex: 1 }}>
              Skip
            </button>
            <button type="submit" className="btn btn-primary btn-md" disabled={generate.isPending} aria-busy={generate.isPending} style={{ flex: 1 }}>
              {generate.isPending ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
