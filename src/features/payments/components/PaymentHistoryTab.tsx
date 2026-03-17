/** Payment Detail — History tab sub-component
 *
 * Placeholder showing an empty state until edit history
 * tracking is implemented.
 */

import { Banknote } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'

export function PaymentHistoryTab() {
  return (
    <div className="payment-history-tab">
      <EmptyState
        icon={<Banknote size={32} aria-hidden="true" />}
        title="No edit history"
        description="Changes to this payment will appear here."
      />
    </div>
  )
}
