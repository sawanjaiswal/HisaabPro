/** EInvoiceCard — IRN status, generate button, cancel (within 24h), QR display */

import React, { useState } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
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
  const { t } = useLanguage()
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
      setActionError(err instanceof Error ? err.message : t.failedGenerateEInvoice)
    }
  }

  return (
    <div className="compliance-card">
      <div className="compliance-card-header">
        <div className="compliance-card-title-group">
          <h2 className="compliance-card-title">{t.eInvoiceIrn}</h2>
          <p className="compliance-card-subtitle">{t.eInvoiceSubtitle}</p>
        </div>
        <span
          className={`compliance-badge ${isPending ? 'compliance-badge-pending' : isGenerated ? 'compliance-badge-generated' : 'compliance-badge-cancelled'}`}
          aria-label={`${t.eInvoiceStatusLabel} ${status?.status ?? 'PENDING'}`}
        >
          <span className="compliance-badge-dot" aria-hidden="true" />
          {isPending ? t.statusPending : isGenerated ? t.statusGenerated : t.statusCancelled}
        </span>
      </div>

      {(error || actionError) && (
        <p className="compliance-inline-error" role="alert">{error ?? actionError}</p>
      )}

      {isGenerated && status && (
        <div className="compliance-details" aria-label={t.eInvoiceDetails}>
          <div className="compliance-detail-row">
            <span className="compliance-detail-label">{t.irn}</span>
            <span className="compliance-detail-value">{status.irn}</span>
          </div>
          <div className="compliance-detail-row">
            <span className="compliance-detail-label">{t.ackNo}</span>
            <span className="compliance-detail-value">{status.ackNumber}</span>
          </div>
          {status.ackDate && (
            <div className="compliance-detail-row">
              <span className="compliance-detail-label">{t.ackDate}</span>
              <span className="compliance-detail-value">{formatDate(status.ackDate)}</span>
            </div>
          )}
        </div>
      )}

      {isGenerated && status?.qrCode && (
        <div className="compliance-qr-wrap">
          <img src={status.qrCode} alt={t.eInvoiceQrAlt} width={120} height={120} loading="lazy" />
        </div>
      )}

      {isCancelled && (
        <div className="compliance-cancelled-notice" role="status">
          <span>{t.cancelledOn} {status?.cancelledAt ? formatDate(status.cancelledAt) : '—'}</span>
          {status?.cancelReason && (
            <span className="compliance-cancelled-reason">{t.reasonLabel} {status.cancelReason}</span>
          )}
        </div>
      )}

      {showCancel && (
        <ComplianceCancelForm
          title={t.cancelEInvoice}
          placeholder={t.wrongGstinExample}
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
              {generating ? t.generatingIrn : t.generateIrn}
            </button>
          )}
          {canCancel && (
            <button type="button" className="btn btn-secondary btn-md"
              onClick={() => setShowCancel(true)} aria-label={t.cancelEInvoiceAria}>
              {t.cancelIrn}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
