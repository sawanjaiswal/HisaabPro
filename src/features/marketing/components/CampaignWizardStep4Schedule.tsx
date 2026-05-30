/** CampaignWizardStep4 — Schedule (send now vs future) */

import { useLanguage } from '@/hooks/useLanguage'
import { QuietHoursNotice } from './QuietHoursNotice'
import { Input } from '@/components/ui/Input'

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          type="button"
          role="radio"
          aria-checked={sendNow}
          onClick={() => handleToggle(true)}
          style={optionStyle(sendNow)}
        >
          <div style={{ fontWeight: 600, fontSize: '15px' }}>{t.marketingSendNowTitle}</div>
          <div style={{ fontSize: '13px', color: sendNow ? 'var(--color-primary-600)' : 'var(--color-gray-400)', marginTop: '2px' }}>
            {t.marketingSendNowDesc}
          </div>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={!sendNow}
          onClick={() => handleToggle(false)}
          style={optionStyle(!sendNow)}
        >
          <div style={{ fontWeight: 600, fontSize: '15px' }}>{t.marketingScheduleLaterTitle}</div>
          <div style={{ fontSize: '13px', color: !sendNow ? 'var(--color-primary-600)' : 'var(--color-gray-400)', marginTop: '2px' }}>
            {t.marketingScheduleLaterDesc}
          </div>
        </button>
      </div>

      {!sendNow && (
        <div>
          <label htmlFor="schedule-datetime" style={labelStyle}>
            {t.marketingScheduleDatetimeLabel} *
          </label>
          <Input
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
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid var(--color-gray-300)',
              fontSize: '16px',
              boxSizing: 'border-box',
            }}
            aria-required={!sendNow}
          />
        </div>
      )}

      <QuietHoursNotice />
    </div>
  )
}

function optionStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '14px 16px',
    borderRadius: '12px',
    border: `2px solid ${active ? 'var(--color-primary-500)' : 'var(--color-gray-200)'}`,
    background: active ? 'var(--color-primary-50)' : 'white',
    cursor: 'pointer',
    textAlign: 'left',
    color: active ? 'var(--color-primary-800)' : 'var(--color-gray-700)',
  }
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-gray-700)',
  marginBottom: '8px',
}
