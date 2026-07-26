/** Dashboard — 4 metric tiles (Collections / Expenses / Cash in Hand / Profit).
 *
 * Sits on the dark sales hero. Each tile: icon chip, label, amount, and a
 * delta chip (▲/▼ %) or a status pill. All amounts in PAISE.
 */

import React, { useState } from 'react'
import { ArrowUp, ArrowDown, ChevronDown, Wallet, Receipt, Landmark, PieChart } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCompactAmount } from '../dashboard.utils'
import type { MetricTile } from '../dashboard.types'

const ICONS: Record<string, LucideIcon> = { Wallet, Receipt, Landmark, PieChart }

interface DashboardMetricTilesProps {
  tiles: MetricTile[]
}

export const DashboardMetricTiles: React.FC<DashboardMetricTilesProps> = ({ tiles }) => {
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(false)

  const visible = tiles.filter((tile) => !tile.hidden)
  const hidden = tiles.filter((tile) => tile.hidden)
  const hasHidden = hidden.length > 0

  // Keep the already-shown tiles in their original first-row slots. The hidden
  // tiles live in a collapsible reveal wrapper below so they animate open on a
  // smooth grid-rows transition instead of popping in.
  const renderTile = (tile: MetricTile) => {
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
  }

  return (
    <>
      <div className="dashboard-metric-tiles" role="list">
        {visible.map(renderTile)}
      </div>

      {hasHidden && (
        <div className={`dashboard-metric-reveal ${expanded ? 'is-open' : ''}`} aria-hidden={!expanded}>
          <div className="dashboard-metric-reveal__inner">
            <div className="dashboard-metric-tiles dashboard-metric-tiles--revealed" role="list">
              {hidden.map(renderTile)}
            </div>
          </div>
        </div>
      )}

      {hasHidden && (
        <Button
          variant="none"
          type="button"
          className={`dashboard-metric-toggle ${expanded ? 'is-open' : ''}`}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? t.showFewerMetrics : t.showMoreMetrics}
        >
          <ChevronDown size={18} aria-hidden="true" />
        </Button>
      )}
    </>
  )
}
