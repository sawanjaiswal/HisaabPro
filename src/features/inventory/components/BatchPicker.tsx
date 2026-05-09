/** BatchPicker — FEFO batch selector modal (BAT-05)
 *
 * 4 UI states: loading skeleton · error · empty · success rows
 * Each row: [BatchNumber] | Expires DD-MMM-YYYY | Available N | [badge]
 * Expired rows: disabled when HARD_BLOCK, visible with strikethrough for WARN_ONLY.
 */

import { X, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useBatchPicker } from '../hooks/useBatchPicker'
import type { BatchPickerItem } from '../types/batch.types'

interface BatchPickerProps {
  productId: string
  /** 'HARD_BLOCK' disables expired rows; 'WARN_ONLY' shows them with warning */
  expiredBatchPolicy?: 'HARD_BLOCK' | 'WARN_ONLY'
  selectedBatchId?: string | null
  onSelect: (batchId: string) => void
  onClose: () => void
}

function formatExpiry(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ExpiryBadge({ isExpired, expiryDate, expiredLabel, daysLeftLabel }: {
  isExpired: boolean
  expiryDate: string | null
  expiredLabel: string
  daysLeftLabel: string
}) {
  if (!expiryDate) return null
  const today = new Date()
  const exp = new Date(expiryDate)
  const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / 86_400_000)

  if (isExpired) {
    return (
      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-error-500)', background: 'var(--color-danger-surface, #fff1f0)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', whiteSpace: 'nowrap' }}>
        {expiredLabel}
      </span>
    )
  }
  if (daysLeft <= 30) {
    return (
      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-warning)', background: 'var(--color-warning-surface, #fffbeb)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', whiteSpace: 'nowrap' }}>
        {daysLeft}{daysLeftLabel}
      </span>
    )
  }
  return null
}

function BatchRow({
  batch,
  policy,
  selected,
  onSelect,
}: {
  batch: BatchPickerItem
  policy: 'HARD_BLOCK' | 'WARN_ONLY'
  selected: boolean
  onSelect: (id: string) => void
}) {
  const isBlocked = batch.isExpired && policy === 'HARD_BLOCK'
  const { t } = useLanguage()

  return (
    <button
      type="button"
      disabled={isBlocked}
      onClick={() => onSelect(batch.id)}
      aria-pressed={selected}
      aria-disabled={isBlocked}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        width: '100%',
        textAlign: 'left',
        padding: 'var(--space-3) var(--space-4)',
        background: selected ? 'var(--color-primary-surface, #e0f2f1)' : 'transparent',
        border: selected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        cursor: isBlocked ? 'not-allowed' : 'pointer',
        opacity: isBlocked ? 0.5 : 1,
        minHeight: 44,
      }}
      aria-label={`${t.pickBatch}: ${batch.batchNumber}${batch.isExpired ? ` — ${t.expired}` : ''}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{
          fontWeight: 600,
          fontSize: 'var(--fs-sm)',
          color: 'var(--color-text-primary)',
          textDecoration: batch.isExpired && policy === 'WARN_ONLY' ? 'line-through' : 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {batch.batchNumber}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {batch.expiryDate && (
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)' }}>
              <Clock size={10} style={{ display: 'inline', marginRight: 3 }} aria-hidden="true" />
              {formatExpiry(batch.expiryDate)}
            </span>
          )}
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)' }}>
            {t.batchPickerAvail}: <strong style={{ color: batch.currentStock === 0 ? 'var(--color-error-500)' : 'var(--color-text-primary)' }}>{batch.currentStock}</strong>
          </span>
          <ExpiryBadge isExpired={batch.isExpired} expiryDate={batch.expiryDate} expiredLabel={t.expired} daysLeftLabel="d" />
        </div>
      </div>
      {selected && (
        <CheckCircle2 size={18} aria-hidden="true" style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
      )}
    </button>
  )
}

export function BatchPicker({
  productId,
  expiredBatchPolicy = 'WARN_ONLY',
  selectedBatchId,
  onSelect,
  onClose,
}: BatchPickerProps) {
  const { t } = useLanguage()
  const { batches, status, error, refetch } = useBatchPicker({ productId })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.pickBatch}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal, 400)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }}
      />

      <div
        style={{
          position: 'relative',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          padding: 'var(--space-4)',
          maxHeight: '80vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            {t.pickBatch}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.batchPickerClose}
            style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Loading */}
        {status === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }} aria-busy="true">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height="3.5rem" />
            ))}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-error-500)', fontSize: 'var(--fs-sm)' }}>
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{error}</span>
            <button type="button" onClick={refetch} className="btn btn-sm" style={{ marginLeft: 'auto' }}>{t.batchPickerRetry}</button>
          </div>
        )}

        {/* Empty */}
        {status === 'success' && batches.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: 'var(--fs-sm)' }}>
            {t.batchPickerNoneAvailable}
          </div>
        )}

        {/* Batch rows */}
        {status === 'success' && batches.length > 0 && (
          <div
            role="listbox"
            aria-label={t.pickBatch}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
          >
            {expiredBatchPolicy === 'HARD_BLOCK' && batches.some((b) => !b.isExpired) && (
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                {t.expiredBatchBlocked}
              </p>
            )}
            {batches.map((batch) => (
              <BatchRow
                key={batch.id}
                batch={batch}
                policy={expiredBatchPolicy}
                selected={selectedBatchId === batch.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
