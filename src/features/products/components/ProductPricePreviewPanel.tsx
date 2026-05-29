/** ProductPricePreviewPanel — "Price across lists" card on product detail.
 *
 * Shows the product's salePrice as baseline, then one section per price list
 * returned by GET /api/products/:id/price-preview.  Each section shows the
 * tier bands (qty range, mode, resolved price).  Lists with no entries render
 * a muted "uses default" row.
 */

import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Tag } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { formatProductPrice } from '../product.utils'
import {
  useProductPricePreview,
  type PricePreviewList,
  type PricePreviewEntry,
} from '@/features/price-lists/use-product-price-preview'
import './product-price-preview-panel.css'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProductPricePreviewPanelProps {
  productId: string
  salePrice: number
}

// ─── Mode label ───────────────────────────────────────────────────────────────

function modeLabel(entry: PricePreviewEntry): string {
  switch (entry.mode) {
    case 'ABSOLUTE':   return 'Fixed'
    case 'PERCENT_OFF':
      return entry.percentBps != null
        ? `${(entry.percentBps / 100).toFixed(0)}% off`
        : 'Percent off'
    case 'FIXED_OFF':  return 'Flat off'
    default:           return entry.mode
  }
}

// ─── Qty range label ──────────────────────────────────────────────────────────

function qtyRangeLabel(min: number, max: number | null): string {
  if (max == null) return `${min}+`
  return `${min}–${max}`
}

// ─── Entry rows ───────────────────────────────────────────────────────────────

function EntryRows({ entries, salePrice, t }: {
  entries: PricePreviewEntry[]
  salePrice: number
  t: ReturnType<typeof useLanguage>['t']
}) {
  if (entries.length === 0) {
    return (
      <p className="ppp-no-entries">
        {t.priceListNoEntries}
        {' — '}
        {t.useDefaultPrice.replace('{price}', formatProductPrice(salePrice))}
      </p>
    )
  }

  return (
    <div className="ppp-entry-table" role="table" aria-label={t.priceAcrossLists}>
      <div className="ppp-entry-header" role="row">
        <span role="columnheader">{t.qtyRange}</span>
        <span role="columnheader">{t.priceMode}</span>
        <span role="columnheader" className="ppp-entry-price-col">{t.resolvedPrice}</span>
      </div>
      {entries.map((e) => (
        <div key={e.entryId} className="ppp-entry-row" role="row">
          <span role="cell" className="ppp-qty-range">{qtyRangeLabel(e.minQty, e.maxQty)}</span>
          <span role="cell" className="ppp-mode-label">{modeLabel(e)}</span>
          <span role="cell" className="ppp-price-resolved">{formatProductPrice(e.resolvedPaiseAtQty1)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── List block ───────────────────────────────────────────────────────────────

function ListBlock({ list, salePrice, t }: {
  list: PricePreviewList
  salePrice: number
  t: ReturnType<typeof useLanguage>['t']
}) {
  return (
    <div className="ppp-list-block">
      <div className="ppp-list-name-row">
        <span className="ppp-list-name">{list.listName}</span>
        {list.isDefault && (
          <span className="ppp-default-badge" aria-label={t.priceListDefaultBadge}>
            {t.priceListDefaultBadge}
          </span>
        )}
      </div>
      <EntryRows
        entries={list.entries ?? []}
        salePrice={salePrice}
        t={t}
      />
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PanelSkeleton() {
  return (
    <div className="ppp-skeleton" aria-hidden="true">
      <Skeleton height="1rem" width="40%" />
      <div className="ppp-skeleton-rows">
        <Skeleton height="2.5rem" borderRadius="var(--radius-md)" />
        <Skeleton height="2.5rem" borderRadius="var(--radius-md)" />
        <Skeleton height="2.5rem" borderRadius="var(--radius-md)" />
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductPricePreviewPanel({
  productId,
  salePrice,
}: ProductPricePreviewPanelProps) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { preview, status, refetch } = useProductPricePreview(productId)

  return (
    <section className="card ppp-panel" aria-label={t.priceAcrossLists}>
      <div className="ppp-header">
        <Tag size={16} aria-hidden="true" className="ppp-header-icon" />
        <h2 className="ppp-title">{t.priceAcrossLists}</h2>
      </div>

      <div className="ppp-baseline-row">
        <span className="ppp-baseline-label">{t.basePrice}</span>
        <span className="ppp-baseline-value">{formatProductPrice(salePrice)}</span>
      </div>

      {status === 'loading' && <PanelSkeleton />}

      {status === 'error' && (
        <ErrorState
          title={t.pricePreviewErrorTitle}
          message={t.checkConnectionRetry}
          onRetry={refetch}
        />
      )}

      {status === 'success' && preview.length === 0 && (
        <div className="ppp-empty">
          <p className="ppp-empty-text">{t.noPriceListsConfigured}</p>
          <Button
            type="button"
            variant="ghost" size="sm" className="ppp-empty-link"
            onClick={() => navigate(ROUTES.PRICE_LISTS)}
          >
            {t.configurePriceLists}
          </Button>
        </div>
      )}

      {status === 'success' && preview.length > 0 && (
        <div className="ppp-lists">
          {preview.map((list) => (
            <ListBlock
              key={list.priceListId}
              list={list}
              salePrice={salePrice}
              t={t}
            />
          ))}
        </div>
      )}
    </section>
  )
}
