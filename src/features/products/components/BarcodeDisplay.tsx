/** Barcode Display — Renders barcode SVG with download/print actions */

import { useMemo, useRef, useEffect } from 'react'
import { Download } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
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
  const { t } = useLanguage()
  const containerRef = useRef<HTMLDivElement>(null)
  const svgMarkup = useMemo(
    () => generateBarcodeSvg(value, format, { height: compact ? 48 : 60 }),
    [value, format, compact],
  )

  // Parse SVG string into DOM safely (no dangerouslySetInnerHTML)
  useEffect(() => {
    const el = containerRef.current
    if (!el || !svgMarkup) {
      if (el) el.replaceChildren()
      return
    }
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgMarkup, 'image/svg+xml')
    const svg = doc.documentElement
    // Only insert if valid SVG (no parsererror)
    if (svg.tagName === 'svg') {
      el.replaceChildren(svg)
    }
  }, [svgMarkup])

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
    <div className="barcode-display" aria-label={`${t.barcodeLabel}: ${value}`}>
      <div className="barcode-svg-container space-y-6" ref={containerRef} />
      {!compact && (
        <div className="barcode-display-footer">
          <span className="barcode-format-label">{BARCODE_FORMAT_LABELS[format]}</span>
          <button
            type="button"
            className="barcode-download-btn"
            onClick={handleDownload}
            aria-label={t.downloadBarcodeSvg}
          >
            <Download size={16} aria-hidden="true" />
            <span>{t.download}</span>
          </button>
        </div>
      )}
    </div>
  )
}
