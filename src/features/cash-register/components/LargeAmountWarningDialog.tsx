/** Cash Register — Large-amount warning dialog (Rs 10L threshold) */

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatPaise } from '../cashRegister.utils'
import { useLanguage } from '@/hooks/useLanguage'

interface Props {
  paise: number
  onConfirm: () => void
  onCancel: () => void
}

export function LargeAmountWarningDialog({ paise, onConfirm, onCancel }: Props) {
  const { t } = useLanguage()
  return (
    <ConfirmDialog
      open
      onClose={onCancel}
      onConfirm={onConfirm}
      title={`${t.cashRegLargeAmountPrefix} ${formatPaise(paise)}. ${t.cashRegConfirmQuestion}`}
      description={t.cashRegLargeAmountDescription}
      confirmLabel={t.confirm}
      cancelLabel={t.cancel}
      isDanger={false}
    />
  )
}
