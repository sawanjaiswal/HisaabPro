/** Bill Scanning / OCR — Hook
 *
 * Manages the scan flow: capture → preprocess → OCR → parse → review.
 * Tesseract worker is lazy-loaded on first use.
 */

import { useState, useCallback, useRef } from 'react'
import type { BillScanResult, BillScanStatus, ExtractedItem, OcrProgress } from './bill-scan.types'
import { OCR_LANGUAGE, MAX_FILE_SIZE } from './bill-scan.constants'
import { preprocessImage, createThumbnail, parseOcrText, extractGrandTotal, extractDate } from './bill-scan.utils'

export interface UseBillScanReturn {
  status: BillScanStatus
  progress: OcrProgress | null
  result: BillScanResult | null
  error: string | null
  processImage: (file: File) => Promise<void>
  updateItem: (id: string, patch: Partial<ExtractedItem>) => void
  removeItem: (id: string) => void
  reset: () => void
}

export function useBillScan(): UseBillScanReturn {
  const [status, setStatus] = useState<BillScanStatus>('idle')
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [result, setResult] = useState<BillScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<import('tesseract.js').Worker | null>(null)

  const processImage = useCallback(async (file: File) => {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`Image too large (${Math.round(file.size / 1024 / 1024)}MB). Max 4MB.`)
      setStatus('error')
      return
    }

    setStatus('processing')
    setProgress({ status: 'Preparing image...', progress: 0 })
    setError(null)

    const startTime = Date.now()

    try {
      // Preprocess image (resize + grayscale + contrast)
      const [processedDataUrl, thumbnail] = await Promise.all([
        preprocessImage(file),
        createThumbnail(file),
      ])

      setProgress({ status: 'Loading OCR engine...', progress: 0.1 })

      // Lazy-load Tesseract worker
      if (!workerRef.current) {
        const { createWorker } = await import('tesseract.js')
        workerRef.current = await createWorker(OCR_LANGUAGE, undefined, {
          logger: (msg) => {
            if (msg.status === 'recognizing text') {
              setProgress({
                status: 'Reading text...',
                progress: 0.2 + msg.progress * 0.7,
              })
            }
          },
        })
      }

      setProgress({ status: 'Reading text...', progress: 0.2 })

      // Run OCR
      const ocrResult = await workerRef.current.recognize(processedDataUrl)
      const rawText = ocrResult.data.text
      const confidence = ocrResult.data.confidence

      setProgress({ status: 'Extracting items...', progress: 0.95 })

      // Parse extracted text
      const extractedItems = parseOcrText(rawText)
      const extractedTotal = extractGrandTotal(rawText)
      const extractedDate = extractDate(rawText)

      const scanResult: BillScanResult = {
        rawText,
        confidence,
        extractedItems,
        extractedTotal,
        extractedDate,
        imageDataUrl: thumbnail,
        processingTimeMs: Date.now() - startTime,
      }

      setResult(scanResult)
      setStatus(extractedItems.length > 0 ? 'review' : 'error')
      if (extractedItems.length === 0) {
        setError('No items found. Try a clearer photo of a printed bill.')
      }
      setProgress(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCR processing failed'
      setError(message)
      setStatus('error')
      setProgress(null)
    }
  }, [])

  const updateItem = useCallback((id: string, patch: Partial<ExtractedItem>) => {
    setResult((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        extractedItems: prev.extractedItems.map((item) =>
          item.id === id ? { ...item, ...patch, isEdited: true } : item
        ),
      }
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setResult((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        extractedItems: prev.extractedItems.filter((item) => item.id !== id),
      }
    })
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setProgress(null)
    setResult(null)
    setError(null)
  }, [])

  return { status, progress, result, error, processImage, updateItem, removeItem, reset }
}
