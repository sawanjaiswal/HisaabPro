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

const ALL = 'ALL' as const
type Filter = CustomOrderStatus | typeof ALL

const PILL_LABELS: Record<Filter, string> = {
  ALL:           'All',
  RECEIVED:      'Received',
  IN_PRODUCTION: 'In Production',
  READY:         'Ready',
  DELIVERED:     'Delivered',
  INVOICED:      'Invoiced',
  CANCELLED:     'Cancelled',
}

export default function CustomOrdersListPage() {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState<Filter>(ALL)
  const [balanceOnly, setBalanceOnly] = useState(false)

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
      <Header title="Custom Orders" />

      <PageContainer>
        {/* Status filter pills */}
        <div
          role="group"
          aria-label="Filter orders by status"
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            overflowX: 'auto',
            paddingBottom: 'var(--space-2)',
            scrollbarWidth: 'none',
          }}
        >
          {([ALL, ...CUSTOM_ORDER_STATUSES] as Filter[]).map((f) => (
            <Button variant="none"
              key={f}
              type="button"
              onClick={() => setActiveFilter(f)}
              aria-pressed={activeFilter === f}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: 9999,
                border: `1px solid ${activeFilter === f ? 'var(--color-primary-600)' : 'var(--color-border)'}`,
                background: activeFilter === f ? 'var(--color-primary-600)' : 'var(--color-surface)',
                color: activeFilter === f ? '#fff' : 'var(--color-text)',
                fontSize: 'var(--fs-xs)',
                fontWeight: 500,
                cursor: 'pointer',
                minHeight: 36,
                whiteSpace: 'nowrap',
              }}
            >
              {PILL_LABELS[f]}
            </Button>
          ))}
        </div>

        {/* Balance-only toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)', cursor: 'pointer', minHeight: 36, paddingBottom: 'var(--space-2)' }}>
          <Input
            type="checkbox"
            checked={balanceOnly}
            onChange={(e) => setBalanceOnly(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          Balance pending only
        </label>

        {status === 'pending' && <CustomOrdersListSkeleton />}
        {status === 'error'   && <CustomOrdersErrorState onRetry={refetch} />}

        {status === 'success' && allItems.length === 0 && (
          <CustomOrdersEmptyState onCreateNew={goToNew} />
        )}

        {status === 'success' && allItems.length > 0 && (
          <div role="list" aria-label="Custom orders" style={{ display: 'flex', flexDirection: 'column' }}>
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
            style={{ width: '100%', marginTop: 'var(--space-3)', minHeight: 44 }}
          >
            {isFetchingNextPage ? 'Loading...' : 'Load more'}
          </Button>
        )}
      </PageContainer>

      <Button variant="none"
        type="button"
        className="fab"
        onClick={goToNew}
        aria-label="Create new order"
      >
        <Plus size={24} aria-hidden="true" />
      </Button>
    </AppShell>
  )
}
