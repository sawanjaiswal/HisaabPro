/** AttendanceStatusPill — Phase 6 PR5 FE
 *
 * Single-tap pill that cycles through the 5 attendance statuses. Used by
 * AttendanceGrid for every (employee, day) cell. Renders as a transparent
 * "empty" placeholder when `status === null` — i.e. no persisted row AND no
 * pending edit — so users can tap any cell to mark.
 *
 * Visual states:
 *   - persisted: filled pill (--status-bg) with icon + label
 *   - pending  : same fill PLUS a 2px dashed outline in --color-warning-500
 *   - empty    : dotted border, faded label "—"
 *
 * Touch target: 44px minimum on every state (mobile). Desktop ≥md tightens
 * to 36px height because the cell already has a 44px row gutter (CSS).
 */

import { Check, X, CircleDot, Plane, PlaneTakeoff, Plus } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { AttendanceStatus } from '../hr.types'
import {
  ATTENDANCE_STATUS_BG,
  ATTENDANCE_STATUS_COLORS,
  ATTENDANCE_STATUS_I18N_KEYS,
} from '../hr.constants'

type Translations = ReturnType<typeof useLanguage>['t']

interface AttendanceStatusPillProps {
  status: AttendanceStatus | null
  isDirty: boolean
  /** Single tap = advance status. Cell-aware logic lives in the parent. */
  onCycle: () => void
  /** Used in aria-label so screen readers announce which cell is changing. */
  employeeName: string
  dateLabel: string
  /** Tighten the pill to icon-only when the grid column is too narrow. */
  compact?: boolean
}

// Future: long-press cell for OT minutes + note (out of scope for PR5 FE).

const ICON_MAP = {
  Check, X, CircleDot, Plane, PlaneTakeoff,
} as const

function iconFor(status: AttendanceStatus) {
  const map: Record<AttendanceStatus, keyof typeof ICON_MAP> = {
    PRESENT: 'Check', ABSENT: 'X', HALF_DAY: 'CircleDot',
    LEAVE_PAID: 'Plane', LEAVE_UNPAID: 'PlaneTakeoff',
  }
  return ICON_MAP[map[status]]
}

export function AttendanceStatusPill({
  status,
  isDirty,
  onCycle,
  employeeName,
  dateLabel,
  compact = false,
}: AttendanceStatusPillProps) {
  const { t } = useLanguage()
  const isEmpty = status === null

  const labelText = isEmpty
    ? '—'
    : (t[ATTENDANCE_STATUS_I18N_KEYS[status] as keyof Translations] as string | undefined) ?? status

  const Icon = isEmpty ? Plus : iconFor(status)
  const color = isEmpty ? 'var(--color-gray-500)' : ATTENDANCE_STATUS_COLORS[status]
  const bg = isEmpty ? 'transparent' : ATTENDANCE_STATUS_BG[status]
  const border = isEmpty
    ? '1.5px dashed var(--color-gray-300, var(--color-gray-200))'
    : isDirty
      ? '2px dashed var(--color-warning-500)'
      : `1.5px solid ${color}`

  // Aria label combines the action ("mark attendance"), the employee, the day,
  // and the current status so SR users can map the pill back to its cell.
  const ariaLabel =
    (t.attendanceCellAriaLabel as string | undefined)
      ?.replace('{employee}', employeeName)
      ?.replace('{date}', dateLabel)
      ?.replace('{status}', labelText)
    ?? `${employeeName} ${dateLabel} ${labelText}`

  return (
    <button
      type="button"
      onClick={onCycle}
      aria-label={ariaLabel}
      aria-pressed={!isEmpty}
      className="attendance-pill"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        minHeight: 44,
        minWidth: 44,
        padding: 'var(--space-1) var(--space-2)',
        borderRadius: 'var(--radius-full)',
        border,
        background: bg,
        color,
        fontSize: 'var(--fs-sm, 0.875rem)',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'transform 120ms ease, background 120ms ease',
      }}
    >
      <Icon size={16} aria-hidden="true" />
      {!compact && <span>{labelText}</span>}
    </button>
  )
}
