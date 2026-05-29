/** JobConvertButton — converts a COMPLETED job to a SALE_INVOICE */

import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useConvertJobToInvoice } from '../hooks/useConvertJobToInvoice'

interface JobConvertButtonProps {
  jobId: string
  jobTitle: string
  isOnline: boolean
}

export function JobConvertButton({ jobId, jobTitle, isOnline }: JobConvertButtonProps) {
  const { mutate, isPending } = useConvertJobToInvoice()

  const handleClick = () => {
    if (!isOnline) return
    mutate({ id: jobId, title: jobTitle })
  }

  return (
    <Button
      type="button"
      variant="primary" size="md"
      onClick={handleClick}
      disabled={isPending || !isOnline}
      title={!isOnline ? 'Connect to internet to create invoice' : undefined}
      aria-label="Convert job to invoice"
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: 44 }}
    >
      <FileText size={16} aria-hidden="true" />
      {isPending ? 'Creating invoice...' : 'Create Invoice'}
    </Button>
  )
}
