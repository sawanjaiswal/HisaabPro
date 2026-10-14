/** CustomOrderListItem — one row: status pill + title + party + Rs total + balance chip + delivery date */

import { Calendar, User, IndianRupee } from 'lucide-react'
import { CustomOrderStatusPill } from './CustomOrderStatusPill'
import { formatPaise, formatOrderNumber } from '../custom-orders.utils'
import type { CustomOrderListRow } from '../custom-orders.types'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/context/LanguageContext'

interface CustomOrderListItemProps {
  order: CustomOrderListRow
  onClick: (id: string) => void
}

export function CustomOrderListItem({ order, onClick }: CustomOrderListItemProps) {
  const { t } = useLanguage()
  const delivery = order.deliveryAt
    ? new Date(order.deliveryAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null

  return (
    <Button
      variant="none"
      type="button"
      className="order-list-item flex flex-col gap-1 w-full text-left p-3 px-4 bg-[var(--color-surface)] border-b border-[var(--color-border)] min-h-[44px]"
      onClick={() => onClick(order.id)}
      aria-label={`${t.coOrderRowAria} ${formatOrderNumber(order.orderNumber, order.id)}: ${order.title}`}
    >
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="text-xs text-[var(--color-text-secondary)] font-medium">
          {formatOrderNumber(order.orderNumber, order.id)}
        </span>
        <CustomOrderStatusPill status={order.status} />
      </div>

      <span className="text-sm font-semibold text-[var(--color-text)] leading-snug">
        {order.title}
      </span>

      <div className="flex items-center justify-between gap-2 flex-wrap w-full">
        <span className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
          <User size={12} aria-hidden="true" />
          {order.partyName}
        </span>

        <div className="flex items-center gap-3">
          {delivery && (
            <span className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
              <Calendar size={12} aria-hidden="true" />
              {delivery}
            </span>
          )}
          <div className="flex items-center flex-col gap-0.5">
            <span className="flex items-center text-sm font-bold text-[var(--color-text)]">
              <IndianRupee size={12} aria-hidden="true" />
              {formatPaise(order.totalPaise)}
            </span>
            {order.balancePaise > 0 && (
              <span className="text-xs font-medium text-[var(--color-warning-700)] bg-[var(--color-warning-50)] rounded px-1.5 py-0.5">
                {t.coBalPrefix} ₹{formatPaise(order.balancePaise)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Button>
  )
}
