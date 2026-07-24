/** CustomOrderConvertButton — converts a READY/DELIVERED order to a SALE_INVOICE */

import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useConvertOrderToInvoice } from '../hooks/useConvertOrderToInvoice'
import { useLanguage } from '@/context/LanguageContext'

interface CustomOrderConvertButtonProps {
  orderId: string
  orderTitle: string
  isOnline: boolean
}

export function CustomOrderConvertButton({ orderId, orderTitle, isOnline }: CustomOrderConvertButtonProps) {
  const { t } = useLanguage()
  const { mutate, isPending } = useConvertOrderToInvoice()

  const handleClick = () => {
    if (!isOnline) return
    mutate({ id: orderId, title: orderTitle })
  }

  return (
    <Button
      type="button"
      variant="primary" size="md"
      onClick={handleClick}
      disabled={isPending || !isOnline}
      title={!isOnline ? t.coConvertOffline : undefined}
      aria-label={t.coConvertAria}
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: 44 }}
    >
      <FileText size={16} aria-hidden="true" />
      {isPending ? t.coCreatingInvoice : t.coCreateInvoice}
    </Button>
  )
}
