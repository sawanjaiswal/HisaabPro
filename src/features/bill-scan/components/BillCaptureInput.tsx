/** Bill Capture — Camera/gallery picker */

import { useRef } from 'react'
import { Camera, ImageIcon } from 'lucide-react'
import { ACCEPTED_IMAGE_EXTENSIONS, ACCEPTED_IMAGE_TYPES } from '../bill-scan.constants'

interface BillCaptureInputProps {
  onCapture: (file: File) => void
}

export function BillCaptureInput({ onCapture }: BillCaptureInputProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    onCapture(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  return (
    <div className="bill-capture-input">
      <div className="bill-capture-illustration" aria-hidden="true">
        <Camera size={48} strokeWidth={1.5} />
      </div>

      <h2 className="bill-capture-title">Scan a Bill</h2>
      <p className="bill-capture-description">
        Take a photo of a printed bill or receipt to auto-extract items
      </p>

      <div className="bill-capture-buttons">
        <button
          type="button"
          className="btn btn-primary btn-lg bill-capture-btn"
          onClick={() => cameraRef.current?.click()}
          aria-label="Take photo with camera"
        >
          <Camera size={20} aria-hidden="true" />
          <span>Take Photo</span>
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-lg bill-capture-btn"
          onClick={() => galleryRef.current?.click()}
          aria-label="Choose image from gallery"
        >
          <ImageIcon size={20} aria-hidden="true" />
          <span>From Gallery</span>
        </button>
      </div>

      <p className="bill-capture-hint">
        Works best with clear, well-lit photos of printed bills
      </p>

      {/* Hidden file inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        capture="environment"
        onChange={handleFile}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={`${ACCEPTED_IMAGE_TYPES},${ACCEPTED_IMAGE_EXTENSIONS}`}
        onChange={handleFile}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  )
}
