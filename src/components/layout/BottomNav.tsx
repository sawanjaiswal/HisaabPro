import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { ROUTES } from '@/config/routes.config'
import { OPEN_SIDE_NAV_EVENT } from '@/config/events.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible'
import './BottomNav.css'

type NavIconProps = SVGProps<SVGSVGElement> & { active?: boolean; size?: number }

/**
 * Modern 2026 Home Icon — Sleek outline with active curved silhouette
 */
function HomeNavIcon({ active, size = 22, ...props }: NavIconProps) {
  if (active) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        {...props}
      >
        <path d="M10.8 2.67a2 2 0 0 1 2.4 0l7.2 5.4a2 2 0 0 1 .8 1.6V19a2 2 0 0 1-2 2h-3.5a1 1 0 0 1-1-1v-4.5a1.5 1.5 0 0 0-1.5-1.5h-2.4a1.5 1.5 0 0 0-1.5 1.5V20a1 1 0 0 1-1 1H4.8a2 2 0 0 1-2-2V9.67a2 2 0 0 1 .8-1.6l7.2-5.4z" />
      </svg>
    )
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3.5 10.2 10.8 4.2a2 2 0 0 1 2.4 0l7.3 6V19a2 2 0 0 1-2 2h-3.8a1 1 0 0 1-1-1v-4.5a1.2 1.2 0 0 0-1.2-1.2h-3a1.2 1.2 0 0 0-1.2 1.2V20a1 1 0 0 1-1 1H5.5a2 2 0 0 1-2-2V10.2z" />
    </svg>
  )
}

/**
 * Modern 2026 Customers / People Icon
 */
function CustomersNavIcon({ active, size = 22, ...props }: NavIconProps) {
  if (active) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        {...props}
      >
        <circle cx="9" cy="7" r="4" />
        <path d="M2.5 19.5c0-3.3 3-6 6.5-6s6.5 2.7 6.5 6a1.5 1.5 0 0 1-1.5 1.5h-10a1.5 1.5 0 0 1-1.5-1.5z" />
        <path d="M17.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-1 3.5c1.8.3 3.6 1.4 4.5 3.1.3.6.5 1.2.5 1.9a1.5 1.5 0 0 1-1.5 1.5h-2.8a3 3 0 0 0 .3-1.5c0-1.8-.7-3.4-2-4.5.3-.2.7-.4 1-.5z" opacity="0.8" />
      </svg>
    )
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M16 20.5v-1.2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1.2" />
      <circle cx="9" cy="7.5" r="3.8" />
      <path d="M22 20.5v-1.2a3.8 3.8 0 0 0-2.8-3.6" />
      <path d="M15.5 3.8a3.8 3.8 0 0 1 0 7.4" />
    </svg>
  )
}

/**
 * Modern 2026 Products / Catalog 3D Package Icon
 */
function ProductsNavIcon({ active, size = 22, ...props }: NavIconProps) {
  if (active) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        {...props}
      >
        <path d="M11 2.36a2 2 0 0 1 2 0l7 4.04a2 2 0 0 1 1 1.74v7.72a2 2 0 0 1-1 1.74l-7 4.04a2 2 0 0 1-2 0l-7-4.04a2 2 0 0 1-1-1.74V8.14a2 2 0 0 1 1-1.74l7-4.04zm1 1.74L5.8 7.6 12 11.2l6.2-3.6L12 4.1zm-7.5 5v6.5l6.5 3.7V12.9L4.5 9.1zm15 0-6.5 3.8v6.4l6.5-3.7V9.1z" />
      </svg>
    )
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.4 7.2 8.6 5 8.6-5" />
      <path d="M12 12.2V21.6" />
    </svg>
  )
}

/**
 * Modern 2026 Menu / Staggered Rounded Bars Icon
 */
function MenuNavIcon({ size = 22, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <line x1="3.5" y1="6.5" x2="20.5" y2="6.5" />
      <line x1="3.5" y1="12" x2="14.5" y2="12" />
      <line x1="3.5" y1="17.5" x2="20.5" y2="17.5" />
    </svg>
  )
}

interface NavItem {
  to: string
  icon: ComponentType<NavIconProps>
  label: string
  end?: boolean
  iconClassName?: string
}

function NavTab({ to, icon: Icon, label, end, iconClassName }: NavItem) {
  return (
    <li className="bnav__cell">
      <NavLink
        to={to}
        end={end ?? to === ROUTES.DASHBOARD}
        className={({ isActive }) =>
          `bnav__tab${isActive ? ' bnav__tab--active' : ''}`
        }
        aria-label={label}
      >
        {({ isActive }) => (
          <>
            <span className={`bnav__icon${iconClassName ? ` ${iconClassName}` : ''}`}>
              <Icon size={22} active={isActive} aria-hidden="true" />
            </span>
            <span className="bnav__label">{label}</span>
          </>
        )}
      </NavLink>
    </li>
  )
}

export function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLanguage()
  const keyboardOpen = useKeyboardVisible()

  const items: readonly NavItem[] = [
    { to: ROUTES.DASHBOARD, icon: HomeNavIcon, label: t.home ?? 'Home' },
    { to: ROUTES.PARTIES, icon: CustomersNavIcon, label: t.customers ?? 'Customers' },
    { to: ROUTES.PRODUCTS, icon: ProductsNavIcon, label: t.products ?? 'Products' },
  ]

  // Total cells = nav items + the Create button + the Menu button — the
  // indicator's width/position are percentages of this full cell count so it
  // aligns with the flex grid regardless of the Appointments feature flag.
  // Render order interleaves Create between the nav items so the lime "+"
  // circle lands in the visual center of the bar (last nav item — Parties —
  // moves after Create); the indicator's cell position is remapped to match.
  const totalCells = items.length + 2
  const lastItemIndex = items.length - 1
  const beforeItems = items.slice(0, lastItemIndex)
  const lastItem = items[lastItemIndex]
  const itemsIndex = items.findIndex((item) => {
    const end = item.end ?? item.to === ROUTES.DASHBOARD
    return end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  })
  const activeIndex = itemsIndex < 0 ? -1 : itemsIndex < lastItemIndex ? itemsIndex : lastItemIndex + 1

  const openSideNav = () => window.dispatchEvent(new Event(OPEN_SIDE_NAV_EVENT))

  return createPortal(
    <div className={`bnav-root${keyboardOpen ? ' bnav-root--hidden' : ''}`} data-keyboard-open={keyboardOpen ? 'true' : 'false'}>
      <nav className="bnav" aria-label="Main navigation" aria-hidden={keyboardOpen}>
        <ul className="bnav__items">
          {activeIndex >= 0 && (
            <span
              className="bnav__indicator"
              aria-hidden="true"
              style={{
                width: `calc(100% / ${totalCells})`,
                left: `calc(100% / ${totalCells} * ${activeIndex})`,
              }}
            />
          )}
          {beforeItems.map((item, i) => (
            <NavTab key={item.to} {...item} end={i === 0} />
          ))}
          <li className="bnav__cell">
            <button
              type="button"
              className="bnav__tab bnav__tab--create"
              onClick={() => navigate(`${ROUTES.INVOICE_CREATE}?type=SALE`)}
              aria-label={t.createInvoice ?? 'Create new invoice'}
              title={t.createInvoice ?? 'Create new invoice'}
            >
              <span className="bnav__icon bnav__icon--create">
                <Plus size={24} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <span className="bnav__label">{t.create ?? 'Create'}</span>
            </button>
          </li>
          {lastItem && <NavTab key={lastItem.to} {...lastItem} end={false} />}
          <li className="bnav__cell">
            <button
              type="button"
              className="bnav__tab"
              onClick={openSideNav}
              aria-label={t.menu ?? 'More'}
            >
              <span className="bnav__icon">
                <MenuNavIcon size={22} aria-hidden="true" />
              </span>
              <span className="bnav__label">{t.menu ?? 'More'}</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>,
    document.body,
  )
}
