/** Stock Shortage Banner — inline 409 INSUFFICIENT_STOCK display
 *
 * Renders a structured, dismissable banner listing every item with
 * insufficient stock. Never a toast — the user needs to read and act on it.
 */

import { Text } from '@/components/ui/Text'
import React from 'react'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, X } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { StockShortageItem } from '../invoice-form.types'

interface StockShortageBannerProps {
  items: StockShortageItem[]
  onDismiss: () => void
}

function formatDetail(t: ReturnType<typeof useLanguage>['t'], item: StockShortageItem): string {
  return t.errStockShortageDetail
    .replace('{product}', item.productName)
    .replace('{available}', String(item.available))
    .replace('{unit}', item.unit ?? '')
    .replace('{requested}', String(item.requested))
}

export const StockShortageBanner: React.FC<StockShortageBannerProps> = ({ items, onDismiss }) => {
  const { t } = useLanguage()
  if (items.length === 0) return null

  const headline = items.length === 1
    ? t.errStockShortageSingular
    : t.errStockShortagePlural.replace('{count}', String(items.length))

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
            {t.errStockShortageTitle}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          aria-label="Dismiss stock shortage warning"
          className="min-w-[44px] min-h-[44px] p-0"
        >
          <X size={16} aria-hidden="true" />
        </Button>
      </div>
      <Text className="text-xs text-[var(--color-error-500)] mt-1 mb-2">
        {headline}
      </Text>
      <ul className="m-0 pl-4 text-sm text-[var(--color-text-primary)]" aria-label={t.errStockShortageTitle}>
        {items.map((item) => (
          <li key={item.productId} className="mb-1">
            {formatDetail(t, item)}
          </li>
        ))}
      </ul>
      <Text className="text-xs text-[var(--color-text-muted)] mt-2">
        {t.errStockShortageHint}
      </Text>
    </div>
  )
}
