/** AttendanceGrid — Phase 6 PR5 FE
 *
 * Renders the Employee × Day matrix. Desktop ≥md = full grid (rows: employees,
 * columns: days). Mobile <md = single-day list (rows: employees, single cell)
 * — the caller collapses the date range to the active mobile day.
 *
 * Click semantics:
 *   tap a pill → cycle to the next status (PRESENT → HALF_DAY → ABSENT →
 *   LEAVE_PAID → LEAVE_UNPAID → PRESENT). The pending state lives in
 *   usePendingAttendance(); the grid is a controlled component that just
 *   reflects (persisted ∪ pending).
 */

import { useMemo } from 'react'
import { AttendanceStatusPill } from './AttendanceStatusPill'
import { ATTENDANCE_CYCLE } from '../hr.constants'
import { cellKey, nextStatus, selectCellStatus } from '../useAttendance'
import type {
  AttendanceCellKey,
  AttendanceRow,
  AttendanceStatus,
  EmployeeLite,
} from '../hr.types'

interface AttendanceGridProps {
  employees: EmployeeLite[]
  dates: string[]                                                // yyyy-mm-dd in chronological order
  persistedByCell: Map<AttendanceCellKey, AttendanceRow>
  pendingByCell: Map<AttendanceCellKey, AttendanceStatus>
  onCellChange: (employeeId: string, date: string, status: AttendanceStatus) => void
  /** Mobile only — when true, render a single column (date[0]) instead of the full range. */
  mobileSingleDay?: boolean
}

const DAY_LABEL_FMT = new Intl.DateTimeFormat('en-IN', { weekday: 'short' })
const DAY_NUM_FMT = new Intl.DateTimeFormat('en-IN', { day: 'numeric' })
const FULL_FMT = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short', month: 'short', day: 'numeric',
})

function dayShortLabel(iso: string): string {
  return `${DAY_LABEL_FMT.format(new Date(iso))} ${DAY_NUM_FMT.format(new Date(iso))}`
}

function fullLabel(iso: string): string {
  return FULL_FMT.format(new Date(iso))
}

export function AttendanceGrid({
  employees,
  dates,
  persistedByCell,
  pendingByCell,
  onCellChange,
  mobileSingleDay = false,
}: AttendanceGridProps) {
  /** The list of dates we actually paint on this device.
   * Mobile collapses to the first date so the layout fits 320px. */
  const desktopDates = dates
  const mobileDates = useMemo(() => (dates.length > 0 ? [dates[0]] : []), [dates])

  // Click handler: cycle the (employeeId, date) cell to its next status.
  // The cycle is shared across persisted + pending — tapping a green pill
  // first time goes to HALF_DAY (the next slot in ATTENDANCE_CYCLE), not
  // a "reset to undecided" state.
  const handleCellClick = (employee: EmployeeLite, date: string) => {
    const { status } = selectCellStatus(persistedByCell, pendingByCell, employee.id, date)
    const next = nextStatus(status, ATTENDANCE_CYCLE)
    onCellChange(employee.id, date, next)
  }

  if (employees.length === 0 || dates.length === 0) return null

  return (
    <div
      role="grid"
      aria-label="Attendance"
      style={{ width: '100%', overflowX: 'auto' }}
    >
      {/* Desktop grid — hidden <md via CSS class */}
      <table
        className={mobileSingleDay ? 'hidden md:table' : 'w-full'}
        style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 'var(--space-2)',
          tableLayout: 'fixed',
        }}
      >
        <thead>
          <tr>
            <th
              scope="col"
              style={{
                textAlign: 'left',
                padding: 'var(--space-2)',
                fontSize: 'var(--fs-sm, 0.875rem)',
                color: 'var(--color-gray-600)',
                fontWeight: 600,
                minWidth: 140,
              }}
            >
              Employee
            </th>
            {(mobileSingleDay ? desktopDates : desktopDates).map((date) => (
              <th
                key={`hd-${date}`}
                scope="col"
                style={{
                  textAlign: 'center',
                  padding: 'var(--space-2)',
                  fontSize: 'var(--fs-sm, 0.875rem)',
                  color: 'var(--color-gray-600)',
                  fontWeight: 600,
                  minWidth: 100,
                }}
              >
                {dayShortLabel(date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.id}>
              <th
                scope="row"
                style={{
                  textAlign: 'left',
                  padding: 'var(--space-2)',
                  fontWeight: 500,
                  fontSize: 'var(--fs-md, 1rem)',
                  color: 'var(--color-gray-700)',
                  background: 'var(--color-gray-50)',
                  borderRadius: 'var(--radius-md)',
                  verticalAlign: 'middle',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>{emp.name}</span>
                  {emp.role && (
                    <span style={{
                      fontSize: 'var(--fs-xs, 0.75rem)',
                      color: 'var(--color-gray-500)',
                      fontWeight: 400,
                    }}>{emp.role}</span>
                  )}
                </div>
              </th>
              {desktopDates.map((date) => {
                const { status, isDirty } = selectCellStatus(persistedByCell, pendingByCell, emp.id, date)
                return (
                  <td
                    key={`${emp.id}-${date}`}
                    style={{ padding: 'var(--space-1)', textAlign: 'center', verticalAlign: 'middle' }}
                  >
                    <AttendanceStatusPill
                      status={status}
                      isDirty={isDirty}
                      employeeName={emp.name}
                      dateLabel={fullLabel(date)}
                      onCycle={() => handleCellClick(emp, date)}
                      compact={desktopDates.length > 7}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile single-day list — visible <md only (md:hidden) */}
      {mobileSingleDay && (
        <ul
          className="md:hidden"
          aria-label="Attendance (mobile single-day view)"
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          {mobileDates.length > 0 && (
            <li style={{
              fontSize: 'var(--fs-sm, 0.875rem)',
              color: 'var(--color-gray-600)',
              fontWeight: 600,
              padding: 'var(--space-2) var(--space-3)',
            }}>
              {fullLabel(mobileDates[0])}
            </li>
          )}
          {employees.map((emp) => {
            const date = mobileDates[0]
            if (!date) return null
            const { status, isDirty } = selectCellStatus(persistedByCell, pendingByCell, emp.id, date)
            return (
              <li
                key={`m-${emp.id}-${cellKey(emp.id, date)}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3)',
                  background: 'var(--color-gray-0, white)',
                  border: '1px solid var(--color-gray-100)',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{
                    fontSize: 'var(--fs-md, 1rem)',
                    fontWeight: 500,
                    color: 'var(--color-gray-700)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>{emp.name}</span>
                  {emp.role && (
                    <span style={{
                      fontSize: 'var(--fs-xs, 0.75rem)',
                      color: 'var(--color-gray-500)',
                    }}>{emp.role}</span>
                  )}
                </div>
                <AttendanceStatusPill
                  status={status}
                  isDirty={isDirty}
                  employeeName={emp.name}
                  dateLabel={fullLabel(date)}
                  onCycle={() => handleCellClick(emp, date)}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
