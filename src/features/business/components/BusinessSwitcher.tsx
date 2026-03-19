import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Plus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ROUTES } from '@/config/routes.config'
import { getBusinessInitials, getBusinessColor } from '../business.utils'

interface BusinessSwitcherProps {
  onClose: () => void
}

export function BusinessSwitcher({ onClose }: BusinessSwitcherProps) {
  const { user, businesses, switchBusiness, isSwitching } = useAuth()
  const navigate = useNavigate()
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSwitch = async (businessId: string) => {
    if (businessId === user?.businessId || isSwitching) return
    await switchBusiness(businessId)
    onClose()
  }

  const handleAddBusiness = () => {
    onClose()
    navigate(ROUTES.ONBOARDING)
  }

  return (
    <>
      <div
        ref={overlayRef}
        className="business-switcher-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="business-switcher-sheet" role="dialog" aria-label="Switch business">
        <div className="business-switcher-handle" />
        <div className="business-switcher-title">Your Businesses</div>
        <ul className="business-switcher-list">
          {businesses.map(biz => {
            const isActive = biz.id === user?.businessId
            return (
              <li key={biz.id}>
                <button
                  type="button"
                  className={`business-switcher-item${isActive ? ' business-switcher-item--active' : ''}`}
                  onClick={() => handleSwitch(biz.id)}
                  disabled={isSwitching}
                >
                  <span
                    className="business-avatar"
                    style={{ background: getBusinessColor(biz.id), width: 40, height: 40, fontSize: '0.8125rem' }}
                  >
                    {getBusinessInitials(biz.name)}
                  </span>
                  <span className="business-switcher-item-info">
                    <span className="business-switcher-item-name">{biz.name}</span>
                    <span className="business-switcher-item-role">{biz.roleName}</span>
                  </span>
                  {isActive && <Check size={18} className="business-switcher-check" aria-label="Active" />}
                </button>
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          className="business-switcher-add"
          onClick={handleAddBusiness}
        >
          <Plus size={20} />
          Add Business
        </button>
      </div>
    </>
  )
}
