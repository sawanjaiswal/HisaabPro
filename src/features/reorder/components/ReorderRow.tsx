/** ReorderRow (#148) — one product's velocity-based reorder suggestion. */

import { Link } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise, formatNumber } from '@/lib/format'
import { ROUTES } from '@/config/routes.config'
import type { ReorderSuggestion } from '../reorder.types'
import { URGENCY_META } from '../reorder.constants'
import { daysToStockOutLabel, velocityLabel } from '../reorder.utils'

interface ReorderRowProps {
  item: ReorderSuggestion
}

export function ReorderRow({ item }: ReorderRowProps) {
  const { t } = useLanguage()
  const meta = URGENCY_META[item.urgency]

  return (
    <li className="reorder-row">
      <Link
        to={ROUTES.PRODUCT_DETAIL.replace(':id', item.productId)}
        className="reorder-row__link"
        aria-label={item.name}
      >
        <div className="reorder-row__head">
          <span className="reorder-row__name">{item.name}</span>
          <span className={`reorder-pill ${meta.modifier}`}>{t[meta.labelKey]}</span>
        </div>

        <div className="reorder-row__meta tabular-nums">
          {formatNumber(item.currentStock)} {item.unitSymbol} {t.inStock} ·{' '}
          {velocityLabel(item.dailyVelocity, t.perDay)} ·{' '}
          {daysToStockOutLabel(item.daysToStockOut, t.notSelling, t.daysLeft)}
        </div>

        <div className="reorder-row__suggest">
          <div className="reorder-row__suggest-qty">
            <span className="reorder-row__suggest-label">{t.suggestedReorder}</span>
            <span className="reorder-row__suggest-value tabular-nums">
              {formatNumber(item.suggestedReorderQty)} {item.unitSymbol}
            </span>
          </div>
          <span className="reorder-row__suggest-value tabular-nums">
            {formatPaise(item.reorderValuePaise)}
          </span>
        </div>
      </Link>
    </li>
  )
}
