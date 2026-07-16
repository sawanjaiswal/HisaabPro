/** Dashboard — 4 metric tiles (Collections / Expenses / Cash in Hand / Profit).
 *
 * Sits on the dark sales hero. Each tile: icon chip, label, amount, and a
 * delta chip (▲/▼ %) or a status pill. All amounts in PAISE.
 * PREVIEW: fed by mock data until the backend series endpoint lands.
 */

import React from 'react'
import { ArrowUp, ArrowDown, Wallet, Receipt, Landmark, PieChart } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCompactAmount } from '../dashboard.utils'
import type { MetricTileMock } from '../dashboard-preview.mock'

const ICONS: Record<string, LucideIcon> = { Wallet, Receipt, Landmark, PieChart }

interface DashboardMetricTilesProps {
  tiles: MetricTileMock[]
}

export const DashboardMetricTiles: React.FC<DashboardMetricTilesProps> = ({ tiles }) => {
  const { t } = useLanguage()

  return (
    <div className="dashboard-metric-tiles" role="list">
      {tiles.map((tile) => {
        const Icon = ICONS[tile.icon] ?? Wallet
        const up = (tile.deltaPct ?? 0) >= 0
        return (
          <div key={tile.id} className="dashboard-metric-tile" role="listitem">
            <div className="dashboard-metric-tile__head">
              <span className={`dashboard-metric-tile__icon dashboard-metric-tile__icon--${tile.tone}`}>
                <Icon size={15} aria-hidden="true" />
              </span>
              <span className="dashboard-metric-tile__label">{t[tile.labelKey]}</span>
            </div>
            <span className="dashboard-metric-tile__amount">{formatCompactAmount(tile.amount)}</span>
            {tile.deltaPct === null ? (
              <span className="dashboard-metric-tile__status">
                <span className="dashboard-metric-tile__dot" aria-hidden="true" />
                {tile.statusKey ? t[tile.statusKey] : ''}
              </span>
            ) : (
              <span className={`dashboard-metric-tile__delta ${up ? 'is-up' : 'is-down'}`}>
                {up ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}
                {Math.abs(tile.deltaPct)}%
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
