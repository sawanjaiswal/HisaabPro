/**
 * CRM (#127) — FollowUpDatePicker.
 *
 * `<DateField type="datetime-local">` for picking the next follow-up at — the
 * native picker works on Android WebView + iOS Safari and supports the
 * existing dark-token system via attribute selectors. Server enforces
 * future-only (INVALID_FOLLOWUP_PAST) and so do we — calling onChange
 * with a past value triggers the validation toast.
 *
 * NULL-clearable: an explicit "Clear" button sends `null` to the patch.
 *
 * 44px tap targets enforced via min-h on the input + buttons.
 */

import { useMemo } from 'react'
import { CalendarClock, X } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { DateField } from '@/components/ui/DateField'
import { Button } from '@/components/ui/Button'

interface FollowUpDatePickerProps {
  /** Current follow-up ISO datetime, or null when unset. */
  value: string | null
  /** Called with new ISO datetime, or null to clear. */
  onChange: (value: string | null) => void
  /** Validation error message (shown below input). */
  error?: string | null
  disabled?: boolean
}

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // YYYY-MM-DDTHH:mm — local time, no seconds/timezone for native picker.
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalDatetimeInput(local: string): string | null {
  if (!local) return null
  // datetime-local has no timezone — interpret as local, convert to ISO.
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export function FollowUpDatePicker({
  value,
  onChange,
  error,
  disabled = false,
}: FollowUpDatePickerProps) {
  const { t } = useLanguage()
  const localValue = useMemo(() => toLocalDatetimeInput(value), [value])

  // Min = now (+1min to defeat clock-skew edge cases on the next-second tick).
  const min = useMemo(() => {
    const d = new Date(Date.now() + 60_000)
    return toLocalDatetimeInput(d.toISOString())
  }, [])

  return (
    <div className="follow-up-picker">
      <label className="follow-up-picker__label" htmlFor="follow-up-at">
        <CalendarClock size={16} aria-hidden="true" />
        <span>{t.crmFollowUpAt}</span>
      </label>
      <div className="follow-up-picker__input-row">
        <DateField
          id="follow-up-at"
          type="datetime-local"
          className="follow-up-picker__input"
          value={localValue}
          min={min}
          onChange={(e) => onChange(fromLocalDatetimeInput(e.target.value))}
          aria-describedby={error ? 'follow-up-at-error' : undefined}
          aria-invalid={error ? true : undefined}
          disabled={disabled}
          placeholder={t.crmFollowUpPickerPlaceholder}
        />
        {value && (
          <Button variant="none"
            type="button"
            className="follow-up-picker__clear"
            onClick={() => onChange(null)}
            aria-label={t.crmClearFollowUp}
            disabled={disabled}
          >
            <X size={18} aria-hidden="true" />
          </Button>
        )}
      </div>
      {error && (
        <p
          id="follow-up-at-error"
          className="follow-up-picker__error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
}
