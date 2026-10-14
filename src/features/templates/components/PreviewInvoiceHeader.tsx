/** Invoice preview — header block with business info + invoice metadata
 * GST Phase 2 PR 6: when isComposite=true, override label to "Bill of Supply".
 */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { TemplateFieldsConfig, TemplateLayoutConfig } from '../template.types'
import { SAMPLE_BUSINESS, SAMPLE_INVOICE } from './templatePreview.constants'

interface PreviewInvoiceHeaderProps {
  headerStyle: React.CSSProperties
  layout: TemplateLayoutConfig
  fields: TemplateFieldsConfig
  /** When true, override document type label to "Bill of Supply" */
  isComposite?: boolean
}

export const PreviewInvoiceHeader: React.FC<PreviewInvoiceHeaderProps> = ({
  headerStyle,
  layout,
  fields,
  isComposite = false,
}) => {
  const { t } = useLanguage()
  const documentTypeLabel = isComposite ? t.billOfSupplyTitle : t.taxInvoice
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
        <div className="font-bold text-base leading-tight">
          {SAMPLE_BUSINESS.name}
        </div>
        {fields.businessPhone && (
          <div className="text-xs opacity-85 mt-0.5">
            {SAMPLE_BUSINESS.phone}
          </div>
        )}
        {fields.businessAddress && (
          <div className="text-xs opacity-75 mt-0.5 max-w-[160px]">
            {SAMPLE_BUSINESS.address}
          </div>
        )}
        {fields.udyamNumber && (
          <div className="text-xs opacity-75 mt-0.5">
            {t.udyamPrefix}: {SAMPLE_BUSINESS.udyamNumber}
          </div>
        )}
      </div>

      <div style={{ textAlign: layout.headerStyle === 'side-by-side' ? 'right' : 'left' }}>
        <div className="font-bold text-base">{documentTypeLabel}</div>
        {fields.invoiceNumber && (
          <div className="text-xs opacity-85">{SAMPLE_INVOICE.number}</div>
        )}
        {fields.invoiceDate && (
          <div className="text-xs opacity-75">{SAMPLE_INVOICE.date}</div>
        )}
        {fields.dueDate && (
          <div className="text-xs opacity-75">{t.duePrefix}: {SAMPLE_INVOICE.dueDate}</div>
        )}
      </div>
    </div>
  </div>
  )
}
