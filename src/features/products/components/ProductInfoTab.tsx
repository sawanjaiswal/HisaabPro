/** Product Info Tab — description, HSN/SAC, SKU, barcode, status.
 *  Reskinned to the Product Detail `pd-card` / `pd-summary` language so it
 *  matches the Overview and Pricing tabs (was legacy `card`/`product-info-*`). */

import type { ReactElement } from 'react'
import { Info, Receipt, Hash, CircleDot } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { useLanguage } from '@/hooks/useLanguage'
import { BARCODE_FORMAT_LABELS } from '../product.constants'
import { BarcodeDisplay } from './BarcodeDisplay'
import type { BarcodeFormat } from '@/lib/types/product.types'

interface ProductInfoTabProps {
  description: string | null
  hsnCode: string | null
  sacCode: string | null
  sku: string
  barcode?: string
  barcodeFormat?: BarcodeFormat
  status: string
  stockValidation: string
}

export function ProductInfoTab({
  description,
  hsnCode,
  sacCode,
  sku,
  barcode,
  barcodeFormat,
  status,
}: ProductInfoTabProps) {
  const { t } = useLanguage()
  const isActive = status === 'ACTIVE'

  const rows = [
    hsnCode ? { id: 'hsn', icon: <Receipt size={18} />, label: t.hsnCodeLabel, value: hsnCode } : null,
    sacCode ? { id: 'sac', icon: <Receipt size={18} />, label: t.sacCodeLabel, value: sacCode } : null,
    { id: 'sku', icon: <Hash size={18} />, label: t.skuLabel, value: sku },
  ].filter((r): r is { id: string; icon: ReactElement; label: string; value: string } => r !== null)

  return (
    <section className="pd-card" aria-label={t.noAdditionalInfo}>
      <header className="pd-card__head">
        <h3 className="pd-card__title">{t.infoTab}</h3>
      </header>

      {description && (
        <p className="pd-info__desc">{description}</p>
      )}

      <ul className="pd-summary__list" role="list">
        {rows.map((r) => (
          <li key={r.id} className="pd-summary__row">
            <span className="pd-summary__icon" aria-hidden="true">{r.icon}</span>
            <span className="pd-summary__label">{r.label}</span>
            <span className="pd-summary__value tabular-nums">{r.value}</span>
          </li>
        ))}
        <li className="pd-summary__row">
          <span className="pd-summary__icon" aria-hidden="true"><CircleDot size={18} /></span>
          <span className="pd-summary__label">{t.statusLabel}</span>
          <span className="pd-summary__value">
            <Badge variant={isActive ? 'paid' : 'pending'}>
              {isActive ? t.activeStatus : t.inactiveStatus}
            </Badge>
          </span>
        </li>
      </ul>

      {barcode && (
        <div className="pd-info__barcode">
          <span className="pd-summary__label">
            {t.barcodeLabel} ({BARCODE_FORMAT_LABELS[barcodeFormat ?? 'CODE128']})
          </span>
          <BarcodeDisplay value={barcode} format={barcodeFormat ?? 'CODE128'} productName={sku} />
        </div>
      )}

      {!description && !hsnCode && !sacCode && !barcode && (
        <EmptyState
          icon={<Info size={32} aria-hidden="true" />}
          title={t.noAdditionalInfo}
          description={t.noAdditionalInfoDesc}
        />
      )}
    </section>
  )
}
