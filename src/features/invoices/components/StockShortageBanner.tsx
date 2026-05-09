/** Stock Shortage Banner — inline 409 INSUFFICIENT_STOCK display
 *
 * Renders a structured, dismissable banner listing every item with
 * insufficient stock. Never a toast — the user needs to read and act on it.
 */

import React from 'react'
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
      style={{
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-error-500)',
        background: 'var(--color-danger-surface, #fff1f0)',
        padding: 'var(--space-3) var(--space-4)',
        marginBottom: 'var(--space-4)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <AlertTriangle size={16} aria-hidden="true" style={{ color: 'var(--color-error-500)', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--color-error-500)' }}>
            {t.errStockShortageTitle}
          </span>
        </div>
        <button
          className="btn-ghost"
          onClick={onDismiss}
          aria-label="Dismiss stock shortage warning"
          style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-error-500)', marginTop: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
        {headline}
      </p>
      <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-primary)' }} aria-label={t.errStockShortageTitle}>
        {items.map((item) => (
          <li key={item.productId} style={{ marginBottom: 'var(--space-1)' }}>
            {formatDetail(t, item)}
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
        {t.errStockShortageHint}
      </p>
    </div>
  )
}
