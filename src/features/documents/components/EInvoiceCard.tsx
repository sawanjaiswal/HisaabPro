/** EInvoiceCard — IRN status, generate button, cancel (within 24h), QR display */

import React, { useState } from 'react'
import { formatDate } from '@/lib/format'
import type { EInvoiceStatus } from '../ecompliance.types'
import { ComplianceCancelForm } from './ComplianceCancelForm'

interface EInvoiceCardProps {
  status: EInvoiceStatus | null
  generating: boolean
  cancelling: boolean
  onGenerate: () => Promise<void>
  onCancel: (reason: string) => Promise<void>
  error?: string | null
}

function isCancellableNow(ackDate: string | null): boolean {
  if (!ackDate) return false
  return Date.now() - new Date(ackDate).getTime() < 24 * 60 * 60 * 1000
}

export const EInvoiceCard: React.FC<EInvoiceCardProps> = ({
  status, generating, cancelling, onGenerate, onCancel, error,
}) => {
  const [showCancel, setShowCancel] = useState(false)
  const [actionError, setActionError] = useState('')

  const isPending = !status || status.status === 'PENDING'
  const isGenerated = status?.status === 'GENERATED'
  const isCancelled = status?.status === 'CANCELLED'
  const canCancel = isGenerated && isCancellableNow(status?.ackDate ?? null)

  const handleGenerate = async () => {
    setActionError('')
    try {
      await onGenerate()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to generate e-invoice')
    }
  }

  return (
    <div className="compliance-card">
      <div className="compliance-card-header">
        <div className="compliance-card-title-group">
          <h2 className="compliance-card-title">E-Invoice (IRN)</h2>
          <p className="compliance-card-subtitle">Required for B2B invoices above Rs 5 crore</p>
        </div>
        <span
          className={`compliance-badge ${isPending ? 'compliance-badge-pending' : isGenerated ? 'compliance-badge-generated' : 'compliance-badge-cancelled'}`}
          aria-label={`E-invoice status: ${status?.status ?? 'PENDING'}`}
        >
          <span className="compliance-badge-dot" aria-hidden="true" />
          {isPending ? 'Pending' : isGenerated ? 'Generated' : 'Cancelled'}
        </span>
      </div>

      {(error || actionError) && (
        <p className="compliance-inline-error" role="alert">{error ?? actionError}</p>
      )}

      {isGenerated && status && (
        <div className="compliance-details" aria-label="E-invoice details">
          <div className="compliance-detail-row">
            <span className="compliance-detail-label">IRN</span>
            <span className="compliance-detail-value">{status.irn}</span>
          </div>
          <div className="compliance-detail-row">
            <span className="compliance-detail-label">Ack No.</span>
            <span className="compliance-detail-value">{status.ackNumber}</span>
          </div>
          {status.ackDate && (
            <div className="compliance-detail-row">
              <span className="compliance-detail-label">Ack Date</span>
              <span className="compliance-detail-value">{formatDate(status.ackDate)}</span>
            </div>
          )}
        </div>
      )}

      {isGenerated && status?.qrCode && (
        <div className="compliance-qr-wrap">
          <img src={status.qrCode} alt="E-invoice QR code" width={120} height={120} loading="lazy" />
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

      {showCancel && (
        <ComplianceCancelForm
          title="Cancel E-Invoice"
          placeholder="e.g. Wrong GSTIN, duplicate invoice"
          cancelling={cancelling}
          onConfirm={async reason => { await onCancel(reason); setShowCancel(false) }}
          onDismiss={() => setShowCancel(false)}
        />
      )}

      {!showCancel && (
        <div className="compliance-actions">
          {isPending && (
            <button type="button" className="btn btn-primary btn-md"
              onClick={handleGenerate} disabled={generating} aria-busy={generating}>
              {generating ? 'Generating…' : 'Generate IRN'}
            </button>
          )}
          {canCancel && (
            <button type="button" className="btn btn-secondary btn-md"
              onClick={() => setShowCancel(true)} aria-label="Cancel this e-invoice">
              Cancel IRN
            </button>
          )}
        </div>
      )}
    </div>
  )
}
