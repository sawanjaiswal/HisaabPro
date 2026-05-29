/** NotificationPreferencesPage — per-channel toggles + quiet hours */

import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Bell } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useNotificationPreferences, useUpdatePreferences } from '../useNotifications'
import { NotificationQuietHoursCard } from '../components/NotificationQuietHoursCard'
import type { NotificationPreferenceRow, NotificationChannel } from '../notifications.types'
import '../notifications.css'

// ─── Toggle ───────────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
  ariaLabel: string
}

function Toggle({ checked, disabled = false, onChange, ariaLabel }: ToggleProps) {
  return (
    <label className="notif-toggle" aria-label={ariaLabel}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="notif-toggle__track" />
    </label>
  )
}

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
          <Toggle
            checked={row.inApp}
            disabled={isPending}
            onChange={(v) => onToggle('IN_APP', v)}
            ariaLabel={`${eventLabel} — ${t.notifChannelInApp ?? 'In-app'}`}
          />
          <span className="notif-prefs__channel-label">{t.notifChannelInApp ?? 'App'}</span>
        </div>
        <div className="notif-prefs__channel-col">
          <Toggle
            checked={row.push}
            disabled={isPending}
            onChange={(v) => onToggle('PUSH', v)}
            ariaLabel={`${eventLabel} — ${t.notifChannelPush ?? 'Push'}`}
          />
          <span className="notif-prefs__channel-label">{t.notifChannelPush ?? 'Push'}</span>
        </div>
        <div className="notif-prefs__channel-col">
          <Toggle
            checked={row.email}
            disabled={isPending}
            onChange={(v) => onToggle('EMAIL', v)}
            ariaLabel={`${eventLabel} — ${t.notifChannelEmail ?? 'Email'}`}
          />
          <span className="notif-prefs__channel-label">{t.notifChannelEmail ?? 'Email'}</span>
        </div>
        <div className="notif-prefs__channel-col">
          <Toggle
            checked={false}
            disabled
            onChange={() => { /* WhatsApp stub — coming soon */ }}
            ariaLabel={`${eventLabel} — WhatsApp (${t.notifComingSoon ?? 'coming soon'})`}
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

function PrefsSkeleton() {
  return (
    <div className="notif-prefs-skeleton" aria-busy="true" aria-label="Loading preferences">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="notif-prefs-skeleton__row">
          <div className="notif-prefs-skeleton__label" />
          <div style={{ display: 'flex', gap: '1rem' }}>
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

  // ── Loading ──────────────────────────────────────────────────────────────
  if (status === 'pending') {
    return (
      <AppShell>
        <Header
          title={t.notifPrefsTitle ?? 'Notification Preferences'}
          backTo={ROUTES.NOTIFICATIONS}
        />
        <PageContainer>
          <PrefsSkeleton />
        </PageContainer>
      </AppShell>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <AppShell>
        <Header
          title={t.notifPrefsTitle ?? 'Notification Preferences'}
          backTo={ROUTES.NOTIFICATIONS}
        />
        <PageContainer>
          <ErrorState
            message={t.notifLoadError ?? 'Could not load preferences. Tap to retry.'}
            onRetry={() => refetch()}
          />
        </PageContainer>
      </AppShell>
    )
  }

  const rows = prefs ?? []

  // ── Success ──────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <Header
        title={t.notifPrefsTitle ?? 'Notification Preferences'}
        backTo={ROUTES.NOTIFICATIONS}
      />
      <PageContainer>
        {/* Channel header */}
        <div className="notif-prefs__row" style={{ background: 'var(--color-gray-50)' }}>
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

        <NotificationQuietHoursCard />
      </PageContainer>
    </AppShell>
  )
}
