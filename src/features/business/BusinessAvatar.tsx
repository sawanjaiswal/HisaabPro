import { useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getBusinessInitials, getBusinessColor } from './business.utils'
import { BusinessSwitcher } from './components/BusinessSwitcher'
import './business.css'

export function BusinessAvatar() {
  const { user, businesses, isSwitching } = useAuth()
  const [showSwitcher, setShowSwitcher] = useState(false)

  const activeBusiness = businesses.find(b => b.id === user?.businessId) ?? businesses[0]
  const hasMultiple = businesses.length > 1

  const handleTap = useCallback(() => {
    if (hasMultiple) {
      setShowSwitcher(true)
    }
  }, [hasMultiple])

  if (!activeBusiness) return null

  const initials = getBusinessInitials(activeBusiness.name)
  const color = getBusinessColor(activeBusiness.id)

  return (
    <>
      <div className="business-avatar-container">
        <button
          type="button"
          className={`business-avatar${isSwitching ? ' business-avatar--switching' : ''}`}
          style={{ background: color }}
          onClick={handleTap}
          aria-label={`Active business: ${activeBusiness.name}${hasMultiple ? '. Tap to switch.' : ''}`}
        >
          {initials}
        </button>
        {hasMultiple && (
          <div className="business-dots" aria-hidden="true">
            {businesses.slice(0, 3).map(b => (
              <span
                key={b.id}
                className={`business-dot${b.id === activeBusiness.id ? ' business-dot--active' : ''}`}
              />
            ))}
          </div>
        )}
      </div>

      {showSwitcher && (
        <BusinessSwitcher onClose={() => setShowSwitcher(false)} />
      )}
    </>
  )
}

export default BusinessAvatar
