import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Home, ShoppingCart, Users, Plus, Menu, CalendarClock } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { ROUTES } from '@/config/routes.config'
import { OPEN_SIDE_NAV_EVENT } from '@/config/events.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible'
import { FEATURES } from '@/config/features'
import './BottomNav.css'

type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

interface NavItem {
  to: string
  icon: IconType
  label: string
  end?: boolean
}

function NavTab({ to, icon: Icon, label, end }: NavItem) {
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
        <span className="bnav__icon">
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
    { to: ROUTES.DASHBOARD, icon: Home, label: t.home ?? 'Home' },
    { to: ROUTES.SALES, icon: ShoppingCart, label: t.salesHub ?? 'Sales' },
    ...(FEATURES.V2_APPOINTMENTS.enabled
      ? [{ to: ROUTES.APPOINTMENTS, icon: CalendarClock, label: t.appointments ?? 'Calendar' }]
      : []),
    { to: ROUTES.PARTIES, icon: Users, label: t.parties },
  ]

  // Total cells = nav items + the Create button + the Menu button — the
  // indicator's width/position are percentages of this full cell count so it
  // aligns with the flex grid regardless of the Appointments feature flag.
  const totalCells = items.length + 2
  const activeIndex = items.findIndex((item) => {
    const end = item.end ?? item.to === ROUTES.DASHBOARD
    return end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  })

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
          {items.map((item, i) => (
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
                <Plus size={20} strokeWidth={2.5} aria-hidden="true" />
              </span>
              <span className="bnav__label">{t.create ?? 'Create'}</span>
            </button>
          </li>
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
