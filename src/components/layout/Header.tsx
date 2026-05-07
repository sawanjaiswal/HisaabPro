/** Header — global app header. Consistent on every page.
 *
 * Layout: [brand | back+title]  ............ [page tools] [sync] [☰]
 *
 * The hamburger fires OPEN_SIDE_NAV_EVENT, picked up by the global <SideNav />
 * mounted in App.tsx. Page-specific tools (Scan, Filter, etc.) go via the
 * `actions` prop and render to the LEFT of the always-on sync + menu icons.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Menu } from 'lucide-react'
import { APP_NAME } from '@/config/app.config'
import { ROUTES } from '@/config/routes.config'
import { OPEN_SIDE_NAV_EVENT } from '@/config/events.config'
import { SyncStatusIcon } from '@/components/feedback/SyncStatusIcon'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'

interface HeaderProps {
  /** Page title — shown when `backTo` is set (sub-page mode). */
  title?: string
  /** Show a back arrow on the left — string = navigate to path; true = history.back() */
  backTo?: string | true
  /** Page-specific action icons (Scan, Filter, etc.). Render LEFT of sync + ☰. */
  actions?: ReactNode
  /** Apply a frosted-glass background only after the user scrolls 16px+. Default: false. */
  scrollCondense?: boolean
}

export function Header({
  title,
  backTo,
  actions,
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

  const openSideNav = () => window.dispatchEvent(new Event(OPEN_SIDE_NAV_EVENT))

  const className = [
    'header',
    scrollCondense && 'header--scroll-condense',
    scrollCondense && isScrolled && 'is-scrolled',
  ].filter(Boolean).join(' ')

  return (
    <header className={className}>
      <div className="header-leading">
        {backTo !== undefined ? (
          <>
            <button
              type="button"
              className="header-back"
              onClick={handleBack}
              aria-label="Go back"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            {title && <h1 className="header-title">{title}</h1>}
          </>
        ) : (
          <button
            type="button"
            className="header-brand"
            onClick={() => navigate(ROUTES.DASHBOARD)}
            aria-label={`${APP_NAME} home`}
          >
            <img
              src="/favicon.svg"
              alt=""
              className="header-brand-logo"
              width={28}
              height={28}
              aria-hidden="true"
            />
            <span className="header-brand-name">{title ?? APP_NAME}</span>
          </button>
        )}
      </div>

      <div className="header-actions">
        {actions}
        <NotificationBell />
        <SyncStatusIcon />
        <button
          type="button"
          className="header-icon-btn"
          onClick={openSideNav}
          aria-label="Open menu"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
