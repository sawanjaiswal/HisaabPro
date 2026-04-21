/** Invoice preview — payment status stamp (badge or watermark style) */

import React from 'react'
import type { StampStyle } from '../template.types'

interface PreviewPaymentStampProps {
  status: 'PAID' | 'PARTIAL' | 'UNPAID'
  style: StampStyle
}

const STAMP_COLORS: Record<string, string> = {
  PAID:    '#16A34A',
  PARTIAL: '#EA580C',
  UNPAID:  '#DC2626',
}

export const PreviewPaymentStamp: React.FC<PreviewPaymentStampProps> = ({ status, style }) => {
  if (style === 'none') return null

  const color = STAMP_COLORS[status]

  if (style === 'watermark') {
    return (
      <div
        className="preview-stamp preview-stamp--watermark"
        style={{ color, opacity: 0.08, fontSize: 'var(--fs-5xl)' }}
        aria-hidden="true"
      >
        {status}
      </div>
    )
  }

  return (
    <div
      className="preview-stamp preview-stamp--badge"
      style={{ color, borderColor: color }}
      aria-hidden="true"
    >
      {status}
    </div>
  )
}
