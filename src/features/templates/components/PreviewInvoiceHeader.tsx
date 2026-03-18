/** Invoice preview — header block with business info + invoice metadata */

import React from 'react'
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
}) => (
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
        <div style={{ fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.2 }}>
          {SAMPLE_BUSINESS.name}
        </div>
        {fields.businessPhone && (
          <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '2px' }}>
            {SAMPLE_BUSINESS.phone}
          </div>
        )}
        {fields.businessAddress && (
          <div style={{ fontSize: '0.694rem', opacity: 0.75, marginTop: '2px', maxWidth: '160px' }}>
            {SAMPLE_BUSINESS.address}
          </div>
        )}
        {fields.udyamNumber && (
          <div style={{ fontSize: '0.694rem', opacity: 0.75, marginTop: '2px' }}>
            Udyam: {SAMPLE_BUSINESS.udyamNumber}
          </div>
        )}
      </div>

      <div style={{ textAlign: layout.headerStyle === 'side-by-side' ? 'right' : 'left' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Tax Invoice</div>
        {fields.invoiceNumber && (
          <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>{SAMPLE_INVOICE.number}</div>
        )}
        {fields.invoiceDate && (
          <div style={{ fontSize: '0.694rem', opacity: 0.75 }}>{SAMPLE_INVOICE.date}</div>
        )}
        {fields.dueDate && (
          <div style={{ fontSize: '0.694rem', opacity: 0.75 }}>Due: {SAMPLE_INVOICE.dueDate}</div>
        )}
      </div>
    </div>
  </div>
)
