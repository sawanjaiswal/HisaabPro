/** CustomOrderAdvancesList — advance ledger inside the order detail */

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatPaise } from '../custom-orders.utils'
import { useDeleteAdvance } from '../hooks/useDeleteAdvance'
import type { CustomOrderAdvance, CustomOrderStatus } from '../custom-orders.types'

interface CustomOrderAdvancesListProps {
  advances: CustomOrderAdvance[]
  orderId: string
  orderTitle: string
  orderStatus: CustomOrderStatus
  advancePaise: number
  balancePaise: number
  totalPaise: number
}

const METHOD_LABELS: Record<string, string> = {
  cash:   'Cash',
  upi:    'UPI',
  bank:   'Bank Transfer',
  cheque: 'Cheque',
  card:   'Card',
  other:  'Other',
}

const isFinal = (status: CustomOrderStatus) => status === 'INVOICED' || status === 'CANCELLED'

export function CustomOrderAdvancesList({
  advances,
  orderId,
  orderTitle,
  orderStatus,
  advancePaise,
  balancePaise,
  totalPaise,
}: CustomOrderAdvancesListProps) {
  const { mutate: doDelete, isPending } = useDeleteAdvance()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {advances.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-sm)', margin: 0 }}>
          No advances recorded yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {advances.map((adv) => (
            <div
              key={adv.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--color-surface-muted)',
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--color-text)' }}>
                  ₹{formatPaise(adv.amountPaise)}
                </span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                  {METHOD_LABELS[adv.method] ?? adv.method}
                  {adv.reference ? ` · ${adv.reference}` : ''}
                </span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                  {new Date(adv.receivedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {adv.notes && (
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                    {adv.notes}
                  </span>
                )}
              </div>
              {!isFinal(orderStatus) && !adv.paymentId && (
                <Button
                  type="button"
                  variant="ghost" size="sm"
                  onClick={() => doDelete({ orderId, advanceId: adv.id, title: orderTitle })}
                  disabled={isPending}
                  aria-label={`Remove advance of ₹${formatPaise(adv.amountPaise)}`}
                  style={{ minHeight: 44, minWidth: 44, color: 'var(--color-error-600)' }}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {advances.length > 0 && (
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
            <span>Order Total</span>
            <span>₹{formatPaise(totalPaise)}</span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--fs-sm)', color: 'var(--color-success-700)' }}>
            <span>Advance Paid</span>
            <span>-₹{formatPaise(advancePaise)}</span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--fs-md)', fontWeight: 700, color: balancePaise > 0 ? 'var(--color-warning-700)' : 'var(--color-success-700)' }}>
            <span>Balance Due</span>
            <span>₹{formatPaise(balancePaise)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
