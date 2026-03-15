/** Payment list — search + type pills + mode pills filter bar */

import React from 'react'
import { Search } from 'lucide-react'
import type { PaymentType, PaymentMode } from '../payment.types'
import { PAYMENT_TYPE_LABELS, PAYMENT_MODE_LABELS } from '../payment.constants'

interface PaymentFilterBarProps {
  search: string
  onSearchChange: (term: string) => void
  activeType: PaymentType | 'ALL'
  onTypeChange: (type: PaymentType | 'ALL') => void
  activeMode: PaymentMode | 'ALL'
  onModeChange: (mode: PaymentMode | 'ALL') => void
}

const PAYMENT_TYPES: PaymentType[] = ['PAYMENT_IN', 'PAYMENT_OUT']

const PAYMENT_MODES: PaymentMode[] = [
  'CASH',
  'UPI',
  'BANK_TRANSFER',
  'CHEQUE',
  'NEFT_RTGS_IMPS',
  'CREDIT_CARD',
  'OTHER',
]

export const PaymentFilterBar: React.FC<PaymentFilterBarProps> = ({
  search,
  onSearchChange,
  activeType,
  onTypeChange,
  activeMode,
  onModeChange,
}) => {
  return (
    <div className="payment-filter-bar">
      <div className="search-bar">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by party or reference..."
          aria-label="Search payments by party name or reference number"
        />
      </div>

      <div
        className="payment-filter-pills"
        role="group"
        aria-label="Filter by payment type"
      >
        <button
          className={`payment-filter-pill${activeType === 'ALL' ? ' payment-filter-pill--active' : ''}`}
          onClick={() => onTypeChange('ALL')}
          aria-pressed={activeType === 'ALL'}
          aria-label="Show all payment types"
        >
          All
        </button>
        {PAYMENT_TYPES.map((type) => (
          <button
            key={type}
            className={`payment-filter-pill${activeType === type ? ' payment-filter-pill--active' : ''}`}
            onClick={() => onTypeChange(type)}
            aria-pressed={activeType === type}
            aria-label={`Show ${PAYMENT_TYPE_LABELS[type]}`}
          >
            {PAYMENT_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <div
        className="payment-filter-pills"
        role="group"
        aria-label="Filter by payment mode"
      >
        <button
          className={`payment-filter-pill${activeMode === 'ALL' ? ' payment-filter-pill--active' : ''}`}
          onClick={() => onModeChange('ALL')}
          aria-pressed={activeMode === 'ALL'}
          aria-label="Show all payment modes"
        >
          All Modes
        </button>
        {PAYMENT_MODES.map((mode) => (
          <button
            key={mode}
            className={`payment-filter-pill${activeMode === mode ? ' payment-filter-pill--active' : ''}`}
            onClick={() => onModeChange(mode)}
            aria-pressed={activeMode === mode}
            aria-label={`Show ${PAYMENT_MODE_LABELS[mode]} payments`}
          >
            {PAYMENT_MODE_LABELS[mode]}
          </button>
        ))}
      </div>
    </div>
  )
}
