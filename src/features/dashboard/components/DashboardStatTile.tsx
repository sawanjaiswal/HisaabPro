/** Dashboard — Single stat tile (2x2 grid cell)
 *
 * Mockup: 4 flat mini-cards under the hero (Collections/Expenses/Cash/Profit).
 * We only have real data for outstanding + today's cash flow, so the 4 tiles
 * here are To Collect / To Pay / Received Today / Paid Today — all derived
 * from the existing HomeDashboardData response (no invented fields).
 */

import React from 'react'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { AnimatedNumber, SPRING } from '@/components/motion'
import { formatCompactAmount } from '../dashboard.utils'

export type StatTileTone = 'teal' | 'lime' | 'success' | 'info'

interface DashboardStatTileProps {
  icon: LucideIcon
  label: string
  amount: number
  tone: StatTileTone
  onClick?: () => void
}

export const DashboardStatTile: React.FC<DashboardStatTileProps> = ({
  icon: Icon,
  label,
  amount,
  tone,
  onClick,
}) => {
  return (
    <motion.button
      type="button"
      className={`dashboard-stat-tile dashboard-stat-tile--${tone}`}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={SPRING.snappy}
      aria-label={`${label}: ${formatCompactAmount(amount)}`}
    >
      <div className="dashboard-stat-tile-icon" aria-hidden="true">
        <Icon size={16} />
      </div>
      <AnimatedNumber
        className="dashboard-stat-tile-amount"
        value={amount}
        format={formatCompactAmount}
      />
      <span className="dashboard-stat-tile-label">{label}</span>
    </motion.button>
  )
}
