/** Invoice preview — Bill To customer address block */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { TemplateFieldsConfig } from '../template.types'
import { SAMPLE_PARTY } from './templatePreview.constants'

interface PreviewBillToProps {
  fields: TemplateFieldsConfig
  borderColor: string
}

export const PreviewBillTo: React.FC<PreviewBillToProps> = ({ fields, borderColor }) => {
  const { t } = useLanguage()
  if (!fields.customerAddress) return null

  return (
    <div
      className="px-4 py-3 text-xs"
      style={{ borderBottom: `1px solid ${borderColor}` }}
      aria-hidden="true"
    >
      <div className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
        {t.billTo}
      </div>
      <div className="font-semibold text-foreground">{SAMPLE_PARTY.name}</div>
      {fields.customerPhone && (
        <div className="text-muted-foreground">{SAMPLE_PARTY.phone}</div>
      )}
      <div className="text-muted-foreground">{SAMPLE_PARTY.address}</div>
    </div>
  )
}
