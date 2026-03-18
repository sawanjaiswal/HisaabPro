/** Barcode Scanner — Camera-based barcode scanning
 *
 * Uses the native BarcodeDetector API (Chrome/Android).
 * Falls back to manual input on unsupported browsers.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Search, AlertTriangle } from 'lucide-react'

interface BarcodeScannerProps {
  onScan: (value: string) => void
  onClose: () => void
}

// Check for BarcodeDetector API support
const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [manualValue, setManualValue] = useState('')

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    scanningRef.current = false
  }, [])

  const startScanning = useCallback(async () => {
    if (!hasBarcodeDetector) {
      setError('Camera scanning not supported on this browser. Use manual entry below.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      // @ts-expect-error BarcodeDetector is not yet in TS lib
      const detector = new BarcodeDetector({
        formats: ['code_128', 'ean_13', 'ean_8', 'code_39', 'upc_a'],
      })

      scanningRef.current = true
      const scan = async () => {
        if (!scanningRef.current || !videoRef.current) return

        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0) {
            const value = barcodes[0].rawValue
            if (value) {
              scanningRef.current = false
              stopCamera()
              onScan(value)
              return
            }
          }
        } catch {
          // Detection error — continue scanning
        }

        if (scanningRef.current) {
          requestAnimationFrame(scan)
        }
      }

      requestAnimationFrame(scan)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera access denied'
      setError(`Camera error: ${msg}. Use manual entry below.`)
    }
  }, [onScan, stopCamera])

  useEffect(() => {
    startScanning()
    return stopCamera
  }, [startScanning, stopCamera])

  const handleManualSubmit = () => {
    const trimmed = manualValue.trim()
    if (trimmed) {
      onScan(trimmed)
    }
  }

  return (
    <div className="barcode-scanner-overlay" role="dialog" aria-label="Barcode Scanner">
      <div className="barcode-scanner-header">
        <h3 className="barcode-scanner-title">Scan Barcode</h3>
        <button
          type="button"
          className="barcode-scanner-close"
          onClick={() => { stopCamera(); onClose() }}
          aria-label="Close scanner"
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      {!error && hasBarcodeDetector && (
        <div className="barcode-scanner-viewport">
          <video
            ref={videoRef}
            className="barcode-scanner-video"
            playsInline
            muted
            aria-label="Camera viewfinder"
          />
          <div className="barcode-scanner-guide" aria-hidden="true">
            <div className="barcode-scanner-guide-corners" />
          </div>
          <p className="barcode-scanner-hint">Point camera at a barcode</p>
        </div>
      )}

      {error && (
        <div className="barcode-scanner-error">
          <AlertTriangle size={24} aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      <div className="barcode-scanner-manual">
        <span className="barcode-scanner-manual-label">Or enter manually</span>
        <div className="barcode-scanner-manual-row">
          <input
            className="input barcode-scanner-manual-input"
            type="text"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit() }}
            placeholder="Type or paste barcode..."
            aria-label="Manual barcode entry"
            autoComplete="off"
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
    </div>
  )
}
