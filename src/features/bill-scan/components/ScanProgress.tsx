/** Scan Progress — Processing indicator with percentage */

import type { OcrProgress } from '../bill-scan.types'
import { useLanguage } from '@/hooks/useLanguage'

interface ScanProgressProps {
  progress: OcrProgress
  imagePreview?: string
}

export function ScanProgress({ progress, imagePreview }: ScanProgressProps) {
  const { t } = useLanguage()
  const percent = Math.round(progress.progress * 100)

  return (
    <div className="scan-progress" role="status" aria-live="polite">
      {imagePreview && (
        <div className="scan-progress-preview">
          <img
            src={imagePreview}
            alt={t.billBeingProcessed}
            className="scan-progress-image"
          />
          <div className="scan-progress-overlay" />
        </div>
      )}

      <div className="scan-progress-info">
        <div className="scan-progress-bar-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="scan-progress-bar-fill"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="scan-progress-label">{progress.status}</span>
        <span className="scan-progress-percent">{percent}%</span>
      </div>
    </div>
  )
}
