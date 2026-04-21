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
      style={{
        padding: 'var(--space-3) var(--space-4)',
        borderBottom: `1px solid ${borderColor}`,
        fontSize: 'var(--fs-xs)',
      }}
      aria-hidden="true"
    >
      <div style={{ fontWeight: 600, color: 'var(--color-gray-500)', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
        {t.billTo}
      </div>
      <div style={{ fontWeight: 600, color: 'var(--color-gray-800)' }}>{SAMPLE_PARTY.name}</div>
      {fields.customerPhone && (
        <div style={{ color: 'var(--color-gray-500)' }}>{SAMPLE_PARTY.phone}</div>
      )}
      <div style={{ color: 'var(--color-gray-500)' }}>{SAMPLE_PARTY.address}</div>
    </div>
  )
}
