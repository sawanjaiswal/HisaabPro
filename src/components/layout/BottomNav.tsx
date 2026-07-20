import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Users, Plus, Menu, Package } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { ROUTES } from '@/config/routes.config'
import { OPEN_SIDE_NAV_EVENT } from '@/config/events.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible'
import './BottomNav.css'

type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

/**
 * Solid house with a door cut into the bottom edge. The door is a concave
 * notch in the single fill path — not a separate sub-path — so it reads as a
 * proper doorway at any fill colour without the fragile paint-order "punch"
 * trick lucide's House needs.
 */
function HouseSolidIcon({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M11.06 3.03a1.5 1.5 0 0 1 1.88 0l7.5 6a1.5 1.5 0 0 1 .56 1.17V19a1.5 1.5 0 0 1-1.5 1.5H14.5V15a1.5 1.5 0 0 0-1.5-1.5h-2A1.5 1.5 0 0 0 9.5 15v5.5H4.5A1.5 1.5 0 0 1 3 19v-8.8a1.5 1.5 0 0 1 .56-1.17z" />
    </svg>
  )
}

interface NavItem {
  to: string
  icon: IconType
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
        <span className={`bnav__icon${iconClassName ? ` ${iconClassName}` : ''}`}>
          <Icon size={22} aria-hidden="true" />
        </span>
        <span className="bnav__label">{label}</span>
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
    { to: ROUTES.DASHBOARD, icon: HouseSolidIcon, label: t.home ?? 'Home', iconClassName: 'bnav__icon--home' },
    { to: ROUTES.PARTIES, icon: Users, label: t.customers ?? 'Customers' },
    { to: ROUTES.PRODUCTS, icon: Package, label: t.products ?? 'Products' },
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
                <Plus size={26} strokeWidth={2.5} aria-hidden="true" />
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
                <Menu size={22} aria-hidden="true" />
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
