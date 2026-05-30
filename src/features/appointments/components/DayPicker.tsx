/** DayPicker — header primitive: prev / today-pill / next + native date input.
 *
 *  Mobile: tap the pill → opens the native date input (which is rendered as
 *  the actual input but visually overlaid by the pill). Desktop (≥md) keeps
 *  the same layout — no popover for FE-2.
 */

import { ChevronLeft, ChevronRight, Calendar as CalIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { dateToISODate, formatDayLabel, isoDateToLocalDate } from '../appointment.utils'

interface DayPickerProps {
  dateISO: string
  onChange: (dateISO: string) => void
  /** Step size in days (1 for day view, 7 for week view). */
  step?: number
}

export function DayPicker({ dateISO, onChange, step = 1 }: DayPickerProps) {
  const { t } = useLanguage()
  const current = isoDateToLocalDate(dateISO)

  const shift = (delta: number) => {
    const d = new Date(current)
    d.setDate(d.getDate() + delta)
    onChange(dateToISODate(d))
  }

  const goToday = () => onChange(dateToISODate(new Date()))

  return (
    <div className="flex items-center gap-1" aria-label={t.date ?? 'Date'}>
      <Button
        variant="none"
        onClick={() => shift(-step)}
        aria-label={t.previous ?? 'Previous'}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[var(--radius-sm)]"
        style={{ background: 'transparent', border: '1px solid var(--color-border)' }}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </Button>

      <label
        className="relative min-h-[44px] flex items-center gap-1.5 px-3 rounded-[var(--radius-sm)] cursor-pointer"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <CalIcon size={14} aria-hidden="true" />
        <span className="text-[var(--fs-sm)] tabular-nums select-none">
          {formatDayLabel(current)}
        </span>
        <input
          type="date"
          value={dateISO}
          onChange={(e) => onChange(e.target.value)}
          aria-label={t.date ?? 'Date'}
          className="absolute inset-0 opacity-0 cursor-pointer"
          style={{ minHeight: '44px' }}
        />
      </label>

      <Button
        variant="secondary"
        onClick={goToday}
        className="min-h-[44px] text-[var(--fs-sm)]"
      >
        {t.today ?? 'Today'}
      </Button>

      <Button
        variant="none"
        onClick={() => shift(step)}
        aria-label={t.next ?? 'Next'}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[var(--radius-sm)]"
        style={{ background: 'transparent', border: '1px solid var(--color-border)' }}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </Button>
    </div>
  )
}
