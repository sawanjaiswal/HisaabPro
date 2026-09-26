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
    COD:    t.codLabel || 'COD',
    NET_7:  t.days7Label || '7 days',
    NET_15: t.days15Label || '15 days',
    NET_30: t.days30Label || '30 days',
    NET_60: t.days60Label || '60 days',
    NET_90: t.days90Label || '90 days',
    CUSTOM: t.customLabel || 'Custom',
  }

  return (
    <div
      className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1"
      role="group"
      aria-label={t.selectPaymentTerms}
    >
      {PAYMENT_TERMS_OPTIONS.map((terms) => {
        const active = value === terms
        return (
          <button
            key={terms}
            type="button"
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
              active
                ? 'bg-[#026F39] text-white border-[#026F39] shadow-xs'
                : 'bg-[#F8F9FA] text-slate-700 border-gray-200/80 hover:bg-gray-100'
            }`}
            onClick={() => onChange(terms)}
            aria-pressed={active}
            aria-label={`${t.selectPaymentTerms}: ${PAYMENT_TERMS_LABELS[terms]}`}
          >
            {PAYMENT_TERMS_SHORT_LABELS[terms]}
          </button>
        )
      })}
    </div>
  )
}
