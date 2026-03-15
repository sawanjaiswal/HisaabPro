/** Payment terms pill selector */

import React from 'react'
import type { PaymentTerms } from '../invoice.types'
import { PAYMENT_TERMS_LABELS } from '../invoice.constants'

interface PaymentTermsSelectorProps {
  value: PaymentTerms
  onChange: (terms: PaymentTerms) => void
}

/** Display order: most common terms first */
const PAYMENT_TERMS_OPTIONS: PaymentTerms[] = [
  'COD',
  'NET_7',
  'NET_15',
  'NET_30',
  'NET_60',
  'NET_90',
]

/** Abbreviated labels for compact pills */
const PAYMENT_TERMS_SHORT_LABELS: Record<PaymentTerms, string> = {
  COD:    'COD',
  NET_7:  '7 Days',
  NET_15: '15 Days',
  NET_30: '30 Days',
  NET_60: '60 Days',
  NET_90: '90 Days',
  CUSTOM: 'Custom',
}

export const PaymentTermsSelector: React.FC<PaymentTermsSelectorProps> = ({
  value,
  onChange,
}) => {
  return (
    <div
      className="pill-tabs"
      role="group"
      aria-label="Select payment terms"
    >
      {PAYMENT_TERMS_OPTIONS.map((terms) => (
        <button
          key={terms}
          type="button"
          className={`pill-tab${value === terms ? ' active' : ''}`}
          onClick={() => onChange(terms)}
          aria-pressed={value === terms}
          aria-label={`Set payment terms to ${PAYMENT_TERMS_LABELS[terms]}`}
        >
          {PAYMENT_TERMS_SHORT_LABELS[terms]}
        </button>
      ))}
    </div>
  )
}
