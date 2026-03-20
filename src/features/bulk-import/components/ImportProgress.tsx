/** Import Progress — Shows progress bar during bulk creation */

import { CheckCircle, AlertTriangle } from 'lucide-react'
import type { BulkImportResult } from '../bulk-import.types'

interface ImportProgressProps {
  progress: number
  total: number
  result: BulkImportResult | null
  onDone: () => void
  onGoToParties: () => void
}

export function ImportProgress({ progress, total, result, onDone, onGoToParties }: ImportProgressProps) {
  const isDone = result !== null
  const percent = total > 0 ? Math.round((progress / total) * 100) : 0

  return (
    <div className="import-progress">
      {!isDone ? (
        <>
          <div className="import-progress-bar-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="import-progress-bar-fill" style={{ width: `${percent}%` }} />
          </div>
          <span className="import-progress-label">
            Importing {progress} of {total}...
          </span>
          <span className="import-progress-percent">{percent}%</span>
        </>
      ) : (
        <div className="import-result">
          <div className="import-result-icon" aria-hidden="true">
            {result.failed === 0 ? (
              <CheckCircle size={48} className="import-result-success" />
            ) : (
              <AlertTriangle size={48} className="import-result-partial" />
            )}
          </div>

          <h3 className="import-result-title">
            {result.failed === 0 ? 'All parties imported!' : 'Import completed with errors'}
          </h3>

          <div className="import-result-stats">
            <span className="import-result-stat import-result-stat-success">
              {result.succeeded} succeeded
            </span>
            {result.failed > 0 && (
              <span className="import-result-stat import-result-stat-error">
                {result.failed} failed
              </span>
            )}
          </div>

          {result.errors.length > 0 && (
            <div className="import-result-errors" role="list" aria-label="Import errors">
              {result.errors.slice(0, 10).map((err, i) => (
                <div key={`${err.name}-${i}`} className="import-result-error-row" role="listitem">
                  <span className="import-result-error-name">{err.name}</span>
                  <span className="import-result-error-reason">{err.reason}</span>
                </div>
              ))}
              {result.errors.length > 10 && (
                <span className="import-result-error-more">
                  +{result.errors.length - 10} more errors
                </span>
              )}
            </div>
          )}

          <div className="import-result-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={onGoToParties}>
              View Parties
            </button>
            <button type="button" className="btn btn-ghost btn-md" onClick={onDone}>
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
