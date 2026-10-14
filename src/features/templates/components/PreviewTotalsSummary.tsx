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
    className="px-4 py-3"
    style={{
      display: 'flex',
      justifyContent: layout.summaryPosition === 'right' ? 'flex-end' : layout.summaryPosition === 'center' ? 'center' : 'stretch',
      borderTop: `1px solid ${borderColor}`,
    }}
    aria-hidden="true"
  >
    <div className="min-w-[180px]">
      <div className="flex justify-between mb-1 text-sm">
        <span className="text-muted-foreground">{t.subtotal}</span>
        <span className="text-foreground">{paise(SAMPLE_SUBTOTAL)}</span>
      </div>
      <div
        className="flex justify-between font-bold text-base pt-1.5 mt-1"
        style={{
          color: accentColor,
          borderTop: `1px solid ${borderColor}`,
        }}
      >
        <span>{t.grandTotal}</span>
        <span>{paise(SAMPLE_TOTAL)}</span>
      </div>
    </div>
  </div>
  )
}
