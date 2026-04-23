/** Product Info Tab — shows description, HSN, SKU, barcode, status */

import { Info } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
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
  return (
    <div className="card product-info-card">
      {description && (
        <div className="product-info-row product-info-row--stacked">
          <span className="product-info-label product-info-label--full">{t.descriptionLabel}</span>
          <p className="product-info-text">{description}</p>
        </div>
      )}
      {hsnCode && (
        <div className="product-info-row">
          <span className="product-info-label">{t.hsnCodeLabel}</span>
          <span className="product-info-value">{hsnCode}</span>
        </div>
      )}
      {sacCode && (
        <div className="product-info-row">
          <span className="product-info-label">{t.sacCodeLabel}</span>
          <span className="product-info-value">{sacCode}</span>
        </div>
      )}
      <div className="product-info-row">
        <span className="product-info-label">{t.skuLabel}</span>
        <span className="product-info-value product-info-value--mono">{sku}</span>
      </div>
      {barcode && (
        <div className="product-info-row product-info-row--stacked-lg">
          <span className="product-info-label product-info-label--full">
            {t.barcodeLabel} ({BARCODE_FORMAT_LABELS[barcodeFormat ?? 'CODE128']})
          </span>
          <BarcodeDisplay
            value={barcode}
            format={barcodeFormat ?? 'CODE128'}
            productName={sku}
          />
        </div>
      )}
      <div className="product-info-row">
        <span className="product-info-label">{t.statusLabel}</span>
        <span className={`badge ${status === 'ACTIVE' ? 'badge-paid' : 'badge-pending'}`}>
          {status === 'ACTIVE' ? t.activeStatus : t.inactiveStatus}
        </span>
      </div>
      {!description && !hsnCode && !sacCode && (
        <EmptyState
          icon={<Info size={32} aria-hidden="true" />}
          title={t.noAdditionalInfo}
          description={t.noAdditionalInfoDesc}
        />
      )}
    </div>
  )
}
