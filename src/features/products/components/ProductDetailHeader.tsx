/** Product Detail — identity card (GPT reskin).
 *
 * Thumbnail · name / "SKU: …" with barcode + copy · In-Stock + Healthy pills ·
 * bookmark button top-right. Pure identity; stats live in ProductStatRow.
 */

import React, { useState } from 'react'
import { Barcode, Copy, Bookmark, ShieldCheck, ShieldAlert } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import type { ProductDetail } from '../product.types'
import { getStockStatus } from '../product.utils'
import { PartyAvatar } from '@/components/ui/PartyAvatar'
import { Button } from '@/components/ui/Button'

interface ProductDetailHeaderProps {
  product: ProductDetail
  onBarcode: () => void
  onToggleSave: () => void
}

export const ProductDetailHeader: React.FC<ProductDetailHeaderProps> = ({
  product,
  onBarcode,
  onToggleSave,
}) => {
  const { t } = useLanguage()
  const toast = useToast()
  const [saved, setSaved] = useState(false)
  const stockStatus = getStockStatus(product.currentStock, product.minStockLevel)
  const stockLabel = { ok: t.inStock, low: t.lowStock, out: t.outOfStock }[stockStatus]
  const healthy = stockStatus === 'ok'

  const copySku = () => {
    void navigator.clipboard?.writeText(product.sku).then(
      () => toast.success(t.copied),
      () => toast.error(t.somethingWentWrong),
    )
  }

  const toggleSave = () => {
    setSaved((s) => !s)
    onToggleSave()
  }

  return (
    <div className="pd-identity" role="region" aria-label={t.productOverview}>
      {product.images?.[0] ? (
        <img src={product.images[0]} alt={product.name} className="pd-identity__thumb" />
      ) : (
        <PartyAvatar name={product.name} size="lg" className="pd-identity__thumb" />
      )}

      <div className="pd-identity__body">
        <h2 className="pd-identity__name">{product.name}</h2>
        <div className="pd-identity__sku">
          <span>{t.skuLabel}: {product.sku}</span>
          <Button variant="none" type="button" className="pd-identity__sku-btn" onClick={onBarcode} aria-label={t.barcodeAction}>
            <Barcode size={16} aria-hidden="true" />
          </Button>
          <Button variant="none" type="button" className="pd-identity__sku-btn" onClick={copySku} aria-label={t.copyLabel}>
            <Copy size={16} aria-hidden="true" />
          </Button>
        </div>
        <div className="pd-identity__pills">
          <span className={`pd-pill pd-pill--${stockStatus === 'ok' ? 'ok' : stockStatus === 'low' ? 'warn' : 'bad'}`}>
            <span className="pd-pill__dot" aria-hidden="true" />
            {stockLabel}
          </span>
          <span className={`pd-pill pd-pill--${healthy ? 'ok' : 'warn'}`}>
            {healthy ? <ShieldCheck size={14} aria-hidden="true" /> : <ShieldAlert size={14} aria-hidden="true" />}
            {healthy ? t.healthy : t.lowStock}
          </span>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className={`pd-identity__save${saved ? ' pd-identity__save--on' : ''}`}
        onClick={toggleSave}
        aria-label={t.moreLabel}
        aria-pressed={saved}
      >
        <Bookmark size={20} aria-hidden="true" fill={saved ? 'currentColor' : 'none'} />
      </Button>
    </div>
  )
}
