/** Cash Register — Large-amount warning dialog (Rs 10L threshold) */

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatPaise } from '../cashRegister.utils'

interface Props {
  paise: number
  onConfirm: () => void
  onCancel: () => void
}

export function LargeAmountWarningDialog({ paise, onConfirm, onCancel }: Props) {
  return (
    <ConfirmDialog
      open
      onClose={onCancel}
      onConfirm={onConfirm}
      title={`Amount is ${formatPaise(paise)}. Confirm?`}
      description="This is higher than usual. Confirm to proceed."
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      isDanger={false}
    />
  )
}
