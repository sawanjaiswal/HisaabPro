/** Bill Scanning / OCR — Type definitions */

/** State machine for bill scan flow */
export type BillScanStatus =
  | 'idle'
  | 'capturing'
  | 'processing'
  | 'review'
  | 'error'

/** Single extracted line item from OCR */
export interface ExtractedItem {
  id: string
  name: string
  quantity: number | null
  rate: number | null      // paise
  total: number | null     // paise
  confidence: number       // 0-100
  isEdited: boolean
}

/** Full OCR scan result */
export interface BillScanResult {
  rawText: string
  confidence: number         // 0-100 overall
  extractedItems: ExtractedItem[]
  extractedTotal: number | null  // paise
  extractedDate: string | null   // ISO date
  imageDataUrl: string           // thumbnail
  processingTimeMs: number
}

/** Progress callback from Tesseract */
export interface OcrProgress {
  status: string
  progress: number  // 0-1
}
