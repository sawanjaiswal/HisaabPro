/** Estimates list page — thin wrapper over DocumentListPage. */

import { DocumentListPage } from './DocumentListPage'
import { useLanguage } from '@/hooks/useLanguage'

export default function EstimatesPage() {
  const { t } = useLanguage()
  return (
    <DocumentListPage
      type="ESTIMATE"
      backTo="/sales"
      pageTitle={t.estimatesPageTitle ?? 'Estimates'}
    />
  )
}
