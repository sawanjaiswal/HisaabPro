/** Bill Scanning / OCR — Text parsing utilities
 *
 * OCR text parsing and line item extraction.
 * Image preprocessing is in bill-scan.image.ts.
 * No hooks, no side effects.
 */

import type { ExtractedItem } from './bill-scan.types'
import { MAX_EXTRACTED_ITEMS } from './bill-scan.constants'

// Re-export image utils for existing consumers
export { preprocessImage, createThumbnail } from './bill-scan.image'

// ─── OCR text parsing ─────────────────────────────────────────────────────────

/**
 * Parse OCR raw text into extracted line items.
 * Handles common Indian bill formats:
 * - "Item Name    2 x 150.00    300.00"
 * - "Item Name    2    150    300"
 * - "Item Name    ₹300.00"
 */
export function parseOcrText(rawText: string): ExtractedItem[] {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean)
  const items: ExtractedItem[] = []
  let itemCounter = 0

  for (const line of lines) {
    // Skip headers, totals, and short lines
    if (isHeaderOrFooter(line)) continue
    if (line.length < 3) continue

    const parsed = parseLine(line)
    if (parsed) {
      itemCounter++
      items.push({
        id: `scan-${itemCounter}`,
        ...parsed,
        isEdited: false,
      })

      if (items.length >= MAX_EXTRACTED_ITEMS) break
    }
  }

  return items
}

/** Lines to skip — headers, totals, labels */
function isHeaderOrFooter(line: string): boolean {
  const lower = line.toLowerCase()
  const skipPatterns = [
    /^(s\.?no|sr|item|description|qty|rate|amount|total|sub\s?total|grand|net|gst|cgst|sgst|igst|tax|discount|round)/i,
    /^(invoice|bill|receipt|cash memo|estimate|quotation|date|phone|mobile|address|gstin|pan)/i,
    /^(thank|thanks|visit|powered|printed|page|terms|condition|note|subject|from|to|ship)/i,
    /^[-=_.*]{3,}$/,  // separator lines
  ]
  return skipPatterns.some((p) => p.test(lower))
}

/**
 * Try to parse a single line into an item with qty/rate/total.
 * Returns null if line doesn't look like an item.
 */
function parseLine(line: string): Omit<ExtractedItem, 'id' | 'isEdited'> | null {
  // Remove currency symbols for parsing
  const cleaned = line.replace(/[₹$]/g, '').replace(/Rs\.?\s*/gi, '')

  // Extract all numbers from the line
  const numbers = extractNumbers(cleaned)

  // Need at least one number (the total/amount)
  if (numbers.length === 0) return null

  // Extract the text part (item name) — everything before the first number
  const firstNumMatch = cleaned.match(/\d/)
  if (!firstNumMatch || firstNumMatch.index === undefined) return null

  const name = cleaned.slice(0, firstNumMatch.index).replace(/[|:.\-]+$/, '').trim()
  if (name.length < 2) return null

  // Determine confidence based on how many fields we extracted
  let quantity: number | null = null
  let rate: number | null = null
  let total: number | null = null
  let confidence = 50

  if (numbers.length >= 3) {
    // qty, rate, total pattern
    quantity = numbers[0]
    rate = Math.round(numbers[1] * 100)  // rupees to paise
    total = Math.round(numbers[2] * 100)
    confidence = 80
  } else if (numbers.length === 2) {
    // Could be qty + total, or rate + total
    if (numbers[0] <= 100 && numbers[1] > numbers[0]) {
      quantity = numbers[0]
      total = Math.round(numbers[1] * 100)
      confidence = 65
    } else {
      rate = Math.round(numbers[0] * 100)
      total = Math.round(numbers[1] * 100)
      confidence = 60
    }
  } else if (numbers.length === 1) {
    // Just an amount
    total = Math.round(numbers[0] * 100)
    confidence = 40
  }

  return { name, quantity, rate, total, confidence }
}

/** Extract decimal numbers from a string */
function extractNumbers(text: string): number[] {
  // Match numbers with optional comma separators and decimal points
  const matches = text.match(/\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?/g)
  if (!matches) return []

  return matches
    .map((m) => parseFloat(m.replace(/,/g, '')))
    .filter((n) => !isNaN(n) && n > 0)
}

/**
 * Try to extract a grand total from OCR text.
 * Looks for patterns like "Total: 1,500.00" or "Grand Total ₹1500"
 */
export function extractGrandTotal(rawText: string): number | null {
  const patterns = [
    /(?:grand\s*)?total[:\s]*(?:₹|Rs\.?\s*)?(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?)/i,
    /(?:net\s*)?(?:amount|payable)[:\s]*(?:₹|Rs\.?\s*)?(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?)/i,
  ]

  for (const pattern of patterns) {
    const match = rawText.match(pattern)
    if (match?.[1]) {
      const amount = parseFloat(match[1].replace(/,/g, ''))
      if (!isNaN(amount) && amount > 0) {
        return Math.round(amount * 100)  // to paise
      }
    }
  }

  return null
}

/**
 * Try to extract a date from OCR text.
 * Handles: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
 */
export function extractDate(rawText: string): string | null {
  const pattern = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/
  const match = rawText.match(pattern)
  if (!match) return null

  const day = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  let year = parseInt(match[3], 10)

  if (year < 100) year += 2000
  if (day < 1 || day > 31 || month < 1 || month > 12) return null

  const date = new Date(year, month - 1, day)
  if (isNaN(date.getTime())) return null

  return date.toISOString().slice(0, 10)
}

/**
 * Convert extracted items to invoice LineItemFormData format.
 * Items without a total or name are skipped.
 */
export function toLineItemFormData(items: ExtractedItem[]): Array<{
  productId: string
  productName: string
  quantity: number
  rate: number
  discountType: 'PERCENTAGE'
  discountValue: number
}> {
  return items
    .filter((item) => item.name && (item.total || item.rate))
    .map((item) => ({
      productId: '',  // no product match yet — user must select
      productName: item.name,
      quantity: item.quantity ?? 1,
      rate: item.rate ?? item.total ?? 0,
      discountType: 'PERCENTAGE' as const,
      discountValue: 0,
    }))
}
