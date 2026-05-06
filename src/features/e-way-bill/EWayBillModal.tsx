/**
 * EWayBillModal — auto-prompted after invoice save.
 * Form: transporter details + distance + transport mode + vehicle.
 * Skip / Generate buttons.
 */

import React, { useState } from 'react'
import { useGenerateEWayBill } from './useEWayBill'

interface Props {
  documentId: string
  open: boolean
  onDismiss: () => void
  onSuccess?: () => void
}

export const EWayBillModal: React.FC<Props> = ({ documentId, open, onDismiss, onSuccess }) => {
  const generate = useGenerateEWayBill(documentId)
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

  return (
    <div role="dialog" aria-modal="true" aria-label="Generate E-Way Bill" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: '1rem' }}>Generate E-Way Bill</h2>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

            <label style={{ fontSize: '0.875rem' }}>
              Transport Mode <span style={{ color: '#dc2626' }}>*</span>
              <select value={form.transportMode} onChange={(e) => set('transportMode', e.target.value as typeof form.transportMode)}
                className="input" style={{ marginTop: '0.25rem', width: '100%' }}>
                <option value="ROAD">Road</option>
                <option value="RAIL">Rail</option>
                <option value="AIR">Air</option>
                <option value="SHIP">Ship</option>
              </select>
            </label>

            <label style={{ fontSize: '0.875rem' }}>
              Transporter Name
              <input value={form.transporterName} onChange={(e) => set('transporterName', e.target.value)}
                className="input" placeholder="Transporter name" style={{ marginTop: '0.25rem', width: '100%' }} />
            </label>

            <label style={{ fontSize: '0.875rem' }}>
              Transporter GSTIN
              <input value={form.transporterGstin} onChange={(e) => set('transporterGstin', e.target.value)}
                className="input" placeholder="15-digit GSTIN (optional)" maxLength={15} style={{ marginTop: '0.25rem', width: '100%' }} />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.875rem' }}>
                Vehicle No
                <input value={form.vehicleNumber} onChange={(e) => set('vehicleNumber', e.target.value)}
                  className="input" placeholder="MH12AB1234" style={{ marginTop: '0.25rem', width: '100%' }} />
              </label>
              <label style={{ fontSize: '0.875rem' }}>
                Vehicle Type
                <select value={form.vehicleType} onChange={(e) => set('vehicleType', e.target.value as typeof form.vehicleType)}
                  className="input" style={{ marginTop: '0.25rem', width: '100%' }}>
                  <option value="REGULAR">Regular</option>
                  <option value="ODC">ODC</option>
                </select>
              </label>
            </div>

            <label style={{ fontSize: '0.875rem' }}>
              Distance (km) <span style={{ color: '#dc2626' }}>*</span>
              <input type="number" value={form.distance} onChange={(e) => set('distance', e.target.value)}
                className="input" placeholder="300" min={1} required style={{ marginTop: '0.25rem', width: '100%' }} />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.875rem' }}>
                From Pincode <span style={{ color: '#dc2626' }}>*</span>
                <input value={form.fromPincode} onChange={(e) => set('fromPincode', e.target.value)}
                  className="input" placeholder="400001" maxLength={6} pattern="\d{6}" required style={{ marginTop: '0.25rem', width: '100%' }} />
              </label>
              <label style={{ fontSize: '0.875rem' }}>
                To Pincode <span style={{ color: '#dc2626' }}>*</span>
                <input value={form.toPincode} onChange={(e) => set('toPincode', e.target.value)}
                  className="input" placeholder="560001" maxLength={6} pattern="\d{6}" required style={{ marginTop: '0.25rem', width: '100%' }} />
              </label>
            </div>

          </div>

          {generate.error && (
            <p role="alert" style={{ color: '#dc2626', fontSize: '0.8125rem', marginTop: '0.75rem' }}>
              {(generate.error as Error).message}
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary btn-md" onClick={onDismiss} style={{ flex: 1 }}>
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
