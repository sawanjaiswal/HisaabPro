/**
 * Phase 7 Slice 7.1A — File dropzone.
 * Click-to-pick + drag-and-drop. Shows name + size when a file is
 * selected. Stateless — owner drives `file` and `onFile`.
 */

import { useCallback, useRef, useState, type DragEvent } from 'react'
import { UploadCloud, FileCheck2, X } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { ACCEPTED_INPUT_ACCEPT } from '../constants/import.constants'
import { formatBytes } from '../utils/file-validation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface FileDropzoneProps {
  file: File | null
  onFile: (file: File | null) => void
  disabled?: boolean
  /** Optional error message rendered below the zone (already translated). */
  errorMessage?: string | null
}

export function FileDropzone({ file, onFile, disabled = false, errorMessage }: FileDropzoneProps) {
  const { t } = useLanguage()
  const tx = t as unknown as Record<string, string>
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)

  const openPicker = useCallback(() => {
    if (disabled) return
    inputRef.current?.click()
  }, [disabled])

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled) setDragging(true)
  }
  const onDragLeave = () => setDragging(false)
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const next = e.dataTransfer.files?.[0]
    if (next) onFile(next)
  }

  const clear = () => {
    onFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="w-full">
      <div
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPicker()
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={tx.importDropzoneAriaLabel ?? 'Choose file to import'}
        className={
          'rounded-[var(--radius-xl)] border-2 border-dashed px-4 py-6 min-h-[160px] flex flex-col items-center justify-center gap-2 text-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]' +
          (dragging
            ? ' border-[var(--color-primary-500)] bg-[var(--color-primary-50)]'
            : ' border-[var(--color-border)] bg-[var(--color-surface)]') +
          (disabled ? ' opacity-60 cursor-not-allowed' : '')
        }
      >
        {file ? (
          <>
            <FileCheck2
              className="w-6 h-6"
              style={{ color: 'var(--color-success-600)' }}
              aria-hidden="true"
            />
            <span
              className="font-semibold break-all"
              style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-primary)' }}
            >
              {file.name}
            </span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
              {formatBytes(file.size)}
            </span>
            <Button variant="none"
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                clear()
              }}
              disabled={disabled}
              aria-label={tx.importRemoveFile ?? 'Remove file'}
              className="mt-1 inline-flex items-center gap-1 min-h-[44px] px-3 rounded-[var(--radius-sm)]"
              style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-xs)' }}
            >
              <X className="w-4 h-4" aria-hidden="true" />
              {tx.importRemoveFile ?? 'Remove'}
            </Button>
          </>
        ) : (
          <>
            <UploadCloud
              className="w-6 h-6"
              style={{ color: 'var(--color-primary-600)' }}
              aria-hidden="true"
            />
            <span
              className="font-semibold"
              style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-primary)' }}
            >
              {tx.importDropzoneTitle ?? 'Drop file here or tap to browse'}
            </span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
              {tx.importDropzoneHint ?? 'XML, CSV, or XLSX up to 10 MB'}
            </span>
          </>
        )}
        <Input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_INPUT_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const next = e.target.files?.[0]
            if (next) onFile(next)
            e.target.value = ''
          }}
        />
      </div>
      {errorMessage ? (
        <p
          role="alert"
          className="mt-2"
          style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-error-600)' }}
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
