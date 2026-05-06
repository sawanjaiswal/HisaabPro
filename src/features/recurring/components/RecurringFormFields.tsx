/** RecurringFormFields — all controlled form fields for create/edit schedule */

import { useLanguage } from '@/hooks/useLanguage'
import { TemplatePicker } from './TemplatePicker'
import { RECURRING_FREQUENCIES, FREQUENCY_LABELS } from '../recurring.constants'
import type { RecurringFormState, FormErrors } from '../hooks/useRecurringForm'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface RecurringFormFieldsProps {
  form: RecurringFormState
  errors: FormErrors
  setField: <K extends keyof RecurringFormState>(key: K, value: RecurringFormState[K]) => void
  disabled?: boolean
}

export function RecurringFormFields({
  form,
  errors,
  setField,
  disabled = false,
}: RecurringFormFieldsProps) {
  const { t } = useLanguage()

  const showAnchorDay = form.frequency !== 'DAILY' && form.frequency !== 'WEEKLY'
  const showDayOfWeek = form.frequency === 'WEEKLY'

  return (
    <div className="rf-fields">
      {/* Template picker */}
      <TemplatePicker
        value={form.templateDocumentId}
        onChange={(id) => setField('templateDocumentId', id)}
        error={errors.templateDocumentId}
      />

      {/* Schedule name */}
      <div className="rf-field">
        <label htmlFor="rf-name" className="rf-label">
          {t.recurringFieldName ?? 'Schedule Name'}
        </label>
        <input
          id="rf-name"
          type="text"
          className="rf-input"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder={t.recurringFieldNamePlaceholder ?? 'e.g. Monthly Rent Invoice'}
          disabled={disabled}
          maxLength={120}
          autoComplete="off"
        />
      </div>

      {/* Frequency */}
      <div className="rf-field">
        <label htmlFor="rf-frequency" className="rf-label">
          {t.recurringFieldFrequency ?? 'Frequency'}
          <span className="rf-required" aria-hidden="true"> *</span>
        </label>
        <div className="rf-segment" role="group" aria-label={t.recurringFieldFrequency ?? 'Frequency'}>
          {RECURRING_FREQUENCIES.map((f) => (
            <button
              key={f}
              type="button"
              className={`rf-segment__btn${form.frequency === f ? ' rf-segment__btn--active' : ''}`}
              onClick={() => setField('frequency', f)}
              disabled={disabled}
              aria-pressed={form.frequency === f}
            >
              {FREQUENCY_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Day of week (WEEKLY) */}
      {showDayOfWeek && (
        <div className="rf-field">
          <label htmlFor="rf-dow" className="rf-label">
            {t.recurringFieldAnchorDayWeekly ?? 'Day of Week'}
          </label>
          <select
            id="rf-dow"
            className="rf-select"
            value={form.dayOfWeek}
            onChange={(e) => setField('dayOfWeek', e.target.value)}
            disabled={disabled}
          >
            {DAY_NAMES.map((name, idx) => (
              <option key={idx} value={idx}>{name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Day of month (MONTHLY/QUARTERLY/YEARLY) */}
      {showAnchorDay && (
        <div className="rf-field">
          <label htmlFor="rf-dom" className="rf-label">
            {t.recurringFieldAnchorDay ?? 'Day of Month'}
          </label>
          <input
            id="rf-dom"
            type="number"
            className="rf-input rf-input--narrow"
            value={form.dayOfMonth}
            min={1}
            max={28}
            onChange={(e) => setField('dayOfMonth', e.target.value)}
            disabled={disabled}
          />
          <p className="rf-hint">{t.recurringFieldAnchorDayMax ?? 'Max: 28th'}</p>
        </div>
      )}

      {/* Start / End dates */}
      <div className="rf-row">
        <div className="rf-field rf-field--grow">
          <label htmlFor="rf-start" className="rf-label">
            {t.recurringFieldStartDate ?? 'Start Date'}
            <span className="rf-required" aria-hidden="true"> *</span>
          </label>
          <input
            id="rf-start"
            type="date"
            className={`rf-input${errors.startDate ? ' rf-input--error' : ''}`}
            value={form.startDate}
            onChange={(e) => setField('startDate', e.target.value)}
            disabled={disabled}
            required
          />
          {errors.startDate && (
            <p className="rf-error" role="alert">
              {t.recurringFormValidationRequired ?? 'This field is required.'}
            </p>
          )}
        </div>

        <div className="rf-field rf-field--grow">
          <label htmlFor="rf-end" className="rf-label">
            {t.recurringFieldEndDate ?? 'End Date (optional)'}
          </label>
          <input
            id="rf-end"
            type="date"
            className={`rf-input${errors.endDate ? ' rf-input--error' : ''}`}
            value={form.endDate}
            min={form.startDate}
            onChange={(e) => setField('endDate', e.target.value)}
            disabled={disabled}
          />
          {errors.endDate && (
            <p className="rf-error" role="alert">
              {t.recurringFormValidationEndDate ?? 'End date must be after start date.'}
            </p>
          )}
        </div>
      </div>

      {/* Toggles */}
      <div className="rf-toggles">
        <label className="rf-toggle">
          <input
            type="checkbox"
            className="rf-toggle__input"
            checked={form.autoSend}
            onChange={(e) => setField('autoSend', e.target.checked)}
            disabled={disabled}
          />
          <span className="rf-toggle__track" aria-hidden="true" />
          <span className="rf-toggle__label">Auto-send WhatsApp</span>
        </label>

        <label className="rf-toggle">
          <input
            type="checkbox"
            className="rf-toggle__input"
            checked={form.autoPaymentLink}
            onChange={(e) => setField('autoPaymentLink', e.target.checked)}
            disabled={disabled}
          />
          <span className="rf-toggle__track" aria-hidden="true" />
          <span className="rf-toggle__label">
            {t.recurringFieldAutoPaymentLink ?? 'Auto-generate payment link'}
          </span>
        </label>

        <label className="rf-toggle">
          <input
            type="checkbox"
            className="rf-toggle__input"
            checked={form.autoReminder}
            onChange={(e) => setField('autoReminder', e.target.checked)}
            disabled={disabled}
          />
          <span className="rf-toggle__track" aria-hidden="true" />
          <span className="rf-toggle__label">
            {t.recurringFieldAutoReminder ?? 'Auto-send reminder'}
          </span>
        </label>
      </div>
    </div>
  )
}
