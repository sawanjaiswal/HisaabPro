/** Estimates list page — thin wrapper over DocumentListPage. */

import { DocumentListPage } from './DocumentListPage'
import { useLanguage } from '@/hooks/useLanguage'

interface EstimatesPageProps {
  embedded?: boolean
}

export default function EstimatesPage({ embedded = false }: EstimatesPageProps) {
  const { t } = useLanguage()
  return (
    <DocumentListPage
      type="ESTIMATE"
      backTo="/sales"
      pageTitle={t.estimatesPageTitle ?? 'Estimates'}
      embedded={embedded}
    />
  )
}
