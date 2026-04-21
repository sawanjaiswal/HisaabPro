/** Invoice preview — header block with business info + invoice metadata */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { TemplateFieldsConfig, TemplateLayoutConfig } from '../template.types'
import { SAMPLE_BUSINESS, SAMPLE_INVOICE } from './templatePreview.constants'

interface PreviewInvoiceHeaderProps {
  headerStyle: React.CSSProperties
  layout: TemplateLayoutConfig
  fields: TemplateFieldsConfig
}

export const PreviewInvoiceHeader: React.FC<PreviewInvoiceHeaderProps> = ({
  headerStyle,
  layout,
  fields,
}) => {
  const { t } = useLanguage()
  return (
  <div style={headerStyle} aria-hidden="true">
    <div
      style={{
        display: 'flex',
        justifyContent:
          layout.headerStyle === 'side-by-side' ? 'space-between' : 'flex-start',
        flexDirection: layout.headerStyle === 'stacked' ? 'column' : 'row',
        gap: 'var(--space-2)',
      }}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: 'var(--fs-base)', lineHeight: 1.2 }}>
          {SAMPLE_BUSINESS.name}
        </div>
        {fields.businessPhone && (
          <div style={{ fontSize: 'var(--fs-xs)', opacity: 0.85, marginTop: '2px' }}>
            {SAMPLE_BUSINESS.phone}
          </div>
        )}
        {fields.businessAddress && (
          <div style={{ fontSize: 'var(--fs-xs)', opacity: 0.75, marginTop: '2px', maxWidth: '160px' }}>
            {SAMPLE_BUSINESS.address}
          </div>
        )}
        {fields.udyamNumber && (
          <div style={{ fontSize: 'var(--fs-xs)', opacity: 0.75, marginTop: '2px' }}>
            {t.udyamPrefix}: {SAMPLE_BUSINESS.udyamNumber}
          </div>
        )}
      </div>

      <div style={{ textAlign: layout.headerStyle === 'side-by-side' ? 'right' : 'left' }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--fs-df)' }}>{t.taxInvoice}</div>
        {fields.invoiceNumber && (
          <div style={{ fontSize: 'var(--fs-xs)', opacity: 0.85 }}>{SAMPLE_INVOICE.number}</div>
        )}
        {fields.invoiceDate && (
          <div style={{ fontSize: 'var(--fs-xs)', opacity: 0.75 }}>{SAMPLE_INVOICE.date}</div>
        )}
        {fields.dueDate && (
          <div style={{ fontSize: '0.694rem', opacity: 0.75 }}>{t.duePrefix}: {SAMPLE_INVOICE.dueDate}</div>
        )}
      </div>
    </div>
  </div>
  )
}
