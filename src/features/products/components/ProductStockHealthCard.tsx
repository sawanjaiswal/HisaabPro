/** Products — "Keep your stock healthy" footer banner (GPT mockup).
 *
 * Green icon tile · title + "N products are running low…" · "View Low Stock"
 * button. Mirrors PartyOutstandingCard structure; only renders when there is
 * at least one low-stock product. Pure display — parent owns the action.
 */

import React from 'react'
import { HeartPulse, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'

interface ProductStockHealthCardProps {
  lowStockCount: number
  onViewLowStock: () => void
}

export const ProductStockHealthCard: React.FC<ProductStockHealthCardProps> = ({
  lowStockCount,
  onViewLowStock,
}) => {
  const { t } = useLanguage()

  if (lowStockCount <= 0) return null

  return (
    <Card className="product-stock-health">
      <span className="product-stock-health__icon" aria-hidden="true">
        <HeartPulse size={20} />
      </span>
      <span className="product-stock-health__info">
        <span className="product-stock-health__title">{t.keepStockHealthy}</span>
        <span className="product-stock-health__sub">
          {lowStockCount} {t.productsRunningLow}
        </span>
      </span>
      <Button
        variant="none"
        className="product-stock-health__btn"
        onClick={onViewLowStock}
        aria-label={t.viewLowStock}
      >
        {t.viewLowStock}
        <ChevronRight size={16} aria-hidden="true" />
      </Button>
    </Card>
  )
}
