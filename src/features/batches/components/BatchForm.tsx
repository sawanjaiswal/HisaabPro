/** BatchForm — Create/Edit batch form */

import { useBatchForm } from '../useBatchForm'
import { BATCH_NUMBER_MAX, BATCH_NOTES_MAX } from '../batch.constants'
import type { Batch } from '../batch.types'

interface BatchFormProps {
  productId: string
  existingBatch?: Batch
  onSuccess: () => void
}

export function BatchForm({ productId, existingBatch, onSuccess }: BatchFormProps) {
  const { form, errors, isSubmitting, updateField, handleSubmit } = useBatchForm(
    productId,
    existingBatch
  )

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await handleSubmit()
    if (ok) onSuccess()
  }

  return (
    <form className="batch-form" onSubmit={onSubmit} noValidate>
      <div className="form-group">
        <label htmlFor="batchNumber" className="form-label">
          Batch Number <span className="form-required">*</span>
        </label>
        <input
          id="batchNumber"
          type="text"
          className={`form-input${errors.batchNumber ? ' form-input--error' : ''}`}
          value={form.batchNumber}
          onChange={(e) => updateField('batchNumber', e.target.value)}
          maxLength={BATCH_NUMBER_MAX}
          placeholder="e.g. BATCH-001"
          autoFocus
        />
        {errors.batchNumber && (
          <span className="form-error" role="alert">{errors.batchNumber}</span>
        )}
      </div>

      <div className="batch-form-row">
        <div className="form-group">
          <label htmlFor="manufacturingDate" className="form-label">Mfg Date</label>
          <input
            id="manufacturingDate"
            type="date"
            className="form-input"
            value={form.manufacturingDate}
            onChange={(e) => updateField('manufacturingDate', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="expiryDate" className="form-label">Expiry Date</label>
          <input
            id="expiryDate"
            type="date"
            className="form-input"
            value={form.expiryDate}
            onChange={(e) => updateField('expiryDate', e.target.value)}
          />
        </div>
      </div>

      <div className="batch-form-row">
        <div className="form-group">
          <label htmlFor="costPrice" className="form-label">Cost Price (Rs)</label>
          <input
            id="costPrice"
            type="number"
            className={`form-input${errors.costPrice ? ' form-input--error' : ''}`}
            value={form.costPrice}
            onChange={(e) => updateField('costPrice', e.target.value)}
            min="0"
            step="0.01"
            placeholder="0.00"
            inputMode="decimal"
          />
          {errors.costPrice && (
            <span className="form-error" role="alert">{errors.costPrice}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="salePrice" className="form-label">Sale Price (Rs)</label>
          <input
            id="salePrice"
            type="number"
            className={`form-input${errors.salePrice ? ' form-input--error' : ''}`}
            value={form.salePrice}
            onChange={(e) => updateField('salePrice', e.target.value)}
            min="0"
            step="0.01"
            placeholder="0.00"
            inputMode="decimal"
          />
          {errors.salePrice && (
            <span className="form-error" role="alert">{errors.salePrice}</span>
          )}
        </div>
      </div>

      {!existingBatch && (
        <div className="form-group">
          <label htmlFor="currentStock" className="form-label">Opening Stock</label>
          <input
            id="currentStock"
            type="number"
            className={`form-input${errors.currentStock ? ' form-input--error' : ''}`}
            value={form.currentStock}
            onChange={(e) => updateField('currentStock', e.target.value)}
            min="0"
            step="1"
            placeholder="0"
            inputMode="numeric"
          />
          {errors.currentStock && (
            <span className="form-error" role="alert">{errors.currentStock}</span>
          )}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="notes" className="form-label">Notes</label>
        <textarea
          id="notes"
          className="form-input form-textarea"
          value={form.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          maxLength={BATCH_NOTES_MAX}
          placeholder="Optional notes about this batch"
          rows={3}
        />
        {errors.notes && (
          <span className="form-error" role="alert">{errors.notes}</span>
        )}
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-lg batch-form-submit"
        disabled={isSubmitting}
      >
        {isSubmitting
          ? 'Saving...'
          : existingBatch ? 'Update Batch' : 'Create Batch'}
      </button>
    </form>
  )
}
