import { AlertCircle, CheckCircle } from 'lucide-react'
import { BULK_CREATE_MAX } from '../serial-number.constants'
import { parseSerialNumbers } from '../serial-number.utils'
import { useBulkSerialForm } from '../useBulkSerialForm'

interface BulkSerialFormProps {
  productId: string
  onSuccess?: () => void
}

export function BulkSerialForm({ productId, onSuccess }: BulkSerialFormProps) {
  const { form, errors, isSubmitting, result, updateField, handleSubmit } = useBulkSerialForm(productId, onSuccess)

  const parsed = parseSerialNumbers(form.text)
  const count = parsed.length

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSubmit()
  }

  return (
    <form className="serial-form" onSubmit={onSubmit} noValidate>
      <div className="serial-form__field">
        <label htmlFor="bulkSerials" className="serial-form__label">
          Serial Numbers (one per line or comma-separated)
        </label>
        <textarea
          id="bulkSerials"
          className={`serial-form__input serial-form__textarea serial-form__textarea--tall${errors.text ? ' serial-form__input--error' : ''}`}
          value={form.text}
          onChange={(e) => updateField('text', e.target.value)}
          placeholder={`SN-001\nSN-002\nSN-003`}
          rows={6}
          autoFocus
        />
        <p className="serial-form__hint">
          {count} serial {count === 1 ? 'number' : 'numbers'} detected (max {BULK_CREATE_MAX})
        </p>
        {errors.text && <p className="serial-form__error">{errors.text}</p>}
      </div>

      {result && result.errors.length > 0 && (
        <div className="serial-bulk-result">
          <p className="serial-bulk-result__summary">
            <CheckCircle size={14} aria-hidden="true" /> {result.created} created
          </p>
          <div className="serial-bulk-result__errors" role="alert">
            <p className="serial-bulk-result__errors-title">
              <AlertCircle size={14} aria-hidden="true" /> {result.errors.length} failed:
            </p>
            <ul className="serial-bulk-result__list">
              {result.errors.map((err) => (
                <li key={err.serial}><strong>{err.serial}</strong>: {err.message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary btn-md serial-form__submit"
        disabled={isSubmitting || count === 0}
      >
        {isSubmitting ? 'Adding...' : `Add ${count} Serial ${count === 1 ? 'Number' : 'Numbers'}`}
      </button>
    </form>
  )
}
