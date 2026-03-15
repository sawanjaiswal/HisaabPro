/** Create Invoice — single editable line item row */

import React, { useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import type { LineItemFormData, DiscountType } from '../invoice.types'
import {
  formatInvoiceAmount,
  calculateLineTotal,
  paiseToRupees,
  rupeesToPaise,
} from '../invoice.utils'
import { DISCOUNT_TYPE_LABELS } from '../invoice.constants'

interface LineItemEditorProps {
  /** Enriched item with pre-calculated fields from the hook */
  item: LineItemFormData & {
    productName: string
    discountAmount: number
    lineTotal: number
    profit: number
    profitPercent: number
  }
  index: number
  onUpdate: (index: number, updates: Partial<LineItemFormData>) => void
  onRemove: (index: number) => void
  showProfit: boolean
}

const DISCOUNT_TYPES: DiscountType[] = ['AMOUNT', 'PERCENTAGE']

export const LineItemEditor: React.FC<LineItemEditorProps> = ({
  item,
  index,
  onUpdate,
  onRemove,
  showProfit,
}) => {
  const handleQuantityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const qty = parseFloat(e.target.value)
      if (!isNaN(qty) && qty >= 0.001) {
        onUpdate(index, { quantity: qty })
      }
    },
    [index, onUpdate],
  )

  const handleRateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rupees = parseFloat(e.target.value)
      if (!isNaN(rupees) && rupees >= 0) {
        onUpdate(index, { rate: rupeesToPaise(rupees) })
      }
    },
    [index, onUpdate],
  )

  const handleDiscountValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value)
      if (!isNaN(val) && val >= 0) {
        const discountValue =
          item.discountType === 'AMOUNT' ? rupeesToPaise(val) : val
        onUpdate(index, { discountValue })
      }
    },
    [index, item.discountType, onUpdate],
  )

  const handleDiscountTypeToggle = useCallback(
    (type: DiscountType) => {
      onUpdate(index, { discountType: type, discountValue: 0 })
    },
    [index, onUpdate],
  )

  const { lineTotal: recalcLineTotal } = calculateLineTotal(
    item.quantity,
    item.rate,
    item.discountType,
    item.discountValue,
  )

  const displayDiscount =
    item.discountType === 'AMOUNT'
      ? paiseToRupees(item.discountValue)
      : item.discountValue

  const isProfit = item.profit >= 0
  const profitClass = isProfit
    ? 'line-item-profit line-item-profit-positive'
    : 'line-item-profit line-item-profit-negative'

  return (
    <div className="line-item-row" aria-label={`Line item ${index + 1}: ${item.productName}`}>
      <div className="line-item-header">
        <span className="line-item-product-name">{item.productName}</span>
        <button
          type="button"
          className="line-item-remove"
          onClick={() => onRemove(index)}
          aria-label={`Remove ${item.productName} from line items`}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="line-item-fields">
        <div className="line-item-field">
          <label
            className="line-item-field-label"
            htmlFor={`line-qty-${index}`}
          >
            Qty
          </label>
          <input
            id={`line-qty-${index}`}
            type="number"
            className="input"
            value={item.quantity}
            min={0.001}
            step={0.001}
            onChange={handleQuantityChange}
            aria-label={`Quantity for ${item.productName}`}
            style={{ minHeight: '44px' }}
          />
        </div>

        <div className="line-item-field">
          <label
            className="line-item-field-label"
            htmlFor={`line-rate-${index}`}
          >
            Rate (Rs)
          </label>
          <input
            id={`line-rate-${index}`}
            type="number"
            className="input"
            value={paiseToRupees(item.rate)}
            min={0}
            step={0.01}
            onChange={handleRateChange}
            aria-label={`Rate in rupees for ${item.productName}`}
            style={{ minHeight: '44px' }}
          />
        </div>

        <div className="line-item-field">
          <label
            className="line-item-field-label"
            htmlFor={`line-discount-${index}`}
          >
            Discount
          </label>
          <div className="discount-toggle">
            <div className="discount-toggle" role="group" aria-label={`Discount type for ${item.productName}`}>
              {DISCOUNT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`discount-toggle-btn${item.discountType === type ? ' active' : ''}`}
                  onClick={() => handleDiscountTypeToggle(type)}
                  aria-pressed={item.discountType === type}
                  aria-label={`Set discount as ${type === 'AMOUNT' ? 'amount in rupees' : 'percentage'}`}
                >
                  {DISCOUNT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
            <input
              id={`line-discount-${index}`}
              type="number"
              className="input"
              value={displayDiscount}
              min={0}
              max={item.discountType === 'PERCENTAGE' ? 100 : undefined}
              step={item.discountType === 'PERCENTAGE' ? 0.01 : 0.01}
              onChange={handleDiscountValueChange}
              aria-label={`Discount ${item.discountType === 'AMOUNT' ? 'amount in rupees' : 'percentage'} for ${item.productName}`}
              style={{ minHeight: '44px' }}
            />
          </div>
        </div>
      </div>

      <div className="line-item-total">
        <span className="line-item-total-label">Line Total</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {showProfit && (
            <span className={profitClass}>
              {isProfit ? '+' : ''}{item.profitPercent.toFixed(1)}%
            </span>
          )}
          <span className="line-item-total-amount">
            {formatInvoiceAmount(recalcLineTotal)}
          </span>
        </div>
      </div>
    </div>
  )
}
