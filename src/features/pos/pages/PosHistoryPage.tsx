/** POS — Sales history page */

import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { usePosHistory } from '../hooks/usePosHistory'
import '../pos-billing.css'
import { PosHistoryList } from '../components/history/PosHistoryList'
import { PosHistoryFiltersBar } from '../components/history/PosHistoryFilters'

export default function PosHistoryPage() {
  const navigate = useNavigate()
  const { t }    = useLanguage()
  const history  = usePosHistory()

  return (
    <AppShell>
      <div className="pos-page">
        <Header title={t.posSalesHistory ?? 'Sales History'} backTo={ROUTES.POS} />

        <div className="pos-history-page">
          <PosHistoryFiltersBar
            filters={history.filters}
            onDateRange={history.setDateRange}
            onStatus={history.setStatus}
            onPaymentMode={history.setPaymentMode}
            onReset={history.resetFilters}
          />

          <PosHistoryList
            sales={history.sales}
            isLoading={history.isLoading}
            isError={history.isError}
            isEmpty={history.isEmpty}
            hasMore={history.hasMore}
            isFetchingMore={history.isFetchingMore}
            totalCount={history.totalCount}
            fetchMore={history.fetchMore}
            onRetry={history.refetch}
            onSaleClick={(id) => navigate(ROUTES.POS_SALE_DETAIL.replace(':id', id))}
          />
        </div>
      </div>
    </AppShell>
  )
}
