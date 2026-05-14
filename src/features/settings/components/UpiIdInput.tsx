/**
 * UpiIdInput — Business UPI ID (VPA) setting
 *
 * Validates against VPA regex, saves via PATCH /businesses/:id,
 * shows toast on success / error.
 * Follows offline rules: api() + entityType + entityLabel.
 */

import { useState, useCallback } from 'react'
import { Smartphone } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { api } from '@/lib/api'
const VPA_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z]{1,64}$/

interface UpiIdInputProps {
  /** Current saved value — null means not set */
  initialValue: string | null
  /** Called after a successful save with the new value (null = cleared) */
  onSaved?: (value: string | null) => void
}

export function UpiIdInput({ initialValue, onSaved }: UpiIdInputProps) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const toast = useToast()

  const [value, setValue] = useState(initialValue ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validate = useCallback((v: string): boolean => {
    if (v === '') return true // clearing is allowed
    if (!VPA_RE.test(v)) {
      setError(t.upiVpaInvalidFormat)
      return false
    }
    setError(null)
    return true
  }, [t.upiVpaInvalidFormat])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    if (error) validate(e.target.value)
  }

  const handleSave = async () => {
    const trimmed = value.trim()
    if (!validate(trimmed)) return

    const businessId = user?.businessId
    if (!businessId) return

    setIsSaving(true)
    try {
      await api(`/businesses/${businessId}`, {
        method: 'PUT',
        body: JSON.stringify({ upiVpa: trimmed === '' ? null : trimmed }),
        entityType: 'business',
        entityLabel: 'UPI ID',
      })
      toast.success(trimmed === '' ? t.upiVpaCleared : t.upiVpaSaved)
      onSaved?.(trimmed === '' ? null : trimmed)
    } catch {
      toast.error(`${t.errorRetry ?? 'Failed to save. Please try again.'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const isDirty = value.trim() !== (initialValue ?? '')

  return (
    <div className="settings-group" style={{ gap: 'var(--space-2)' }}>
      <label className="settings-item-label" htmlFor="upi-vpa-input">
        <Smartphone size={14} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 4 }} />
        {t.upiVpaSettingsLabel}
      </label>
      <input
        id="upi-vpa-input"
        type="text"
        className={`form-input${error ? ' form-input--error' : ''}`}
        value={value}
        onChange={handleChange}
        onBlur={() => validate(value.trim())}
        placeholder={t.upiVpaSettingsHelp}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-describedby={error ? 'upi-vpa-error' : 'upi-vpa-help'}
        aria-invalid={!!error}
        disabled={isSaving}
      />
      {error && (
        <p id="upi-vpa-error" className="form-error" role="alert" aria-live="polite">
          {error}
        </p>
      )}
      {!error && (
        <p id="upi-vpa-help" className="form-help" aria-hidden="true">
          {t.upiVpaSettingsHelp}
        </p>
      )}
      {isDirty && !error && (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={isSaving}
          aria-busy={isSaving}
        >
          {isSaving ? (t.saving ?? 'Saving...') : (t.save ?? 'Save')}
        </button>
      )}
    </div>
  )
}
