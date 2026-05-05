/** Invoice Template Preview — GST Tax Summary block
 *
 * Renders CGST/SGST (intra-state), IGST (inter-state), or a composition
 * scheme notice. Inserted between subtotal and grand total rows in the
 * template preview panel.
 *
 * Render guard:
 *   - template.fields.gstTaxSummary must be true
 *   - (totalCgst + totalSgst + totalIgst + totalCess) > 0  OR  compositionScheme
 *   - paperSize !== 'THERMAL_58MM'
 *
 * GST Phase 2 / PR 5
 */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { PageSize } from '../template-layout.types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaxRow {
  label: string
  amountPaise: number
}

export interface TaxSummaryBlockProps {
  /** Whether the template flag is enabled */
  enabled: boolean
  /** True for composition scheme dealers */
  compositionScheme: boolean
  /** True when supply crosses state lines (IGST instead of CGST+SGST) */
  interState: boolean
  /** CGST amount in paise */
  totalCgst: number
  /** SGST amount in paise */
  totalSgst: number
  /** IGST amount in paise */
  totalIgst: number
  /** CESS amount in paise */
  totalCess: number
  /** CGST rate in basis points (e.g. 900 = 9%) */
  cgstRate?: number
  /** SGST rate in basis points */
  sgstRate?: number
  /** IGST rate in basis points */
  igstRate?: number
  /** Border colour (from template.colors.tableBorderColor) */
  borderColor: string
  /** Paper size — 58mm thermal returns null */
  pageSize: PageSize
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function paiseToDisplay(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(paise / 100)
}

function bpToPercent(bp: number | undefined): string {
  if (!bp) return ''
  return ` (${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 1)}%)`
}

// ─── Row primitive ────────────────────────────────────────────────────────────

interface TaxLineRowProps {
  label: string
  value: string
  bold?: boolean
  borderColor: string
  topBorder?: boolean
}

function TaxLineRow({ label, value, bold, borderColor, topBorder }: TaxLineRowProps) {
  const style: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '3px 0',
    fontSize: '0.8125rem',
    fontWeight: bold ? 700 : 400,
    borderTop: topBorder ? `1px solid ${borderColor}` : undefined,
    marginTop: topBorder ? '4px' : undefined,
  }
  return (
    <div style={style} aria-hidden="true">
      <span style={{ color: 'var(--color-gray-600)' }}>{label}</span>
      <span style={{ color: bold ? 'var(--color-gray-900)' : 'var(--color-gray-700)' }}>
        {value}
      </span>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TaxSummaryBlock: React.FC<TaxSummaryBlockProps> = ({
  enabled,
  compositionScheme,
  interState,
  totalCgst,
  totalSgst,
  totalIgst,
  totalCess,
  cgstRate,
  sgstRate,
  igstRate,
  borderColor,
  pageSize,
}) => {
  const { t } = useLanguage()

  // Guard 1: flag disabled
  if (!enabled) return null

  // Guard 2: 58mm thermal — too narrow
  if (pageSize === 'THERMAL_58MM') return null

  const totalTax = totalCgst + totalSgst + totalIgst + totalCess

  // Guard 3: no tax and not composition scheme
  if (totalTax === 0 && !compositionScheme) return null

  const containerStyle: React.CSSProperties = {
    padding: '6px var(--space-4)',
    borderTop: `1px solid ${borderColor}`,
  }

  const innerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
  }

  const tableStyle: React.CSSProperties = {
    minWidth: '200px',
  }

  // Composition scheme — just a notice, no rate rows
  if (compositionScheme) {
    return (
      <div style={{ ...containerStyle, textAlign: 'center' }} aria-hidden="true">
        <span
          style={{
            fontSize: '0.8125rem',
            color: 'var(--color-gray-500)',
            fontStyle: 'italic',
          }}
        >
          {t.compositionDealerNotice}
        </span>
      </div>
    )
  }

  // Build rows
  const rows: TaxRow[] = []

  if (interState) {
    if (totalIgst > 0) {
      rows.push({ label: `IGST${bpToPercent(igstRate)}`, amountPaise: totalIgst })
    }
  } else {
    if (totalCgst > 0) {
      rows.push({ label: `CGST${bpToPercent(cgstRate)}`, amountPaise: totalCgst })
    }
    if (totalSgst > 0) {
      rows.push({ label: `SGST${bpToPercent(sgstRate)}`, amountPaise: totalSgst })
    }
  }

  if (totalCess > 0) {
    rows.push({ label: 'CESS', amountPaise: totalCess })
  }

  return (
    <div style={containerStyle} aria-hidden="true">
      <div style={innerStyle}>
        <div style={tableStyle}>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--color-gray-500)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '4px',
            }}
          >
            {t.taxSummaryHeader}
          </div>

          {rows.map((row) => (
            <TaxLineRow
              key={row.label}
              label={row.label}
              value={paiseToDisplay(row.amountPaise)}
              borderColor={borderColor}
            />
          ))}

          {rows.length > 1 && (
            <TaxLineRow
              label={t.totalTaxLabel}
              value={paiseToDisplay(totalTax)}
              bold
              borderColor={borderColor}
              topBorder
            />
          )}
        </div>
      </div>
    </div>
  )
}
