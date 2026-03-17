/** Live invoice mock-up — renders a simplified invoice preview using the template config */

import React from 'react'
import type { TemplateConfig } from '../template.types'
import { getVisibleColumns } from '../template.utils'
import { PreviewInvoiceHeader } from './PreviewInvoiceHeader'
import { PreviewBillTo } from './PreviewBillTo'
import { PreviewLineItems } from './PreviewLineItems'
import { PreviewTotalsSummary } from './PreviewTotalsSummary'

interface TemplatePreviewPanelProps {
  config: TemplateConfig
}

export const TemplatePreviewPanel: React.FC<TemplatePreviewPanelProps> = ({ config }) => {
  const { colors, typography, layout, fields } = config
  const visibleColumns = getVisibleColumns(config.columns)

  const borderColor = colors.tableBorderColor

  const headerStyle: React.CSSProperties = {
    backgroundColor: colors.headerBg,
    color: colors.headerText,
    padding: 'var(--space-4)',
  }

  const cellStyle: React.CSSProperties = {
    padding: '6px var(--space-2)',
    borderBottom: `1px solid ${borderColor}`,
    fontSize: typography.fontSize === 'small' ? '0.75rem' : typography.fontSize === 'large' ? '0.9375rem' : '0.833rem',
  }

  const thStyle: React.CSSProperties = {
    ...cellStyle,
    backgroundColor: colors.tableHeaderBg,
    color: colors.tableHeaderText,
    fontWeight: 700,
    fontSize: typography.fontSize === 'small' ? '0.694rem' : '0.75rem',
    padding: '8px var(--space-2)',
  }

  return (
    <div
      className="template-preview-panel"
      aria-label="Invoice preview"
      role="region"
    >
      <div className="template-preview-container">
        <div className="template-preview-invoice">

          {/* Header text line (optional) */}
          {config.headerText && (
            <div
              style={{
                textAlign: 'center',
                fontSize: '0.75rem',
                padding: 'var(--space-2) var(--space-4)',
                color: colors.accent,
                borderBottom: `1px solid ${borderColor}`,
              }}
              aria-hidden="true"
            >
              {config.headerText}
            </div>
          )}

          {/* Invoice header block */}
          <PreviewInvoiceHeader
            headerStyle={headerStyle}
            layout={layout}
            fields={fields}
          />

          {/* Bill To block */}
          <PreviewBillTo fields={fields} borderColor={borderColor} />

          {/* Line items table */}
          <PreviewLineItems
            visibleColumns={visibleColumns}
            layout={layout}
            cellStyle={cellStyle}
            thStyle={thStyle}
          />

          {/* Totals summary */}
          <PreviewTotalsSummary
            layout={layout}
            borderColor={borderColor}
            accentColor={colors.accent}
          />

          {/* Footer text */}
          {config.footerText && (
            <div
              style={{
                textAlign: 'center',
                fontSize: '0.694rem',
                color: 'var(--color-gray-400)',
                padding: 'var(--space-2) var(--space-4) var(--space-3)',
                borderTop: `1px solid ${borderColor}`,
              }}
              aria-hidden="true"
            >
              {config.footerText}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
