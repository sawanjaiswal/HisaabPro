/** Party Ledger — compact month & date preset selector → Drawer */

import { useMemo, useState } from 'react'
import { ChevronDown, Check, CalendarRange } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { useLanguage } from '@/hooks/useLanguage'

interface LedgerMonthPickerProps {
  /** Current range start (YYYY-MM-DD). */
  from: string
  /** Current range end (YYYY-MM-DD). */
  to: string
  /** Commit a selection as a [from, to] range. */
  onChange: (from: string, to: string) => void
}

interface DateOption {
  from: string
  to: string
  label: string
}

const fmt = (d: Date) => d.toISOString().slice(0, 10)

/** Build common date range presets. */
function buildPresets(t: Record<string, string>): DateOption[] {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()

  const thisMonthFirst = new Date(Date.UTC(y, m, 1))
  const thisMonthLast = new Date(Date.UTC(y, m + 1, 0))

  const d30 = new Date()
  d30.setDate(d30.getDate() - 30)

  const d90 = new Date()
  d90.setDate(d90.getDate() - 90)

  return [
    { from: fmt(thisMonthFirst), to: fmt(thisMonthLast), label: t.thisMonth || 'This Month' },
    { from: fmt(d30), to: fmt(now), label: t.last30Days || 'Last 30 Days' },
    { from: fmt(d90), to: fmt(now), label: t.last90Days || 'Last 90 Days' },
    { from: '2020-01-01', to: fmt(now), label: t.viewAll || t.all || 'All Time' },
  ]
}

/** Build the last `count` calendar months, newest first. */
function buildRecentMonths(count: number): DateOption[] {
  const now = new Date()
  const out: DateOption[] = []
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

function resolveLabel(from: string, to: string, presets: DateOption[]): string {
  const matchedPreset = presets.find((p) => p.from === from && p.to === to)
  if (matchedPreset) return matchedPreset.label

  const dFrom = new Date(from)
  if (Number.isNaN(dFrom.getTime())) return ''

  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(dFrom)
}

export function LedgerMonthPicker({ from, to, onChange }: LedgerMonthPickerProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const presets = useMemo(() => buildPresets(t as unknown as Record<string, string>), [t])
  const months = useMemo(() => buildRecentMonths(12), [])
  const label = useMemo(() => resolveLabel(from, to, presets), [from, to, presets])

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
        <div className="ledger-picker-drawer-body">
          {/* Quick presets */}
          <div className="ledger-presets-grid" role="group" aria-label={t.dateRange ?? 'Date Range'}>
            {presets.map((p) => {
              const active = from === p.from && to === p.to
              return (
                <Button
                  variant={active ? 'primary' : 'outline'}
                  size="sm"
                  key={p.label}
                  className={`ledger-preset-chip${active ? ' active' : ''}`}
                  onClick={() => {
                    onChange(p.from, p.to)
                    setOpen(false)
                  }}
                >
                  <CalendarRange size={13} aria-hidden="true" />
                  <span>{p.label}</span>
                </Button>
              )
            })}
          </div>

          <div className="ledger-drawer-divider" />

          {/* Month by month list */}
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
        </div>
      </Drawer>
    </>
  )
}

