/**
 * EInvoiceCard — 5 states: not-generated, loading, error, success (IRN+QR+cancel), cancel-window expired.
 * Wires useEInvoice hooks. Dark-mode and 320px safe.
 */

import React, { useState } from 'react'
import { useEInvoice, useGenerateIrn, useCancelIrn } from './useEInvoice'
import { EInvoiceCancelDialog } from './EInvoiceCancelDialog'
import type { CancelReason } from './e-invoice.types'

interface Props {
  documentId: string
}

function formatTs(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function canCancelNow(ackDate: string): boolean {
  return Date.now() - new Date(ackDate).getTime() < 24 * 60 * 60 * 1000
}

export const EInvoiceCard: React.FC<Props> = ({ documentId }) => {
  const { data, isLoading, error } = useEInvoice(documentId)
  const generate = useGenerateIrn(documentId)
  const cancel = useCancelIrn(documentId)
  const [cancelOpen, setCancelOpen] = useState(false)

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="card" aria-busy="true" aria-label="Loading e-invoice">
        <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '0.9rem' }}>
          Loading e-invoice...
        </div>
      </div>
    )
  }

  // ── Error (not 404) ─────────────────────────────────────────────────────────

  const apiError = error as { message?: string } | null
  const is404 = apiError?.message?.includes('not found') || apiError?.message?.includes('404')

  if (apiError && !is404) {
    return (
      <div className="card" role="alert">
        <p style={{ color: 'var(--color-error, #dc2626)', fontSize: '0.875rem' }}>
          {apiError.message || 'Failed to load e-invoice'}
        </p>
      </div>
    )
  }

  // ── Not generated ───────────────────────────────────────────────────────────

  if (!data || is404) {
    return (
      <div className="card">
        <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>E-Invoice (IRN)</h3>
        <p style={{ fontSize: '0.8125rem', color: '#666', marginBottom: '1rem' }}>
          Generate IRN via NIC IRP portal for B2B compliance.
        </p>
        {generate.error && (
          <p role="alert" style={{ color: 'var(--color-error, #dc2626)', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
            {(generate.error as Error).message}
          </p>
        )}
        <button
          type="button"
          className="btn btn-primary btn-md"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          aria-busy={generate.isPending}
        >
          {generate.isPending ? 'Generating...' : 'Generate IRN'}
        </button>
      </div>
    )
  }

  // ── Cancelled ───────────────────────────────────────────────────────────────

  if (data.status === 'CANCELLED') {
    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>E-Invoice (IRN)</h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', background: '#fef2f2', borderRadius: '999px', padding: '2px 10px' }}>
            CANCELLED
          </span>
        </div>
        <p style={{ fontSize: '0.8125rem', color: '#666', marginTop: '0.5rem' }}>
          Cancelled on {data.cancelledAt ? formatTs(data.cancelledAt) : '—'}
          {data.cancelReason ? ` · Reason: ${data.cancelReason}` : ''}
        </p>
        <button
          type="button"
          className="btn btn-primary btn-md"
          style={{ marginTop: '1rem' }}
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          aria-busy={generate.isPending}
        >
          {generate.isPending ? 'Generating...' : 'Generate New IRN'}
        </button>
      </div>
    )
  }

  // ── Generated ───────────────────────────────────────────────────────────────

  const cancellable = canCancelNow(data.ackDate)

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>E-Invoice (IRN)</h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16a34a', background: '#f0fdf4', borderRadius: '999px', padding: '2px 10px' }}>
            GENERATED
          </span>
        </div>

        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.375rem 1rem', fontSize: '0.8125rem' }}>
          <dt style={{ color: '#888', fontWeight: 500 }}>IRN</dt>
          <dd style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.75rem' }}>{data.irn}</dd>

          <dt style={{ color: '#888', fontWeight: 500 }}>Ack No</dt>
          <dd>{data.ackNumber}</dd>

          <dt style={{ color: '#888', fontWeight: 500 }}>Ack Date</dt>
          <dd>{formatTs(data.ackDate)}</dd>
        </dl>

        {data.qrCodeData && (
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
            <img
              src={`data:image/png;base64,${data.qrCodeData}`}
              alt="E-Invoice QR code"
              width={120}
              height={120}
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        )}

        {cancellable ? (
          <button
            type="button"
            className="btn btn-secondary btn-md"
            style={{ marginTop: '1rem', width: '100%' }}
            onClick={() => setCancelOpen(true)}
            aria-label="Cancel this e-invoice"
          >
            Cancel IRN
          </button>
        ) : (
          <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#888', textAlign: 'center' }}>
            24-hour cancel window has expired
          </p>
        )}
      </div>

      <EInvoiceCancelDialog
        open={cancelOpen}
        loading={cancel.isPending}
        onConfirm={(reason: CancelReason, remarks: string) => {
          cancel.mutate({ reason, remarks }, { onSuccess: () => setCancelOpen(false) })
        }}
        onDismiss={() => setCancelOpen(false)}
      />
    </>
  )
}
