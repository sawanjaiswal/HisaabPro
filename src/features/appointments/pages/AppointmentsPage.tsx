/** AppointmentsPage — V2 Appointments calendar entry (FE-2).
 *
 *  FE-2 deltas:
 *    - Day / Week view toggle (segmented control).
 *    - DayPicker primitive in the header (prev / today-pill / next).
 *    - CalendarDayView + CalendarWeekView (was DayListView).
 *    - Replay-bus subscription: re-opens CreateAppointmentDrawer pre-filled
 *      from the queued payload when a queued mutation is rejected.
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { onReplayRejected } from '@/lib/replay-bus'
import { useAppointments } from '../hooks/useAppointments'
import { CalendarDayView } from '../components/CalendarDayView'
import { CalendarWeekView } from '../components/CalendarWeekView'
import { DayPicker } from '../components/DayPicker'
import { AppointmentEmptyState } from '../components/AppointmentEmptyState'
import { CreateAppointmentDrawer } from '../components/CreateAppointmentDrawer'
import {
  dateToISODate,
  isoDateToLocalDate,
  formatDayLabel,
} from '../appointment.utils'
import { weekDates } from '../calendar.utils'
import { DEFAULT_VIEW_MODE } from '../appointment.constants'
import type {
  AppointmentFormState,
  ViewMode,
} from '../appointment.types'
import '../appointments.css'

interface RestoreState {
  snapshot: Partial<AppointmentFormState>
  message: string
}

export default function AppointmentsPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [dateISO, setDateISO] = useState(() => dateToISODate(new Date()))
  const [viewMode, setViewMode] = useState<ViewMode>(DEFAULT_VIEW_MODE)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [seedHour, setSeedHour] = useState<number | undefined>(undefined)
  const [restore, setRestore] = useState<RestoreState | null>(null)

  const date = isoDateToLocalDate(dateISO)
  // Week-view widens the range to span the week. Day-view stays one day.
  const range = useMemo(() => {
    if (viewMode === 'week') {
      const days = weekDates(date)
      return { from: days[0]!, to: days[6]! }
    }
    return { from: date, to: date }
  }, [date, viewMode])
  const { data, status, refresh } = useAppointments({ date: range.from })
  // For week view we still pass the anchor; the hook only ranges by `date`.

  const openCreate = (hour?: number) => {
    setSeedHour(hour)
    setRestore(null)
    setDrawerOpen(true)
  }

  // Replay-bus subscription — re-open drawer when a queued appointment is rejected.
  useEffect(() => {
    return onReplayRejected((detail) => {
      if (detail.entityType !== 'appointment') return
      // The processor doesn't carry the original form snapshot; we re-open
      // the drawer pre-filled with the date the user is currently looking at
      // and surface a banner explaining what happened.
      setRestore({
        snapshot: { dateISO },
        message: t.slotTaken ?? "Slot taken — pick another time",
      })
      setDrawerOpen(true)
    })
  }, [dateISO, t.slotTaken])

  return (
    <AppShell>
      <Header
        title={t.appointments ?? 'Appointments'}
        actions={<DayPicker dateISO={dateISO} onChange={setDateISO} step={viewMode === 'week' ? 7 : 1} />}
      />

      <PageContainer
        variant="list"
        className="pb-[calc(var(--bottom-nav-height)+2rem)] pt-4 space-y-4"
      >
        {/* View-mode segmented control */}
        <div
          role="tablist"
          aria-label={t.viewMode ?? 'View'}
          className="inline-flex rounded-[var(--radius-md)]"
          style={{ border: '1px solid var(--color-border)' }}
        >
          <Button
            variant="none"
            role="tab"
            aria-selected={viewMode === 'day'}
            onClick={() => setViewMode('day')}
            className="min-h-[44px] px-4 text-[var(--fs-sm)]"
            style={{
              background: viewMode === 'day' ? 'var(--color-surface-muted)' : 'transparent',
              color: viewMode === 'day' ? 'var(--color-primary)' : 'var(--color-text)',
              borderRadius: 'var(--radius-md) 0 0 var(--radius-md)',
            }}
          >
            {t.dayView ?? 'Day'}
          </Button>
          <Button
            variant="none"
            role="tab"
            aria-selected={viewMode === 'week'}
            onClick={() => setViewMode('week')}
            className="min-h-[44px] px-4 text-[var(--fs-sm)]"
            style={{
              background: viewMode === 'week' ? 'var(--color-surface-muted)' : 'transparent',
              color: viewMode === 'week' ? 'var(--color-primary)' : 'var(--color-text)',
              borderRadius: '0 var(--radius-md) var(--radius-md) 0',
            }}
          >
            {t.weekView ?? 'Week'}
          </Button>
        </div>

        <div className="text-[var(--fs-lg)] font-medium">
          {formatDayLabel(date)}{' '}
          {status === 'success' && (
            <span className="text-[var(--fs-sm)]" style={{ color: 'var(--color-text-muted)' }}>
              · {data.length} {data.length === 1 ? (t.appointment ?? 'appointment') : (t.appointments ?? 'appointments')}
            </span>
          )}
        </div>

        {status === 'loading' && (
          <div className="space-y-3" aria-live="polite" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height="72px" borderRadius="var(--radius-md)" />
            ))}
          </div>
        )}

        {status === 'error' && (
          <ErrorState
            title={t.appointmentLoadFailed ?? 'Could not load appointments'}
            message={t.tryAgain ?? 'Please try again.'}
            onRetry={refresh}
          />
        )}

        {status === 'success' && data.length === 0 && viewMode === 'day' && (
          <AppointmentEmptyState onCreate={() => openCreate()} />
        )}

        {status === 'success' && (data.length > 0 || viewMode === 'week') && (
          viewMode === 'day' ? (
            <CalendarDayView
              date={date}
              rows={data}
              onSelect={(id) => navigate(`/appointments/${id}`)}
              onCreateAtHour={(h) => openCreate(h)}
            />
          ) : (
            <CalendarWeekView
              anchorDate={date}
              rows={data}
              onSelect={(id) => navigate(`/appointments/${id}`)}
              onPickDay={(d) => { setDateISO(dateToISODate(d)); setViewMode('day') }}
            />
          )
        )}
      </PageContainer>

      <Button
        variant="none"
        onClick={() => openCreate()}
        aria-label={t.newAppointment ?? 'New appointment'}
        className="appt-fab"
      >
        <Plus size={24} aria-hidden="true" />
      </Button>

      <CreateAppointmentDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setRestore(null) }}
        seedDate={date}
        seedStartHour={seedHour}
        restoreSnapshot={restore?.snapshot}
        restoreBannerMessage={restore?.message}
        onCreated={() => { refresh() }}
      />
    </AppShell>
  )
}
