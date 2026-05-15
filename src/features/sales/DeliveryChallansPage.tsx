/** Delivery Challans list page — thin wrapper over DocumentListPage. */

import { DocumentListPage } from './DocumentListPage'
import { useLanguage } from '@/hooks/useLanguage'

export default function DeliveryChallansPage() {
  const { t } = useLanguage()
  return (
    <DocumentListPage
      type="DELIVERY_CHALLAN"
      backTo="/sales"
      pageTitle={t.deliveryChallanPageTitle ?? 'Delivery Challans'}
    />
  )
}
