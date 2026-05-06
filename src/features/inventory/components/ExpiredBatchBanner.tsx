/** ExpiredBatchBanner — inline 409 handler for batch-expiry errors (BAT-05)
 *
 * Mirrors StockShortageBanner style exactly.
 * Codes: EXPIRED_BATCH | ALL_BATCHES_EXPIRED | INSUFFICIENT_BATCH_STOCK
 * CTA: "Pick another batch" → calls onReopenPicker
 */

import { AlertTriangle, X } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

type BatchErrorCode = 'EXPIRED_BATCH' | 'ALL_BATCHES_EXPIRED' | 'INSUFFICIENT_BATCH_STOCK'

interface ExpiredBatchBannerProps {
  code: BatchErrorCode
  onDismiss: () => void
  onReopenPicker: () => void
}

export function ExpiredBatchBanner({ code, onDismiss, onReopenPicker }: ExpiredBatchBannerProps) {
  const { t } = useLanguage()

  const title = code === 'ALL_BATCHES_EXPIRED'
    ? t.allBatchesExpired
    : code === 'INSUFFICIENT_BATCH_STOCK'
      ? t.insufficientBatchStock
      : t.expiredBatchBlocked

  const hint = code === 'ALL_BATCHES_EXPIRED'
    ? t.allBatchesExpiredHint
    : t.expiredBatchHint

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-danger)',
        background: 'var(--color-danger-surface, #fff1f0)',
        padding: 'var(--space-3) var(--space-4)',
        marginBottom: 'var(--space-4)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <AlertTriangle size={16} aria-hidden="true" style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>
            {title}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss expired batch warning"
          style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', marginTop: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
        {hint}
      </p>
      {code !== 'ALL_BATCHES_EXPIRED' && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={onReopenPicker}
          style={{ fontSize: 'var(--text-sm)', minHeight: 36 }}
        >
          {t.pickAnotherBatch}
        </button>
      )}
    </div>
  )
}
