/** GodownForm — Create/Edit godown form fields */

import { useLanguage } from '@/hooks/useLanguage'
import { GODOWN_NAME_MAX, ADDRESS_MAX } from '../godown.constants'
import type { CreateGodownData } from '../godown.types'

interface GodownFormProps {
  form: CreateGodownData
  errors: Record<string, string>
  isSubmitting: boolean
  onUpdate: <K extends keyof CreateGodownData>(key: K, value: CreateGodownData[K]) => void
  onSubmit: () => void
  submitLabel: string
}

export function GodownForm({ form, errors, isSubmitting, onUpdate, onSubmit, submitLabel }: GodownFormProps) {
  const { t } = useLanguage()
  return (
    <form
      className="godown-form"
      onSubmit={(e) => { e.preventDefault(); onSubmit() }}
      noValidate
    >
      <div className="godown-form__field">
        <label htmlFor="godown-name" className="godown-form__label">
          {t.godownName} <span aria-hidden="true">*</span>
        </label>
        <input
          id="godown-name"
          type="text"
          className={`godown-form__input${errors.name ? ' godown-form__input--error' : ''}`}
          value={form.name}
          onChange={(e) => onUpdate('name', e.target.value)}
          onBlur={() => onUpdate('name', form.name)}
          placeholder={t.godownNamePlaceholder}
          maxLength={GODOWN_NAME_MAX}
          autoFocus
          aria-required="true"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'godown-name-error' : undefined}
        />
        {errors.name && (
          <p id="godown-name-error" className="godown-form__error" role="alert">{errors.name}</p>
        )}
      </div>

      <div className="godown-form__field">
        <label htmlFor="godown-address" className="godown-form__label">{t.address}</label>
        <textarea
          id="godown-address"
          className={`godown-form__textarea${errors.address ? ' godown-form__input--error' : ''}`}
          value={form.address ?? ''}
          onChange={(e) => onUpdate('address', e.target.value)}
          placeholder={t.godownAddress}
          maxLength={ADDRESS_MAX}
          rows={3}
          aria-invalid={Boolean(errors.address)}
          aria-describedby={errors.address ? 'godown-address-error' : undefined}
        />
        {errors.address && (
          <p id="godown-address-error" className="godown-form__error" role="alert">{errors.address}</p>
        )}
      </div>

      <label className="godown-form__toggle">
        <input
          type="checkbox"
          checked={form.isDefault ?? false}
          onChange={(e) => onUpdate('isDefault', e.target.checked)}
        />
        <span className="godown-form__toggle-label">{t.setAsDefaultGodown}</span>
      </label>

      <button
        type="submit"
        className="btn btn-primary btn-lg godown-form__submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? t.saving : submitLabel}
      </button>
    </form>
  )
}
