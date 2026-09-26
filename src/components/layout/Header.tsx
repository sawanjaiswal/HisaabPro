/** Header — global app header. Consistent on every page.
 *
 * Layout: [brand | back+title]  ............ [page actions] [sync] [notifications]
 *
 * Page-specific tools (Scan, Filter, Import, etc.) render via the `actions` prop.
 * Sync status icon and Notification bell render on the homepage (Dashboard/Home)
 * by default, ensuring sub-pages and hero pages remain clean and uncluttered.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { APP_NAME, APP_NAME_MARK } from '@/config/app.config'
import { ROUTES } from '@/config/routes.config'
import { SyncStatusPill } from '@/components/ui/sync-center'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { Heading } from '@/components/ui/Heading'
import { useFlowEngine } from '@/lib/navigation'

interface HeaderProps {
  /** Page title — shown when `backTo` is set (sub-page mode) or custom title on root. */
  title?: string
  /** Subtitle description shown beneath the title */
  subtitle?: string
  /** Show a back arrow on the left — string = fallback parent path; true = auto topology */
  backTo?: string | true
  /** Page-specific action icons (Scan, Filter, Import, etc.). Render LEFT of sync + notification. */
  actions?: ReactNode
  /** Apply a frosted-glass background only after the user scrolls 16px+. Default: false. */
  scrollCondense?: boolean
  /**
   * Visual treatment. When omitted, back-button sub-pages default to
   * `'emerald'` and everything else (brand/root + hero list pages) to
   * `'default'` — see `effectiveVariant` below. Pass explicitly to override.
   * - `'default'` — frosted cream glass, dark foreground.
   * - `'emerald'` — deep-emerald hero surface, white back/title/action icons.
   */
  variant?: 'default' | 'emerald'
  /** Explicitly show or hide the sync status icon. Defaults to true on homepage only. */
  showSync?: boolean
  /** Explicitly show or hide the notifications bell. Defaults to true on homepage only. */
  showNotifications?: boolean
}

export function Header({
  title,
  subtitle,
  backTo,
  actions,
  scrollCondense = false,
  variant,
  showSync,
  showNotifications,
}: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { goBack } = useFlowEngine()
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    if (!scrollCondense) return
    const onScroll = () => setIsScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [scrollCondense])

  const handleBack = () => {
    goBack({ fallbackRoute: typeof backTo === 'string' ? backTo : undefined })
  }

  const isHomePage =
    location.pathname === ROUTES.DASHBOARD ||
    location.pathname === ROUTES.HOME ||
    location.pathname === '/' ||
    location.pathname === '/dashboard'

  const shouldShowSync = showSync ?? isHomePage
  const shouldShowNotifications = showNotifications ?? isHomePage

  // Back-button sub-pages get the emerald hero bar by default; brand/root and
  // scroll-condense hero pages (which bleed transparent) stay on the cream
  // treatment. An explicit `variant` prop always wins.
  const effectiveVariant =
    variant ?? (backTo !== undefined && !scrollCondense ? 'emerald' : 'default')

  const className = [
    'header',
    effectiveVariant === 'emerald' && 'header--emerald',
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
            {title && (
              <div className="flex flex-col min-w-0">
                <Heading level={1} className="header-title truncate">{title}</Heading>
                {subtitle && (
                  <span className="text-[11px] font-normal leading-tight opacity-80 truncate text-current">
                    {subtitle}
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            className="header-brand"
            onClick={() => navigate(ROUTES.DASHBOARD)}
            aria-label={`${APP_NAME} home`}
          >
            <BrandLogo
              variant="favicon"
              size={28}
              className="header-brand-logo"
              alt=""
              aria-hidden="true"
            />
            <span className="header-brand-name">
              {title ?? (
                <>
                  {APP_NAME_MARK.base}
                  <span className="header-brand-accent">{APP_NAME_MARK.accent}</span>
                </>
              )}
            </span>
          </button>
        )}
      </div>

      <div className="header-actions">
        {actions}
        {shouldShowSync && <SyncStatusPill />}
        {shouldShowNotifications && <NotificationBell />}
      </div>
    </header>
  )
}
