/** AttendanceDateNav — Phase 6 PR5 FE
 *
 * Date navigator above the grid. Sits at top: var(--header-height) (allowed —
 * NOT top: 0 — per PLATFORM_SHELL C10). Mobile shows prev/next + range label
 * + Today CTA; desktop adds a Week | Month view toggle.
 *
 * Date math is intentionally manual — the repo has no date-fns. ISO yyyy-mm-dd
 * strings round-trip through `new Date(iso)` for arithmetic and back via
 * toISOString().slice(0, 10).
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'

export type AttendanceView = 'week' | 'month'

interface AttendanceDateNavProps {
  view: AttendanceView
  from: string                                  // yyyy-mm-dd
  to: string                                    // yyyy-mm-dd
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onChangeView: (v: AttendanceView) => void
}

// ─── Date helpers (shared with the page) ─────────────────────────────────────

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Number of days in [from, to] inclusive. */
function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  return Math.round(ms / 86_400_000) + 1
}

/** Human-readable range label, e.g. "May 13 – May 19, 2026". */
function rangeLabel(from: string, to: string): string {
  const fmt = new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric' })
  const fmtFull = new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
  if (daysBetween(from, to) === 1) return fmtFull.format(new Date(from))
  return `${fmt.format(new Date(from))} – ${fmtFull.format(new Date(to))}`
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AttendanceDateNav({
  view,
  from,
  to,
  onPrev,
  onNext,
  onToday,
  onChangeView,
}: AttendanceDateNavProps) {
  const { t } = useLanguage()
  const label = useMemo(() => rangeLabel(from, to), [from, to])

  return (
    <div
      role="toolbar"
      aria-label={t.attendanceTitle as string}
      style={{
        position: 'sticky',
        top: 'var(--header-height)',
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--color-gray-50)',
        borderBottom: '1px solid var(--color-gray-100)',
      }}
    >
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous"
        style={{
          minWidth: 44, minHeight: 44,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--color-gray-200)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-gray-0, white)',
          color: 'var(--color-gray-700)',
          cursor: 'pointer',
        }}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>

      <div
        style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 'var(--fs-md, 1rem)',
          fontWeight: 600,
          color: 'var(--color-gray-700)',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>

      <button
        type="button"
        onClick={onNext}
        aria-label="Next"
        style={{
          minWidth: 44, minHeight: 44,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--color-gray-200)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-gray-0, white)',
          color: 'var(--color-gray-700)',
          cursor: 'pointer',
        }}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>

      <Button size="sm" variant="ghost" onClick={onToday}>
        {t.attendanceTodayCta as string}
      </Button>

      {/* View toggle — desktop only via CSS class (md:flex) */}
      <div className="hidden md:inline-flex" role="tablist" aria-label="View">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'week'}
          onClick={() => onChangeView('week')}
          style={viewBtn(view === 'week')}
        >
          {t.attendanceWeekView as string}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'month'}
          onClick={() => onChangeView('month')}
          style={viewBtn(view === 'month')}
        >
          {t.attendanceMonthView as string}
        </button>
      </div>
    </div>
  )
}

function viewBtn(active: boolean): React.CSSProperties {
  return {
    minHeight: 36,
    padding: 'var(--space-1) var(--space-3)',
    border: '1px solid var(--color-gray-200)',
    borderRadius: 0,
    background: active ? 'var(--color-primary-500)' : 'var(--color-gray-0, white)',
    color: active ? 'var(--color-gray-0, white)' : 'var(--color-gray-700)',
    fontSize: 'var(--fs-sm, 0.875rem)',
    fontWeight: 500,
    cursor: 'pointer',
  }
}
