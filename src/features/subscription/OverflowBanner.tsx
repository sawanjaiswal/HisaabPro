/**
 * OverflowBanner — shown when the business has exceeded its plan limit and
 * is in grace. Reads state from useSubscription; renders null otherwise.
 *
 * Top of page (under <Header>), NOT fixed-positioned (per PLATFORM_SHELL.md
 * fixed-top is a primitive responsibility — this is a content-level alert).
 */

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { useSubscription } from '@/hooks/useSubscription'

interface OverflowBannerProps {
  onUpgrade: () => void
}

function formatTimeLeft(target: Date): { days: number; hours: number } {
  const ms = target.getTime() - Date.now()
  if (ms <= 0) return { days: 0, hours: 0 }
  const days = Math.floor(ms / (24 * 60 * 60 * 1000))
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  return { days, hours }
}

export function OverflowBanner({ onUpgrade }: OverflowBannerProps) {
  const { t } = useLanguage()
  const { isInGrace, graceUntil } = useSubscription()

  if (!isInGrace || !graceUntil) return null
  const { days, hours } = formatTimeLeft(graceUntil)
  const isExpired = days === 0 && hours === 0

  return (
    <div
      role="alert"
      className="mx-4 mt-3 mb-2 rounded-[var(--radius-md)] p-3 flex items-start gap-3"
      style={{
        backgroundColor: 'var(--color-warning-50)',
        border: '1px solid var(--color-warning-500)',
      }}
    >
      <AlertTriangle
        className="w-5 h-5 flex-shrink-0 mt-0.5"
        style={{ color: 'var(--color-warning-500)' }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p
          className="text-[var(--fs-sm)] font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {t.overflowGraceTitle}
        </p>
        <p
          className="text-[var(--fs-xs)] mt-0.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          {isExpired
            ? t.graceExpired
            : `${t.graceExpiresIn} ${days}${t.daysShort} ${hours}${t.hoursShort}`}
          {' — '}
          {t.overflowGraceDesc}
        </p>
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={onUpgrade}
        className="flex-shrink-0 min-h-[44px]"
      >
        {t.upgradeNow}
      </Button>
    </div>
  )
}

export default OverflowBanner
