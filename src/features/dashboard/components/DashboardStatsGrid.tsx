/** Dashboard — 2x2 stats grid (replaces OutstandingHero + TodayCashStrip on home)
 *
 * All amounts in PAISE. Data already present in HomeDashboardData.
 */

import React from 'react'
import { ArrowDownCircle, ArrowUpCircle, Wallet, HandCoins } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { DashboardStatTile } from './DashboardStatTile'

interface DashboardStatsGridProps {
  receivableTotal: number
  payableTotal: number
  paymentsReceivedAmount: number
  paymentsMadeAmount: number
  onCollectClick: () => void
  onPayClick: () => void
}

export const DashboardStatsGrid: React.FC<DashboardStatsGridProps> = ({
  receivableTotal,
  payableTotal,
  paymentsReceivedAmount,
  paymentsMadeAmount,
  onCollectClick,
  onPayClick,
}) => {
  const { t } = useLanguage()
  return (
    <div className="dashboard-stats-grid" role="list" aria-label={t.outstandingSummary}>
      <DashboardStatTile
        icon={ArrowDownCircle}
        label={t.toCollect}
        amount={receivableTotal}
        tone="teal"
        onClick={onCollectClick}
      />
      <DashboardStatTile
        icon={ArrowUpCircle}
        label={t.toPay}
        amount={payableTotal}
        tone="lime"
        onClick={onPayClick}
      />
      <DashboardStatTile
        icon={Wallet}
        label={t.receivedToday}
        amount={paymentsReceivedAmount}
        tone="success"
      />
      <DashboardStatTile
        icon={HandCoins}
        label={t.paidToday}
        amount={paymentsMadeAmount}
        tone="info"
      />
    </div>
  )
}
