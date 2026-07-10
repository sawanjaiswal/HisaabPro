/** Sale Orders list page — thin wrapper over DocumentListPage. */

import { DocumentListPage } from './DocumentListPage'
import { useLanguage } from '@/hooks/useLanguage'

interface SaleOrdersPageProps {
  embedded?: boolean
}

export default function SaleOrdersPage({ embedded = false }: SaleOrdersPageProps) {
  const { t } = useLanguage()
  return (
    <DocumentListPage
      type="SALE_ORDER"
      backTo="/sales"
      pageTitle={t.saleOrdersPageTitle ?? 'Sale Orders'}
      embedded={embedded}
    />
  )
}
