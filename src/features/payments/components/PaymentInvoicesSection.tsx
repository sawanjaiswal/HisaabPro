/** Payment Invoices Section — shared between Record & Edit pages
 *
 * Invoice allocation list with checkboxes, per-invoice amount inputs,
 * auto-allocate (FIFO) button, and unallocated summary.
 */

import { formatPaise } from '@/lib/format'
import { useLanguage } from '@/hooks/useLanguage'
import type { PaymentFormAllocation } from '../payment.types'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface PaymentInvoicesSectionProps {
  allocations: PaymentFormAllocation[]
  unallocatedAmount: number
  errors: Record<string, string>
  onToggle: (invoiceId: string) => void
  onAmountChange: (invoiceId: string, paise: number) => void
  onAutoAllocate: () => void
}

export function PaymentInvoicesSection({
  allocations,
  unallocatedAmount,
  errors,
  onToggle,
  onAmountChange,
  onAutoAllocate,
}: PaymentInvoicesSectionProps) {
  const { t } = useLanguage()
  const selectedCount = allocations.filter((a) => a.selected).length

  if (allocations.length === 0) {
    return (
      <div className="payment-form">
        <p className="payment-empty-text">
          {t.noUnpaidInvoices}
        </p>
      </div>
    )
  }

  return (
    <div className="payment-form">
      <div className="payment-invoices-header">
        <span className="payment-invoices-count">
          {selectedCount} {t.ofWord} {allocations.length} {t.invoicesSelected}
        </span>
        <Button variant="none"
          type="button"
          className="btn btn-outline btn-sm"
          onClick={onAutoAllocate}
          aria-label={t.autoAllocateOldest}
        >
          {t.autoFifo}
        </Button>
      </div>

      <div className="payment-invoices-list">
        {allocations.map((alloc) => (
          <div key={alloc.invoiceId} className="payment-invoice-row">
            <label className="payment-invoice-check">
              <Input
                type="checkbox"
                checked={alloc.selected}
                onChange={() => onToggle(alloc.invoiceId)}
                aria-label={`${t.linkInvoice} ${alloc.invoiceNumber}`}
              />
              <div className="payment-invoice-info">
                <span className="payment-invoice-number">{alloc.invoiceNumber}</span>
                <span className="payment-invoice-due">{t.dueColon} {formatPaise(alloc.invoiceDue)}</span>
              </div>
            </label>
            {alloc.selected && (
              <Input
                type="number"
                inputMode="decimal"
                className="input payment-alloc-amount"
                placeholder="0.00"
                value={alloc.amount > 0 ? (alloc.amount / 100).toFixed(2) : ''}
                onChange={(e) => {
                  const paise = Math.round(parseFloat(e.target.value || '0') * 100)
                  onAmountChange(alloc.invoiceId, paise)
                }}
                aria-label={`${t.amountFor} ${alloc.invoiceNumber}`}
              />
            )}
          </div>
        ))}
      </div>

      {errors.allocations && <span className="field-error" role="alert">{errors.allocations}</span>}

      <div className="payment-unallocated">
        {unallocatedAmount > 0
          ? `${formatPaise(unallocatedAmount)} ${t.advancePaymentNote}`
          : t.fullyAllocatedLabel}
      </div>
    </div>
  )
}
