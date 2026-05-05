/** CustomOrderConvertButton — converts a READY/DELIVERED order to a SALE_INVOICE */

import { FileText } from 'lucide-react'
import { useConvertOrderToInvoice } from '../hooks/useConvertOrderToInvoice'

interface CustomOrderConvertButtonProps {
  orderId: string
  orderTitle: string
  isOnline: boolean
}

export function CustomOrderConvertButton({ orderId, orderTitle, isOnline }: CustomOrderConvertButtonProps) {
  const { mutate, isPending } = useConvertOrderToInvoice()

  const handleClick = () => {
    if (!isOnline) return
    mutate({ id: orderId, title: orderTitle })
  }

  return (
    <button
      type="button"
      className="btn btn-primary btn-md"
      onClick={handleClick}
      disabled={isPending || !isOnline}
      title={!isOnline ? 'Connect to internet to create invoice' : undefined}
      aria-label="Convert order to invoice"
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: 44 }}
    >
      <FileText size={16} aria-hidden="true" />
      {isPending ? 'Creating invoice...' : 'Create Invoice'}
    </button>
  )
}
