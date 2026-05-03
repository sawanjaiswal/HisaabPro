/** Dashboard — Today's cash flow strip
 *
 * Three compact stats under the sales hero: money in, money out, net.
 * All values in paise — formatted via formatCompactAmount.
 */

import { ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCompactAmount } from '../dashboard.utils'

interface TodayCashStripProps {
  /** Paise */
  paymentsIn: number
  /** Paise */
  paymentsOut: number
  /** Paise (signed) */
  netCashFlow: number
}

export function TodayCashStrip({ paymentsIn, paymentsOut, netCashFlow }: TodayCashStripProps) {
  const { t } = useLanguage()
  const isPositive = netCashFlow >= 0

  return (
    <div
      className="dashboard-cash-strip"
      role="group"
      aria-label={t.todaysCashFlow}
    >
      <div className="dashboard-cash-cell">
        <ArrowDownLeft size={14} aria-hidden="true" className="dashboard-cash-cell__icon dashboard-cash-cell__icon--in" />
        <div className="dashboard-cash-cell__body">
          <span className="dashboard-cash-cell__label">{t.moneyIn}</span>
          <span className="dashboard-cash-cell__value">{formatCompactAmount(paymentsIn)}</span>
        </div>
      </div>
      <div className="dashboard-cash-cell-divider" aria-hidden="true" />
      <div className="dashboard-cash-cell">
        <ArrowUpRight size={14} aria-hidden="true" className="dashboard-cash-cell__icon dashboard-cash-cell__icon--out" />
        <div className="dashboard-cash-cell__body">
          <span className="dashboard-cash-cell__label">{t.moneyOut}</span>
          <span className="dashboard-cash-cell__value">{formatCompactAmount(paymentsOut)}</span>
        </div>
      </div>
      <div className="dashboard-cash-cell-divider" aria-hidden="true" />
      <div className="dashboard-cash-cell">
        {isPositive ? (
          <TrendingUp size={14} aria-hidden="true" className="dashboard-cash-cell__icon dashboard-cash-cell__icon--in" />
        ) : (
          <TrendingDown size={14} aria-hidden="true" className="dashboard-cash-cell__icon dashboard-cash-cell__icon--out" />
        )}
        <div className="dashboard-cash-cell__body">
          <span className="dashboard-cash-cell__label">{t.netCashFlow}</span>
          <span
            className={`dashboard-cash-cell__value${isPositive ? '' : ' dashboard-cash-cell__value--neg'}`}
          >
            {formatCompactAmount(netCashFlow)}
          </span>
        </div>
      </div>
    </div>
  )
}
