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
      <table className={`${mobileSingleDay ? 'hidden md:table' : 'table'} w-full border-separate [border-spacing:var(--space-2)] table-fixed`}>
        <thead>
          <tr>
            <th
              scope="col"
              className="text-left p-2 text-sm text-[var(--color-gray-600)] font-semibold min-w-[140px]"
            >
              Employee
            </th>
            {desktopDates.map((date) => (
              <th
                key={`hd-${date}`}
                scope="col"
                className="text-center p-2 text-sm text-[var(--color-gray-600)] font-semibold min-w-[100px]"
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
                className="text-left p-2 font-medium text-base text-[var(--color-gray-700)] bg-[var(--color-gray-50)] rounded-md align-middle"
              >
                <div className="flex flex-col">
                  <span>{emp.name}</span>
                  {emp.role && (
                    <span className="text-xs text-[var(--color-gray-500)] font-normal">{emp.role}</span>
                  )}
                </div>
              </th>
              {desktopDates.map((date) => {
                const { status, isDirty } = selectCellStatus(persistedByCell, pendingByCell, emp.id, date)
                return (
                  <td
                    key={`${emp.id}-${date}`}
                    className="p-1 text-center align-middle"
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
          className="md:hidden list-none p-0 m-0 flex flex-col gap-2"
          aria-label="Attendance (mobile single-day view)"
        >
          {mobileDates.length > 0 && (
            <li className="text-sm text-[var(--color-gray-600)] font-semibold px-3 py-2">
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
                className="flex items-center justify-between gap-3 p-3 bg-[var(--color-gray-0,white)] border border-[var(--color-gray-100)] rounded-lg"
              >
                <div className="min-w-0 flex flex-col">
                  <span className="text-base font-medium text-[var(--color-gray-700)] truncate">{emp.name}</span>
                  {emp.role && (
                    <span className="text-xs text-[var(--color-gray-500)]">{emp.role}</span>
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
