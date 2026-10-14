/** CustomOrdersListPage — /orders: list with status filter pills + 4 UI states */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { useCustomOrders } from '../hooks/useCustomOrders'
import { CustomOrderListItem } from '../components/CustomOrderListItem'
import { CustomOrdersListSkeleton } from '../components/CustomOrdersListSkeleton'
import { CustomOrdersEmptyState } from '../components/CustomOrdersEmptyState'
import { CustomOrdersErrorState } from '../components/CustomOrdersErrorState'
import { CUSTOM_ORDER_STATUSES, ORDER_ROUTES } from '../custom-orders.constants'
import type { CustomOrderStatus } from '../custom-orders.types'
import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/context/LanguageContext'

const ALL = 'ALL' as const
type Filter = CustomOrderStatus | typeof ALL

export default function CustomOrdersListPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [activeFilter, setActiveFilter] = useState<Filter>(ALL)
  const [balanceOnly, setBalanceOnly] = useState(false)

  const PILL_LABELS: Record<Filter, string> = {
    ALL:           t.all,
    RECEIVED:      t.coStatusReceived,
    IN_PRODUCTION: t.coStatusInProduction,
    READY:         t.coStatusReady,
    DELIVERED:     t.coStatusDelivered,
    INVOICED:      t.coStatusInvoiced,
    CANCELLED:     t.coStatusCancelled,
  }

  const { data, status, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useCustomOrders(
    {
      ...(activeFilter !== ALL ? { status: activeFilter } : {}),
      ...(balanceOnly ? { hasBalance: true } : {}),
    },
  )

  const allItems = data?.pages.flatMap((p) => p.items) ?? []
  const goToNew = () => navigate(ORDER_ROUTES.NEW)

  return (
    <AppShell>
      <Header
        title={t.coTitle}
        actions={
          <Button variant="ghost" size="sm" onClick={goToNew} aria-label={t.coCreateNewAria}>
            <Plus size={20} aria-hidden="true" />
          </Button>
        }
      />

      <PageContainer>
        {/* Status filter pills */}
        <div
          role="group"
          aria-label={t.coFilterByStatus}
          className="flex gap-2 overflow-x-auto pb-2 scrollbar-none"
        >
          {([ALL, ...CUSTOM_ORDER_STATUSES] as Filter[]).map((f) => (
            <Button
              key={f}
              type="button"
              variant={activeFilter === f ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter(f)}
              aria-pressed={activeFilter === f}
              className="flex-shrink-0 rounded-full text-xs font-medium min-h-[36px] whitespace-nowrap px-3.5 py-1.5"
            >
              {PILL_LABELS[f]}
            </Button>
          ))}
        </div>

        {/* Balance-only toggle */}
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer min-h-[36px] pb-2">
          <Input
            type="checkbox"
            checked={balanceOnly}
            onChange={(e) => setBalanceOnly(e.target.checked)}
            className="w-4 h-4"
          />
          {t.coBalancePendingOnly}
        </label>

        {status === 'pending' && <CustomOrdersListSkeleton />}
        {status === 'error'   && <CustomOrdersErrorState onRetry={refetch} />}

        {status === 'success' && allItems.length === 0 && (
          <CustomOrdersEmptyState onCreateNew={goToNew} />
        )}

        {status === 'success' && allItems.length > 0 && (
          <div role="list" aria-label={t.coListAria} className="flex flex-col">
            {allItems.map((order) => (
              <div key={order.id} role="listitem">
                <CustomOrderListItem order={order} onClick={(id) => navigate(ORDER_ROUTES.DETAIL(id))} />
              </div>
            ))}
          </div>
        )}

        {hasNextPage && (
          <Button
            type="button"
            variant="ghost" size="sm"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full mt-3 min-h-[44px]"
          >
            {isFetchingNextPage ? t.coLoadingMore : t.coLoadMore}
          </Button>
        )}
      </PageContainer>

    </AppShell>
  )
}
