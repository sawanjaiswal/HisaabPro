/** RecurrenceFields — daily/weekly/monthly + count-vs-until mutex.
 *
 *  Mirrors server SF-SEC-2 (≤365d span). Validation messages render inline;
 *  the parent drawer also gates Save on `validateRecurrence` so a bad combo
 *  never reaches the wire.
 */

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select, SelectItem } from '@/components/ui/Select'
import { useLanguage } from '@/hooks/useLanguage'
import { validateRecurrence } from '../recurrence.utils'
import type {
  AppointmentRecurrenceFreq,
  RecurrenceFormState,
} from '../appointment.types'
import type { TranslationKey } from '@/lib/translations'

interface RecurrenceFieldsProps {
  value: RecurrenceFormState
  onChange: (next: RecurrenceFormState) => void
  /** Start of the first occurrence (ISO) — used for span validation. */
  startISO: string
}

const FREQUENCIES: { key: AppointmentRecurrenceFreq; labelKey: TranslationKey }[] = [
  { key: 'DAILY', labelKey: 'repeatDaily' },
  { key: 'WEEKLY', labelKey: 'repeatWeekly' },
  { key: 'MONTHLY', labelKey: 'repeatMonthly' },
]

export function RecurrenceFields({ value, onChange, startISO }: RecurrenceFieldsProps) {
  const { t } = useLanguage()
  const validation = validateRecurrence(value, startISO)

  const toggle = () => onChange({ ...value, enabled: !value.enabled })

  return (
    <section
      className="space-y-3 p-3 rounded-[var(--radius-md)]"
      style={{ background: 'var(--color-surface-muted)' }}
      aria-label={t.recurrence ?? 'Recurrence'}
    >
      <div className="flex items-center justify-between">
        <span className="text-[var(--fs-sm)] font-medium">{t.recurrence ?? 'Recurrence'}</span>
        <Button
          variant="none"
          type="button"
          role="switch"
          aria-checked={value.enabled}
          onClick={toggle}
          className="text-[var(--fs-sm)] min-h-[44px] px-3 rounded-[var(--radius-sm)]"
          style={{
            background: value.enabled ? 'var(--color-primary)' : 'transparent',
            color: value.enabled ? 'var(--color-on-primary, #fff)' : 'var(--color-text)',
            border: '1px solid var(--color-border)',
          }}
        >
          {value.enabled ? (t.on ?? 'On') : (t.repeatNever ?? 'Never')}
        </Button>
      </div>

      {value.enabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="recur-freq" className="text-[var(--fs-sm)] mb-1.5 inline-block">
                {t.frequency ?? 'Frequency'}
              </label>
              <Select
                value={value.frequency}
                onValueChange={(v) => onChange({ ...value, frequency: v as AppointmentRecurrenceFreq })}
                ariaLabel={t.frequency ?? 'Frequency'}
              >
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {(t[f.labelKey] as string | undefined) ?? f.key}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <Input
              label={t.every ?? 'Every'}
              type="number"
              inputMode="numeric"
              min={1}
              max={52}
              value={String(value.interval)}
              onChange={(e) => onChange({ ...value, interval: Math.max(1, Number(e.target.value) || 1) })}
              onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
            />
          </div>

          <fieldset>
            <legend className="text-[var(--fs-sm)] mb-1.5">{t.endsOn ?? 'Ends'}</legend>
            <div className="flex gap-3 items-center mb-2" role="radiogroup" aria-label={t.endsOn ?? 'Ends'}>
              <Button
                variant="none"
                type="button"
                role="radio"
                aria-checked={value.endMode === 'count'}
                onClick={() => onChange({ ...value, endMode: 'count' })}
                className="text-[var(--fs-sm)] min-h-[44px] px-3 rounded-[var(--radius-sm)]"
                style={{
                  background: value.endMode === 'count' ? 'var(--color-primary)' : 'transparent',
                  color: value.endMode === 'count' ? 'var(--color-on-primary, #fff)' : 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {t.occurrences ?? 'Occurrences'}
              </Button>
              <Button
                variant="none"
                type="button"
                role="radio"
                aria-checked={value.endMode === 'until'}
                onClick={() => onChange({ ...value, endMode: 'until' })}
                className="text-[var(--fs-sm)] min-h-[44px] px-3 rounded-[var(--radius-sm)]"
                style={{
                  background: value.endMode === 'until' ? 'var(--color-primary)' : 'transparent',
                  color: value.endMode === 'until' ? 'var(--color-on-primary, #fff)' : 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {t.until ?? 'Until'}
              </Button>
            </div>

            {value.endMode === 'count' ? (
              <Input
                label={t.occurrences ?? 'Occurrences'}
                type="number"
                inputMode="numeric"
                min={1}
                max={52}
                value={String(value.count)}
                onChange={(e) => onChange({ ...value, count: Math.max(1, Number(e.target.value) || 1) })}
                onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
              />
            ) : (
              <Input
                label={t.until ?? 'Until'}
                type="date"
                value={value.until}
                onChange={(e) => onChange({ ...value, until: e.target.value })}
              />
            )}
          </fieldset>

          {!validation.ok && validation.messageKey && (
            <p
              className="text-[var(--fs-sm)]"
              style={{ color: 'var(--color-error)' }}
              role="alert"
            >
              {(t[validation.messageKey] as string | undefined) ?? 'Invalid recurrence'}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
