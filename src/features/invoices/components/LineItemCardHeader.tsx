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
    <div className="line-item-card__header">
      <div className="line-item-card__header-left">
        {/* Avatar Thumbnail */}
        <div
          className="line-item-card__avatar"
          style={{ backgroundColor: avatarBg }}
        >
          {productName ? productName.charAt(0).toUpperCase() : 'P'}
        </div>

        <div className="line-item-card__header-details">
          <div className="line-item-card__title-row">
            <span className="line-item-card__title">
              {productName}
            </span>
            {isFree && (
              <span className="line-item-card__free-badge">
                {freeItemBadge}
              </span>
            )}
          </div>

          {sku && (
            <span className="line-item-card__sku">
              {sku}
            </span>
          )}

          <div className="line-item-card__stock-row">
            <span
              className={`line-item-card__stock ${
                currentStock !== null && currentStock <= 0
                  ? 'line-item-card__stock--low'
                  : ''
              }`}
            >
              Stock: {currentStock !== null ? `${currentStock.toFixed(1)} ${unitSymbol}` : `0.0 ${unitSymbol}`}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Line Total Amount */}
      <div className="line-item-card__header-right">
        <div className="line-item-card__total">
          {formatInvoiceAmount(displayLineTotal)}
        </div>
        {hasActiveDiscount && (
          <div className="line-item-card__discount-applied">
            Discount applied
          </div>
        )}
      </div>
    </div>
  )
}
