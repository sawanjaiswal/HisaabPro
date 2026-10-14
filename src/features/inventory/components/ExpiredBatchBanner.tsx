/** ExpiredBatchBanner — inline 409 handler for batch-expiry errors (BAT-05)
 *
 * Mirrors StockShortageBanner style exactly.
 * Codes: EXPIRED_BATCH | ALL_BATCHES_EXPIRED | INSUFFICIENT_BATCH_STOCK
 * CTA: "Pick another batch" → calls onReopenPicker
 */

import { Text } from '@/components/ui/Text'
import { AlertTriangle, X } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'

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
      className="rounded-lg border border-[var(--color-error-500)] bg-[var(--color-danger-surface,#fff1f0)] p-3 px-4 mb-4"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} aria-hidden="true" className="text-[var(--color-error-500)] flex-shrink-0" />
          <span className="font-semibold text-sm text-[var(--color-error-500)]">
            {title}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss expired batch warning"
          className="min-w-[44px] min-h-[44px] p-0"
        >
          <X size={16} aria-hidden="true" />
        </Button>
      </div>
      <Text className="text-xs text-[var(--color-error-500)] mt-1 mb-2">
        {hint}
      </Text>
      {code !== 'ALL_BATCHES_EXPIRED' && (
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={onReopenPicker}
          className="text-sm min-h-[36px]"
        >
          {t.pickAnotherBatch}
        </Button>
      )}
    </div>
  )
}
