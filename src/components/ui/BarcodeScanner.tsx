/** Barcode Scanner — Native MLKit (Android/iOS) + Web file-picker fallback
 *
 * State machine: idle → scanning → success | error → idle
 * Platform helpers in barcode-scanner.utils.ts (lazy-imported)
 */

import { useState, useRef, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { X, Search, AlertTriangle, Camera, ImageIcon } from 'lucide-react'
import { scanNative, scanWeb } from './barcode-scanner.utils'
import './barcode-scanner.css'

export interface BarcodeScannerProps {
  onScan: (value: string) => void
  onClose: () => void
}

type ScanState = 'idle' | 'scanning' | 'success' | 'error'

const isNative = Capacitor.isNativePlatform()

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [state, setState]         = useState<ScanState>('idle')
  const [errorMsg, setErrorMsg]   = useState<string>('')
  const [manualValue, setManual]  = useState('')
  const fileInputRef              = useRef<HTMLInputElement>(null)

  const handleClose = useCallback(async () => {
    if (isNative && state === 'scanning') {
      try {
        const { BarcodeScanner: BS } = await import('@capacitor-mlkit/barcode-scanning')
        await BS.stopScan()
        await BS.removeAllListeners()
      } catch { /* silent */ }
    }
    onClose()
  }, [onClose, state])

  const handleNativeScan = useCallback(async () => {
    setState('scanning')
    await scanNative(
      (value) => { setState('success'); onScan(value) },
      (msg)   => { setState('error'); setErrorMsg(msg) },
      ()      => setState('idle'),
    )
  }, [onScan])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) { setState('idle'); return }
    setState('scanning')
    await scanWeb(
      file,
      (value) => { setState('success'); onScan(value) },
      (msg)   => { setState('error'); setErrorMsg(msg) },
    )
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [onScan])

  const handleManualSubmit = useCallback(() => {
    const trimmed = manualValue.trim()
    if (!trimmed) return
    setState('success')
    onScan(trimmed)
  }, [manualValue, onScan])

  const handleRetry = useCallback(() => {
    setErrorMsg('')
    setState('idle')
    if (isNative) {
      setTimeout(handleNativeScan, 50)
    } else {
      fileInputRef.current?.click()
    }
  }, [handleNativeScan])

  return (
    <div className="barcode-scanner-overlay" role="dialog" aria-modal="true" aria-label="Scan Barcode">
      <div className="barcode-scanner-header">
        <h3 className="barcode-scanner-title">Scan Barcode</h3>
        <button
          type="button"
          className="barcode-scanner-close"
          onClick={handleClose}
          aria-label="Close scanner"
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      {/* ── IDLE ─────────────────────────────────────────────────────── */}
      {state === 'idle' && (
        <div className="barcode-scanner-idle">
          {isNative ? (
            <button
              type="button"
              className="btn btn-primary barcode-scanner-cta"
              onClick={handleNativeScan}
              aria-label="Scan Barcode"
            >
              <Camera size={20} aria-hidden="true" />
              Scan Barcode
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary barcode-scanner-cta"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Choose Photo / Camera"
              >
                <ImageIcon size={20} aria-hidden="true" />
                Choose Photo / Camera
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                aria-hidden="true"
                onChange={handleFileChange}
              />
            </>
          )}
        </div>
      )}

      {/* ── SCANNING ─────────────────────────────────────────────────── */}
      {state === 'scanning' && (
        <div className="barcode-scanner-scanning" aria-live="polite" aria-label="Scanning…">
          {isNative ? (
            <>
              <div className="barcode-scanner-viewfinder" aria-hidden="true">
                <div className="barcode-scanner-guide-corners" />
              </div>
              <p className="barcode-scanner-hint">Point camera at a barcode</p>
              <button type="button" className="btn btn-ghost barcode-scanner-cancel" onClick={handleClose}>
                Cancel
              </button>
            </>
          ) : (
            <div className="barcode-scanner-processing">
              <div className="barcode-scanner-spinner" aria-hidden="true" />
              <p>Analysing image…</p>
            </div>
          )}
        </div>
      )}

      {/* ── ERROR ─────────────────────────────────────────────────────── */}
      {state === 'error' && (
        <div className="barcode-scanner-error" role="alert">
          <AlertTriangle size={28} aria-hidden="true" />
          <p className="barcode-scanner-error-msg">{errorMsg}</p>
          <button type="button" className="btn btn-outline barcode-scanner-retry" onClick={handleRetry}>
            Try Again
          </button>
          {!isNative && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              aria-hidden="true"
              onChange={handleFileChange}
            />
          )}
        </div>
      )}

      {/* ── MANUAL ENTRY (always shown except success) ───────────────── */}
      {state !== 'success' && (
        <div className="barcode-scanner-manual">
          <span className="barcode-scanner-manual-label">Or enter manually</span>
          <div className="barcode-scanner-manual-row">
            <input
              className="input barcode-scanner-manual-input"
              type="text"
              value={manualValue}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit() }}
              placeholder="Type or paste barcode…"
              aria-label="Manual barcode entry"
              autoComplete="off"
              inputMode="text"
            />
            <button
              type="button"
              className="btn btn-primary barcode-scanner-search-btn"
              onClick={handleManualSubmit}
              disabled={!manualValue.trim()}
              aria-label="Search barcode"
            >
              <Search size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
