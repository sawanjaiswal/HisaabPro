/** AttendancePage — Phase 6 PR5 FE
 *
 * /hr/attendance — daily attendance grid (Employee × Day, status pills).
 *
 * Wiring:
 *   - useEmployees()        — list employees; 404 → [] so we can show empty state
 *   - useAttendanceRange()  — load attendance rows for the active week/month
 *   - usePendingAttendance()— in-memory dirty state (React only, NOT localStorage)
 *   - useAttendanceBatch()  — POST /hr/attendance/batch with UUID idem key
 *
 * 4 UI states:
 *   loading  — skeleton grid (the persisted query is pending)
 *   error    — ErrorState with onRetry
 *   empty    — "Add your first employee" (employees=[] → 404 from PR6 endpoint)
 *   success  — AttendanceGrid + sticky save bar (when count > 0)
 *
 * PinGateProvider auto-handles 403 PIN_REQUIRED via api()'s 403 interceptor.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { AttendanceDateNav, isoToday, type AttendanceView } from './components/AttendanceDateNav'
import { AttendanceGrid } from './components/AttendanceGrid'
import { useEmployees } from './useEmployees'
import {
  useAttendanceRange,
  useAttendanceBatch,
  usePendingAttendance,
  usePersistedIndex,
} from './useAttendance'

// ─── Date math (kept tiny — no date-fns in the repo) ─────────────────────────

const DAY_MS = 86_400_000

function shiftIso(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString().slice(0, 10)
}

/** Monday-aligned week containing `iso`. Returns [from, to]. */
function weekRange(iso: string): [string, string] {
  const d = new Date(iso)
  const day = d.getUTCDay() // 0=Sun..6=Sat — we want Monday-start, so offset
  const monOffset = day === 0 ? -6 : 1 - day
  const from = shiftIso(iso, monOffset)
  const to = shiftIso(from, 6)
  return [from, to]
}

/** Calendar month containing `iso`. Returns [from, to]. */
function monthRange(iso: string): [string, string] {
  const d = new Date(iso)
  const from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10)
  const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
  return [from, to]
}

function listDates(from: string, to: string): string[] {
  const out: string[] = []
  let cur = from
  while (cur <= to) { out.push(cur); cur = shiftIso(cur, 1) }
  return out
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { t } = useLanguage()

  // Active range
  const [view, setView] = useState<AttendanceView>('week')
  const [anchor, setAnchor] = useState<string>(() => isoToday())
  const [from, to] = useMemo(
    () => (view === 'week' ? weekRange(anchor) : monthRange(anchor)),
    [view, anchor],
  )
  const dates = useMemo(() => listDates(from, to), [from, to])

  // Mobile single-day view — track the day the user is interacting with on
  // small screens. Defaults to the first day of the active range (= today
  // when in the current week).
  const [mobileDay, setMobileDay] = useState<string>(() => isoToday())
  useEffect(() => {
    if (mobileDay < from || mobileDay > to) setMobileDay(from)
  }, [from, to, mobileDay])

  // Data
  const employeesQuery = useEmployees()
  const employees = employeesQuery.employees

  const employeeIds = useMemo(() => employees.map((e) => e.id), [employees])
  const attendance = useAttendanceRange(from, to, employeeIds.length > 0 ? employeeIds : undefined)
  const persistedByCell = usePersistedIndex(attendance.rows)

  // Pending edits + save mutation
  const pending = usePendingAttendance()
  const batch = useAttendanceBatch()

  const handleSave = () => {
    if (pending.count === 0) return
    batch.mutate(pending.toBatchEntries(), {
      onSuccess: () => pending.clearAll(),
    })
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const isLoading = employeesQuery.status === 'loading' || attendance.status === 'loading'
  const isError = employeesQuery.status === 'error' || attendance.status === 'error'
  const showEmpty = employeesQuery.status === 'success' && employees.length === 0

  return (
    <AppShell>
      <Header title={t.attendanceTitle as string} backTo={ROUTES.DASHBOARD} />

      <AttendanceDateNav
        view={view}
        from={from}
        to={to}
        onPrev={() => setAnchor(shiftIso(anchor, view === 'week' ? -7 : -30))}
        onNext={() => setAnchor(shiftIso(anchor, view === 'week' ? 7 : 30))}
        onToday={() => setAnchor(isoToday())}
        onChangeView={setView}
      />

      <PageContainer
        variant="dashboard"
        className="space-y-6"
        // 8rem leaves room for the sticky save bar AND the bottom-nav.
        // The save bar itself sits at bottom: var(--bottom-nav-height) so it
        // floats above the BottomNav without overlapping it.
      >
        <div style={{ paddingBottom: 'calc(var(--bottom-nav-height) + 4rem)' }}>
          {isLoading && (
            <div aria-busy="true" aria-label={t.loading as string} style={{
              display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
              padding: 'var(--space-4) 0',
            }}>
              {[1, 2, 3, 4].map((n) => (
                <Skeleton key={n} height="56px" />
              ))}
            </div>
          )}

          {isError && (
            <ErrorState
              title={t.attendanceLoadError as string}
              onRetry={() => { employeesQuery.refresh(); attendance.refresh() }}
            />
          )}

          {!isLoading && !isError && showEmpty && (
            <EmptyState
              icon={<UserPlus size={48} aria-hidden="true" />}
              title={t.attendanceNoEmployees as string}
              action={
                <Link to={ROUTES.HR_EMPLOYEES} className="btn btn-primary btn-md">
                  {t.attendanceAddFirstEmployee as string}
                </Link>
              }
            />
          )}

          {!isLoading && !isError && !showEmpty && (
            <AttendanceGrid
              employees={employees}
              dates={view === 'week' && mobileDay ? dates : dates}
              persistedByCell={persistedByCell}
              pendingByCell={pending.pending}
              onCellChange={pending.setCell}
              mobileSingleDay
            />
          )}
        </div>
      </PageContainer>

      {/* Sticky save bar — floats above the BottomNav. Bottom math uses
          --bottom-nav-height (which already includes the safe-area inset) so
          the bar never sits behind the OS gesture pill on edge-to-edge. */}
      {pending.count > 0 && (
        <div
          role="region"
          aria-label={t.attendancePendingCount as string}
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'var(--bottom-nav-height)',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-gray-0, white)',
            borderTop: '1px solid var(--color-gray-100)',
            boxShadow: 'var(--shadow-md, 0 -4px 12px rgba(0,0,0,0.08))',
          }}
        >
          <span style={{ fontSize: 'var(--fs-sm, 0.875rem)', color: 'var(--color-gray-700)' }}>
            {(t.attendancePendingCount as string).replace('{count}', String(pending.count))}
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="ghost" size="sm" onClick={pending.clearAll} disabled={batch.isPending}>
              {t.attendanceDiscardPending as string}
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={batch.isPending}>
              {t.attendanceSavePending as string}
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  )
}
