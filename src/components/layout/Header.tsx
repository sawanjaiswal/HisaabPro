import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { APP_NAME } from '@/config/app.config'
import { BusinessAvatar } from '@/features/business/BusinessAvatar'

interface HeaderProps {
  /** Page title. Defaults to APP_NAME. */
  title?: string
  /** Show a back arrow on the left — string = navigate to path; true = history.back() */
  backTo?: string | true
  /** Right-side action buttons (edit, more, settings, etc.) */
  actions?: ReactNode
  /** Override the left slot. When supplied, replaces the default avatar+back arrangement
   *  (use this for the dashboard's avatar+theme combo). */
  leading?: ReactNode
  /** Force-show or force-hide the business avatar. Defaults to: shown on root pages, hidden on sub-pages with a back arrow, ignored when `leading` is set. */
  showBusinessAvatar?: boolean
  /** Center the title using absolute positioning (dashboard variant). */
  centerTitle?: boolean
  /** Apply a frosted-glass background only after the user scrolls 16px+. Default: false (always-on glass). */
  scrollCondense?: boolean
}

export function Header({
  title = APP_NAME,
  backTo,
  actions,
  leading,
  showBusinessAvatar,
  centerTitle = false,
  scrollCondense = false,
}: HeaderProps) {
  const navigate = useNavigate()
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    if (!scrollCondense) return
    const onScroll = () => setIsScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [scrollCondense])

  const handleBack = () => {
    if (typeof backTo === 'string' && backTo) navigate(backTo)
    else navigate(-1)
  }

  // Avatar shown by default on root pages (no back), hidden on sub-pages.
  const shouldShowAvatar = leading ? false : (showBusinessAvatar ?? backTo === undefined)

  const className = [
    'header',
    centerTitle && 'header--center',
    scrollCondense && 'header--scroll-condense',
    scrollCondense && isScrolled && 'is-scrolled',
  ].filter(Boolean).join(' ')

  return (
    <header className={className}>
      <div className="header-leading">
        {leading ?? (
          <>
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
            {!centerTitle && <h1 className="header-title">{title}</h1>}
          </>
        )}
      </div>
      {centerTitle && <h1 className="header-title header-title--center">{title}</h1>}
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  )
}
