import React from 'react'
import { Trash2, Gift, Pencil, Tag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'

interface LineItemActionIconsProps {
  index: number
  productName: string
  productId: string
  isFree: boolean
  canMarkFree: boolean
  hasActiveDiscount: boolean
  showDiscount: boolean
  onToggleDiscount: () => void
  onToggleFree: () => void
  onEditProduct?: (productId: string) => void
  onRemove: (index: number) => void
}

export const LineItemActionIcons: React.FC<LineItemActionIconsProps> = ({
  index,
  productName,
  productId,
  isFree,
  canMarkFree,
  hasActiveDiscount,
  showDiscount,
  onToggleDiscount,
  onToggleFree,
  onEditProduct,
  onRemove,
}) => {
  const { t } = useLanguage()

  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button
        variant="none"
        type="button"
        className={`p-1.5 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer border-0 ${
          hasActiveDiscount
            ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-800)]'
            : showDiscount
            ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-600)]'
            : 'text-[var(--color-gray-400)] hover:text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)]'
        }`}
        onClick={onToggleDiscount}
        aria-label={hasActiveDiscount ? 'Edit discount' : 'Add discount'}
        title={hasActiveDiscount ? 'Edit discount' : 'Add discount'}
      >
        <Tag size={15} aria-hidden="true" />
      </Button>

      {canMarkFree && (
        <Button
          variant="none"
          type="button"
          className={`p-1.5 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer border-0 ${
            isFree
              ? 'bg-[var(--color-success-100)] text-[var(--color-success-800)]'
              : 'text-[var(--color-gray-400)] hover:text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)]'
          }`}
          onClick={onToggleFree}
          aria-pressed={isFree}
          aria-label={isFree ? t.unmarkFreeItem : t.markFreeItem}
          title={isFree ? t.unmarkFreeItem : t.markFreeItem}
        >
          <Gift size={15} aria-hidden="true" />
        </Button>
      )}

      <Button
        variant="none"
        type="button"
        className="p-1.5 rounded-lg text-xs font-semibold flex items-center justify-center text-[var(--color-gray-400)] hover:text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] transition-colors cursor-pointer border-0"
        onClick={() => onEditProduct?.(productId)}
        aria-label="Edit product details"
        title="Edit product details"
      >
        <Pencil size={15} aria-hidden="true" />
      </Button>

      <Button
        variant="none"
        type="button"
        className="line-item-remove cursor-pointer text-[var(--color-gray-400)] hover:text-[var(--color-error-600)] hover:bg-[var(--color-error-50)] p-1.5 rounded-lg transition-colors border-0"
        onClick={() => onRemove(index)}
        aria-label={`${productName} ${t.removeFromLineItems}`}
        title={t.removeFromLineItems}
      >
        <Trash2 size={15} aria-hidden="true" />
      </Button>
    </div>
  )
}
