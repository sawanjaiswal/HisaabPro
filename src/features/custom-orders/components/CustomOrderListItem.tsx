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
    <Button variant="none"
      type="button"
      className="order-list-item"
      onClick={() => onClick(order.id)}
      aria-label={`${t.coOrderRowAria} ${formatOrderNumber(order.orderNumber, order.id)}: ${order.title}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
        width: '100%',
        textAlign: 'left',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--color-surface)',
        border: 'none',
        borderBottom: '1px solid var(--color-border)',
        cursor: 'pointer',
        minHeight: 44,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          {formatOrderNumber(order.orderNumber, order.id)}
        </span>
        <CustomOrderStatusPill status={order.status} />
      </div>

      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.3 }}>
        {order.title}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
          <User size={12} aria-hidden="true" />
          {order.partyName}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {delivery && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
              <Calendar size={12} aria-hidden="true" />
              {delivery}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 2 }}>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
              <IndianRupee size={12} aria-hidden="true" />
              {formatPaise(order.totalPaise)}
            </span>
            {order.balancePaise > 0 && (
              <span style={{
                fontSize: 'var(--fs-xs)',
                fontWeight: 500,
                color: 'var(--color-warning-700)',
                background: 'var(--color-warning-50)',
                borderRadius: 4,
                padding: '1px 5px',
              }}>
                {t.coBalPrefix} ₹{formatPaise(order.balancePaise)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Button>
  )
}
