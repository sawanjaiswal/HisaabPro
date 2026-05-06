/** Batch error state slice for useInvoiceForm (BAT-05).
 *
 * Extracted from useInvoiceForm.ts to stay within the 250-line cap.
 * Owns: batchErrorCode, batchErrorLineIndex, clearBatchError.
 * The parent hook calls onBatchError from its mutation onError handler
 * and resetBatchErrors from its mutation onSuccess handler.
 */

import { useState, useCallback } from 'react'
import { ApiError } from '@/lib/api'
import type { BatchErrorCode } from './invoice-form.types'

export interface UseBatchErrorsReturn {
  batchErrorCode: BatchErrorCode | null
  batchErrorLineIndex: number | null
  /** Clears batch error state — usable from both onSuccess reset and UI dismiss */
  clearBatchError: () => void
  /** Call from mutation onError — returns true if the error was a batch error */
  onBatchError: (err: unknown) => boolean
}

export function useInvoiceFormBatchErrors(): UseBatchErrorsReturn {
  const [batchErrorCode, setBatchErrorCode] = useState<BatchErrorCode | null>(null)
  const [batchErrorLineIndex, setBatchErrorLineIndex] = useState<number | null>(null)

  const clearBatchError = useCallback(() => {
    setBatchErrorCode(null)
    setBatchErrorLineIndex(null)
  }, [])

  const onBatchError = useCallback((err: unknown): boolean => {
    const batchCodes: BatchErrorCode[] = ['EXPIRED_BATCH', 'ALL_BATCHES_EXPIRED', 'INSUFFICIENT_BATCH_STOCK']
    if (err instanceof ApiError && batchCodes.includes(err.code as BatchErrorCode)) {
      setBatchErrorCode(err.code as BatchErrorCode)
      return true
    }
    return false
  }, [])

  return { batchErrorCode, batchErrorLineIndex, clearBatchError, onBatchError }
}
