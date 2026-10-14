/** CustomOrderAdvancesList — advance ledger inside the order detail */

import { Text } from '@/components/ui/Text'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatPaise } from '../custom-orders.utils'
import { useDeleteAdvance } from '../hooks/useDeleteAdvance'
import type { CustomOrderAdvance, CustomOrderStatus } from '../custom-orders.types'
import { useLanguage } from '@/context/LanguageContext'

interface CustomOrderAdvancesListProps {
  advances: CustomOrderAdvance[]
  orderId: string
  orderTitle: string
  orderStatus: CustomOrderStatus
  advancePaise: number
  balancePaise: number
  totalPaise: number
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
  const { t } = useLanguage()
  const METHOD_LABELS: Record<string, string> = {
    cash:   t.coMethodCash,
    upi:    t.coMethodUpi,
    bank:   t.coMethodBank,
    cheque: t.coMethodCheque,
    card:   t.coMethodCard,
    other:  t.coMethodOther,
  }
  const { mutate: doDelete, isPending } = useDeleteAdvance()

  return (
    <div className="flex flex-col gap-3">
      {advances.length === 0 ? (
        <Text className="text-secondary text-sm m-0">
          {t.coNoAdvances}
        </Text>
      ) : (
        <div className="flex flex-col gap-2">
          {advances.map((adv) => (
            <div
              key={adv.id}
              className="flex items-start justify-between gap-2 p-2 px-3 bg-[var(--color-surface-muted)] rounded-lg"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-sm text-[var(--color-text)]">
                  ₹{formatPaise(adv.amountPaise)}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {METHOD_LABELS[adv.method] ?? adv.method}
                  {adv.reference ? ` · ${adv.reference}` : ''}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {new Date(adv.receivedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {adv.notes && (
                  <span className="text-xs text-[var(--color-text-secondary)] italic">
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
                  aria-label={`${t.coRemoveAdvanceAria} ₹${formatPaise(adv.amountPaise)}`}
                  className="min-h-[44px] min-w-[44px] text-red-600"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {advances.length > 0 && (
        <div className="border-t border-[var(--color-border)] pt-2 flex flex-col gap-1 items-end">
          <div className="flex gap-3 text-sm text-[var(--color-text-secondary)]">
            <span>{t.coOrderTotal}</span>
            <span>₹{formatPaise(totalPaise)}</span>
          </div>
          <div className="flex gap-3 text-sm text-[var(--color-success-700)]">
            <span>{t.coAdvancePaid}</span>
            <span>-₹{formatPaise(advancePaise)}</span>
          </div>
          <div className={`flex gap-3 text-base font-bold ${balancePaise > 0 ? 'text-[var(--color-warning-700)]' : 'text-[var(--color-success-700)]'}`}>
            <span>{t.coBalanceDue}</span>
            <span>₹{formatPaise(balancePaise)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
