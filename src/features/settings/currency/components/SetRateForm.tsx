/** SetRateForm — Form to set an exchange rate for a foreign currency */

import { useState, useCallback } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { todayIso, parseRateInput } from '../currency.utils'
import type { SupportedCurrency, SetExchangeRatePayload } from '../currency.types'
import { BASE_CURRENCY } from '../currency.constants'

interface SetRateFormProps {
  currencies: SupportedCurrency[]
  onSubmit: (payload: SetExchangeRatePayload) => Promise<void>
  onCancel: () => void
}

export function SetRateForm({ currencies, onSubmit, onCancel }: SetRateFormProps) {
  const { t } = useLanguage()
  const foreignCurrencies = currencies.filter((c) => c.code !== BASE_CURRENCY)

  const [fromCurrency, setFromCurrency] = useState(foreignCurrencies[0]?.code ?? '')
  const [rateInput, setRateInput] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(todayIso())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const rate = parseRateInput(rateInput)
    if (isNaN(rate)) {
      setError(t.validRateError)
      return
    }
    if (!fromCurrency) {
      setError(t.selectCurrencyError)
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({ fromCurrency, rate, effectiveDate })
    } catch {
      // Error toast is shown by the hook; keep form open
    } finally {
      setSubmitting(false)
    }
  }, [fromCurrency, rateInput, effectiveDate, onSubmit, t])

  return (
    <form className="set-rate-form" onSubmit={handleSubmit} noValidate>
      <div className="set-rate-form__field">
        <label className="set-rate-form__label" htmlFor="sr-currency">
          {t.currencyFormLabel}
        </label>
        <select
          id="sr-currency"
          className="set-rate-form__select"
          value={fromCurrency}
          onChange={(e) => setFromCurrency(e.target.value)}
          required
        >
          {foreignCurrencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="set-rate-form__field">
        <label className="set-rate-form__label" htmlFor="sr-rate">
          {`${t.rateInputPrefix} ${fromCurrency || '...'} ${t.rateInputSuffix}`}
        </label>
        <input
          id="sr-rate"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.0001"
          className="set-rate-form__input"
          placeholder={t.ratePlaceholder}
          value={rateInput}
          onChange={(e) => setRateInput(e.target.value)}
          required
        />
      </div>

      <div className="set-rate-form__field">
        <label className="set-rate-form__label" htmlFor="sr-date">
          {t.effectiveDateLabel}
        </label>
        <input
          id="sr-date"
          type="date"
          className="set-rate-form__input"
          value={effectiveDate}
          max={todayIso()}
          onChange={(e) => setEffectiveDate(e.target.value)}
          required
        />
      </div>

      {error && (
        <p className="set-rate-form__error" role="alert">
          {error}
        </p>
      )}

      <div className="set-rate-form__actions">
        <button
          type="button"
          className="set-rate-form__btn set-rate-form__btn--secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          {t.cancel}
        </button>
        <button
          type="submit"
          className="set-rate-form__btn set-rate-form__btn--primary"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? t.saving : t.saveRateBtn}
        </button>
      </div>
    </form>
  )
}
