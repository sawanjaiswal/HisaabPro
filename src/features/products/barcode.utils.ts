/** Barcode — Pure utility functions
 *
 * Validation and SVG generation for product barcodes.
 * Uses JsBarcode for client-side rendering.
 */

import JsBarcode from 'jsbarcode'
import type { BarcodeFormat } from '@/lib/types/product.types'
import { BARCODE_MAX_LENGTH } from './product.constants'

// ─── Format validation patterns ──────────────────────────────────────────────

const BARCODE_PATTERNS: Record<BarcodeFormat, RegExp> = {
  CODE128: /^[\x20-\x7E]{1,48}$/,        // printable ASCII
  EAN13:   /^\d{13}$/,
  EAN8:    /^\d{8}$/,
  CODE39:  /^[A-Z0-9\-.$/+% ]{1,48}$/,
  UPC:     /^\d{12}$/,
}

const BARCODE_HINTS: Record<BarcodeFormat, string> = {
  CODE128: 'Any printable characters, max 48',
  EAN13:   'Exactly 13 digits',
  EAN8:    'Exactly 8 digits',
  CODE39:  'Uppercase letters, digits, and - . $ / + % space',
  UPC:     'Exactly 12 digits',
}

/**
 * Validate barcode value against format rules.
 * Returns null if valid, or an error message string.
 */
export function validateBarcode(value: string, format: BarcodeFormat): string | null {
  if (!value.trim()) return null // empty = no barcode, which is valid (optional field)

  if (value.length > BARCODE_MAX_LENGTH) {
    return `Barcode too long (max ${BARCODE_MAX_LENGTH} characters)`
  }

  if (!BARCODE_PATTERNS[format].test(value)) {
    return `Invalid for ${format}: ${BARCODE_HINTS[format]}`
  }

  // EAN-13 / EAN-8 / UPC check digit validation
  if (format === 'EAN13' || format === 'EAN8' || format === 'UPC') {
    if (!isValidCheckDigit(value)) {
      return 'Invalid check digit'
    }
  }

  return null
}

/**
 * Validate EAN/UPC check digit (last digit).
 * Works for EAN-13, EAN-8, and UPC-A.
 */
function isValidCheckDigit(digits: string): boolean {
  const nums = digits.split('').map(Number)
  const check = nums.pop()!
  let sum = 0
  for (let i = 0; i < nums.length; i++) {
    sum += nums[i] * (i % 2 === 0 ? 1 : 3)
  }
  const expected = (10 - (sum % 10)) % 10
  return check === expected
}

/**
 * Get hint text for a barcode format.
 */
export function getBarcodeHint(format: BarcodeFormat): string {
  return BARCODE_HINTS[format]
}

/**
 * Generate barcode as SVG string using JsBarcode.
 * Returns the SVG markup or null on failure.
 */
export function generateBarcodeSvg(
  value: string,
  format: BarcodeFormat,
  options?: { width?: number; height?: number; displayValue?: boolean },
): string | null {
  if (!value.trim()) return null

  try {
    const svgNs = 'http://www.w3.org/2000/svg'
    // Create a temporary SVG element for JsBarcode
    const doc = document.implementation.createDocument(svgNs, 'svg', null)
    const svg = doc.documentElement

    JsBarcode(svg, value, {
      format,
      width: options?.width ?? 2,
      height: options?.height ?? 60,
      displayValue: options?.displayValue ?? true,
      fontSize: 14,
      margin: 8,
      background: 'transparent',
    })

    const serializer = new XMLSerializer()
    return serializer.serializeToString(svg)
  } catch {
    return null
  }
}

/**
 * Generate barcode as a data URL for download/print.
 */
export function generateBarcodeDataUrl(
  value: string,
  format: BarcodeFormat,
): string | null {
  const svg = generateBarcodeSvg(value, format, { height: 80 })
  if (!svg) return null
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
