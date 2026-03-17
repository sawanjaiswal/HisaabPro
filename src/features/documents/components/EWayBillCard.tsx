/** EWayBillCard — EWB status display, generate/cancel/update-PartB triggers */

import React, { useState } from 'react'
import { formatDate } from '@/lib/format'
import type { EWayBillStatus, VehicleType, EWayBillGenerateInput } from '../ecompliance.types'
import { EWayBillGenerateForm } from './EWayBillGenerateForm'
import { EWayBillPartBForm } from './EWayBillPartBForm'
import { ComplianceCancelForm } from './ComplianceCancelForm'

interface EWayBillCardProps {
  status: EWayBillStatus | null
  generating: boolean
  cancelling: boolean
  updatingPartB: boolean
  onGenerate: (input: Omit<EWayBillGenerateInput, 'documentId'>) => Promise<void>
  onCancel: (reason: string) => Promise<void>
  onUpdatePartB: (vehicleNumber: string, vehicleType?: VehicleType) => Promise<void>
  error?: string | null
}

type ActiveForm = 'none' | 'generate' | 'cancel' | 'partb'

function isCancellableNow(ewbDate: string | null): boolean {
  if (!ewbDate) return false
  return Date.now() - new Date(ewbDate).getTime() < 24 * 60 * 60 * 1000
}

export const EWayBillCard: React.FC<EWayBillCardProps> = ({
  status, generating, cancelling, updatingPartB,
  onGenerate, onCancel, onUpdatePartB, error,
}) => {
  const [activeForm, setActiveForm] = useState<ActiveForm>('none')

  const isPending = !status || status.status === 'PENDING'
  const isGenerated = status?.status === 'GENERATED'
  const isCancelled = status?.status === 'CANCELLED'
  const canCancel = isGenerated && isCancellableNow(status?.ewbDate ?? null)

  return (
    <div className="compliance-card">
      <div className="compliance-card-header">
        <div className="compliance-card-title-group">
          <h2 className="compliance-card-title">E-Way Bill</h2>
          <p className="compliance-card-subtitle">Required for goods movement above Rs 50,000</p>
        </div>
        <span
          className={`compliance-badge ${isPending ? 'compliance-badge-pending' : isGenerated ? 'compliance-badge-generated' : 'compliance-badge-cancelled'}`}
          aria-label={`E-way bill status: ${status?.status ?? 'PENDING'}`}
        >
          <span className="compliance-badge-dot" aria-hidden="true" />
          {isPending ? 'Pending' : isGenerated ? 'Generated' : 'Cancelled'}
        </span>
      </div>

      {error && <p className="compliance-inline-error" role="alert">{error}</p>}

      {isGenerated && status && (
        <div className="compliance-details" aria-label="E-way bill details">
          <div className="compliance-detail-row">
            <span className="compliance-detail-label">EWB No.</span>
            <span className="compliance-detail-value">{status.ewbNumber}</span>
          </div>
          {status.ewbDate && (
            <div className="compliance-detail-row">
              <span className="compliance-detail-label">Generated</span>
              <span className="compliance-detail-value">{formatDate(status.ewbDate)}</span>
            </div>
          )}
          {status.validUntil && (
            <div className="compliance-detail-row">
              <span className="compliance-detail-label">Valid Until</span>
              <span className="compliance-detail-value">{formatDate(status.validUntil)}</span>
            </div>
          )}
          {status.vehicleNumber && (
            <div className="compliance-detail-row">
              <span className="compliance-detail-label">Vehicle</span>
              <span className="compliance-detail-value">{status.vehicleNumber}</span>
            </div>
          )}
          {status.transportMode && (
            <div className="compliance-detail-row">
              <span className="compliance-detail-label">Mode</span>
              <span className="compliance-detail-value">{status.transportMode}</span>
            </div>
          )}
        </div>
      )}

      {isCancelled && (
        <div className="compliance-cancelled-notice" role="status">
          <span>Cancelled on {status?.cancelledAt ? formatDate(status.cancelledAt) : '—'}</span>
          {status?.cancelReason && (
            <span className="compliance-cancelled-reason">Reason: {status.cancelReason}</span>
          )}
        </div>
      )}

      {activeForm === 'generate' && (
        <EWayBillGenerateForm
          generating={generating}
          onSubmit={async input => { await onGenerate(input); setActiveForm('none') }}
          onDismiss={() => setActiveForm('none')}
        />
      )}

      {activeForm === 'partb' && (
        <EWayBillPartBForm
          initialVehicleNumber={status?.vehicleNumber}
          updatingPartB={updatingPartB}
          onSubmit={async (v, vt) => { await onUpdatePartB(v, vt); setActiveForm('none') }}
          onDismiss={() => setActiveForm('none')}
        />
      )}

      {activeForm === 'cancel' && (
        <ComplianceCancelForm
          title="Cancel E-Way Bill"
          placeholder="e.g. Wrong vehicle number, cancelled order"
          cancelling={cancelling}
          onConfirm={async reason => { await onCancel(reason); setActiveForm('none') }}
          onDismiss={() => setActiveForm('none')}
        />
      )}

      {activeForm === 'none' && (
        <div className="compliance-actions">
          {isPending && (
            <button type="button" className="btn btn-primary btn-md"
              onClick={() => setActiveForm('generate')} aria-label="Generate e-way bill">
              Generate EWB
            </button>
          )}
          {isGenerated && (
            <button type="button" className="btn btn-secondary btn-md"
              onClick={() => setActiveForm('partb')} aria-label="Update vehicle details for e-way bill">
              Update Vehicle
            </button>
          )}
          {canCancel && (
            <button type="button" className="btn btn-ghost btn-md"
              onClick={() => setActiveForm('cancel')} aria-label="Cancel this e-way bill">
              Cancel EWB
            </button>
          )}
        </div>
      )}
    </div>
  )
}
