/** Products — 4-up stat tiles (GPT mockup).
 *
 * Total Products · Low Stock · Inventory Value · Out of Stock. Each tile is a
 * coloured icon-chip + label + big value + a subtitle; the last three are
 * tappable (chevron affordance) and route to filtered views. Composes only
 * tokens — no raw colours.
 */

import React from 'react'
import { Package, AlertTriangle, Layers, Ban, ChevronRight } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCompactInr } from '../product.utils'
import type { ProductListResponse } from '../product.types'

interface ProductStatTilesProps {
  summary: ProductListResponse['summary']
  onLowStock: () => void
  onValue: () => void
  onOutOfStock: () => void
}

export const ProductStatTiles: React.FC<ProductStatTilesProps> = ({
  summary,
  onLowStock,
  onValue,
  onOutOfStock,
}) => {
  const { t } = useLanguage()

  const tiles = [
    {
      id: 'total',
      tone: 'total' as const,
      icon: <Package size={18} aria-hidden="true" />,
      label: t.totalProducts,
      value: String(summary.totalProducts),
      sub: t.allItems,
      onClick: undefined,
    },
    {
      id: 'low',
      tone: 'low' as const,
      icon: <AlertTriangle size={18} aria-hidden="true" />,
      label: t.lowStock,
      value: String(summary.lowStockCount),
      sub: t.needReorder,
      onClick: onLowStock,
    },
    {
      id: 'value',
      tone: 'value' as const,
      icon: <Layers size={18} aria-hidden="true" />,
      label: t.inventoryValue,
      value: formatCompactInr(summary.totalStockValue),
      sub: t.totalValue,
      onClick: onValue,
    },
    {
      id: 'out',
      tone: 'out' as const,
      icon: <Ban size={18} aria-hidden="true" />,
      label: t.outOfStock,
      value: String(summary.outOfStockCount),
      sub: t.unavailable,
      onClick: onOutOfStock,
    },
  ]

  return (
    <div className="product-stat-tiles" role="list" aria-label={t.inventorySummary}>
      {tiles.map((tile) => {
        const Tag = tile.onClick ? 'button' : 'div'
        return (
          <Tag
            key={tile.id}
            type={tile.onClick ? 'button' : undefined}
            className={`product-stat-tile product-stat-tile--${tile.tone}`}
            onClick={tile.onClick}
            role="listitem"
            aria-label={`${tile.label}: ${tile.value}`}
          >
            <span className="product-stat-tile__icon" aria-hidden="true">{tile.icon}</span>
            <span className="product-stat-tile__label">{tile.label}</span>
            <span className="product-stat-tile__value">{tile.value}</span>
            <span className="product-stat-tile__sub">
              {tile.sub}
              {tile.onClick && <ChevronRight size={12} aria-hidden="true" />}
            </span>
          </Tag>
        )
      })}
    </div>
  )
}
