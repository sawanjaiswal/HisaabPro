/** NotificationPreferencesPage — per-channel toggles + quiet hours */

import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Bell } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useNotificationPreferences, useUpdatePreferences } from '../useNotifications'
import { NotificationQuietHoursCard } from '../components/NotificationQuietHoursCard'
import type { NotificationPreferenceRow, NotificationChannel } from '../notifications.types'
import '../notifications.css'
import { Switch } from '@/components/ui/Switch'

// ─── Preference Row ───────────────────────────────────────────────────────────

interface PrefRowProps {
  row: NotificationPreferenceRow
  onToggle: (channel: NotificationChannel, value: boolean) => void
  isPending: boolean
  t: Record<string, string>
}

function PrefRow({ row, onToggle, isPending, t }: PrefRowProps) {
  const eventLabel =
    (t as Record<string, string>)[`notifEvent_${row.eventKey}`] ?? row.eventKey

  return (
    <div className="notif-prefs__row">
      <span className="notif-prefs__row-label">{eventLabel}</span>
      <div className="notif-prefs__channel-group">
        <div className="notif-prefs__channel-col">
          <Switch
            checked={row.inApp}
            disabled={isPending}
            onCheckedChange={(v) => onToggle('IN_APP', v)}
            aria-label={`${eventLabel} — ${t.notifChannelInApp ?? 'In-app'}`}
          />
          <span className="notif-prefs__channel-label">{t.notifChannelInApp ?? 'App'}</span>
        </div>
        <div className="notif-prefs__channel-col">
          <Switch
            checked={row.push}
            disabled={isPending}
            onCheckedChange={(v) => onToggle('PUSH', v)}
            aria-label={`${eventLabel} — ${t.notifChannelPush ?? 'Push'}`}
          />
          <span className="notif-prefs__channel-label">{t.notifChannelPush ?? 'Push'}</span>
        </div>
        <div className="notif-prefs__channel-col">
          <Switch
            checked={row.email}
            disabled={isPending}
            onCheckedChange={(v) => onToggle('EMAIL', v)}
            aria-label={`${eventLabel} — ${t.notifChannelEmail ?? 'Email'}`}
          />
          <span className="notif-prefs__channel-label">{t.notifChannelEmail ?? 'Email'}</span>
        </div>
        <div className="notif-prefs__channel-col">
          <Switch
            checked={false}
            disabled
            onCheckedChange={() => { /* WhatsApp stub — coming soon */ }}
            aria-label={`${eventLabel} — WhatsApp (${t.notifComingSoon ?? 'coming soon'})`}
          />
          <span className="notif-prefs__channel-label notif-prefs__coming-soon">
            {t.notifComingSoon ?? 'Soon'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function PrefsSkeleton({ label }: { label: string }) {
  return (
    <div className="notif-prefs-skeleton" aria-busy="true" aria-label={label}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="notif-prefs-skeleton__row">
          <div className="notif-prefs-skeleton__label" />
          <div className="flex gap-4">
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="notif-prefs-skeleton__toggle" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationPreferencesPage() {
  const { t } = useLanguage()
  const { data: prefs, status, refetch } = useNotificationPreferences()
  const updatePref = useUpdatePreferences()
  const rows = prefs ?? []

  function handleToggle(
    row: NotificationPreferenceRow,
    channel: NotificationChannel,
    value: boolean,
  ) {
    const patch = {
      eventKey: row.eventKey,
      inApp:    channel === 'IN_APP' ? value : row.inApp,
      push:     channel === 'PUSH'   ? value : row.push,
      email:    channel === 'EMAIL'  ? value : row.email,
      whatsapp: row.whatsapp,
    }
    updatePref.mutate(patch)
  }

  return (
    <AppShell>
      <Header
        title={t.notifPrefsTitle ?? 'Notification Preferences'}
        backTo={ROUTES.NOTIFICATIONS}
      />
      <HeroPage>
        {status === 'pending' && (
          <PrefsSkeleton label={(t.loading as string) ?? 'Loading preferences'} />
        )}

        {status === 'error' && (
          <ErrorState
            message={t.notifLoadError ?? 'Could not load preferences. Tap to retry.'}
            onRetry={() => refetch()}
          />
        )}

        {status === 'success' && (
          <>
            <div className="notif-prefs">
              {/* Channel header */}
              <div className="notif-prefs__row bg-[var(--color-gray-50)]">
                <span className="notif-prefs__row-label notif-prefs__row-label--muted">
                  {t.notifPrefsEventLabel ?? 'Event'}
                </span>
                <div className="notif-prefs__channel-group">
                  {(['App', 'Push', 'Email', t.notifComingSoon ?? 'WA'] as string[]).map((lbl) => (
                    <div key={lbl} className="notif-prefs__channel-col">
                      <span className="notif-prefs__channel-label">{lbl}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="notif-prefs__section">
                {rows.map((row) => (
                  <PrefRow
                    key={row.id}
                    row={row}
                    onToggle={(ch, v) => handleToggle(row, ch, v)}
                    isPending={updatePref.isPending}
                    t={t as unknown as Record<string, string>}
                  />
                ))}
                {rows.length === 0 && (
                  <EmptyState
                    icon={<Bell size={22} aria-hidden="true" />}
                    title={t.notifPrefsEmpty ?? 'No preferences found.'}
                  />
                )}
              </div>
            </div>

            <NotificationQuietHoursCard />
          </>
        )}
      </HeroPage>
    </AppShell>
  )
}
