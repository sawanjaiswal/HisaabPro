import React from 'react'
import { formatInvoiceAmount } from '../invoice-format.utils'
import { getAvatarColor } from '@/components/ui/PartyAvatar'

interface LineItemCardHeaderProps {
  productName: string
  sku?: string | null
  unitSymbol: string
  currentStock: number | null
  isFree: boolean
  freeItemBadge: string
  displayLineTotal: number
  hasActiveDiscount: boolean
}

export const LineItemCardHeader: React.FC<LineItemCardHeaderProps> = ({
  productName,
  sku,
  unitSymbol,
  currentStock,
  isFree,
  freeItemBadge,
  displayLineTotal,
  hasActiveDiscount,
}) => {
  const avatarBg = getAvatarColor(productName)

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Avatar Thumbnail */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm select-none border shadow-2xs"
          style={{
            backgroundColor: avatarBg,
            borderColor: 'rgba(0, 0, 0, 0.08)',
            color: '#0f172a',
          }}
        >
          {productName ? productName.charAt(0).toUpperCase() : 'P'}
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-sm sm:text-base text-[var(--color-text-primary)] leading-tight truncate">
              {productName}
            </span>
            {isFree && (
              <span className="px-2 py-0.5 rounded-full bg-[var(--color-success-50)] text-[var(--color-success-700)] text-[10px] font-bold shrink-0">
                {freeItemBadge}
              </span>
            )}
          </div>

          {sku && (
            <span className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
              {sku}
            </span>
          )}

          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={`text-[11px] font-medium ${
                currentStock !== null && currentStock <= 0
                  ? 'text-amber-600 dark:text-amber-400 font-semibold'
                  : 'text-[var(--color-text-secondary)]'
              }`}
            >
              Stock: {currentStock !== null ? `${currentStock.toFixed(1)} ${unitSymbol}` : `0.0 ${unitSymbol}`}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Line Total Amount */}
      <div className="text-right shrink-0">
        <div className="text-sm sm:text-base font-extrabold text-[var(--color-text-primary)] tabular-nums">
          {formatInvoiceAmount(displayLineTotal)}
        </div>
        {hasActiveDiscount && (
          <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            Discount applied
          </div>
        )}
      </div>
    </div>
  )
}
