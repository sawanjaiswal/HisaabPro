/** CustomOrderEditPage — /orders/:id/edit */

import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useCustomOrder } from '../hooks/useCustomOrder'
import { useUpdateCustomOrder } from '../hooks/useUpdateCustomOrder'
import { CustomOrderForm } from '../components/CustomOrderForm'
import { ORDER_ROUTES } from '../custom-orders.constants'
import type { CreateCustomOrderInput } from '../api/custom-orders.api.types'

function EditSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }} aria-busy="true" aria-label="Loading order">
      {[200, 120, 80, 300].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8, width: `${w}px`, maxWidth: '100%' }} aria-hidden="true" />
      ))}
    </div>
  )
}

export default function CustomOrderEditPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: order, status, refetch } = useCustomOrder(id)
  const { mutate, isPending } = useUpdateCustomOrder()

  const handleSubmit = (data: CreateCustomOrderInput) => {
    if (!order) return
    mutate(
      { id, data, title: order.title },
      { onSuccess: () => navigate(ORDER_ROUTES.DETAIL(id)) },
    )
  }

  if (status === 'pending') return <AppShell><Header title="Edit Order" /><EditSkeleton /></AppShell>
  if (status === 'error' || !order) {
    return (
      <AppShell>
        <Header title="Edit Order" />
        <PageContainer>
          <ErrorState title="Could not load order" message="Check your connection and try again" onRetry={refetch} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title="Edit Order" />
      <PageContainer>
        <CustomOrderForm
          initialData={order}
          onSubmit={handleSubmit}
          isSubmitting={isPending}
          submitLabel="Save Changes"
        />
      </PageContainer>
    </AppShell>
  )
}
