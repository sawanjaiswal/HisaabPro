/** Payment Invoices Section — shared between Record & Edit pages
 *
 * Invoice allocation list with checkboxes, per-invoice amount inputs,
 * auto-allocate (FIFO) button, and unallocated summary.
 */

import { formatCurrency } from '@/lib/format'
import type { PaymentFormAllocation } from '../payment.types'

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
  const selectedCount = allocations.filter((a) => a.selected).length

  if (allocations.length === 0) {
    return (
      <div className="payment-form">
        <p className="payment-empty-text">
          No unpaid invoices for this party. This payment will be recorded as advance.
        </p>
      </div>
    )
  }

  return (
    <div className="payment-form">
      <div className="payment-invoices-header">
        <span className="payment-invoices-count">
          {selectedCount} of {allocations.length} invoices selected
        </span>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={onAutoAllocate}
          aria-label="Auto-allocate oldest first"
        >
          Auto (FIFO)
        </button>
      </div>

      <div className="payment-invoices-list">
        {allocations.map((alloc) => (
          <div key={alloc.invoiceId} className="payment-invoice-row">
            <label className="payment-invoice-check">
              <input
                type="checkbox"
                checked={alloc.selected}
                onChange={() => onToggle(alloc.invoiceId)}
                aria-label={`Link ${alloc.invoiceNumber}`}
              />
              <div className="payment-invoice-info">
                <span className="payment-invoice-number">{alloc.invoiceNumber}</span>
                <span className="payment-invoice-due">Due: {formatCurrency(alloc.invoiceDue)}</span>
              </div>
            </label>
            {alloc.selected && (
              <input
                type="number"
                inputMode="decimal"
                className="input payment-alloc-amount"
                placeholder="0.00"
                value={alloc.amount > 0 ? (alloc.amount / 100).toFixed(2) : ''}
                onChange={(e) => {
                  const paise = Math.round(parseFloat(e.target.value || '0') * 100)
                  onAmountChange(alloc.invoiceId, paise)
                }}
                aria-label={`Amount for ${alloc.invoiceNumber}`}
              />
            )}
          </div>
        ))}
      </div>

      {errors.allocations && <span className="field-error" role="alert">{errors.allocations}</span>}

      <div className="payment-unallocated">
        {unallocatedAmount > 0
          ? `${formatCurrency(unallocatedAmount)} will be recorded as advance payment`
          : 'Fully allocated'}
      </div>
    </div>
  )
}
