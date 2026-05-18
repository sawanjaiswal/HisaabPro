/**
 * SuspendBanner — full-width banner rendered above page content when the
 * active business is in a suspended state. Phase 6 #138 PR2 FE.
 *
 * Renders nothing in the 'active' state (zero-cost when not needed).
 *
 * Variant decided by `deriveSuspendState(activeBusiness)`:
 *   - firm-suspended  → red banner, owner sees "Reactivate firm" CTA;
 *                       non-owner sees the owner-only hint instead
 *   - member-suspended → amber banner, "Switch business" CTA only
 *
 * The reactivate CTA opens <ReactivationModal>. On success the modal calls
 * `refreshActiveBusiness()` from AuthContext so the banner disappears
 * without a full page reload.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, PauseCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { OPEN_SIDE_NAV_EVENT } from '@/config/events.config'
import { deriveSuspendState } from '../suspend.service'
import { ReactivationModal } from './ReactivationModal'
import './suspend-banner.css'

export function SuspendBanner() {
  const { activeBusiness } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [reactivateOpen, setReactivateOpen] = useState(false)

  const state = deriveSuspendState(activeBusiness)
  if (state === 'active' || !activeBusiness) return null

  const isOwner = activeBusiness.role === 'owner'

  const handleSwitch = () => {
    // Switching is exposed via the SideNav switcher; open it.
    window.dispatchEvent(new Event(OPEN_SIDE_NAV_EVENT))
  }

  const handleGoOnboarding = () => {
    // Member-suspended user with only one firm needs a way to add another.
    navigate(ROUTES.CREATE_BUSINESS)
  }

  return (
    <>
      <div
        className={`suspend-banner suspend-banner--${state}`}
        role="alert"
        data-state={state}
      >
        <div className="suspend-banner__icon" aria-hidden="true">
          {state === 'firm-suspended' ? (
            <PauseCircle size={20} />
          ) : (
            <AlertTriangle size={20} />
          )}
        </div>

        <div className="suspend-banner__body">
          <p className="suspend-banner__title">
            {state === 'firm-suspended'
              ? t.suspendBannerFirmTitle
              : t.suspendBannerMemberTitle}
          </p>
          <p className="suspend-banner__desc">
            {state === 'firm-suspended'
              ? t.suspendBannerFirmBody
              : t.suspendBannerMemberBody}
          </p>
          {state === 'firm-suspended' && !isOwner && (
            <p className="suspend-banner__hint">{t.suspendBannerOwnerOnlyHint}</p>
          )}
        </div>

        <div className="suspend-banner__actions">
          {state === 'firm-suspended' && isOwner && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setReactivateOpen(true)}
            >
              {t.suspendBannerReactivateCta}
            </Button>
          )}
          {state === 'member-suspended' && (
            <Button variant="secondary" size="sm" onClick={handleSwitch}>
              {t.suspendBannerSwitchCta}
            </Button>
          )}
          {state === 'firm-suspended' && !isOwner && (
            <Button variant="secondary" size="sm" onClick={handleGoOnboarding}>
              {t.suspendBannerSwitchCta}
            </Button>
          )}
        </div>
      </div>

      {reactivateOpen && (
        <ReactivationModal
          open={reactivateOpen}
          businessId={activeBusiness.id}
          businessName={activeBusiness.name}
          onClose={() => setReactivateOpen(false)}
        />
      )}
    </>
  )
}
