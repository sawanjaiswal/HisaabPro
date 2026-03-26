/** Payment list — search + type pills + mode pills filter bar */

import React from 'react'
import { Search } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
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
  const { t } = useLanguage()
  return (
    <div className="payment-filter-bar">
      <div className="search-bar">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t.searchByPartyOrRef}
          aria-label={t.searchPayments}
        />
      </div>

      <div
        className="pill-tabs"
        role="group"
        aria-label={t.filterByType}
      >
        <button
          className={`pill-tab${activeType === 'ALL' ? ' active-tint' : ''}`}
          onClick={() => onTypeChange('ALL')}
          aria-pressed={activeType === 'ALL'}
        >
          {t.all}
        </button>
        {PAYMENT_TYPES.map((type) => (
          <button
            key={type}
            className={`pill-tab${activeType === type ? ' active-tint' : ''}`}
            onClick={() => onTypeChange(type)}
            aria-pressed={activeType === type}
          >
            {PAYMENT_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <div
        className="pill-tabs"
        role="group"
        aria-label={t.filterByMode}
      >
        <button
          className={`pill-tab${activeMode === 'ALL' ? ' active-tint' : ''}`}
          onClick={() => onModeChange('ALL')}
          aria-pressed={activeMode === 'ALL'}
        >
          {t.allModes}
        </button>
        {PAYMENT_MODES.map((mode) => (
          <button
            key={mode}
            className={`pill-tab${activeMode === mode ? ' active-tint' : ''}`}
            onClick={() => onModeChange(mode)}
            aria-pressed={activeMode === mode}
          >
            {PAYMENT_MODE_LABELS[mode]}
          </button>
        ))}
      </div>
    </div>
  )
}
