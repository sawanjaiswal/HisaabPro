/**
 * StatementPeriodPicker — modal with 4 period presets for statement generation.
 *
 * Presets: This Month | Last 3 Months (default) | This FY | Custom
 * On "Generate Statement" → calls onConfirm(from, to) with ISO date strings.
 */

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { Drawer } from '@/components/ui/Drawer'
import { Input } from '@/components/ui/Input'

type Preset = 'this_month' | 'last_3_months' | 'this_fy' | 'custom'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (from: string, to: string) => void
  loading?: boolean
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function todayIST(): Date {
  // Use Asia/Kolkata offset (+5:30) to get correct "today" for FY boundaries.
  const nowIST = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  )
  return nowIST
}

function computePreset(preset: Preset): { from: string; to: string } {
  const today = todayIST()
  const to = toISODate(today)

  if (preset === 'this_month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: toISODate(from), to }
  }
  if (preset === 'last_3_months') {
    const from = new Date(today)
    from.setDate(from.getDate() - 90)
    return { from: toISODate(from), to }
  }
  if (preset === 'this_fy') {
    // Indian FY: 1 Apr to 31 Mar
    const month = today.getMonth() // 0-indexed; April = 3
    const year = today.getFullYear()
    const fyStartYear = month >= 3 ? year : year - 1
    const from = new Date(fyStartYear, 3, 1) // 1 April
    return { from: toISODate(from), to }
  }
  // custom — caller sets dates
  return { from: to, to }
}

export function StatementPeriodPicker({ open, onClose, onConfirm, loading }: Props) {
  const { t } = useLanguage()
  const [preset, setPreset] = useState<Preset>('last_3_months')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const handleConfirm = useCallback(() => {
    if (preset === 'custom') {
      if (!customFrom || !customTo) return
      onConfirm(customFrom, customTo)
    } else {
      const { from, to } = computePreset(preset)
      onConfirm(from, to)
    }
  }, [preset, customFrom, customTo, onConfirm])

  const presets: { id: Preset; label: string }[] = [
    { id: 'this_month',    label: t.stmtThisMonth },
    { id: 'last_3_months', label: t.stmtLast3Months },
    { id: 'this_fy',       label: t.stmtThisFY },
    { id: 'custom',        label: t.stmtCustomRange },
  ]

  const canConfirm = preset !== 'custom' || (Boolean(customFrom) && Boolean(customTo))

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t.stmtSelectPeriod}
      size="sm"
      footer={
        <Button
          variant="primary" size="md"
          style={{ width: '100%' }}
          onClick={handleConfirm}
          disabled={loading || !canConfirm}
          aria-label={t.stmtGenerateStatement}
        >
          {loading ? t.stmtGenerating : t.stmtGenerateStatement}
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {presets.map((p) => (
          <button
            key={p.id}
            className={`btn btn-md ${preset === p.id ? 'btn-primary' : 'btn-outline'}`}
            style={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start' }}
            onClick={() => setPreset(p.id)}
            aria-pressed={preset === p.id}
          >
            {p.label}
          </button>
        ))}

        {preset === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            <div>
              <label className="form-label" htmlFor="stmt-from">{t.stmtFrom}</label>
              <Input
                id="stmt-from"
                type="date"
                className="form-input"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                max={customTo || undefined}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="stmt-to">{t.stmtTo}</label>
              <Input
                id="stmt-to"
                type="date"
                className="form-input"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                min={customFrom || undefined}
              />
            </div>
          </div>
        )}
      </div>
    </Drawer>
  )
}
