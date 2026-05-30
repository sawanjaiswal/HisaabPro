/** AppointmentDetailPage — V2 Appointments detail (FE-2).
 *
 *  FE-2 deltas:
 *    - ConvertToBillSheet wired in (was placeholder toast).
 *    - Audit log grouped by day with a sticky section header per day; each
 *      entry shows the relative time (`formatRelativeTime`).
 *    - Vertical sourced from useVertical() so the clinic banner + convert
 *      target (job vs invoice) are correct.
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useLanguage } from '@/hooks/useLanguage'
import { useVertical } from '@/hooks/useVertical'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { formatRelativeTime } from '@/lib/format'
import { getAppointment } from '../appointment.service'
import { StatusActionBar } from '../components/StatusActionBar'
import { ClinicNotesBanner } from '../components/ClinicNotesBanner'
import { ConvertToBillSheet } from '../components/ConvertToBillSheet'
import { useAppointmentMutations } from '../hooks/useAppointmentMutations'
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABEL_KEY,
} from '../appointment.constants'
import {
  formatDayLabel,
  formatLocalTime,
  isFormerParty,
  sameLocalDay,
} from '../appointment.utils'
import type {
  AppointmentStatusEventRow,
  AppointmentVertical,
} from '../appointment.types'
import type { TranslationKey } from '@/lib/translations'

function verticalFromBusinessType(type: string): AppointmentVertical {
  if (type === 'clinic') return 'clinic'
  if (type === 'salon') return 'salon'
  return 'general'
}

function groupEventsByDay(events: AppointmentStatusEventRow[]) {
  const out: { day: Date; events: AppointmentStatusEventRow[] }[] = []
  for (const ev of events) {
    const d = new Date(ev.createdAt)
    const last = out[out.length - 1]
    if (last && sameLocalDay(last.day, d)) last.events.push(ev)
    else out.push({ day: d, events: [ev] })
  }
  return out
}

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const verticalProfile = useVertical()
  const { patchStatus, isPatching } = useAppointmentMutations()
  const [notFound, setNotFound] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)

  const query = useQuery({
    queryKey: queryKeys.appointments.detail(id ?? ''),
    queryFn: ({ signal }) => getAppointment(id!, signal),
    enabled: !!id,
    retry: false,
  })

  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 404) {
      setNotFound(true)
    }
  }, [query.error])

  const row = query.data
  const vertical: AppointmentVertical = verticalFromBusinessType(verticalProfile.type)
  const grouped = useMemo(() => groupEventsByDay(row?.events ?? []), [row?.events])

  return (
    <AppShell>
      <Header title={t.appointment ?? 'Appointment'} backTo />
      <PageContainer
        variant="detail"
        className="pb-[calc(var(--bottom-nav-height)+2rem)] pt-4 space-y-4"
      >
        {query.isPending && (
          <div className="space-y-3" aria-live="polite" aria-busy="true">
            <Skeleton height="32px" />
            <Skeleton height="120px" borderRadius="var(--radius-md)" />
            <Skeleton height="120px" borderRadius="var(--radius-md)" />
          </div>
        )}

        {notFound && (
          <EmptyState
            title={t.appointmentNotFoundTitle ?? 'Appointment not found'}
            description={t.appointmentNotFoundDesc ?? 'It may have been deleted or you may not have access.'}
            action={
              <Button variant="primary" onClick={() => navigate('/appointments')}>
                {t.back ?? 'Back'}
              </Button>
            }
          />
        )}

        {query.error && !notFound && (
          <ErrorState
            title={t.appointmentLoadFailed ?? 'Could not load appointment'}
            onRetry={() => { void query.refetch() }}
          />
        )}

        {row && (
          <>
            {vertical === 'clinic' && <ClinicNotesBanner />}

            <section
              className="space-y-2 p-4 rounded-[var(--radius-md)]"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[var(--fs-lg)] font-medium">{row.partyNameSnapshot}</h2>
                {isFormerParty(row) && <Badge variant="overdue">{t.former ?? 'former'}</Badge>}
                <Badge variant={STATUS_BADGE_VARIANT[row.status]}>
                  {(t[STATUS_LABEL_KEY[row.status] as TranslationKey] as string | undefined) ?? row.status}
                </Badge>
              </div>
              <p
                className="text-[var(--fs-sm)] tabular-nums"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {formatDayLabel(new Date(row.startAt))} · {formatLocalTime(new Date(row.startAt))} → {formatLocalTime(new Date(row.endAt))}
              </p>
              {row.employeeNameSnapshot && (
                <p className="text-[var(--fs-sm)]">{row.employeeNameSnapshot}</p>
              )}
              {row.notes && (
                <p className="text-[var(--fs-sm)]" style={{ color: 'var(--color-text)' }}>
                  {row.notes}
                </p>
              )}
            </section>

            <section
              className="space-y-3 p-4 rounded-[var(--radius-md)]"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <h3 className="text-[var(--fs-base)] font-medium">{t.actions ?? 'Actions'}</h3>
              <StatusActionBar
                row={row}
                isPatching={isPatching}
                onPatch={(to, reason) => {
                  void patchStatus(row.id, { toStatus: to, reason }, row.partyNameSnapshot, row.startAt)
                }}
              />
              <Button variant="secondary" onClick={() => setConvertOpen(true)}>
                {vertical === 'clinic'
                  ? (t.convertToInvoice ?? 'Convert to invoice')
                  : (t.convertToJob ?? 'Convert to job')}
              </Button>
            </section>

            {grouped.length > 0 && (
              <section
                className="space-y-3 p-4 rounded-[var(--radius-md)]"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <h3 className="text-[var(--fs-base)] font-medium">{t.activity ?? 'Activity'}</h3>
                {grouped.map((group, gi) => (
                  <div key={gi} className="space-y-1">
                    <div
                      className="text-[var(--fs-xs)] uppercase sticky top-0 py-1"
                      style={{
                        color: 'var(--color-text-muted)',
                        background: 'var(--color-surface)',
                      }}
                    >
                      {formatDayLabel(group.day)}
                    </div>
                    <ul className="space-y-1 text-[var(--fs-sm)]">
                      {group.events.map((ev) => (
                        <li key={ev.id} className="flex justify-between gap-2">
                          <span>
                            {(t[STATUS_LABEL_KEY[ev.toStatus] as TranslationKey] as string | undefined) ?? ev.toStatus}
                          </span>
                          <span
                            style={{ color: 'var(--color-text-muted)' }}
                            className="tabular-nums"
                            title={formatLocalTime(new Date(ev.createdAt))}
                          >
                            {formatRelativeTime(ev.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            )}

            <ConvertToBillSheet
              open={convertOpen}
              onClose={() => setConvertOpen(false)}
              row={row}
              vertical={vertical}
            />
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
