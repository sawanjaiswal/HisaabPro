/** Party Ledger — compact month dropdown ("June 2025 ▾") → Drawer month list */

import { useMemo, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { useLanguage } from '@/hooks/useLanguage'

interface LedgerMonthPickerProps {
  /** Current range start (YYYY-MM-DD). */
  from: string
  /** Current range end (YYYY-MM-DD). */
  to: string
  /** Commit a month selection as a [from, to] range. */
  onChange: (from: string, to: string) => void
}

interface MonthOption {
  from: string
  to: string
  label: string
}

const fmt = (d: Date) => d.toISOString().slice(0, 10)

/** Build the last `count` calendar months, newest first. */
function buildRecentMonths(count: number): MonthOption[] {
  const now = new Date()
  const out: MonthOption[] = []
  for (let i = 0; i < count; i += 1) {
    const y = now.getUTCFullYear()
    const m = now.getUTCMonth() - i
    const first = new Date(Date.UTC(y, m, 1))
    const last = new Date(Date.UTC(y, m + 1, 0))
    out.push({
      from: fmt(first),
      to: fmt(last),
      label: new Intl.DateTimeFormat('en-IN', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(first),
    })
  }
  return out
}

function monthLabel(from: string): string {
  const d = new Date(from)
  return Number.isNaN(d.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(d)
}

export function LedgerMonthPicker({ from, to, onChange }: LedgerMonthPickerProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const months = useMemo(() => buildRecentMonths(12), [])
  const label = useMemo(() => monthLabel(from), [from])

  return (
    <>
      <Button
        variant="none"
        className="ledger-month-btn"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t.selectMonth}
      >
        <span className="ledger-month-btn__label">{label}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </Button>

      <Drawer open={open} onClose={() => setOpen(false)} title={t.selectMonth}>
        <div className="ledger-month-list" role="listbox" aria-label={t.selectMonth}>
          {months.map((m) => {
            const active = from === m.from && to === m.to
            return (
              <Button
                variant="none"
                key={m.from}
                role="option"
                aria-selected={active}
                className={`ledger-month-option${active ? ' active' : ''}`}
                onClick={() => {
                  onChange(m.from, m.to)
                  setOpen(false)
                }}
              >
                <span>{m.label}</span>
                {active && <Check size={16} aria-hidden="true" />}
              </Button>
            )
          })}
        </div>
      </Drawer>
    </>
  )
}
