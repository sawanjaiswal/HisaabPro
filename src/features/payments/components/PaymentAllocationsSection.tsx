/** Payment Details — linked invoices, with the amount applied to each.
 *
 * Mockup #42 lists the invoice numbers on one row; this section carries the
 * per-invoice split, which the numbers alone lose. Rendered only when the
 * payment touches more than one invoice — a single allocation adds nothing
 * over the amount + unallocated rows above it.
 */

import { FormSection } from '@/components/ui/FormSection'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import type { PaymentAllocation } from '../payment.types'

interface PaymentAllocationsSectionProps {
  allocations: PaymentAllocation[]
}

export function PaymentAllocationsSection({ allocations }: PaymentAllocationsSectionProps) {
  const { t } = useLanguage()
  if (allocations.length < 2) return null

  return (
    <FormSection title={t.invoiceAllocations}>
      <div className="payment-alloc-list" role="list">
        {allocations.map((alloc) => (
          <div key={alloc.id} className="payment-alloc-row" role="listitem">
            <span className="payment-alloc-invoice">{alloc.invoiceNumber}</span>
            <span className="payment-alloc-amount tabular-nums">{formatPaise(alloc.amount)}</span>
          </div>
        ))}
      </div>
    </FormSection>
  )
}
