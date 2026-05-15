/** Sale Orders list page — thin wrapper over DocumentListPage. */

import { DocumentListPage } from './DocumentListPage'
import { useLanguage } from '@/hooks/useLanguage'

export default function SaleOrdersPage() {
  const { t } = useLanguage()
  return (
    <DocumentListPage
      type="SALE_ORDER"
      backTo="/sales"
      pageTitle={t.saleOrdersPageTitle ?? 'Sale Orders'}
    />
  )
}
