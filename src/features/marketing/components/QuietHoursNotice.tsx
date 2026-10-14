import { Clock } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { QUIET_HOURS_START, QUIET_HOURS_END } from '../marketing.constants'

interface Props {
  start?: string
  end?: string
}

export function QuietHoursNotice({ start = QUIET_HOURS_START, end = QUIET_HOURS_END }: Props) {
  const { t } = useLanguage()
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs leading-relaxed">
      <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
      <span>
        <strong>{t.marketingQuietHoursEnforced}:</strong> {start}–{end} · {t.marketingQuietHoursMessage}
      </span>
    </div>
  )
}
