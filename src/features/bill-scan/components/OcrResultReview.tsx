/** OCR Result Review — Editable table of extracted items */

import { Trash2, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react'
import type { BillScanResult, ExtractedItem } from '../bill-scan.types'
import { CONFIDENCE_HIGH, CONFIDENCE_MEDIUM } from '../bill-scan.constants'
import { useLanguage } from '@/hooks/useLanguage'

interface OcrResultReviewProps {
  result: BillScanResult
  onUpdateItem: (id: string, patch: Partial<ExtractedItem>) => void
  onRemoveItem: (id: string) => void
  onConfirm: () => void
  onRetry: () => void
}

function ConfidenceBadge({ value }: { value: number }) {
  const { t } = useLanguage()
  if (value >= CONFIDENCE_HIGH) {
    return <CheckCircle size={16} className="confidence-high" aria-label={`${value}% ${t.confidenceLabel}`} />
  }
  if (value >= CONFIDENCE_MEDIUM) {
    return <HelpCircle size={16} className="confidence-medium" aria-label={`${value}% ${t.confidenceLabel} — ${t.verifyThisItem}`} />
  }
  return <AlertTriangle size={16} className="confidence-low" aria-label={`${value}% ${t.confidenceLabel} — ${t.likelyIncorrect}`} />
}

function formatPaise(paise: number | null): string {
  if (paise === null) return ''
  return (paise / 100).toFixed(2)
}

function parsePaise(value: string): number | null {
  const num = parseFloat(value)
  if (isNaN(num)) return null
  return Math.round(num * 100)
}

export function OcrResultReview({ result, onUpdateItem, onRemoveItem, onConfirm, onRetry }: OcrResultReviewProps) {
  const { t } = useLanguage()
  const { extractedItems, extractedTotal, confidence, processingTimeMs } = result
  const itemsTotal = extractedItems.reduce((sum, item) => sum + (item.total ?? 0), 0)

  return (
    <div className="ocr-review">
      <div className="ocr-review-header">
        <div className="ocr-review-stats">
          <span className="ocr-review-stat">
            {extractedItems.length} item{extractedItems.length !== 1 ? 's' : ''} found
          </span>
          <span className="ocr-review-stat ocr-review-stat-secondary">
            {Math.round(confidence)}% accuracy
          </span>
          <span className="ocr-review-stat ocr-review-stat-secondary">
            {(processingTimeMs / 1000).toFixed(1)}s
          </span>
        </div>

        {result.imageDataUrl && (
          <img
            src={result.imageDataUrl}
            alt="Scanned bill"
            className="ocr-review-thumbnail"
          />
        )}
      </div>

      {extractedItems.length === 0 ? (
        <div className="ocr-review-empty">
          <AlertTriangle size={32} aria-hidden="true" />
          <p>{t.noItemsExtracted}</p>
          <button type="button" className="btn btn-secondary btn-md" onClick={onRetry}>
            Try Again
          </button>
        </div>
      ) : (
        <>
          <div className="ocr-review-items" role="list" aria-label={t.lineItems}>
            {extractedItems.map((item) => (
              <div key={item.id} className="ocr-review-item" role="listitem">
                <div className="ocr-review-item-header">
                  <ConfidenceBadge value={item.confidence} />
                  <input
                    className="ocr-review-item-name"
                    value={item.name}
                    onChange={(e) => onUpdateItem(item.id, { name: e.target.value })}
                    aria-label={t.productName}
                  />
                  <button
                    type="button"
                    className="ocr-review-item-delete"
                    onClick={() => onRemoveItem(item.id)}
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>

                <div className="ocr-review-item-fields">
                  <div className="ocr-review-field">
                    <label className="ocr-review-field-label">Qty</label>
                    <input
                      className="ocr-review-field-input"
                      type="number"
                      min="0"
                      step="1"
                      value={item.quantity ?? ''}
                      onChange={(e) => onUpdateItem(item.id, {
                        quantity: e.target.value ? parseInt(e.target.value, 10) : null,
                      })}
                      aria-label={`Quantity for ${item.name}`}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="ocr-review-field">
                    <label className="ocr-review-field-label">Rate</label>
                    <input
                      className="ocr-review-field-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formatPaise(item.rate)}
                      onChange={(e) => onUpdateItem(item.id, { rate: parsePaise(e.target.value) })}
                      aria-label={`Rate for ${item.name}`}
                      inputMode="decimal"
                    />
                  </div>
                  <div className="ocr-review-field">
                    <label className="ocr-review-field-label">Total</label>
                    <input
                      className="ocr-review-field-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formatPaise(item.total)}
                      onChange={(e) => onUpdateItem(item.id, { total: parsePaise(e.target.value) })}
                      aria-label={`Total for ${item.name}`}
                      inputMode="decimal"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="ocr-review-totals">
            <div className="ocr-review-total-row">
              <span>{t.itemsTotal}</span>
              <span className="ocr-review-total-value">
                Rs {(itemsTotal / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {extractedTotal !== null && (
              <div className="ocr-review-total-row">
                <span>{t.billTotalScanned}</span>
                <span className={`ocr-review-total-value ${Math.abs(extractedTotal - itemsTotal) > 100 ? 'ocr-review-total-mismatch' : ''}`}>
                  Rs {(extractedTotal / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          <div className="ocr-review-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={onConfirm}
              disabled={extractedItems.length === 0}
              aria-label={t.addXItemsToInvoice}
            >
              Add {extractedItems.length} Item{extractedItems.length !== 1 ? 's' : ''} to Invoice
            </button>
            <button type="button" className="btn btn-ghost btn-md" onClick={onRetry}>
              Scan Another
            </button>
          </div>
        </>
      )}
    </div>
  )
}
