/** Payment Detail — History tab sub-component
 *
 * Placeholder showing an empty state until edit history
 * tracking is implemented.
 */

import { Banknote } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLanguage } from '@/hooks/useLanguage'

export function PaymentHistoryTab() {
  const { t } = useLanguage()
  return (
    <div className="payment-history-tab">
      <EmptyState
        icon={<Banknote size={32} aria-hidden="true" />}
        title={t.noEditHistory}
        description={t.editHistoryDesc}
      />
    </div>
  )
}
