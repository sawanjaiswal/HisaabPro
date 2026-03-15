import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { APP_NAME } from '@/config/app.config'

interface HeaderProps {
  title?: string
  /** Show a back arrow on the left — navigates to `backTo` path or calls history.back() */
  backTo?: string
  /** Right-side action buttons (edit, more, etc.) */
  actions?: ReactNode
}

export function Header({ title = APP_NAME, backTo, actions }: HeaderProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (backTo) {
      navigate(backTo)
    } else {
      navigate(-1)
    }
  }

  return (
    <header className="header">
      <div className="header-leading">
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
