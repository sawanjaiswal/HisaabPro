/** Barcode Display — Renders barcode SVG with download/print actions */

import { useMemo } from 'react'
import { Download } from 'lucide-react'
import type { BarcodeFormat } from '@/lib/types/product.types'
import { generateBarcodeSvg, generateBarcodeDataUrl } from '../barcode.utils'
import { BARCODE_FORMAT_LABELS } from '../product.constants'

interface BarcodeDisplayProps {
  value: string
  format: BarcodeFormat
  /** Product name — used as download filename */
  productName?: string
  /** Compact mode hides format label and download button */
  compact?: boolean
}

export function BarcodeDisplay({ value, format, productName, compact }: BarcodeDisplayProps) {
  const svgMarkup = useMemo(
    () => generateBarcodeSvg(value, format, { height: compact ? 48 : 60 }),
    [value, format, compact],
  )

  if (!value || !svgMarkup) return null

  const handleDownload = () => {
    const dataUrl = generateBarcodeDataUrl(value, format)
    if (!dataUrl) return

    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${productName ?? 'barcode'}-${value}.svg`
    link.click()
  }

  return (
    <div className="barcode-display" aria-label={`Barcode: ${value}`}>
      <div
        className="barcode-svg-container"
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
      {!compact && (
        <div className="barcode-display-footer">
          <span className="barcode-format-label">{BARCODE_FORMAT_LABELS[format]}</span>
          <button
            type="button"
            className="barcode-download-btn"
            onClick={handleDownload}
            aria-label="Download barcode as SVG"
          >
            <Download size={16} aria-hidden="true" />
            <span>Download</span>
          </button>
        </div>
      )}
    </div>
  )
}
