import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { SerialForm } from './components/SerialForm'
import './serial-numbers.css'

export default function CreateSerialPage() {
  const { t } = useLanguage()
  const { productId = '' } = useParams<{ productId: string }>()
  const navigate = useNavigate()

  const handleSuccess = () => {
    navigate(ROUTES.SERIAL_NUMBERS.replace(':productId', productId), { replace: true })
  }

  return (
    <AppShell>
      <Header title={t.addSerialNumber} backTo={ROUTES.SERIAL_NUMBERS.replace(':productId', productId)} />
      <PageContainer>
        <SerialForm productId={productId} onSuccess={handleSuccess} />
      </PageContainer>
    </AppShell>
  )
}
