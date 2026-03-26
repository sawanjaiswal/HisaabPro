/** Payment Detail — Allocations tab sub-component
 *
 * Shows linked invoice allocations or an empty state
 * when the payment is recorded as an advance.
 */

import { Banknote } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLanguage } from '@/hooks/useLanguage'
import type { PaymentAllocation } from '../payment.types'

interface PaymentAllocationsTabProps {
  allocations: PaymentAllocation[]
}

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function formatAmount(paise: number): string {
  return INR.format(paise / 100)
}

export function PaymentAllocationsTab({ allocations }: PaymentAllocationsTabProps) {
  const { t } = useLanguage()
  if (allocations.length === 0) {
    return (
      <div className="payment-allocations-tab">
        <EmptyState
          icon={<Banknote size={32} aria-hidden="true" />}
          title={t.notLinkedToInvoice}
          description={t.advancePaymentDesc}
        />
      </div>
    )
  }

  return (
    <div className="payment-allocations-tab">
      <div className="payment-allocations-list" role="list" aria-label={t.invoiceAllocations}>
        {allocations.map((alloc) => (
          <div key={alloc.id} className="card payment-alloc-card" role="listitem">
            <div className="payment-alloc-header">
              <span className="payment-alloc-invoice">{alloc.invoiceNumber}</span>
              <span className="payment-alloc-amount">{formatAmount(alloc.amount)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
