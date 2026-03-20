import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { APP_NAME } from '@/config/app.config'
import { BusinessAvatar } from '@/features/business/BusinessAvatar'

interface HeaderProps {
  title?: string
  /** Show a back arrow on the left — navigates to `backTo` path, or history.back() when `true` */
  backTo?: string | true
  /** Right-side action buttons (edit, more, etc.) */
  actions?: ReactNode
  /** Show business avatar (default true on root pages, false on sub-pages with back) */
  showBusinessAvatar?: boolean
}

export function Header({ title = APP_NAME, backTo, actions, showBusinessAvatar }: HeaderProps) {
  const navigate = useNavigate()
  // Show avatar on root pages (no back button), unless explicitly overridden
  const shouldShowAvatar = showBusinessAvatar ?? (backTo === undefined)

  const handleBack = () => {
    if (typeof backTo === 'string' && backTo) {
      navigate(backTo)
    } else {
      navigate(-1)
    }
  }

  return (
    <header className="header">
      <div className="header-leading">
        {shouldShowAvatar && <BusinessAvatar />}
        {backTo !== undefined && (
          <button
            type="button"
            className="header-back"
            onClick={handleBack}
            aria-label="Go back"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        )}
        <h1 className="header-title">{title}</h1>
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  )
}
