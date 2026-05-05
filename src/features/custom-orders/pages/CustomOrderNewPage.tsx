/** CustomOrderNewPage — /orders/new */

import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { useCreateCustomOrder } from '../hooks/useCreateCustomOrder'
import { CustomOrderForm } from '../components/CustomOrderForm'
import { ORDER_ROUTES } from '../custom-orders.constants'
import type { CreateCustomOrderInput } from '../api/custom-orders.api.types'

export default function CustomOrderNewPage() {
  const navigate = useNavigate()
  const { mutate, isPending } = useCreateCustomOrder()

  const handleSubmit = (data: CreateCustomOrderInput) => {
    mutate(data, {
      onSuccess: (result) => {
        if (result?.id) {
          navigate(ORDER_ROUTES.DETAIL(result.id))
        } else {
          navigate(ORDER_ROUTES.LIST)
        }
      },
    })
  }

  return (
    <AppShell>
      <Header title="New Order" />
      <PageContainer>
        <CustomOrderForm
          onSubmit={handleSubmit}
          isSubmitting={isPending}
          submitLabel="Create Order"
        />
      </PageContainer>
    </AppShell>
  )
}
