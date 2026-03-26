/** Payment terms pill selector */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
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

export const PaymentTermsSelector: React.FC<PaymentTermsSelectorProps> = ({
  value,
  onChange,
}) => {
  const { t } = useLanguage()

  const PAYMENT_TERMS_SHORT_LABELS: Record<PaymentTerms, string> = {
    COD:    t.codLabel,
    NET_7:  t.days7Label,
    NET_15: t.days15Label,
    NET_30: t.days30Label,
    NET_60: t.days60Label,
    NET_90: t.days90Label,
    CUSTOM: t.customLabel,
  }

  return (
    <div
      className="pill-tabs"
      role="group"
      aria-label={t.selectPaymentTerms}
    >
      {PAYMENT_TERMS_OPTIONS.map((terms) => (
        <button
          key={terms}
          type="button"
          className={`pill-tab${value === terms ? ' active' : ''}`}
          onClick={() => onChange(terms)}
          aria-pressed={value === terms}
          aria-label={`${t.selectPaymentTerms}: ${PAYMENT_TERMS_LABELS[terms]}`}
        >
          {PAYMENT_TERMS_SHORT_LABELS[terms]}
        </button>
      ))}
    </div>
  )
}
