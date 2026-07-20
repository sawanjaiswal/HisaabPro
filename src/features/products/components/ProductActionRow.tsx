/** Product Detail — quick-action icon row (Adjust Stock · Edit Price · Barcode
 *  · Duplicate · More). Emerald outline icon squares, label beneath. */

import React from 'react'
import { Package, Tag, Barcode, Copy, MoreHorizontal } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'

interface ProductActionRowProps {
  onAdjustStock: () => void
  onEditPrice: () => void
  onBarcode: () => void
  onDuplicate: () => void
  onMore: () => void
}

export const ProductActionRow: React.FC<ProductActionRowProps> = ({
  onAdjustStock,
  onEditPrice,
  onBarcode,
  onDuplicate,
  onMore,
}) => {
  const { t } = useLanguage()

  const actions = [
    { id: 'adjust', label: t.adjustStock, icon: <Package size={22} aria-hidden="true" />, onClick: onAdjustStock },
    { id: 'price', label: t.editPrice, icon: <Tag size={22} aria-hidden="true" />, onClick: onEditPrice },
    { id: 'barcode', label: t.barcodeAction, icon: <Barcode size={22} aria-hidden="true" />, onClick: onBarcode },
    { id: 'duplicate', label: t.duplicate, icon: <Copy size={22} aria-hidden="true" />, onClick: onDuplicate },
    { id: 'more', label: t.moreLabel, icon: <MoreHorizontal size={22} aria-hidden="true" />, onClick: onMore },
  ]

  return (
    <div className="pd-actions" role="group" aria-label={t.adjustStock}>
      {actions.map((a) => (
        <Button variant="none" key={a.id} type="button" className="pd-actions__item" onClick={a.onClick}>
          <span className="pd-actions__icon">{a.icon}</span>
          <span className="pd-actions__label">{a.label}</span>
        </Button>
      ))}
    </div>
  )
}
