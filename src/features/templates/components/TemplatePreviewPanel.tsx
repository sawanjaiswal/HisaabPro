/** Live invoice mock-up — renders a simplified invoice preview using the template config */

import React from 'react'
import type { TemplateConfig } from '../template.types'
import { getVisibleColumns } from '../template.utils'

interface TemplatePreviewPanelProps {
  config: TemplateConfig
}

const SAMPLE_BUSINESS = {
  name: 'Sharma Traders',
  phone: '+91 98765 43210',
  address: '12 Main Market, Lajpat Nagar, New Delhi 110024',
}

const SAMPLE_PARTY = {
  name: 'Raju Enterprises',
  phone: '+91 99001 12345',
  address: '5 Industrial Area, Phase-II, Gurugram 122001',
}

const SAMPLE_INVOICE = {
  number: 'INV-0042',
  date: '15 Mar 2026',
  dueDate: '30 Mar 2026',
}

interface SampleLineItem {
  name: string
  qty: number
  unit: string
  rate: number
  amount: number
}

const SAMPLE_ITEMS: SampleLineItem[] = [
  { name: 'Basmati Rice (5 kg)', qty: 10, unit: 'Bag',  rate: 42000, amount: 420000 },
  { name: 'Toor Dal (1 kg)',     qty: 25, unit: 'Pkt',  rate:  9500, amount: 237500 },
  { name: 'Sunflower Oil (1 L)', qty: 15, unit: 'Btl',  rate: 14000, amount: 210000 },
]

const SAMPLE_SUBTOTAL  = 867500   // paise
const SAMPLE_TOTAL     = 867500   // paise (no GST in MVP)

function paise(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount / 100)
}

/** Column keys that map to the sample line item fields */
const COL_RENDER: Record<string, (item: SampleLineItem, idx: number) => React.ReactNode> = {
  serialNumber:   (_item, idx) => idx + 1,
  itemName:       (item)       => item.name,
  quantity:       (item)       => item.qty,
  unit:           (item)       => item.unit,
  rate:           (item)       => paise(item.rate),
  amount:         (item)       => paise(item.amount),
  hsn:            ()           => '—',
  discount:       ()           => '—',
  discountAmount: ()           => '—',
  taxRate:        ()           => '—',
  taxAmount:      ()           => '—',
  cessRate:       ()           => '—',
  cessAmount:     ()           => '—',
}

export const TemplatePreviewPanel: React.FC<TemplatePreviewPanelProps> = ({ config }) => {
  const { colors, typography, layout, fields } = config
  const visibleColumns = getVisibleColumns(config.columns)

  const headerStyle: React.CSSProperties = {
    backgroundColor: colors.headerBg,
    color: colors.headerText,
    padding: 'var(--space-4)',
  }

  const tableHeaderStyle: React.CSSProperties = {
    backgroundColor: colors.tableHeaderBg,
    color: colors.tableHeaderText,
  }

  const borderColor = colors.tableBorderColor
  const cellStyle: React.CSSProperties = {
    padding: '6px var(--space-2)',
    borderBottom: `1px solid ${borderColor}`,
    fontSize: typography.fontSize === 'small' ? '0.75rem' : typography.fontSize === 'large' ? '0.9375rem' : '0.833rem',
  }

  const thStyle: React.CSSProperties = {
    ...cellStyle,
    ...tableHeaderStyle,
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

          {/* Bill To block */}
          {fields.customerAddress && (
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderBottom: `1px solid ${borderColor}`,
                fontSize: '0.75rem',
              }}
              aria-hidden="true"
            >
              <div style={{ fontWeight: 600, color: 'var(--color-gray-500)', fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                Bill To
              </div>
              <div style={{ fontWeight: 600, color: 'var(--color-gray-800)' }}>{SAMPLE_PARTY.name}</div>
              {fields.customerPhone && (
                <div style={{ color: 'var(--color-gray-500)' }}>{SAMPLE_PARTY.phone}</div>
              )}
              <div style={{ color: 'var(--color-gray-500)' }}>{SAMPLE_PARTY.address}</div>
            </div>
          )}

          {/* Line items table */}
          <div style={{ overflowX: 'auto' }} aria-hidden="true">
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.833rem',
              }}
            >
              <thead>
                <tr>
                  {visibleColumns.map(({ key, label }) => (
                    <th key={key} style={thStyle}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SAMPLE_ITEMS.map((item, idx) => (
                  <tr
                    key={item.name}
                    style={
                      layout.itemTableStyle === 'striped' && idx % 2 === 1
                        ? { backgroundColor: 'var(--color-gray-50)' }
                        : undefined
                    }
                  >
                    {visibleColumns.map(({ key }) => (
                      <td key={key} style={cellStyle}>
                        {(COL_RENDER[key] ?? (() => '—'))(item, idx)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals summary */}
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
                <span style={{ color: 'var(--color-gray-500)' }}>Subtotal</span>
                <span style={{ color: 'var(--color-gray-700)' }}>{paise(SAMPLE_SUBTOTAL)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  fontSize: '0.9375rem',
                  color: colors.accent,
                  borderTop: `1px solid ${borderColor}`,
                  paddingTop: '6px',
                  marginTop: '4px',
                }}
              >
                <span>Grand Total</span>
                <span>{paise(SAMPLE_TOTAL)}</span>
              </div>
            </div>
          </div>

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
