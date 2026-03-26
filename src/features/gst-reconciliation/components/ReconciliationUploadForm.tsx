/** ReconciliationUploadForm
 *
 * JSON file upload or paste area for GSTR data, period selector, start button.
 * Validates structure client-side before sending to API.
 * Input amounts are rupees floats (as filed in GSTR portal).
 */

import React, { useRef, useState, useCallback } from 'react'
import { Upload } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { startReconciliation } from '../reconciliation.service'
import { ApiError } from '@/lib/api'
import type { GstrInputItem } from '../reconciliation.types'

interface Props {
  onSuccess: (id: string) => void
}

function validateGstrItems(raw: unknown): GstrInputItem[] {
  if (!Array.isArray(raw)) throw new Error('GSTR data must be a JSON array')
  return raw.map((item: unknown, idx: number) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Item at index ${idx} is not an object`)
    }
    const obj = item as Record<string, unknown>
    if (typeof obj.invoiceNumber !== 'string' || !obj.invoiceNumber.trim()) {
      throw new Error(`Item ${idx}: invoiceNumber is required`)
    }
    if (typeof obj.invoiceDate !== 'string' || !obj.invoiceDate.trim()) {
      throw new Error(`Item ${idx}: invoiceDate is required`)
    }
    if (typeof obj.gstin !== 'string' || !obj.gstin.trim()) {
      throw new Error(`Item ${idx}: gstin is required`)
    }
    if (typeof obj.taxableValue !== 'number') {
      throw new Error(`Item ${idx}: taxableValue must be a number`)
    }
    if (typeof obj.taxAmount !== 'number') {
      throw new Error(`Item ${idx}: taxAmount must be a number`)
    }
    return {
      invoiceNumber: String(obj.invoiceNumber).trim(),
      invoiceDate:   String(obj.invoiceDate).trim(),
      gstin:         String(obj.gstin).trim(),
      partyName:     typeof obj.partyName === 'string' ? obj.partyName.trim() : undefined,
      taxableValue:  obj.taxableValue as number,
      taxAmount:     obj.taxAmount as number,
    }
  })
}

export const ReconciliationUploadForm: React.FC<Props> = ({ onSuccess }) => {
  const { t } = useLanguage()
  const toast    = useToast()
  const fileRef  = useRef<HTMLInputElement>(null)
  const submitRef = useRef(false)

  const [period,    setPeriod]    = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [jsonText,  setJsonText]  = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setJsonText(String(ev.target?.result ?? ''))
      setParseError(null)
    }
    reader.readAsText(file)
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitRef.current) return
    setParseError(null)

    let items: GstrInputItem[]
    try {
      const parsed = JSON.parse(jsonText)
      items = validateGstrItems(parsed)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON'
      setParseError(msg)
      return
    }

    if (items.length === 0) {
      setParseError('GSTR data array is empty')
      return
    }

    submitRef.current = true
    setIsLoading(true)
    try {
      const result = await startReconciliation({ period, reconType: 'GSTR1_VS_BOOKS', gstrData: items })
      toast.success(`Reconciliation started — ${items.length} invoices queued`)
      onSuccess(result.id)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to start reconciliation'
      toast.error(message)
    } finally {
      submitRef.current = false
      setIsLoading(false)
    }
  }, [jsonText, period, onSuccess, toast])

  return (
    <form className="recon-upload-form" onSubmit={handleSubmit} noValidate>
      <div className="recon-upload-form__field">
        <label className="recon-upload-form__label" htmlFor="recon-period">{t.reconPeriodLabel}</label>
        <input
          id="recon-period"
          type="month"
          className="recon-upload-form__input"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          required
          aria-label={t.selectReconPeriod}
        />
      </div>

      <div className="recon-upload-form__field">
        <label className="recon-upload-form__label" htmlFor="recon-file">
          {t.uploadGstrJsonFile}
        </label>
        <button
          type="button"
          className="recon-upload-form__file-btn"
          onClick={() => fileRef.current?.click()}
          aria-label={t.chooseGstrJsonFile}
        >
          <Upload size={16} aria-hidden="true" />
          {t.chooseFile}
        </button>
        <input
          ref={fileRef}
          id="recon-file"
          type="file"
          accept=".json,application/json"
          className="recon-upload-form__file-input-hidden"
          onChange={handleFileChange}
          aria-label={t.gstrJsonFileUpload}
        />
      </div>

      <div className="recon-upload-form__field">
        <label className="recon-upload-form__label" htmlFor="recon-json">
          {t.orPasteJsonDirectly}
        </label>
        <textarea
          id="recon-json"
          className="recon-upload-form__textarea"
          value={jsonText}
          onChange={(e) => { setJsonText(e.target.value); setParseError(null) }}
          placeholder='[{"invoiceNumber":"INV001","invoiceDate":"2026-03-01","gstin":"29AABCT1332L1ZN","taxableValue":10000,"taxAmount":1800}]'
          rows={6}
          aria-label={t.pasteGstrDataJson}
          aria-describedby={parseError ? 'recon-json-error' : undefined}
        />
        {parseError && (
          <p id="recon-json-error" className="recon-upload-form__error" role="alert">
            {parseError}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="recon-upload-form__submit"
        disabled={isLoading || !jsonText.trim() || !period}
        aria-busy={isLoading}
      >
        {isLoading ? t.starting : t.startReconciliation}
      </button>
    </form>
  )
}
