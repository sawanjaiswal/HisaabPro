/**
 * Barcode PNG — canvas-encoded barcode for React-PDF <Image>
 *
 * React-PDF has no DOM. BarcodeDisplay uses document.implementation.createDocument
 * which is DOM-only. This module draws the barcode onto an offscreen canvas and
 * returns a data URL safe for React-PDF's <Image src=...> prop.
 *
 * Cache: results are memoised by `value` so qty > 1 copies reuse the same URL.
 */

import JsBarcode from 'jsbarcode'
import type { BarcodeFormat } from '@/lib/types/product.types'

// In-process cache: barcode value → png data URL
const _cache = new Map<string, string>()

type JsFormat = 'CODE128' | 'EAN13' | 'EAN8' | 'CODE39' | 'UPC'

function toJsFormat(fmt: BarcodeFormat): JsFormat {
  switch (fmt) {
    case 'EAN13': return 'EAN13'
    case 'EAN8':  return 'EAN8'
    case 'CODE39': return 'CODE39'
    case 'UPC':   return 'CODE128'   // JsBarcode uses CODE128 as UPC fallback
    case 'CODE128':
    default:      return 'CODE128'
  }
}

export interface BarcodeImageOptions {
  width?: number    // canvas width px (default 280)
  height?: number   // barcode height px (default 80)
}

/**
 * Generate a barcode PNG as a data URL using an offscreen canvas.
 * Returns null if value is empty or JsBarcode throws (invalid format).
 * Result is cached by value for the lifetime of the page.
 */
export function generateBarcodePngDataUrl(
  value: string,
  format: BarcodeFormat,
  options: BarcodeImageOptions = {},
): string | null {
  if (!value?.trim()) return null

  const cacheKey = `${format}:${value}`
  const hit = _cache.get(cacheKey)
  if (hit) return hit

  try {
    const canvas = document.createElement('canvas')
    const { width = 280, height = 80 } = options

    JsBarcode(canvas, value, {
      format: toJsFormat(format),
      width: 2,
      height,
      displayValue: true,
      fontSize: 12,
      margin: 8,
      background: '#ffffff',
      lineColor: '#000000',
    })

    // Override canvas width if JsBarcode set something different
    if (width && canvas.width > width) {
      // Re-render at target width if canvas auto-sized too large
      const scale = width / canvas.width
      const scaled = document.createElement('canvas')
      scaled.width = width
      scaled.height = Math.round(canvas.height * scale)
      const ctx = scaled.getContext('2d')
      if (ctx) {
        ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height)
        const url = scaled.toDataURL('image/png')
        _cache.set(cacheKey, url)
        return url
      }
    }

    const url = canvas.toDataURL('image/png')
    _cache.set(cacheKey, url)
    return url
  } catch {
    return null
  }
}

/** Clear the PNG cache (call on logout if needed). */
export function clearBarcodePngCache(): void {
  _cache.clear()
}
