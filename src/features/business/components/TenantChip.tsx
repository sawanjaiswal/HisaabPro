/**
 * TenantChip — pill rendered in the SideNav identity row + Header (compact)
 * showing the current firm + its suspend state. Phase 6 #138 PR2 FE.
 *
 *   ┌───────────────────────────────────┐
 *   │ [RT] Raju Traders                 │ ← active
 *   │      Owner                        │
 *   └───────────────────────────────────┘
 *
 *   ┌───────────────────────────────────┐
 *   │ [RT] Raju Traders     • Firm paused │ ← firm-suspended
 *   └───────────────────────────────────┘
 *
 *   ┌───────────────────────────────────┐
 *   │ [RT] Raju Traders     • Paused      │ ← member-suspended
 *   └───────────────────────────────────┘
 *
 *   ┌───────────────────────────────────┐
 *   │ [○○] Switching…                    │ ← loading
 *   └───────────────────────────────────┘
 *
 * 4 states drive the visual treatment via a single `state` prop derived
 * from `suspend.service.deriveSuspendState(activeBusiness)`. The chip is
 * read-only here; clicks are wired by the parent (SideNav opens the
 * switcher; Header opens the SideNav itself).
 */

import { Loader2, PauseCircle } from 'lucide-react'
import type { BusinessSummary } from '@/features/auth/auth.types'
import { useLanguage } from '@/hooks/useLanguage'
import { getBusinessInitials, getBusinessColor } from '../business.utils'
import { deriveSuspendState } from '../suspend.service'
import type { SuspendState } from '../suspend.service'
import './tenant-chip.css'
import { Button } from '@/components/ui/Button'

interface TenantChipProps {
  business: BusinessSummary | null
  loading?: boolean
  /** Optional click handler — when provided, the chip renders as a button. */
  onClick?: () => void
  /** Layout variant. 'full' = SideNav identity row. 'compact' = Header pill. */
  variant?: 'full' | 'compact'
}

const STATE_TO_CLASS: Record<SuspendState | 'loading', string> = {
  active: 'tenant-chip--active',
  'member-suspended': 'tenant-chip--member-suspended',
  'firm-suspended': 'tenant-chip--firm-suspended',
  loading: 'tenant-chip--loading',
}

export function TenantChip({
  business,
  loading = false,
  onClick,
  variant = 'full',
}: TenantChipProps) {
  const { t } = useLanguage()

  const state: SuspendState | 'loading' = loading
    ? 'loading'
    : deriveSuspendState(business)

  const className = [
    'tenant-chip',
    `tenant-chip--${variant}`,
    STATE_TO_CLASS[state],
  ].join(' ')

  const ariaLabel = (() => {
    if (loading) return t.tenantChipSwitching
    if (!business) return t.tenantChipActive
    if (state === 'firm-suspended') return `${business.name} — ${t.tenantChipFirmSuspended}`
    if (state === 'member-suspended') return `${business.name} — ${t.tenantChipMemberSuspended}`
    return `${business.name} — ${t.tenantChipActive}`
  })()

  const content = (
    <>
      <span
        className="tenant-chip__avatar"
        style={business ? { background: getBusinessColor(business.id) } : undefined}
        aria-hidden="true"
      >
        {loading ? (
          <Loader2 size={16} className="tenant-chip__spin" />
        ) : business ? (
          getBusinessInitials(business.name)
        ) : (
          '·'
        )}
      </span>
      <span className="tenant-chip__body">
        <span className="tenant-chip__name">
          {loading ? t.tenantChipSwitching : business?.name ?? ''}
        </span>
        {!loading && business && (
          <span className="tenant-chip__meta">
            {state === 'firm-suspended' && (
              <>
                <PauseCircle size={12} aria-hidden="true" />
                <span>{t.tenantChipFirmSuspended}</span>
              </>
            )}
            {state === 'member-suspended' && (
              <>
                <PauseCircle size={12} aria-hidden="true" />
                <span>{t.tenantChipMemberSuspended}</span>
              </>
            )}
            {state === 'active' && variant === 'full' && (
              <span>{business.roleName}</span>
            )}
          </span>
        )}
      </span>
    </>
  )

  if (onClick) {
    return (
      <Button variant="none"
        type="button"
        className={className}
        onClick={onClick}
        disabled={loading}
        aria-label={ariaLabel}
        data-state={state}
      >
        {content}
      </Button>
    )
  }

  return (
    <div
      className={className}
      role="status"
      aria-label={ariaLabel}
      data-state={state}
    >
      {content}
    </div>
  )
}
