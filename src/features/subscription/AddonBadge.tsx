/** AddonBadge — small chip showing an active feature addon. */

import { Badge } from '@/components/ui/Badge'
import { useLanguage } from '@/hooks/useLanguage'
import type { ActiveAddon } from './subscription.types'

interface AddonBadgeProps {
  addon: ActiveAddon
}

export function AddonBadge({ addon }: AddonBadgeProps) {
  const { t } = useLanguage()
  const expires = addon.expiresAt ? new Date(addon.expiresAt) : null
  return (
    <div className="inline-flex items-center gap-2">
      <Badge variant="paid">{addon.label}</Badge>
      {expires && (
        <span
          className="text-[var(--fs-xs)]"
          style={{ color: 'var(--text-muted)' }}
        >
          {t.addonExpiresOn} {expires.toLocaleDateString('en-IN')}
        </span>
      )}
    </div>
  )
}

export default AddonBadge
