/** Sales list empty state — variant per document type with i18n copy. */

import React from 'react'
import { Button } from '@/components/ui/Button'
import { FileText, Plus } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLanguage } from '@/hooks/useLanguage'
import type { SalesDocumentType } from '../sales.types'

interface DocumentEmptyStateProps {
  type: SalesDocumentType
  onCreateClick: () => void
}

export const DocumentEmptyState: React.FC<DocumentEmptyStateProps> = ({
  type,
  onCreateClick,
}) => {
  const { t } = useLanguage()

  const { title, description, ctaLabel } = (() => {
    switch (type) {
      case 'ESTIMATE':
        return {
          title:       t.noEstimatesYet ?? 'No estimates yet',
          description: t.noEstimatesDesc ?? 'Create your first estimate to share a quote with a customer.',
          ctaLabel:    t.newEstimate ?? 'New Estimate',
        }
      case 'SALE_ORDER':
        return {
          title:       t.noSaleOrdersYet ?? 'No sale orders yet',
          description: t.noSaleOrdersDesc ?? 'Convert an estimate or create one directly.',
          ctaLabel:    t.newSaleOrder ?? 'New Sale Order',
        }
      case 'DELIVERY_CHALLAN':
        return {
          title:       t.noDeliveryChallansYet ?? 'No delivery challans yet',
          description: t.noDeliveryChallansDesc ?? 'Create one from a sale order when goods are dispatched.',
          ctaLabel:    t.newDeliveryChallan ?? 'New Challan',
        }
    }
  })()

  return (
    <EmptyState
      icon={<FileText size={40} aria-hidden="true" />}
      title={title}
      description={description}
      action={
        <Button
          variant="primary" size="md"
          onClick={onCreateClick}
          aria-label={ctaLabel}
        >
          <Plus size={18} aria-hidden="true" />
          {ctaLabel}
        </Button>
      }
    />
  )
}
