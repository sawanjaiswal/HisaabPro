/** CampaignWizardStep4 — Schedule (send now vs future) */

import { useLanguage } from '@/hooks/useLanguage'
import { QuietHoursNotice } from './QuietHoursNotice'
import { DateField } from '@/components/ui/DateField'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface Props {
  sendNow: boolean
  scheduledAt: string | null
  onSendNowChange: (sendNow: boolean) => void
  onScheduledAtChange: (iso: string | null) => void
}

export function CampaignWizardStep4Schedule({ sendNow, scheduledAt, onSendNowChange, onScheduledAtChange }: Props) {
  const { t } = useLanguage()
  const handleToggle = (nowMode: boolean) => {
    onSendNowChange(nowMode)
    if (nowMode) onScheduledAtChange(null)
  }

  // Minimum schedule = now + 10 minutes (IST)
  const minDatetime = new Date(Date.now() + 10 * 60 * 1000)
    .toISOString()
    .slice(0, 16)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <Card
          clickable
          role="radio"
          aria-checked={sendNow}
          onClick={() => handleToggle(true)}
          className={cn(
            'flex flex-col items-start p-3.5 rounded-xl border text-left transition-all',
            sendNow
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : 'border-border bg-card hover:border-[var(--border-strong)]'
          )}
        >
          <div className="font-semibold text-sm text-[var(--text-primary)]">{t.marketingSendNowTitle}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            {t.marketingSendNowDesc}
          </div>
        </Card>

        <Card
          clickable
          role="radio"
          aria-checked={!sendNow}
          onClick={() => handleToggle(false)}
          className={cn(
            'flex flex-col items-start p-3.5 rounded-xl border text-left transition-all',
            !sendNow
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : 'border-border bg-card hover:border-[var(--border-strong)]'
          )}
        >
          <div className="font-semibold text-sm text-[var(--text-primary)]">{t.marketingScheduleLaterTitle}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            {t.marketingScheduleLaterDesc}
          </div>
        </Card>
      </div>

      {!sendNow && (
        <div>
          <label htmlFor="schedule-datetime" className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
            {t.marketingScheduleDatetimeLabel} *
          </label>
          <DateField
            id="schedule-datetime"
            type="datetime-local"
            min={minDatetime}
            value={scheduledAt ? new Date(scheduledAt).toISOString().slice(0, 16) : ''}
            onChange={(e) => {
              if (e.target.value) {
                // Treat input as IST — convert to ISO
                const ist = new Date(e.target.value + ':00+05:30')
                onScheduledAtChange(ist.toISOString())
              } else {
                onScheduledAtChange(null)
              }
            }}
            aria-required={!sendNow}
          />
        </div>
      )}

      <QuietHoursNotice />
    </div>
  )
}
