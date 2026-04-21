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
        <div className="product-info-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--color-gray-400)', fontSize: 'var(--fs-sm)' }}>{t.descriptionLabel}</span>
          <p style={{ marginTop: 'var(--space-1)', lineHeight: 1.5 }}>{description}</p>
        </div>
      )}
      {hsnCode && (
        <div className="product-info-row">
          <span style={{ color: 'var(--color-gray-400)', fontSize: 'var(--fs-sm)', minWidth: 100 }}>{t.hsnCodeLabel}</span>
          <span style={{ fontWeight: 500 }}>{hsnCode}</span>
        </div>
      )}
      {sacCode && (
        <div className="product-info-row">
          <span style={{ color: 'var(--color-gray-400)', fontSize: 'var(--fs-sm)', minWidth: 100 }}>{t.sacCodeLabel}</span>
          <span style={{ fontWeight: 500 }}>{sacCode}</span>
        </div>
      )}
      <div className="product-info-row">
        <span style={{ color: 'var(--color-gray-400)', fontSize: 'var(--fs-sm)', minWidth: 100 }}>{t.skuLabel}</span>
        <span style={{ fontWeight: 500, fontFamily: 'monospace' }}>{sku}</span>
      </div>
      {barcode && (
        <div className="product-info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
          <span style={{ color: 'var(--color-gray-400)', fontSize: 'var(--fs-sm)' }}>
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
        <span style={{ color: 'var(--color-gray-400)', fontSize: 'var(--fs-sm)', minWidth: 100 }}>{t.statusLabel}</span>
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
