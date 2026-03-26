import { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Plus, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { getBusinessInitials, getBusinessColor } from '../business.utils'
import { useLanguage } from '@/hooks/useLanguage'

interface BusinessSwitcherProps {
  onClose: () => void
}

export function BusinessSwitcher({ onClose }: BusinessSwitcherProps) {
  const { t } = useLanguage()
  const { user, businesses, switchBusiness, isSwitching, switchingBusinessId } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const sheetRef = useRef<HTMLDivElement>(null)
  const firstFocusRef = useRef<HTMLButtonElement>(null)

  // Focus trap + Escape handler
  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return

    // Focus first item on open
    firstFocusRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key === 'Tab') {
        const focusable = sheet.querySelectorAll<HTMLElement>(
          'button, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSwitch = useCallback(async (businessId: string) => {
    if (businessId === user?.businessId || isSwitching) return
    try {
      await switchBusiness(businessId)
      onClose()
    } catch {
      toast.error('Failed to switch business. Please try again.')
    }
  }, [user?.businessId, isSwitching, switchBusiness, onClose, toast])

  const handleAddBusiness = () => {
    onClose()
    navigate(ROUTES.ONBOARDING)
  }

  return (
    <>
      <div
        className="business-switcher-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        className="business-switcher-sheet"
        role="dialog"
        aria-label={t.switchBusiness}
        aria-modal="true"
      >
        <div className="business-switcher-handle" />
        <div className="business-switcher-title">Your Businesses</div>
        <ul className="business-switcher-list">
          {businesses.map((biz, index) => {
            const isActive = biz.id === user?.businessId
            return (
              <li key={biz.id}>
                <button
                  ref={index === 0 ? firstFocusRef : undefined}
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
                      {switchingBusinessId === biz.id
                        ? ''
                        : biz.roleName}
                      {switchingBusinessId === biz.id && (
                        <Loader2 size={14} className="spinner" aria-label={t.switching} />
                      )}
                    </span>
                  </span>
                  {isActive && <Check size={18} className="business-switcher-check" aria-hidden="true" />}
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
          <Plus size={20} aria-hidden="true" />
          Add Business
        </button>
      </div>
    </>
  )
}
