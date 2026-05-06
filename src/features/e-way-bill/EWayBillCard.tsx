/**
 * EWayBillCard — states: not-generated, threshold-not-met, loading, error, success, cancelled.
 * Wires useEWayBill hooks. 320px safe.
 */

import React, { useState } from 'react'
import { useEWayBill, useGenerateEWayBill, useCancelEWayBill } from './useEWayBill'
import { EWayBillUpdatePartBDialog } from './EWayBillUpdatePartBDialog'
import { TRANSPORT_MODE_LABELS } from './e-way-bill.types'

interface Props {
  documentId: string
  grandTotal?: number        // paise
  onGenerateClick?: () => void // open EWayBillModal
}

const THRESHOLD = 5_000_000 // Rs 50,000 paise

function formatTs(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function canCancelNow(ewbDate: string): boolean {
  return Date.now() - new Date(ewbDate).getTime() < 24 * 60 * 60 * 1000
}

export const EWayBillCard: React.FC<Props> = ({ documentId, grandTotal = 0, onGenerateClick }) => {
  const { data, isLoading, error } = useEWayBill(documentId)
  const cancel = useCancelEWayBill(documentId)
  const generate = useGenerateEWayBill(documentId)
  const [partBOpen, setPartBOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="card" aria-busy="true" aria-label="Loading e-way bill">
        <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '0.9rem' }}>
          Loading E-Way Bill...
        </div>
      </div>
    )
  }

  const apiError = error as { message?: string } | null
  const is404 = apiError?.message?.includes('not found') || apiError?.message?.includes('404')

  if (apiError && !is404) {
    return (
      <div className="card" role="alert">
        <p style={{ color: 'var(--color-error, #dc2626)', fontSize: '0.875rem' }}>
          {apiError.message || 'Failed to load E-Way Bill'}
        </p>
      </div>
    )
  }

  // ── Threshold not met ───────────────────────────────────────────────────────

  if (!data || is404) {
    const belowThreshold = grandTotal < THRESHOLD

    return (
      <div className="card">
        <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>E-Way Bill</h3>

        {belowThreshold ? (
          <p style={{ fontSize: '0.8125rem', color: '#888' }}>
            E-Way Bill not required — invoice below Rs 50,000
            (current: Rs {(grandTotal / 100).toLocaleString('en-IN')}).
          </p>
        ) : (
          <>
            <p style={{ fontSize: '0.8125rem', color: '#666', marginBottom: '1rem' }}>
              Required for inter-state supply ≥ Rs 50,000. Threshold: Rs {(THRESHOLD / 100).toLocaleString('en-IN')}.
            </p>
            {generate.error && (
              <p role="alert" style={{ color: 'var(--color-error, #dc2626)', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
                {(generate.error as Error).message}
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary btn-md"
              onClick={onGenerateClick}
              disabled={generate.isPending}
            >
              Generate E-Way Bill
            </button>
          </>
        )}
      </div>
    )
  }

  // ── Cancelled ───────────────────────────────────────────────────────────────

  if (data.status === 'CANCELLED') {
    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>E-Way Bill</h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', background: '#fef2f2', borderRadius: '999px', padding: '2px 10px' }}>
            CANCELLED
          </span>
        </div>
        <p style={{ fontSize: '0.8125rem', color: '#666', marginTop: '0.5rem' }}>
          EWB No: {data.ewbNumber} · Cancelled {data.cancelledAt ? formatTs(data.cancelledAt) : '—'}
        </p>
      </div>
    )
  }

  // ── Active ──────────────────────────────────────────────────────────────────

  const cancellable = canCancelNow(data.ewbDate)

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>E-Way Bill</h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16a34a', background: '#f0fdf4', borderRadius: '999px', padding: '2px 10px' }}>
            ACTIVE
          </span>
        </div>

        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.375rem 1rem', fontSize: '0.8125rem' }}>
          <dt style={{ color: '#888', fontWeight: 500 }}>EWB No</dt>
          <dd style={{ fontFamily: 'monospace' }}>{data.ewbNumber}</dd>

          <dt style={{ color: '#888', fontWeight: 500 }}>Valid Upto</dt>
          <dd>{formatTs(data.validUpto)}</dd>

          <dt style={{ color: '#888', fontWeight: 500 }}>Mode</dt>
          <dd>{TRANSPORT_MODE_LABELS[data.transportMode] ?? data.transportMode}</dd>

          {data.vehicleNumber && (
            <>
              <dt style={{ color: '#888', fontWeight: 500 }}>Vehicle</dt>
              <dd>{data.vehicleNumber}</dd>
            </>
          )}
        </dl>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-md"
            onClick={() => setPartBOpen(true)}
            style={{ flex: 1 }}
          >
            Update Part B
          </button>
          {cancellable && (
            <button
              type="button"
              className="btn btn-danger btn-md"
              onClick={() => {
                const r = window.prompt('Cancel reason:')
                if (r) cancel.mutate(r)
              }}
              disabled={cancel.isPending}
              style={{ flex: 1 }}
            >
              {cancel.isPending ? 'Cancelling...' : 'Cancel'}
            </button>
          )}
        </div>
      </div>

      <EWayBillUpdatePartBDialog
        open={partBOpen}
        documentId={documentId}
        partBHistory={data.partBUpdates}
        onDismiss={() => setPartBOpen(false)}
      />
    </>
  )
}
