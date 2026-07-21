/** BusinessSwitcher — pick the active business from a bottom sheet.
 *
 * Built on <Drawer>, which owns the backdrop, portal, focus trap, Escape and
 * drag-to-dismiss (PLATFORM_SHELL C6). It used to hand-roll all of that plus
 * its own fixed-bottom positioning.
 */

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Plus, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { getBusinessInitials, getBusinessColor } from '../business.utils'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'

interface BusinessSwitcherProps {
  open: boolean
  onClose: () => void
}

export function BusinessSwitcher({ open, onClose }: BusinessSwitcherProps) {
  const { t } = useLanguage()
  const { user, businesses, switchBusiness, isSwitching, switchingBusinessId } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const handleSwitch = useCallback(async (businessId: string) => {
    if (businessId === user?.businessId || isSwitching) return
    try {
      await switchBusiness(businessId)
      onClose()
    } catch {
      toast.error(t.failedSwitchBusiness)
    }
  }, [user?.businessId, isSwitching, switchBusiness, onClose, toast, t])

  const handleAddBusiness = () => {
    onClose()
    navigate(ROUTES.ONBOARDING)
  }

  return (
    <Drawer open={open} onClose={onClose} title={t.yourBusinesses} size="sm">
      <ul className="business-switcher-list">
        {businesses.map((biz) => {
          const isActive = biz.id === user?.businessId
          return (
            <li key={biz.id}>
              <Button variant="none"
                type="button"
                className={`business-switcher-item${isActive ? ' business-switcher-item--active' : ''}`}
                onClick={() => handleSwitch(biz.id)}
                disabled={isSwitching}
                aria-current={isActive ? 'true' : undefined}
              >
                <span
                  className="business-avatar business-avatar--list"
                  style={{ background: getBusinessColor(biz.id) }}
                >
                  {getBusinessInitials(biz.name)}
                </span>
                <span className="business-switcher-item-info">
                  <span className="business-switcher-item-name">{biz.name}</span>
                  <span className="business-switcher-item-role">
                    {switchingBusinessId === biz.id ? '' : biz.roleName}
                    {switchingBusinessId === biz.id && (
                      <Loader2 size={14} className="spinner" aria-label={t.switching} />
                    )}
                  </span>
                </span>
                {isActive && <Check size={18} className="business-switcher-check" aria-hidden="true" />}
              </Button>
            </li>
          )
        })}
      </ul>
      <Button variant="none"
        type="button"
        className="business-switcher-add"
        onClick={handleAddBusiness}
      >
        <Plus size={20} aria-hidden="true" />
        {t.addBusiness}
      </Button>
    </Drawer>
  )
}
