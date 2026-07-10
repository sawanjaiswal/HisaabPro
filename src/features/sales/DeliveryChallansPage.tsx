/** Delivery Challans list page — thin wrapper over DocumentListPage. */

import { DocumentListPage } from './DocumentListPage'
import { useLanguage } from '@/hooks/useLanguage'

interface DeliveryChallansPageProps {
  embedded?: boolean
}

export default function DeliveryChallansPage({ embedded = false }: DeliveryChallansPageProps) {
  const { t } = useLanguage()
  return (
    <DocumentListPage
      type="DELIVERY_CHALLAN"
      backTo="/sales"
      pageTitle={t.deliveryChallanPageTitle ?? 'Delivery Challans'}
      embedded={embedded}
    />
  )
}
