/** Live invoice mock-up — renders a simplified invoice preview using the template config */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { TemplateConfig, PrintSettings } from '../template.types'
import { getVisibleColumns } from '../template.utils'
import { PreviewInvoiceHeader } from './PreviewInvoiceHeader'
import { PreviewBillTo } from './PreviewBillTo'
import { PreviewLineItems } from './PreviewLineItems'
import { PreviewTotalsSummary } from './PreviewTotalsSummary'
import { PreviewPaymentStamp } from './PreviewPaymentStamp'
import { PreviewCopyLabel } from './PreviewCopyLabel'
import { SAMPLE_ITEMS } from './templatePreview.constants'

interface TemplatePreviewPanelProps {
  config: TemplateConfig
  printSettings?: PrintSettings
}

export const TemplatePreviewPanel: React.FC<TemplatePreviewPanelProps> = ({ config, printSettings }) => {
  const { t } = useLanguage()
  const { colors, typography, layout, fields } = config
  const visibleColumns = getVisibleColumns(config.columns)

  const borderColor = colors.tableBorderColor

  const headerStyle: React.CSSProperties = {
    backgroundColor: colors.headerBg,
    color: colors.headerText,
    padding: 'var(--space-4)',
  }

  const fontSizeMap = { xs: '0.625rem', small: '0.75rem', medium: '0.875rem', large: '1rem', xl: '1.125rem' } as const
  const thSizeMap = { xs: '0.5625rem', small: '0.6875rem', medium: '0.8125rem', large: '0.9375rem', xl: '1rem' } as const
  const lineHeightMap = { compact: 1.3, normal: 1.5, relaxed: 1.7 } as const
  const bodyFontSize = fontSizeMap[typography.fontSize]
  const thFontSize = thSizeMap[typography.fontSize]
  const lineHeight = lineHeightMap[typography.lineHeight]

  const totalQty = fields.totalQuantity
    ? SAMPLE_ITEMS.reduce((sum, item) => sum + item.qty, 0)
    : 0

  const cellStyle: React.CSSProperties = {
    padding: '6px var(--space-2)',
    borderBottom: `1px solid ${borderColor}`,
    fontSize: bodyFontSize,
    lineHeight,
  }

  const thStyle: React.CSSProperties = {
    ...cellStyle,
    backgroundColor: colors.tableHeaderBg,
    color: colors.tableHeaderText,
    fontWeight: 700,
    fontSize: thFontSize,
    padding: '8px var(--space-2)',
  }

  return (
    <div
      className="template-preview-panel"
      aria-label={t.invoicePreview}
      role="region"
    >
      <div className="template-preview-container">
        <div className="template-preview-invoice" style={{ position: 'relative', overflow: 'hidden' }}>

          {/* Payment status stamp overlay */}
          {fields.paymentStatusStamp && printSettings?.stampStyle !== 'none' && (
            <PreviewPaymentStamp
              status="PAID"
              style={printSettings?.stampStyle ?? 'badge'}
            />
          )}

          {/* Copy label */}
          {fields.copyLabel && printSettings?.copyLabels && (
            <PreviewCopyLabel label={printSettings.copyLabelNames?.[0] ?? 'ORIGINAL'} />
          )}

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

          {/* Total quantity row */}
          {fields.totalQuantity && totalQty > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: '6px var(--space-4)',
                fontSize: bodyFontSize,
                fontWeight: 600,
                color: 'var(--color-gray-600)',
                borderBottom: `1px solid ${borderColor}`,
              }}
              aria-hidden="true"
            >
              {t.totalQtyPrefix}: {totalQty}
            </div>
          )}

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
