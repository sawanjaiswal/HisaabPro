/** OptOutChip — tiny badge on party rows indicating marketing opt-out */

import { ShieldOff } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

export function OptOutChip() {
  const { t } = useLanguage()
  const label = t.optOutListTitle ?? 'Opt-out'
  return (
    <span
      className="badge"
      aria-label={label}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        borderRadius: '999px',
        background: 'var(--color-warning-50)',
        color: 'var(--color-warning-700)',
        fontSize: '11px',
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      <ShieldOff size={11} aria-hidden="true" />
      {label}
    </span>
  )
}
