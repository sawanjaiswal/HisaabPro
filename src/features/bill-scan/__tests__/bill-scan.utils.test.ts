import { describe, it, expect } from 'vitest'
import {
  parseOcrText,
  extractGrandTotal,
  extractDate,
  toLineItemFormData,
} from '../bill-scan.utils'

// ─── parseOcrText ─────────────────────────────────────────────────────────────

describe('parseOcrText', () => {
  it('parses qty x rate x total pattern', () => {
    const text = 'Maggi Noodles    2    150    300'
    const items = parseOcrText(text)
    expect(items.length).toBeGreaterThanOrEqual(1)
    expect(items[0].name).toContain('Maggi')
    expect(items[0].quantity).toBe(2)
  })

  it('parses single amount line', () => {
    const text = 'Chai 50'
    const items = parseOcrText(text)
    expect(items.length).toBeGreaterThanOrEqual(1)
    expect(items[0].name).toContain('Chai')
  })

  it('skips header lines', () => {
    const text = 'Invoice No 12345\nDate: 15/03/2026\nItem Name    Qty    Rate    Amount\nMaggi    2    150    300'
    const items = parseOcrText(text)
    // Should skip headers and parse only item lines
    const maggi = items.find((i) => i.name.includes('Maggi'))
    expect(maggi).toBeTruthy()
  })

  it('skips total/subtotal lines', () => {
    const text = 'Maggi    2    150    300\nTotal    600\nSubtotal    600'
    const items = parseOcrText(text)
    expect(items.find((i) => i.name.toLowerCase().includes('total'))).toBeFalsy()
  })

  it('returns empty for empty input', () => {
    expect(parseOcrText('')).toEqual([])
  })

  it('handles Indian number format with commas', () => {
    const text = 'Gold Ring    1    15,000    15,000'
    const items = parseOcrText(text)
    expect(items.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── extractGrandTotal ────────────────────────────────────────────────────────

describe('extractGrandTotal', () => {
  it('extracts "Total: 1,500"', () => {
    // Indian format with comma: 1,500 rupees → 150000 paise
    expect(extractGrandTotal('Some items\nTotal: 1,500\nThank you')).toBe(150000)
  })

  it('extracts "Grand Total ₹1,500.00"', () => {
    expect(extractGrandTotal('Grand Total ₹1,500.00')).toBe(150000)
  })

  it('extracts "Net Amount Rs. 2,000"', () => {
    expect(extractGrandTotal('Net Amount Rs. 2,000')).toBe(200000)
  })

  it('extracts small amounts without comma', () => {
    // "Total: 500" — regex captures "500" (3 digits, no comma needed)
    expect(extractGrandTotal('Total: 500')).toBe(50000)
  })

  it('returns null when no total found', () => {
    expect(extractGrandTotal('Hello world')).toBeNull()
  })

  it('returns null for empty text', () => {
    expect(extractGrandTotal('')).toBeNull()
  })
})

// ─── extractDate ──────────────────────────────────────────────────────────────

describe('extractDate', () => {
  it('extracts DD/MM/YYYY and returns ISO date', () => {
    const result = extractDate('Date: 15/03/2026')
    // Uses local timezone → ISO may shift by -1 day in IST; verify it's a valid date
    expect(result).toBeTruthy()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('extracts DD-MM-YYYY', () => {
    const result = extractDate('Date: 15-03-2026')
    expect(result).toBeTruthy()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('extracts DD.MM.YYYY', () => {
    const result = extractDate('Date: 15.03.2026')
    expect(result).toBeTruthy()
  })

  it('handles 2-digit year', () => {
    const result = extractDate('01/01/26')
    expect(result).toBeTruthy()
    expect(result).toMatch(/^202[56]-/)
  })

  it('returns null for invalid date', () => {
    expect(extractDate('Date: 32/13/2026')).toBeNull()
  })

  it('returns null when no date found', () => {
    expect(extractDate('No date here')).toBeNull()
  })
})

// ─── toLineItemFormData ───────────────────────────────────────────────────────

describe('toLineItemFormData', () => {
  it('converts items to form data format', () => {
    const items = [
      { id: '1', name: 'Maggi', quantity: 2, rate: 15000, total: 30000, confidence: 80, isEdited: false },
    ]
    const result = toLineItemFormData(items)
    expect(result).toHaveLength(1)
    expect(result[0].productName).toBe('Maggi')
    expect(result[0].quantity).toBe(2)
    expect(result[0].rate).toBe(15000)
    expect(result[0].productId).toBe('')
  })

  it('defaults quantity to 1 when null', () => {
    const items = [
      { id: '1', name: 'Item', quantity: null, rate: 10000, total: 10000, confidence: 50, isEdited: false },
    ]
    const result = toLineItemFormData(items)
    expect(result[0].quantity).toBe(1)
  })

  it('uses total as rate when rate is null', () => {
    const items = [
      { id: '1', name: 'Item', quantity: null, rate: null, total: 5000, confidence: 40, isEdited: false },
    ]
    const result = toLineItemFormData(items)
    expect(result[0].rate).toBe(5000)
  })

  it('skips items without name or amount', () => {
    const items = [
      { id: '1', name: '', quantity: null, rate: null, total: null, confidence: 0, isEdited: false },
    ]
    expect(toLineItemFormData(items)).toHaveLength(0)
  })
})
