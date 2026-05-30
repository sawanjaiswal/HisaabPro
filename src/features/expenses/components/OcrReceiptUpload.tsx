/** OcrReceiptUpload — File picker that triggers OCR and pre-fills form fields */

import { useRef, useState } from 'react'
import { Camera, Loader2, X } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { ocrReceipt } from '../expense.service'
import type { OcrResult } from '../expense.types'
import { useLanguage } from '@/hooks/useLanguage'
import { Input } from '@/components/ui/Input'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB (decoded)

interface OcrReceiptUploadProps {
  onPrefill: (result: OcrResult) => void
  disabled?: boolean
}

export function OcrReceiptUpload({ onPrefill, disabled }: OcrReceiptUploadProps) {
  const { t } = useLanguage()
  const toast = useToast()
  const isOnline = useOnlineStatus()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [confidence, setConfidence] = useState<number | null>(null)

  async function handleFile(file: File) {
    // Client-side size guard (estimate decoded from base64)
    if (file.size > MAX_BYTES) {
      toast.error(t.expensesOcrTooLarge ?? 'Image is too large (max 5 MB)')
      return
    }

    setLoading(true)
    setConfidence(null)

    try {
      const base64 = await fileToBase64(file)
      const response = await ocrReceipt(base64, file.type)

      if (!response.success) {
        const code = response.error?.code
        if (code === 'IMAGE_TOO_LARGE') {
          toast.error(t.expensesOcrTooLarge ?? 'Image is too large (max 5 MB)')
        } else {
          toast.error(t.expensesOcrUnavailable ?? 'OCR is unavailable. Fill in manually.')
        }
        return
      }

      const data = response.data
      if (!data) {
        toast.error(t.expensesOcrError ?? 'Receipt not recognised')
        return
      }

      if (data.confidence === 0) {
        toast.error(t.expensesOcrError ?? 'Receipt not recognised — fields left blank')
      }

      setConfidence(data.confidence)
      onPrefill(data)
    } catch {
      toast.error(t.expensesOcrError ?? 'Could not read receipt. Try again.')
    } finally {
      setLoading(false)
      // Reset file input so same file can be picked again
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleClick() {
    if (!isOnline) {
      toast.error('OCR requires internet — fill in manually')
      return
    }
    fileRef.current?.click()
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Strip "data:image/jpeg;base64," prefix
        resolve(result.split(',')[1] ?? result)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  return (
    <div className="ocr-upload" aria-live="polite">
      <Input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="ocr-upload__input"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleChange}
      />

      {loading ? (
        <div className="ocr-upload__loading" role="status" aria-live="assertive">
          <Loader2 size={16} className="spinner" aria-hidden="true" />
          <span>{t.expensesOcrLoading ?? 'Reading receipt…'}</span>
        </div>
      ) : (
        <button
          type="button"
          className="ocr-upload__btn"
          onClick={handleClick}
          disabled={disabled || loading}
          aria-label={t.expensesOcrScanAction ?? 'Scan receipt'}
        >
          <Camera size={16} aria-hidden="true" />
          <span>{t.expensesOcrScanAction ?? 'Scan receipt'}</span>
        </button>
      )}

      {confidence !== null && confidence > 0 && (
        <div className="ocr-upload__badge" role="status">
          <span className="ocr-badge ocr-badge--amber">
            OCR filled — {Math.round(confidence * 100)}% confidence
          </span>
          <button
            type="button"
            className="ocr-badge__clear"
            onClick={() => setConfidence(null)}
            aria-label="Dismiss OCR confidence notice"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
