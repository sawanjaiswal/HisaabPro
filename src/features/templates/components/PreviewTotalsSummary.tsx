/** Invoice preview — totals summary block (subtotal + grand total) */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { TemplateLayoutConfig } from '../template.types'
import { SAMPLE_SUBTOTAL, SAMPLE_TOTAL, paise } from './templatePreview.constants'

interface PreviewTotalsSummaryProps {
  layout: TemplateLayoutConfig
  borderColor: string
  accentColor: string
}

export const PreviewTotalsSummary: React.FC<PreviewTotalsSummaryProps> = ({
  layout,
  borderColor,
  accentColor,
}) => {
  const { t } = useLanguage()
  return (
  <div
    style={{
      display: 'flex',
      justifyContent: layout.summaryPosition === 'right' ? 'flex-end' : layout.summaryPosition === 'center' ? 'center' : 'stretch',
      padding: 'var(--space-3) var(--space-4)',
      borderTop: `1px solid ${borderColor}`,
    }}
    aria-hidden="true"
  >
    <div style={{ minWidth: '180px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.833rem' }}>
        <span style={{ color: 'var(--color-gray-500)' }}>{t.subtotal}</span>
        <span style={{ color: 'var(--color-gray-700)' }}>{paise(SAMPLE_SUBTOTAL)}</span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontWeight: 700,
          fontSize: '0.9375rem',
          color: accentColor,
          borderTop: `1px solid ${borderColor}`,
          paddingTop: '6px',
          marginTop: '4px',
        }}
      >
        <span>{t.grandTotal}</span>
        <span>{paise(SAMPLE_TOTAL)}</span>
      </div>
    </div>
  </div>
  )
}
