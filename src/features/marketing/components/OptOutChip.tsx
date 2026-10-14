import { ShieldOff } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Badge } from '@/components/ui/Badge'

export function OptOutChip() {
  const { t } = useLanguage()
  const label = t.marketingOptOutChipLabel
  return (
    <Badge
      variant="warning"
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1 text-[11px] py-0.5 px-1.5"
    >
      <ShieldOff size={11} aria-hidden="true" />
      {label}
    </Badge>
  )
}
