/** Invoice Detail — Items tab panel
 *
 * Renders each line item as a card showing product name, quantity,
 * rate, discount, and line total.
 */

import { FileText } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLanguage } from '@/hooks/useLanguage'
import { formatInvoiceAmount } from '../invoice-format.utils'
import type { DocumentLineItem } from '../invoice.types'

interface InvoiceItemsPanelProps {
  lineItems: DocumentLineItem[]
}

export function InvoiceItemsPanel({ lineItems }: InvoiceItemsPanelProps) {
  const { t } = useLanguage()
  if (lineItems.length === 0) {
    return (
      <div className="invoice-items-tab">
        <EmptyState
          icon={<FileText size={32} aria-hidden="true" />}
          title={t.noItemsTitle}
          description={t.noItemsDesc}
        />
      </div>
    )
  }

  return (
    <div className="invoice-items-tab">
      <div className="invoice-items-list" role="list" aria-label={t.lineItemsAriaLabel}>
        {lineItems.map((item) => (
          <div key={item.id} className="card invoice-item-card" role="listitem">
            <div className="invoice-item-header">
              <span className="invoice-item-name">{item.product.name}</span>
              <span className="invoice-item-total">{formatInvoiceAmount(item.lineTotal)}</span>
            </div>
            <div className="invoice-item-meta">
              <span>{item.quantity} {item.product.unit} x {formatInvoiceAmount(item.rate)}</span>
              {item.discountAmount > 0 && (
                <span style={{ color: 'var(--color-error-600)' }}>
                  {t.discLabel} -{formatInvoiceAmount(item.discountAmount)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
