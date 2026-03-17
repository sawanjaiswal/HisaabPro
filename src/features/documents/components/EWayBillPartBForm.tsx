/** EWayBillPartBForm — update vehicle number and type for an active EWB */

import React, { useState } from 'react'
import type { VehicleType } from '../ecompliance.types'

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'REGULAR', label: 'Regular' },
  { value: 'ODC', label: 'ODC (Over Dimensional)' },
]

interface EWayBillPartBFormProps {
  initialVehicleNumber?: string
  updatingPartB: boolean
  onSubmit: (vehicleNumber: string, vehicleType?: VehicleType) => Promise<void>
  onDismiss: () => void
}

export const EWayBillPartBForm: React.FC<EWayBillPartBFormProps> = ({
  initialVehicleNumber = '',
  updatingPartB,
  onSubmit,
  onDismiss,
}) => {
  const [vehicleNumber, setVehicleNumber] = useState(initialVehicleNumber)
  const [vehicleType, setVehicleType] = useState<VehicleType>('REGULAR')
  const [actionError, setActionError] = useState('')

  const handleSubmit = async () => {
    if (!vehicleNumber.trim()) return
    setActionError('')
    try {
      await onSubmit(vehicleNumber.trim().toUpperCase(), vehicleType)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update vehicle details')
    }
  }

  return (
    <div className="partb-form" role="group" aria-label="Update vehicle details">
      <p className="partb-form-title">Update Vehicle (Part-B)</p>
      {actionError && <p className="compliance-inline-error" role="alert">{actionError}</p>}
      <div className="ewb-form-row">
        <div className="input-group">
          <label className="input-label" htmlFor="partb-vehicle">Vehicle Number</label>
          <input
            id="partb-vehicle"
            className="input"
            type="text"
            placeholder="MH12AB1234"
            value={vehicleNumber}
            maxLength={12}
            onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
          />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="partb-vtype">Vehicle Type</label>
          <select
            id="partb-vtype"
            className="ewb-form-select"
            value={vehicleType}
            onChange={e => setVehicleType(e.target.value as VehicleType)}
          >
            {VEHICLE_TYPES.map(v => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="compliance-cancel-actions">
        <button
          type="button"
          className="btn btn-ghost btn-md"
          onClick={onDismiss}
          disabled={updatingPartB}
        >
          Dismiss
        </button>
        <button
          type="button"
          className="btn btn-primary btn-md"
          onClick={handleSubmit}
          disabled={updatingPartB || !vehicleNumber.trim()}
          aria-busy={updatingPartB}
        >
          {updatingPartB ? 'Updating…' : 'Update'}
        </button>
      </div>
    </div>
  )
}
