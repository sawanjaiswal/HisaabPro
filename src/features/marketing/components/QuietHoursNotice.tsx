/** QuietHoursNotice — banner showing TRAI quiet hours enforcement */

import { useLanguage } from '@/hooks/useLanguage'
import { QUIET_HOURS_START, QUIET_HOURS_END } from '../marketing.constants'

interface Props {
  start?: string
  end?: string
}

export function QuietHoursNotice({ start = QUIET_HOURS_START, end = QUIET_HOURS_END }: Props) {
  const { t } = useLanguage()
  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-start',
        padding: '10px 12px',
        borderRadius: '8px',
        background: 'var(--color-primary-50, #eff6ff)',
        border: '1px solid var(--color-primary-200, #bfdbfe)',
        color: 'var(--color-primary-700, #1d4ed8)',
        fontSize: '12px',
        lineHeight: '1.5',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }}>
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12,6 12,12 16,14"/>
      </svg>
      <span>
        <strong>{t.marketingQuietHoursEnforced}:</strong> {start}–{end} · {t.marketingQuietHoursMessage}
      </span>
    </div>
  )
}
