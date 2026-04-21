/** Create Batch — New batch for a product */

import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { BatchForm } from './components/BatchForm'
import './batches.css'
import { useLanguage } from '@/hooks/useLanguage'

export default function CreateBatchPage() {
  const { t } = useLanguage()
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const backPath = productId
    ? ROUTES.BATCHES.replace(':productId', productId)
    : ROUTES.PRODUCTS

  const handleSuccess = () => {
    toast.success('Batch created')
    navigate(backPath)
  }

  if (!productId) return null

  return (
    <AppShell>
      <Header title={t.addBatch} backTo={backPath} />
      <PageContainer className="stagger-enter space-y-6">
        <BatchForm productId={productId} onSuccess={handleSuccess} />
      </PageContainer>
    </AppShell>
  )
}
