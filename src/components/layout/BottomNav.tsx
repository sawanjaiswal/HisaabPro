import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { House, Users, Package, Menu, Plus } from 'lucide-react'
import type { ComponentType } from 'react'
import { ROUTES } from '@/config/routes.config'
import { OPEN_SIDE_NAV_EVENT } from '@/config/events.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible'
import './BottomNav.css'

interface NavItem {
  to: string
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
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
        {({ isActive }) => (
          <>
            <span className="bnav__icon">
              <Icon size={24} strokeWidth={isActive ? 2.25 : 1.9} aria-hidden="true" />
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
    { to: ROUTES.DASHBOARD, icon: House, label: t.home ?? 'Home' },
    { to: ROUTES.PARTIES, icon: Users, label: t.customers ?? 'Customers' },
    { to: ROUTES.PRODUCTS, icon: Package, label: t.products ?? 'Products' },
  ]

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
                <Menu size={24} strokeWidth={1.9} aria-hidden="true" />
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
