/** Invoice Template Preview — GST Declaration text block
 *
 * Renders declaration text at the bottom of GST invoices, after the terms block.
 * Text source priority:
 *   1. business.gstDeclarationText (user-customised)
 *   2. COMPOSITION_GST_DECLARATION (composition scheme dealers)
 *   3. STANDARD_GST_DECLARATION (all other GST dealers)
 * RCM appendix is appended when document.isReverseCharge === true.
 *
 * Render guard: template.fields.gstDeclaration must be true.
 * React auto-escapes all text — XSS-safe by construction.
 *
 * GST Phase 2 / PR 5
 */

import React from 'react'
import {
  STANDARD_GST_DECLARATION,
  COMPOSITION_GST_DECLARATION,
  RCM_DECLARATION_APPENDIX,
} from '../template.constants'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface GstDeclarationBlockProps {
  /** Whether the template flag is enabled */
  enabled: boolean
  /** Custom declaration text set by the business owner (may be null) */
  gstDeclarationText: string | null | undefined
  /** True for composition scheme dealers */
  compositionScheme: boolean
  /** True when the document is subject to Reverse Charge Mechanism */
  isReverseCharge: boolean
  /** Border colour (from template.colors.tableBorderColor) */
  borderColor: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export const GstDeclarationBlock: React.FC<GstDeclarationBlockProps> = ({
  enabled,
  gstDeclarationText,
  compositionScheme,
  isReverseCharge,
  borderColor,
}) => {
  if (!enabled) return null

  const baseText =
    gstDeclarationText ??
    (compositionScheme ? COMPOSITION_GST_DECLARATION : STANDARD_GST_DECLARATION)

  const finalText = isReverseCharge
    ? `${baseText}\n${RCM_DECLARATION_APPENDIX}`
    : baseText

  const paragraphs = finalText.split('\n').filter(Boolean)

  return (
    <div
      style={{
        padding: 'var(--space-3) var(--space-4)',
        marginTop: '10mm',
        borderTop: `1px solid ${borderColor}`,
      }}
      aria-hidden="true"
    >
      {paragraphs.map((para, idx) => (
        <p
          key={idx}
          style={{
            fontSize: '0.75rem',
            lineHeight: 1.5,
            color: 'var(--color-gray-500)',
            textAlign: 'left',
            margin: idx > 0 ? '6px 0 0' : '0',
          }}
        >
          {para}
        </p>
      ))}
    </div>
  )
}
