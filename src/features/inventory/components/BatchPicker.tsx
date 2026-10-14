/** BatchPicker — FEFO batch selector modal (BAT-05)
 *
 * 4 UI states: loading skeleton · error · empty · success rows
 * Each row: [BatchNumber] | Expires DD-MMM-YYYY | Available N | [badge]
 * Expired rows: disabled when HARD_BLOCK, visible with strikethrough for WARN_ONLY.
 */

import { Text } from '@/components/ui/Text'
import { X, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useBatchPicker } from '../hooks/useBatchPicker'
import type { BatchPickerItem } from '../types/batch.types'
import { Button } from '@/components/ui/Button'
import { Heading } from '@/components/ui/Heading'

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
      <span className="text-xs font-semibold text-[var(--color-error-500)] bg-[var(--color-danger-surface,#fff1f0)] rounded px-1.5 py-0.5 whitespace-nowrap">
        {expiredLabel}
      </span>
    )
  }
  if (daysLeft <= 30) {
    return (
      <span className="text-xs font-semibold text-[var(--color-warning)] bg-[var(--color-warning-surface,#fffbeb)] rounded px-1.5 py-0.5 whitespace-nowrap">
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
    <Button
      variant="none"
      type="button"
      disabled={isBlocked}
      onClick={() => onSelect(batch.id)}
      aria-pressed={selected}
      aria-disabled={isBlocked}
      className={`flex items-center justify-between gap-3 w-full text-left p-3 px-4 rounded-lg min-h-[44px] ${
        selected ? 'bg-[var(--color-primary-surface,#e0f2f1)] border-2 border-[var(--color-primary)]' : 'bg-transparent border border-[var(--color-border)]'
      } ${isBlocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      aria-label={`${t.pickBatch}: ${batch.batchNumber}${batch.isExpired ? ` — ${t.expired}` : ''}`}
    >
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span className={`font-semibold text-sm text-[var(--color-text-primary)] truncate ${batch.isExpired && policy === 'WARN_ONLY' ? 'line-through' : ''}`}>
          {batch.batchNumber}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {batch.expiryDate && (
            <span className="text-xs text-[var(--text-muted)]">
              <Clock size={10} className="inline mr-1" aria-hidden="true" />
              {formatExpiry(batch.expiryDate)}
            </span>
          )}
          <span className="text-xs text-[var(--text-muted)]">
            {t.batchPickerAvail}: <strong style={{ color: batch.currentStock === 0 ? 'var(--color-error-500)' : 'var(--color-text-primary)' }}>{batch.currentStock}</strong>
          </span>
          <ExpiryBadge isExpired={batch.isExpired} expiryDate={batch.expiryDate} expiredLabel={t.expired} daysLeftLabel="d" />
        </div>
      </div>
      {selected && (
        <CheckCircle2 size={18} aria-hidden="true" style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
      )}
    </Button>
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
        <div className="flex items-center justify-between">
          <Heading level={2} className="text-base font-bold text-[var(--color-text-primary)] m-0">
            {t.pickBatch}
          </Heading>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={onClose}
            aria-label={t.batchPickerClose}
            className="min-w-[44px] min-h-[44px] text-[var(--color-text-muted)]"
          >
            <X size={20} aria-hidden="true" />
          </Button>
        </div>

        {/* Loading */}
        {status === 'loading' && (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height="3.5rem" />
            ))}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div role="alert" className="flex items-center gap-2 text-sm text-[var(--color-error-500)]">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{error}</span>
            <Button variant="outline" size="sm" type="button" onClick={refetch} className="ml-auto">{t.batchPickerRetry}</Button>
          </div>
        )}

        {/* Empty */}
        {status === 'success' && batches.length === 0 && (
          <div className="text-center p-6 text-sm text-[var(--color-text-muted)]">
            {t.batchPickerNoneAvailable}
          </div>
        )}

        {/* Batch rows */}
        {status === 'success' && batches.length > 0 && (
          <div
            role="listbox"
            aria-label={t.pickBatch}
            className="flex flex-col gap-2"
          >
            {expiredBatchPolicy === 'HARD_BLOCK' && batches.some((b) => !b.isExpired) && (
              <Text className="text-xs text-[var(--color-text-muted)] m-0">
                {t.expiredBatchBlocked}
              </Text>
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
