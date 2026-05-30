/** NotificationQuietHoursCard — start/end time pickers for quiet hours */

import { useState, useEffect } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { useNotificationSettings, useUpdateSettings } from '../useNotifications'
import '../notifications.css'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

/** Validate HH:MM format */
function isValidTime(val: string): boolean {
  return /^\d{2}:\d{2}$/.test(val)
}

export function NotificationQuietHoursCard() {
  const { t } = useLanguage()
  const { data: settings, status } = useNotificationSettings()
  const updateSettings = useUpdateSettings()

  const [startTime, setStartTime] = useState('22:00')
  const [endTime, setEndTime] = useState('07:00')
  const [enabled, setEnabled] = useState(false)

  // Sync local state when server data loads
  useEffect(() => {
    if (settings) {
      setStartTime(settings.quietHoursStart)
      setEndTime(settings.quietHoursEnd)
      setEnabled(settings.quietHoursEnabled)
    }
  }, [settings])

  const isDirty =
    settings &&
    (startTime !== settings.quietHoursStart ||
      endTime !== settings.quietHoursEnd ||
      enabled !== settings.quietHoursEnabled)

  const isValid = isValidTime(startTime) && isValidTime(endTime)

  function handleSave() {
    if (!isValid) return
    updateSettings.mutate({
      quietHoursEnabled: enabled,
      quietHoursStart: startTime,
      quietHoursEnd: endTime,
    })
  }

  if (status === 'pending') {
    return (
      <div className="notif-quiet-hours" aria-busy="true">
        <div className="notif-prefs-skeleton__label" style={{ width: '40%', marginBottom: '1rem' }} />
        <div className="notif-prefs-skeleton__row">
          <div className="notif-prefs-skeleton__label" />
          <div className="notif-prefs-skeleton__label" />
        </div>
      </div>
    )
  }

  return (
    <div className="notif-quiet-hours">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <h3 className="notif-quiet-hours__title" style={{ margin: 0 }}>
          {t.notifQuietHoursTitle ?? 'Quiet Hours'}
        </h3>
        <label className="notif-toggle" aria-label={t.notifQuietHoursToggle ?? 'Enable quiet hours'}>
          <Input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span className="notif-toggle__track" />
        </label>
      </div>

      <div className="notif-quiet-hours__fields" style={{ opacity: enabled ? 1 : 0.5 }}>
        <div className="notif-quiet-hours__field">
          <label className="notif-quiet-hours__label" htmlFor="quiet-start">
            {t.notifQuietHoursStart ?? 'Start (HH:MM)'}
          </label>
          <Input
            id="quiet-start"
            type="time"
            className="notif-quiet-hours__input"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            disabled={!enabled}
            aria-label={t.notifQuietHoursStart ?? 'Start time'}
          />
        </div>

        <div className="notif-quiet-hours__field">
          <label className="notif-quiet-hours__label" htmlFor="quiet-end">
            {t.notifQuietHoursEnd ?? 'End (HH:MM)'}
          </label>
          <Input
            id="quiet-end"
            type="time"
            className="notif-quiet-hours__input"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            disabled={!enabled}
            aria-label={t.notifQuietHoursEnd ?? 'End time'}
          />
        </div>
      </div>

      <Button variant="none"
        type="button"
        className="notif-quiet-hours__save-btn"
        onClick={handleSave}
        disabled={!isDirty || !isValid || updateSettings.isPending}
      >
        {updateSettings.isPending
          ? (t.notifSaving ?? 'Saving…')
          : (t.notifQuietHoursSave ?? 'Save Quiet Hours')}
      </Button>
    </div>
  )
}
