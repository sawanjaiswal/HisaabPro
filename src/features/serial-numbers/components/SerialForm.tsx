import { SERIAL_NUMBER_MAX, NOTES_MAX } from '../serial-number.constants'
import { useSerialForm } from '../useSerialForm'

interface SerialFormProps {
  productId: string
  onSuccess?: () => void
}

export function SerialForm({ productId, onSuccess }: SerialFormProps) {
  const { form, errors, isSubmitting, updateField, handleSubmit } = useSerialForm(productId, onSuccess)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSubmit()
  }

  return (
    <form className="serial-form" onSubmit={onSubmit} noValidate>
      <div className="serial-form__field">
        <label htmlFor="serialNumber" className="serial-form__label">Serial Number *</label>
        <input
          id="serialNumber"
          type="text"
          className={`serial-form__input${errors.serialNumber ? ' serial-form__input--error' : ''}`}
          value={form.serialNumber}
          onChange={(e) => updateField('serialNumber', e.target.value)}
          maxLength={SERIAL_NUMBER_MAX}
          placeholder="e.g. SN-2026-001"
          autoFocus
        />
        {errors.serialNumber && <p className="serial-form__error">{errors.serialNumber}</p>}
      </div>

      <div className="serial-form__field">
        <label htmlFor="notes" className="serial-form__label">Notes</label>
        <textarea
          id="notes"
          className="serial-form__input serial-form__textarea"
          value={form.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          maxLength={NOTES_MAX}
          placeholder="Optional notes"
          rows={3}
        />
        {errors.notes && <p className="serial-form__error">{errors.notes}</p>}
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-md serial-form__submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Adding...' : 'Add Serial Number'}
      </button>
    </form>
  )
}
