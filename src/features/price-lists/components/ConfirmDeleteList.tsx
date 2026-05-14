/** ConfirmDeleteList — delete confirmation for price lists */

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useLanguage } from '@/hooks/useLanguage'
import type { PriceList } from '../price-list.types'

interface ConfirmDeleteListProps {
  priceList: PriceList | null
  isLoading: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDeleteList({
  priceList,
  isLoading,
  onConfirm,
  onClose,
}: ConfirmDeleteListProps) {
  const { t } = useLanguage()

  if (!priceList) return null

  return (
    <ConfirmDialog
      open={!!priceList}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.plDeleteTitle}
      description={`${t.plDeleteDesc} "${priceList.name}"?`}
      confirmLabel={t.delete}
      cancelLabel={t.cancel}
      isDanger
      isLoading={isLoading}
    />
  )
}
